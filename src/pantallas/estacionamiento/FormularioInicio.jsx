// Inicio de una sesión de estacionamiento (S6, E2): patente, tiempo, importe en vivo y
// confirmación con pago simulado. La patente se valida en el cliente con normalizarPatente (la
// misma expresión que las reglas) y el error va debajo del campo; "patente ocupada" también.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios, tipografia } from '../../tema/tokens';
import {
  Aviso, Boton, Campo, Dialogo, FilaDato, Icono, Selector, Texto, useAvisoFlotante,
} from '../../ui';
import { useComando } from '../../datos/useComando';
import { iniciarEstacionamiento } from '../../datos/repositorio';
import { EVENTOS } from '../../firebase/analytics';
import { TRAZAS } from '../../firebase/rendimiento';
import { comprobante, normalizarPatente, nuevoIdSolicitud } from '../../../shared/dominio.mjs';
import { dinero, hora } from '../../../shared/formato.mjs';
import { MS_MINUTO, OPCIONES_MINUTOS, horarioEstricto, importeSeguro, textoMinutos, zonaEnHorario } from './util';

const OPCIONES = OPCIONES_MINUTOS.map((n) => ({ valor: String(n), etiqueta: textoMinutos(n) }));

const MENSAJE_FUERA_DE_HORARIO = 'Esta zona no cobra en este momento. Elegí otra zona o volvé dentro del horario indicado.';

export default function FormularioInicio({ zona, config, ahora, alIniciar, patente: patenteExterna, onPatente }) {
  const [patenteLocal, setPatenteLocal] = useState('');
  const patente = patenteExterna ?? patenteLocal;
  const setPatente = onPatente ?? setPatenteLocal;
  const refPatente = useRef(null);
  const aviso = useAvisoFlotante();
  const [minutos, setMinutos] = useState('60');
  const [errorPatente, setErrorPatente] = useState(null);
  const [errorBoton, setErrorBoton] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);   // { requestId, patente, minutos, zona, importe }

  const inicio = useComando(iniciarEstacionamiento, {
    evento: EVENTOS.ESTACIONAMIENTO_INICIADO,
    parametrosEvento: (_r, datos) => ({ zona: datos?.zonaId, minutos: datos?.minutos }),
    traza: TRAZAS.INICIO_ESTACIONAMIENTO,
  });

  const min = Number(minutos);
  const importe = zona ? importeSeguro(zona.tarifaHora, min) : null;
  const cobra = zona ? zonaEnHorario(zona, ahora) : false;
  const estricto = horarioEstricto(config);

  // Lleva el foco a la patente: el navegador la trae a la vista (estaba fuera de pantalla, arriba
  // del botón) y el lector anuncia el error que tiene debajo.
  // Con el diálogo abierto se espera a que se cierre y devuelva el foco, para no pisarlo después.
  const enfocarPatente = (demora = 0) => setTimeout(() => refPatente.current?.focus?.(), demora);

  // "Patente ocupada" pertenece al campo: se cierra el diálogo y el error queda debajo de la patente.
  useEffect(() => {
    if (inicio.error?.campo === 'patente') {
      setConfirmacion(null);
      enfocarPatente(400);
    }
  }, [inicio.error]);

  // Al cambiar de zona o de tiempo, el aviso del botón ya no aplica.
  useEffect(() => { setErrorBoton(null); }, [zona?.id, minutos]);

  const cambiarPatente = (texto) => {
    setPatente(texto);
    setErrorPatente(null);
    if (inicio.error) inicio.limpiar();
  };

  const pedirConfirmacion = () => {
    inicio.limpiar();
    setErrorBoton(null);
    let normalizada;
    try {
      normalizada = normalizarPatente(patente);
    } catch (e) {
      setErrorPatente(e.message);
      enfocarPatente();
      return;
    }
    setErrorPatente(null);
    if (!zona) {
      setErrorBoton('Elegí una zona en el mapa o en la lista.');
      return;
    }
    if (estricto && !cobra) {
      setErrorBoton(MENSAJE_FUERA_DE_HORARIO);
      return;
    }
    setPatente(normalizada);
    // El requestId se genera al abrir el diálogo y se reutiliza en los reintentos (sección 0).
    setConfirmacion({ requestId: nuevoIdSolicitud(), patente: normalizada, minutos: min, zona, importe });
  };

  const confirmar = async () => {
    if (!confirmacion) return;
    const sesion = await inicio.ejecutar(
      { zonaId: confirmacion.zona.id, patente: confirmacion.patente, minutos: confirmacion.minutos },
      confirmacion.requestId,
    );
    if (!sesion) return;
    setConfirmacion(null);
    // En el celular el aviso va arriba (Marco), así no tapa "Extender 15 min" de la sesión nueva.
    aviso.mostrar({
      titulo: 'Estacionamiento iniciado',
      cuerpo: `Patente ${sesion.patente} hasta las ${hora(sesion.fin)}. Comprobante ${comprobante('EST', sesion.id)}.`,
    });
    alIniciar?.(sesion);
  };

  const cerrarConfirmacion = () => {
    if (inicio.ocupado) return;
    setConfirmacion(null);
    inicio.limpiar();
  };

  const errorDialogo = inicio.error && inicio.error.campo !== 'patente' ? inicio.error : null;

  return (
    <View style={estilos.formulario}>
      <Campo
        id="campo-patente"
        testID="campo-patente"
        etiqueta="Patente del vehículo"
        valor={patente}
        onCambio={cambiarPatente}
        mayusculas
        maxLargo={10}
        placeholder="AB123CD"
        ayuda="Como figura en la chapa, por ejemplo ABC123 o AB123CD."
        error={errorPatente ?? inicio.errorDe('patente')}
        ref={refPatente}
        teclaEnter="done"
      />

      <Selector
        etiqueta="¿Cuánto tiempo vas a estacionar?"
        valor={minutos}
        opciones={OPCIONES}
        onCambio={setMinutos}
        testID="minutos"
      />

      <View style={estilos.importe} aria-live="polite">
        <View style={estilos.importeTextos}>
          <Texto variante="chico" color={colores.textoSuave}>
            Vas a pagar
          </Texto>
          <Texto variante="numero" testID="importe" estilo={estilos.numero}>
            {importe == null ? '—' : dinero(importe)}
          </Texto>
        </View>
        {zona ? (
          <View style={estilos.importeDetalle}>
            <Texto variante="chico" color={colores.textoSuave}>
              {`${dinero(zona.tarifaHora)} por hora × ${textoMinutos(min)}`}
            </Texto>
            <Texto variante="chico" color={colores.textoSuave}>
              {`Si empezás ahora, termina a las ${hora(ahora + min * MS_MINUTO)}`}
            </Texto>
          </View>
        ) : null}
      </View>

      <View style={estilos.accion}>
        <Boton
          titulo="Iniciar estacionamiento"
          icono="estacionamiento"
          onPress={pedirConfirmacion}
          ancho="completo"
          testID="iniciar-estacionamiento"
        />
        {!errorBoton && (errorPatente || inicio.errorDe('patente')) ? (
          <View style={estilos.errorFila}>
            <Icono nombre="alerta" tamano={16} color={colores.peligro} />
            <Texto variante="chico" peso="600" color={colores.peligro} testID="resumen-error-patente" estilo={estilos.flexible}>
              Revisá la patente, más arriba.
            </Texto>
          </View>
        ) : null}
        {errorBoton ? (
          <View style={estilos.errorFila}>
            <Icono nombre="alerta" tamano={16} color={colores.peligro} />
            <Texto role="alert" variante="chico" peso="600" color={colores.peligro} testID="error-iniciar" estilo={estilos.flexible}>
              {errorBoton}
            </Texto>
          </View>
        ) : null}
      </View>

      <Dialogo
        visible={!!confirmacion}
        titulo="Confirmá tu estacionamiento"
        onCerrar={cerrarConfirmacion}
        cerrable={!inicio.ocupado}
        testID="dialogo-estacionamiento"
        pie={errorDialogo ? (
          <Aviso tono="peligro" rol="alert" titulo="No se pudo iniciar" mensaje={errorDialogo.message} testID="error-estacionamiento" />
        ) : null}
        acciones={[
          { titulo: 'Cancelar', onPress: cerrarConfirmacion, variante: 'secundario', deshabilitado: inicio.ocupado, testID: 'cancelar-estacionamiento' },
          {
            titulo: confirmacion?.importe != null ? `Pagar ${dinero(confirmacion.importe)}` : 'Confirmar',
            onPress: confirmar,
            cargando: inicio.ocupado,
            testID: 'confirmar-estacionamiento',
          },
        ]}
      >
        {confirmacion ? (
          <>
            <View>
              <FilaDato etiqueta="Zona" valor={confirmacion.zona.nombre} />
              <FilaDato etiqueta="Patente" valor={confirmacion.patente} testID="confirmacion-patente" />
              <FilaDato etiqueta="Tiempo" valor={textoMinutos(confirmacion.minutos)} />
              <FilaDato etiqueta="Termina aproximadamente" valor={`${hora(Date.now() + confirmacion.minutos * MS_MINUTO)} h`} />
              <FilaDato etiqueta="Importe" valor={dinero(confirmacion.importe)} testID="confirmacion-importe" />
            </View>
            <Aviso tono="aviso" icono="info" mensaje="Pago simulado, sin cargos reales." />
            <Texto variante="chico" color={colores.textoSuave}>
              {`Código de operación: ${comprobante('EST', confirmacion.requestId)}`}
            </Texto>
          </>
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espacio.l },
  importe: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: espacio.s,
    padding: espacio.l,
    borderRadius: radios.medio,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  importeTextos: { gap: 0 },
  numero: { fontFamily: tipografia.familia, color: colores.accionOscuro },
  importeDetalle: { gap: 2, flexShrink: 1 },
  accion: { gap: espacio.s },
  errorFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1 },
});
