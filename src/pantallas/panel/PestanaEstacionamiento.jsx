// Pestaña Estacionamiento del panel: control del estacionamiento medido. Sesiones activas de todos
// los vecinos en tiempo real (patente, zona, fin, minutos restantes, vecino e importe), resumen del
// día y "Finalizar sesión" con confirmación: termina la sesión ahora y libera la patente en la misma
// transacción, como "Terminar ahora" del vecino.
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import { finalizarSesionAdmin } from '../../datos/repositorioPanel';
import { useComando } from '../../datos/useComando';
import { useResumenAdmin } from '../../datos/useAdmin';
import { useAhora } from '../../datos/useAhora';
import { colores, espacio, radios } from '../../tema/tokens';
import {
  Aviso, Boton, Campo, Cargando, Dialogo, ErrorCarga, EtiquetaEstado, FilaDato, Seccion, Tarjeta,
  Texto, Vacio, useAvisoFlotante,
} from '../../ui';
import { ETIQUETAS } from '../../../shared/constantes.mjs';
import { codigoVecino, dinero, hora } from '../../../shared/formato.mjs';
import { Grilla, Indicadores, accionPanel, estilosPanel, plural } from './comun';

const POR_PAGINA = 12;
const clave = (s) => `${s.uid}/${s.id}`;

function minutosRestantes(sesion, ahora) {
  return Math.max(0, Math.ceil((sesion.fin - ahora) / 60_000));
}

function textoRestante(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function coincide(sesion, texto) {
  if (!texto) return true;
  const t = texto.toLocaleUpperCase('es-AR').replace(/[\s…-]/g, '');
  return [sesion.patente, codigoVecino(sesion.uid).replace('…', ''), sesion.zonaNombre]
    .some((v) => typeof v === 'string' && v.toLocaleUpperCase('es-AR').replace(/[\s-]/g, '').includes(t));
}

function Patente({ patente, grande = false }) {
  return (
    <View style={[estilos.patente, grande && estilos.patenteGrande]}>
      <Texto variante={grande ? 'titulo3' : 'chico'} peso="700" estilo={estilos.patenteTexto}>
        {patente}
      </Texto>
    </View>
  );
}

function SesionPanel({ sesion, ahora, porVencerMin, onFinalizar }) {
  const restante = minutosRestantes(sesion, ahora);
  const porVencer = restante <= porVencerMin;
  const zona = ETIQUETAS.zonas[sesion.zona] ?? sesion.zona;
  return (
    <Tarjeta
      tono={porVencer ? 'alerta' : 'normal'}
      etiquetaAccesible={`Sesión de ${sesion.patente}`}
      testID={`sesion-panel-${sesion.id}`}
      estilo={estilosPanel.celda}
    >
      <View style={estilos.cabecera}>
        <Patente patente={sesion.patente} grande />
        <EtiquetaEstado
          texto={porVencer ? 'Por vencer' : 'Activa'}
          tono={porVencer ? 'alerta' : 'exito'}
          sobreColor={porVencer}
          testID={`estado-sesion-panel-${sesion.id}`}
        />
      </View>
      <Texto variante="chico" color={colores.textoSuave} numberOfLines={1}>
        {[sesion.zonaNombre, zona ? `Zona ${zona}` : null].filter(Boolean).join(' · ')}
      </Texto>
      <View style={estilos.cifras}>
        <View style={estilos.cifra}>
          <Texto variante="chico" color={colores.textoSuave}>Quedan</Texto>
          <Texto variante="titulo2" testID={`restante-sesion-panel-${sesion.id}`}>{textoRestante(restante)}</Texto>
        </View>
        <View style={estilos.cifra}>
          <Texto variante="chico" color={colores.textoSuave}>Termina</Texto>
          <Texto variante="titulo2">{hora(sesion.fin)}</Texto>
        </View>
        <View style={estilos.cifra}>
          <Texto variante="chico" color={colores.textoSuave}>Inició</Texto>
          <Texto variante="titulo2" color={colores.textoSuave}>{hora(sesion.inicio)}</Texto>
        </View>
      </View>
      <Texto variante="chico" color={colores.textoSuave}>
        {[
          `Vecino ${codigoVecino(sesion.uid)}`,
          dinero(sesion.importe),
          sesion.extensiones ? plural(sesion.extensiones, 'extensión', 'extensiones') : null,
        ].filter(Boolean).join(' · ')}
      </Texto>
      <View style={estilosPanel.empujar} />
      <Boton
        titulo="Finalizar sesión"
        icono="cerrar"
        variante="contorno"
        ancho="completo"
        onPress={() => onFinalizar(sesion)}
        etiquetaAccesible={`Finalizar la sesión de ${sesion.patente}`}
        testID={`finalizar-sesion-panel-${sesion.id}`}
      />
    </Tarjeta>
  );
}

export default function PestanaEstacionamiento({ control, activas, onReintentar }) {
  const aviso = useAvisoFlotante();
  const ahora = useAhora(15_000);
  const config = useMunicipal((s) => s.config);
  const { cargando, errores } = control;
  // Una sesión nueva, extendida o finalizada cambia la recaudación y las sesiones del día.
  const senal = control.sesiones.map((s) => `${s.id}:${s.actualizadoEn}`).join('|');
  const { resumen, cargando: calculando, error: errorResumen } = useResumenAdmin(senal);
  const [busqueda, setBusqueda] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [dialogo, setDialogo] = useState(null);   // la sesión a finalizar
  const patenteFinalizada = useRef('');

  const finalizar = useComando(finalizarSesionAdmin, {
    ...accionPanel('finalizar_sesion'),
    alExito: () => {
      aviso.mostrar(`Sesión de ${patenteFinalizada.current} finalizada. La patente quedó libre.`);
      setDialogo(null);
    },
  });

  const visibles = useMemo(() => activas.filter((s) => coincide(s, busqueda.trim())), [activas, busqueda]);
  const enCurso = useMemo(() => activas.reduce((t, s) => t + (s.importe || 0), 0), [activas]);

  // La sesión del diálogo con sus datos más recientes: si el vecino la extiende o la termina, se ve.
  const actual = dialogo ? control.sesiones.find((s) => clave(s) === clave(dialogo)) ?? dialogo : null;
  const yaTermino = actual ? actual.fin <= ahora : false;

  const abrir = (sesion) => {
    finalizar.limpiar();
    setDialogo(sesion);
  };
  const cerrar = () => {
    if (finalizar.ocupado) return;
    finalizar.limpiar();
    setDialogo(null);
  };
  const confirmar = () => {
    if (!actual || yaTermino) return;
    patenteFinalizada.current = actual.patente;
    finalizar.ejecutar({ uid: actual.uid, sesionId: actual.id });
  };

  const est = resumen?.estacionamientoDia;
  const porVencerMin = config?.avisoEstacionamientoMin ?? 5;

  let lista;
  if (cargando.sesiones) lista = <Cargando lineas={3} mensaje="Cargando las sesiones activas…" />;
  else if (errores.sesiones && !activas.length) {
    lista = <ErrorCarga error={errores.sesiones} onReintentar={onReintentar} testID="error-sesiones-panel" />;
  } else if (!activas.length) {
    lista = <Vacio icono="estacionamiento" titulo="No hay sesiones activas" testID="vacio-sesiones-panel" />;
  } else {
    lista = (
      <>
        <View style={estilos.busqueda}>
          <Campo
            etiqueta="Buscar por patente, zona o vecino"
            valor={busqueda}
            onCambio={(v) => { setBusqueda(v); setMostrar(POR_PAGINA); }}
            placeholder="Por ejemplo: AB123CD"
            id="buscar-sesiones-panel"
            testID="buscar-sesiones-panel"
          />
        </View>
        {!visibles.length ? (
          <Vacio
            icono="buscar"
            titulo="Ninguna sesión coincide con la búsqueda"
            accion={{ titulo: 'Ver todas', onPress: () => setBusqueda('') }}
            testID="vacio-filtro-sesiones"
          />
        ) : (
          <Grilla minimo={280} testID="lista-sesiones-panel">
            {visibles.slice(0, mostrar).map((s) => (
              <SesionPanel key={clave(s)} sesion={s} ahora={ahora} porVencerMin={porVencerMin} onFinalizar={abrir} />
            ))}
          </Grilla>
        )}
        {visibles.length > mostrar ? (
          <Boton
            titulo={`Ver más sesiones (quedan ${visibles.length - mostrar})`}
            variante="secundario"
            ancho="completo"
            onPress={() => setMostrar((n) => n + POR_PAGINA)}
            testID="ver-mas-sesiones-panel"
          />
        ) : null}
      </>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <Indicadores
        testID="resumen-estacionamiento"
        items={[
          {
            clave: 'activas', icono: 'estacionamiento', etiqueta: 'Sesiones activas',
            valor: String(activas.length), detalle: activas.length ? `${dinero(enCurso)} en curso` : 'Ningún vehículo estacionado',
            cargando: cargando.sesiones, testID: 'sesiones-activas-total',
          },
          {
            clave: 'hoy', icono: 'reloj', etiqueta: 'Sesiones iniciadas hoy', valor: String(est?.sesiones ?? 0),
            detalle: est ? plural(est.extensiones, 'extensión', 'extensiones') : '', cargando: calculando && !resumen, testID: 'sesiones-hoy',
          },
          {
            clave: 'recaudado', icono: 'tributo', tono: 'exito', etiqueta: 'Recaudado hoy en estacionamiento',
            valor: dinero(est?.total), detalle: 'Sesiones y extensiones', cargando: calculando && !resumen,
            testID: 'recaudado-estacionamiento-hoy',
          },
        ]}
      />
      {errorResumen && !resumen ? (
        <ErrorCarga error={errorResumen} onReintentar={onReintentar} testID="error-resumen-estacionamiento" />
      ) : null}

      <Seccion
        titulo="Sesiones activas"
        accion={activas.length ? <EtiquetaEstado texto="En vivo" tono="exito" icono="reloj" /> : null}
        testID="seccion-sesiones"
      >
        {lista}
      </Seccion>

      <Dialogo
        visible={!!dialogo}
        titulo={actual ? `¿Finalizar la sesión de ${actual.patente}?` : 'Finalizar sesión'}
        onCerrar={cerrar}
        cerrable={!finalizar.ocupado}
        testID="dialogo-finalizar-sesion"
        acciones={[
          { titulo: 'Cancelar', onPress: cerrar, variante: 'secundario', deshabilitado: finalizar.ocupado, testID: 'cancelar-finalizar-sesion' },
          {
            titulo: 'Finalizar sesión',
            onPress: confirmar,
            variante: 'peligro',
            cargando: finalizar.ocupado,
            deshabilitado: yaTermino,
            testID: 'confirmar-finalizar-sesion',
          },
        ]}
      >
        {actual ? (
          <>
            <View>
              <FilaDato etiqueta="Patente" valor={actual.patente} />
              <FilaDato etiqueta="Zona" valor={actual.zonaNombre ?? '—'} />
              <FilaDato etiqueta="Vecino" valor={codigoVecino(actual.uid) || '—'} />
              <FilaDato etiqueta="Termina" valor={yaTermino ? 'Ya terminó' : `${hora(actual.fin)} (quedan ${textoRestante(minutosRestantes(actual, ahora))})`} />
              <FilaDato etiqueta="Importe pagado" valor={dinero(actual.importe)} />
            </View>
            <Texto variante="cuerpo">
              La sesión termina ahora y la patente queda libre para una nueva sesión. El importe no se reintegra.
            </Texto>
            {yaTermino ? <Aviso tono="info" mensaje="Esta sesión ya terminó." testID="sesion-ya-terminada" /> : null}
            {finalizar.error ? (
              <Aviso tono="peligro" rol="alert" mensaje={finalizar.error.message} testID="error-finalizar-sesion" />
            ) : null}
          </>
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xl },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  patente: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: colores.texto,
    borderRadius: radios.chico,
    paddingHorizontal: espacio.s,
    paddingVertical: 2,
    backgroundColor: colores.superficie,
  },
  patenteGrande: { paddingHorizontal: espacio.m },
  patenteTexto: { letterSpacing: 1.5 },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.xl, rowGap: espacio.s },
  cifra: { gap: 0 },
  busqueda: { maxWidth: 520 },
});
