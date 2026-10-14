// Estacionamiento medido (S6, sección 8.9): E1 mapa de zonas con tarifa, horario y control de
// horario; E2 inicio con patente y minutos; E3 temporizador con aviso antes de vencer; E4 extensión
// y finalización anticipada; historial con "Cargar más". Enlace profundo: #/estacionamiento/p1.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { colores, coloresMapa, espacio, radios } from '../tema/tokens';
import {
  Aviso, Cargando, ErrorCarga, Mapa, Pantalla, Seccion, Tarjeta, Texto, Vacio, useAnchoDisponible,
} from '../ui';
import { useMunicipal, cargarMas } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useRuta } from '../navegacion';
import FormularioInicio from './estacionamiento/FormularioInicio';
import Historial from './estacionamiento/Historial';
import SelectorZona from './estacionamiento/SelectorZona';
import SesionActiva from './estacionamiento/SesionActiva';
import { MapaYLista, altoMapaLateral, esLadoALado } from './bicicletas/Disposicion';
import { useTarjetaALaVista } from './bicicletas/useTarjetaALaVista';
import {
  horarioEstricto, puntosDeZonas, separarSesiones, umbralAviso, zonaEnHorario,
} from './estacionamiento/util';

// Desde este ancho de contenido (sin el menú lateral; en escritorio, desde el de Disposicion): el
// mapa a la izquierda, fijo a la vista; zonas, sesión, inicio e historial a la derecha.
const ANCHO_DOS_COLUMNAS = 840;

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
      mensaje="Podés iniciar igual."
      testID="aviso-horario"
    />
  );
}

export default function Estacionamiento({ ruta }) {
  const { listo, zonas, config, sesiones, hayMas, errorZonas, errorSesiones } = useMunicipal(seleccionar);
  const { navegar } = useRuta();
  const [anchoDisponible, alMedir] = useAnchoDisponible();
  const { width: anchoVentana, height: altoVentana } = useWindowDimensions();
  const zonasALaVista = useTarjetaALaVista();
  const ahora = useAhora(1000);
  // Lo que no necesita el segundo exacto (horario de las zonas, mapa) cambia cada 15 s.
  const ahoraLento = Math.floor(ahora / 15000) * 15000;
  const ancho = esLadoALado(anchoDisponible, anchoVentana, ANCHO_DOS_COLUMNAS);

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

  // La zona tocada en el mapa: su opción lleva la etiqueta "Elegida en el mapa" hasta que se elija
  // otra desde la lista (siempre hay una zona elegida, así que la etiqueta dice de dónde vino).
  const [enMapa, setEnMapa] = useState(null);

  const elegirZona = (id) => {
    setZonaId(id);
    setEnMapa(null);
    // Deja la zona en la dirección (se puede compartir), sin sumar entradas al historial.
    if (id !== idRuta) navegar('estacionamiento', id, null, { reemplazar: true });
  };
  // Una zona elegida en el mapa entra a la vista en la lista de zonas.
  const elegirEnMapa = (id) => {
    elegirZona(id);
    setEnMapa(id);
    zonasALaVista.pedir(id);
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
          mensaje="No tenés un estacionamiento activo."
          testID="sin-sesiones"
        />
      ) : null}
    </Seccion>
  );

  const sinZonas = errorZonas
    ? <ErrorCarga error={errorZonas} testID="error-zonas" />
    : !zonas.length
      ? <Cargando lineas={4} mensaje="Cargando las zonas de estacionamiento…" testID="cargando-zonas" />
      : null;

  const mapa = (
    <>
      <Mapa
        puntos={puntos}
        seleccionado={zonaId}
        onSeleccionar={elegirEnMapa}
        alto={ancho ? altoMapaLateral(altoVentana) : 240}
        etiqueta="Mapa de las zonas de estacionamiento medido de San Francisco"
        testID="mapa-estacionamiento"
      />
      <LeyendaMapa />
    </>
  );
  const selector = (
    <SelectorZona
      zonas={zonas}
      valor={zonaId}
      onCambio={elegirZona}
      ahora={ahoraLento}
      refOpcion={zonasALaVista.registrar}
      elegidaEnMapa={enMapa}
    />
  );
  const formulario = (
    <>
      {activas.length ? null : <AvisoHorario zona={zona} estricto={estricto} cobra={cobra} />}
      <FormularioInicio
        oculto={activas.length > 0}
        zona={zona}
        config={config}
        ahora={ahoraLento}
        patente={patente}
        onPatente={setPatente}
        alIniciar={(s) => setSesionNueva(s.id)}
      />
    </>
  );

  // Ancho: el mapa va en la columna izquierda (fijo); acá, las zonas y los datos.
  const cuerpoFormulario = sinZonas ?? (
    <>
      {ancho ? null : mapa}
      <Tarjeta>
        {selector}
        {/* Una sola sesión vigente por vecino: con una en curso se explica cómo seguir. */}
        {activas.length ? (
          <Aviso
            tono="info"
            titulo="Ya tenés un estacionamiento en curso"
            mensaje="Para sumar tiempo, extendelo. Para estacionar en otro lugar, terminalo antes."
            testID="sesion-en-curso"
          />
        ) : null}
        {formulario}
      </Tarjeta>
    </>
  );

  const seccionFormulario = (
    <Seccion titulo={activas.length ? 'Zonas de estacionamiento' : 'Iniciar un estacionamiento'} testID="iniciar">
      {cuerpoFormulario}
    </Seccion>
  );

  const seccionHistorial = (
    <Seccion titulo="Historial" testID="historial">
      <Historial sesiones={terminadas} hayMas={hayMas} alCargarMas={() => cargarMas('estacionamiento')} />
    </Seccion>
  );

  // La sesión en curso va primero; si no hay, primero se inicia. Con clave estable, al reordenar
  // se mueven sin volver a montarse (no se pierde la patente escrita).
  const ordenadas = (activas.length ? ['activas', 'formulario'] : ['formulario', 'activas']).map((clave) => (
    <React.Fragment key={clave}>{clave === 'activas' ? seccionActivas : seccionFormulario}</React.Fragment>
  ));

  return (
    <Pantalla titulo={TITULO} bajada={BAJADA} testID="pantalla-estacionamiento">
      <View onLayout={alMedir} style={estilos.apilado}>
        {ancho && !sinZonas ? (
          <MapaYLista
            ladoALado
            proporcion={[3, 2]}
            testID="columna-mapa-estacionamiento"
            mapa={mapa}
            lista={(
              <>
                {ordenadas}
                {seccionHistorial}
              </>
            )}
          />
        ) : (
          <>
            {ordenadas}
            {seccionHistorial}
          </>
        )}
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  apilado: { gap: espacio.l },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, rowGap: espacio.xs, marginTop: -espacio.s },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  leyendaLinea: { width: 18, height: 6, borderRadius: radios.pildora },
});
