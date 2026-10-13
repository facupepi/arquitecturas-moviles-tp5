// Sesión activa (S6, E3 y E4): temporizador HH:MM:SS (el `ahora` de useAhora(1000) de la pantalla, role="timer"), hora de fin,
// aviso visual cuando faltan menos de config.avisoEstacionamientoMin minutos (la notificación local
// la dispara el almacén, no esta pantalla), "Extender 15/30 min" con su importe y "Terminar ahora".
// La extensión se paga con la pasarela: medio → "Pagar $X" → "Procesando el pago…" → comprobante.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios, tipografia } from '../../tema/tokens';
import {
  Aviso, Boton, Dialogo, EtiquetaEstado, FilaDato, Tarjeta, Texto, useAvisoFlotante,
} from '../../ui';
import { useComando } from '../../datos/useComando';
import { extenderEstacionamiento, finalizarEstacionamiento } from '../../datos/repositorio';
import { EVENTOS } from '../../firebase/analytics';
import { comprobante, nuevoIdSolicitud } from '../../../shared/dominio.mjs';
import { LIMITES } from '../../../shared/constantes.mjs';
import { dinero, duracion, fechaHora, hora } from '../../../shared/formato.mjs';
import MediosDePago from '../pagos/MediosDePago';
import Procesando from '../pagos/Procesando';
import ComprobantePago from '../pagos/ComprobantePago';
import { conProcesamiento, etiquetaMedio, useMedioPago } from '../pagos/pasarela';
import { EXTENSIONES, MS_MINUTO, importeSeguro, recordatorioPorVencer, textoMinutos } from './util';

function textoRestante(ms) {
  const min = Math.ceil(ms / MS_MINUTO);
  if (ms <= 0) return 'Tu estacionamiento terminó';
  if (min <= 1) return 'Te queda menos de 1 minuto';
  if (min < 60) return `Te quedan ${min} minutos`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `Te quedan ${h} ${h === 1 ? 'hora' : 'horas'}${m ? ` y ${m} minutos` : ''}`;
}

export default function SesionActiva({ sesion, zona, umbralMin, ahora, enfocar = false }) {
  const aviso = useAvisoFlotante();
  const refTitulo = useRef(null);
  const refMedios = useRef(null);
  const medio = useMedioPago();
  const [extension, setExtension] = useState(null);   // { requestId, minutos, importe }
  const [aprobada, setAprobada] = useState(null);     // { fin, medio, fecha }: último paso de la pasarela
  const [finalizando, setFinalizando] = useState(false);

  // La pasarela muestra "Procesando el pago…" al menos 1,5 s.
  const extender = useComando(conProcesamiento(extenderEstacionamiento), {
    evento: EVENTOS.ESTACIONAMIENTO_EXTENDIDO,
    parametrosEvento: (_r, _id, minutos, _req, medioElegido) => ({ minutos, medio: medioElegido }),
  });
  // Al terminar bien, la sesión pasa al historial y esta tarjeta se desmonta: el aviso lo da alExito.
  const finalizar = useComando(finalizarEstacionamiento, {
    evento: EVENTOS.ESTACIONAMIENTO_FINALIZADO,
    alExito: () => {
      setFinalizando(false);
      aviso.mostrar({ titulo: 'Sesión terminada', cuerpo: `La patente ${sesion.patente} quedó libre.` });
    },
  });

  // Recién iniciada: el foco va al título de la tarjeta (y la página se desplaza hasta el temporizador).
  useEffect(() => {
    if (!enfocar) return;
    try { refTitulo.current?.focus?.(); } catch { /* en nativo un Text no recibe foco */ }
  }, [enfocar]);

  const restanteMs = Math.max(0, sesion.fin - ahora);
  const recordatorio = recordatorioPorVencer(sesion, ahora, umbralMin);
  const porVencer = !!recordatorio;
  const totalMs = Math.max(1, sesion.minutos * MS_MINUTO);
  const fraccion = Math.min(1, restanteMs / totalMs);
  const disponibles = LIMITES.minutosMax - sesion.minutos;
  const tarifa = zona?.tarifaHora;

  const abrirExtension = (minutos) => {
    extender.limpiar();
    medio.reiniciar();
    setAprobada(null);
    setExtension({ requestId: nuevoIdSolicitud(), minutos, importe: importeSeguro(tarifa, minutos) });
  };

  const confirmarExtension = async () => {
    if (!extension) return;
    if (!medio.validar()) {
      setTimeout(() => refMedios.current?.focus?.(), 0);
      return;
    }
    const elegido = medio.valor;
    const nueva = await extender.ejecutar(sesion.id, extension.minutos, extension.requestId, elegido);
    if (!nueva) return;
    setAprobada({ fin: nueva.fin, medio: elegido, fecha: Date.now() });
  };

  const cerrarExtension = () => {
    if (extender.ocupado) return;
    setExtension(null);
    setAprobada(null);
    extender.limpiar();
  };

  let tituloExtension = 'Extender estacionamiento';
  let accionesExtension = [
    { titulo: 'Cancelar', onPress: cerrarExtension, variante: 'secundario', testID: 'cancelar-extension' },
    {
      titulo: extension?.importe != null ? `Pagar ${dinero(extension.importe)}` : 'Confirmar',
      onPress: confirmarExtension,
      testID: 'confirmar-extension',
    },
  ];
  if (extender.ocupado) {
    accionesExtension = [];
  } else if (aprobada) {
    tituloExtension = 'Comprobante de pago';
    accionesExtension = [{ titulo: 'Listo', onPress: cerrarExtension, testID: 'listo-extension' }];
  }

  const abrirFinalizar = () => {
    finalizar.limpiar();
    setFinalizando(true);
  };

  const confirmarFinalizar = () => finalizar.ejecutar(sesion.id);

  const cerrarFinalizar = () => {
    if (finalizar.ocupado) return;
    setFinalizando(false);
    finalizar.limpiar();
  };

  return (
    // Fondo blanco siempre (contraste AA de los botones); el estado se marca con el borde izquierdo.
    <Tarjeta
      testID={`sesion-${sesion.id}`}
      estilo={[estilos.tarjeta, { borderLeftColor: porVencer ? colores.alertaAcento : colores.accion }]}
    >
      <View style={estilos.cabecera}>
        <Texto
          ref={refTitulo}
          role="heading"
          aria-level={3}
          tabIndex={-1}
          variante="titulo3"
        >
          {sesion.zonaNombre ?? zona?.nombre ?? 'Estacionamiento'}
        </Texto>
        <View style={estilos.fila}>
          <View style={estilos.patente}>
            <Texto variante="cuerpo" peso="700" color={colores.blanco} estilo={estilos.patenteTexto}>
              {sesion.patente}
            </Texto>
          </View>
          <EtiquetaEstado
            texto={porVencer ? 'Por vencer' : 'En curso'}
            tono={porVencer ? 'alerta' : 'exito'}
            icono={porVencer ? 'alerta' : 'reloj'}
          />
        </View>
      </View>

      <View style={estilos.reloj}>
        <Texto variante="chico" color={colores.textoSuave}>
          Tiempo restante
        </Texto>
        <View role="timer" aria-label={textoRestante(restanteMs)} testID={`temporizador-${sesion.id}`}>
          <Texto aria-hidden estilo={[estilos.temporizador, porVencer && { color: colores.alerta }]}>
            {duracion(restanteMs / 1000)}
          </Texto>
        </View>
        <View style={estilos.barra} aria-hidden>
          <View
            style={[
              estilos.relleno,
              { width: `${Math.round(fraccion * 100)}%`, backgroundColor: porVencer ? colores.alertaAcento : colores.accion },
            ]}
          />
        </View>
      </View>

      {porVencer ? (
        <Aviso
          tono="alerta"
          rol="alert"
          titulo={recordatorio.titulo}
          mensaje={`${textoRestante(restanteMs)}. Si necesitás más tiempo, extendelo ahora.`}
          testID="aviso-por-vencer"
        />
      ) : null}

      <View>
        <FilaDato etiqueta="Termina a las" valor={`${hora(sesion.fin)} h`} testID={`fin-${sesion.id}`} />
        <FilaDato etiqueta="Tiempo pagado" valor={textoMinutos(sesion.minutos)} testID={`minutos-pagados-${sesion.id}`} />
        <FilaDato etiqueta="Pagaste en total" valor={dinero(sesion.importe)} />
      </View>

      <View style={estilos.acciones}>
        {EXTENSIONES.map((m, i) => {
          const precio = importeSeguro(tarifa, m);
          return (
            <View key={m} style={estilos.accion}>
              <Boton
                titulo={precio == null ? `Extender ${m} min` : `Extender ${m} min · ${dinero(precio)}`}
                variante={i === 0 ? 'primario' : 'secundario'}
                icono="mas"
                deshabilitado={m > disponibles}
                onPress={() => abrirExtension(m)}
                ancho="completo"
                testID={`extender-${m}-${sesion.id}`}
              />
            </View>
          );
        })}
      </View>
      {disponibles < EXTENSIONES[0] ? (
        <Texto variante="chico" color={colores.textoSuave}>
          Llegaste al máximo de 4 horas por sesión.
        </Texto>
      ) : null}
      <Boton
        titulo="Terminar ahora"
        variante="texto"
        icono="cerrar"
        onPress={abrirFinalizar}
        testID={`finalizar-${sesion.id}`}
      />

      <Dialogo
        visible={!!extension}
        titulo={tituloExtension}
        onCerrar={cerrarExtension}
        cerrable={!extender.ocupado}
        testID="dialogo-extension"
        pie={extender.error && !extender.ocupado && !aprobada ? (
          <Aviso tono="peligro" rol="alert" titulo="No se pudo extender" mensaje={extender.error.message} testID="error-extension" />
        ) : null}
        acciones={accionesExtension}
      >
        {extension && extender.ocupado ? (
          <Procesando importe={extension.importe} medio={medio.valor} />
        ) : extension && aprobada ? (
          <ComprobantePago
            enfocar
            numero={comprobante('EXT', extension.requestId)}
            bajada={`Sumaste ${textoMinutos(extension.minutos)}.`}
            filas={[
              { etiqueta: 'Patente', valor: sesion.patente },
              { etiqueta: 'Tiempo extra', valor: textoMinutos(extension.minutos) },
              { etiqueta: 'Ahora termina a las', valor: `${hora(aprobada.fin)} h` },
              { etiqueta: 'Importe', valor: dinero(extension.importe) },
              { etiqueta: 'Medio de pago', valor: etiquetaMedio(aprobada.medio), testID: 'comprobante-medio' },
              { etiqueta: 'Fecha y hora', valor: fechaHora(aprobada.fecha) },
            ]}
          />
        ) : extension ? (
          <>
            <View>
              <FilaDato etiqueta="Patente" valor={sesion.patente} />
              <FilaDato etiqueta="Tiempo extra" valor={textoMinutos(extension.minutos)} />
              <FilaDato etiqueta="Nuevo fin" valor={`${hora(sesion.fin + extension.minutos * MS_MINUTO)} h`} />
              <FilaDato etiqueta="Importe" valor={dinero(extension.importe)} />
            </View>
            <MediosDePago ref={refMedios} valor={medio.valor} onCambio={medio.elegir} error={medio.error} />
            <Texto variante="chico" color={colores.textoSuave} testID="numero-operacion">
              {`Número de operación: ${comprobante('EXT', extension.requestId)}`}
            </Texto>
          </>
        ) : null}
      </Dialogo>

      <Dialogo
        visible={finalizando}
        titulo="¿Terminar el estacionamiento?"
        onCerrar={cerrarFinalizar}
        cerrable={!finalizar.ocupado}
        testID="dialogo-finalizar"
        pie={finalizar.error ? (
          <Aviso tono="peligro" rol="alert" titulo="No se pudo terminar" mensaje={finalizar.error.message} testID="error-finalizar" />
        ) : null}
        acciones={[
          { titulo: 'Seguir estacionado', onPress: cerrarFinalizar, variante: 'secundario', deshabilitado: finalizar.ocupado, testID: 'cancelar-finalizar' },
          { titulo: 'Terminar ahora', onPress: confirmarFinalizar, variante: 'peligro', cargando: finalizar.ocupado, testID: 'confirmar-finalizar' },
        ]}
      >
        <Texto variante="cuerpo">
          {`La patente ${sesion.patente} queda libre y la sesión pasa al historial.`}
        </Texto>
        <Aviso tono="alerta" mensaje="No se reintegra el tiempo no usado." />
      </Dialogo>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderLeftWidth: 5 },
  cabecera: { gap: espacio.s },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, flexWrap: 'wrap' },
  patente: {
    backgroundColor: colores.texto,
    borderRadius: radios.chico,
    paddingHorizontal: espacio.m,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colores.blanco,
  },
  patenteTexto: { letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  reloj: { gap: espacio.xs, alignItems: 'flex-start' },
  temporizador: {
    fontFamily: tipografia.familia,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colores.accionOscuro,
  },
  barra: { alignSelf: 'stretch', height: 8, borderRadius: radios.pildora, backgroundColor: 'rgba(0,92,136,0.15)', overflow: 'hidden' },
  relleno: { height: '100%', borderRadius: radios.pildora },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  accion: { flexGrow: 1, flexBasis: 200 },
});
