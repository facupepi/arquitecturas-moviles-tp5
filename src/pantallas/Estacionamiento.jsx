// Estacionamiento medido (S6, sección 8.9): E1 mapa de zonas con tarifa, horario y control de
// horario; E2 inicio con patente y minutos; E3 temporizador con aviso antes de vencer; E4 extensión
// y finalización anticipada; historial con "Cargar más". Enlace profundo: #/estacionamiento/p1.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colores, coloresMapa, cortes, espacio, radios } from '../tema/tokens';
import {
  Aviso, Cargando, ErrorCarga, Mapa, Pantalla, Seccion, Tarjeta, Texto, Vacio,
} from '../ui';
import { useMunicipal, cargarMas } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useRuta } from '../navegacion';
import FormularioInicio from './estacionamiento/FormularioInicio';
import Historial from './estacionamiento/Historial';
import SelectorZona from './estacionamiento/SelectorZona';
import SesionActiva from './estacionamiento/SesionActiva';
import {
  horarioEstricto, puntosDeZonas, separarSesiones, umbralAviso, zonaEnHorario,
} from './estacionamiento/util';

const TITULO = 'Estacionamiento medido';
const BAJADA = 'Elegí la zona, indicá tu patente y controlá el tiempo desde el celular.';

const seleccionar = (s) => ({
  listo: s.listo,
  zonas: s.zonas,
  config: s.config,
  sesiones: s.sesiones,
  hayMas: s.hayMas.estacionamiento,
  errorZonas: s.errores.zonas ?? null,
  errorSesiones: s.errores.estacionamiento ?? null,
});

function LeyendaMapa() {
  const items = [
    { color: coloresMapa.normal, texto: 'Cobra ahora' },
    { color: coloresMapa.neutro, texto: 'Fuera de horario' },
    { color: coloresMapa.seleccionado, texto: 'Zona elegida' },
  ];
  return (
    <View style={estilos.leyenda}>
      {items.map((i) => (
        <View key={i.texto} style={estilos.leyendaItem}>
          <View style={[estilos.leyendaLinea, { backgroundColor: i.color }]} aria-hidden />
          <Texto variante="chico" color={colores.textoSuave}>
            {i.texto}
          </Texto>
        </View>
      ))}
    </View>
  );
}

function AvisoHorario({ zona, estricto, cobra }) {
  if (!zona || cobra) return null;
  if (estricto) {
    return (
      <Aviso
        tono="alerta"
        titulo="Fuera del horario de cobro"
        mensaje={`Esta zona cobra ${zona.horarioTexto?.toLowerCase() ?? 'en su horario'}. Ahora no se puede iniciar una sesión.`}
        testID="aviso-horario"
      />
    );
  }
  return (
    <Aviso
      tono="info"
      titulo="Fuera del horario de cobro"
      mensaje="Modo demostración: el control de horario está apagado, así que podés iniciar igual."
      testID="aviso-horario"
    />
  );
}

export default function Estacionamiento({ ruta }) {
  const { listo, zonas, config, sesiones, hayMas, errorZonas, errorSesiones } = useMunicipal(seleccionar);
  const { navegar } = useRuta();
  const { width } = useWindowDimensions();
  const ahora = useAhora(1000);
  // Lo que no necesita el segundo exacto (horario de las zonas, mapa) cambia cada 15 s.
  const ahoraLento = Math.floor(ahora / 15000) * 15000;
  const ancho = width >= cortes.escritorio;

  const idRuta = ruta?.id ?? null;
  const [zonaId, setZonaId] = useState(idRuta);
  const [sesionNueva, setSesionNueva] = useState(null);
  // La patente vive acá y no en el formulario: si el formulario se vuelve a montar (cambio de
  // orden de las secciones, zonas que se recargan), lo escrito no se pierde.
  const [patente, setPatente] = useState('');

  // Enlace profundo (#/estacionamiento/p2) y zona por defecto (la primera).
  useEffect(() => {
    if (idRuta && zonas.some((z) => z.id === idRuta)) setZonaId(idRuta);
  }, [idRuta, zonas]);
  useEffect(() => {
    if (zonas.length && !zonas.some((z) => z.id === zonaId)) setZonaId(zonas[0].id);
  }, [zonas, zonaId]);

  const elegirZona = (id) => {
    setZonaId(id);
    // Deja la zona en la dirección (se puede compartir), sin sumar entradas al historial.
    if (id !== idRuta) navegar('estacionamiento', id, null, { reemplazar: true });
  };

  const zona = zonas.find((z) => z.id === zonaId) ?? null;
  const estricto = horarioEstricto(config);
  const umbral = umbralAviso(config);
  const cobra = zona ? zonaEnHorario(zona, ahoraLento) : false;
  const puntos = useMemo(() => puntosDeZonas(zonas, ahoraLento), [zonas, ahoraLento]);
  const { activas, terminadas } = separarSesiones(sesiones, ahora);
  const zonaDe = (s) => zonas.find((z) => z.id === s.zonaId) ?? null;

  if (!listo) {
    return (
      <Pantalla titulo={TITULO} bajada={BAJADA} testID="pantalla-estacionamiento">
        <Cargando lineas={6} mensaje="Cargando zonas y sesiones…" testID="cargando-estacionamiento" />
      </Pantalla>
    );
  }

  const seccionActivas = (
    <Seccion titulo={activas.length > 1 ? 'Tus sesiones activas' : 'Tu sesión activa'} testID="sesiones-activas">
      {errorSesiones ? <ErrorCarga error={errorSesiones} testID="error-sesiones" /> : null}
      {activas.length ? (
        activas.map((s) => (
          <SesionActiva
            key={s.id}
            sesion={s}
            zona={zonaDe(s)}
            umbralMin={umbral}
            ahora={ahora}
            enfocar={s.id === sesionNueva}
          />
        ))
      ) : !errorSesiones ? (
        <Vacio
          icono="reloj"
          titulo="Tu próximo lugar te espera"
          mensaje="Cuando inicies una sesión, vas a ver acá el tiempo que te queda y vas a poder extenderla."
          testID="sin-sesiones"
        />
      ) : null}
    </Seccion>
  );

  let cuerpoFormulario;
  if (errorZonas) {
    cuerpoFormulario = <ErrorCarga error={errorZonas} testID="error-zonas" />;
  } else if (!zonas.length) {
    cuerpoFormulario = <Cargando lineas={4} mensaje="Cargando las zonas de estacionamiento…" testID="cargando-zonas" />;
  } else {
    cuerpoFormulario = (
      <>
        <Mapa
          puntos={puntos}
          seleccionado={zonaId}
          onSeleccionar={elegirZona}
          alto={ancho ? 320 : 240}
          etiqueta="Mapa de las zonas de estacionamiento medido de San Francisco"
          testID="mapa-estacionamiento"
        />
        <LeyendaMapa />
        <Tarjeta>
          <SelectorZona zonas={zonas} valor={zonaId} onCambio={elegirZona} ahora={ahoraLento} />
          <AvisoHorario zona={zona} estricto={estricto} cobra={cobra} />
          <FormularioInicio
            zona={zona}
            config={config}
            ahora={ahoraLento}
            patente={patente}
            onPatente={setPatente}
            alIniciar={(s) => setSesionNueva(s.id)}
          />
        </Tarjeta>
      </>
    );
  }

  const seccionFormulario = (
    <Seccion titulo={activas.length ? 'Iniciar otro estacionamiento' : 'Iniciar un estacionamiento'} testID="iniciar">
      {cuerpoFormulario}
    </Seccion>
  );

  const seccionHistorial = (
    <Seccion titulo="Historial" testID="historial">
      <Historial sesiones={terminadas} hayMas={hayMas} alCargarMas={() => cargarMas('estacionamiento')} />
    </Seccion>
  );

  return (
    <Pantalla titulo={TITULO} bajada={BAJADA} testID="pantalla-estacionamiento">
      {ancho ? (
        <View style={estilos.columnas}>
          <View style={estilos.columnaPrincipal}>{seccionFormulario}</View>
          <View style={estilos.columnaLateral}>
            {seccionActivas}
            {seccionHistorial}
          </View>
        </View>
      ) : (
        <>
          {/* En el celular, la sesión en curso va primero; si no hay, primero se inicia. Con clave
              estable, al reordenar se mueven sin volver a montarse (no se pierde la patente escrita). */}
          {(activas.length ? ['activas', 'formulario'] : ['formulario', 'activas']).map((clave) => (
            <React.Fragment key={clave}>{clave === 'activas' ? seccionActivas : seccionFormulario}</React.Fragment>
          ))}
          {seccionHistorial}
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xl },
  columnaPrincipal: { flex: 3, minWidth: 0, gap: espacio.l },
  columnaLateral: { flex: 2, minWidth: 0, gap: espacio.l },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, rowGap: espacio.xs, marginTop: -espacio.s },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  leyendaLinea: { width: 18, height: 6, borderRadius: radios.pildora },
});
