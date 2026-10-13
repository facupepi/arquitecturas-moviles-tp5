// Bicicletas públicas (S3, sección 8.5). Cubre B1 (mapa de estaciones), B2 (disponibilidad en
// tiempo real: la pantalla cambia sola cuando el panel o el simulador mueven bicicletas), B3
// (estaciones cercanas con la ubicación) y B4 (reportar un problema con el reclamo precargado).
// La ubicación solo vive en memoria mientras la pantalla está abierta: nunca se guarda.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useRuta } from '../navegacion';
import { ubicar } from '../plataforma/ubicacion';
import { EVENTOS, registrarEvento } from '../firebase/analytics';
import { colores, coloresMapa, espacio } from '../tema/tokens';
import {
  Aviso, Boton, Campo, Cargando, ErrorCarga, Mapa, Pantalla, Seccion, Tarjeta, Texto, Vacio,
} from '../ui';
import { ordenarPorCercania } from '../../shared/dominio.mjs';
import TarjetaEstacion from './bicicletas/TarjetaEstacion';
import { llevarALaVista } from './bicicletas/llevarALaVista';
import { Grilla, MapaYLista, altoMapaLateral, esLadoALado, useAncho } from './bicicletas/Disposicion';
import { useTarjetaALaVista } from './bicicletas/useTarjetaALaVista';
import {
  distanciaTexto, estadoEstacion, normalizarBusqueda, ordenarPorDisponibilidad, plural,
} from './bicicletas/utiles';

const seleccionar = (s) => ({
  listo: s.listo,
  estaciones: s.estaciones,
  error: s.errores.estaciones ?? s.errores.catalogo ?? null,
});

function evento(nombre, parametros) {
  try { registrarEvento(nombre, parametros); } catch { /* Analytics es opcional */ }
}

function Resumen({ estaciones }) {
  const operativas = estaciones.filter((e) => e.estado !== 'fuera_de_servicio');
  const total = operativas.reduce((suma, e) => suma + (e.bicicletas || 0), 0);
  const conBicis = operativas.filter((e) => e.bicicletas > 0).length;
  return (
    <Tarjeta tono="destacada" testID="resumen-bicicletas">
      <View style={estilos.resumen}>
        <Texto variante="numero" color={colores.accionOscuro} testID="bicicletas-total">
          {total}
        </Texto>
        <View style={estilos.resumenTextos}>
          <Texto variante="cuerpo" peso="700">
            {total === 1 ? 'bicicleta disponible ahora' : 'bicicletas disponibles ahora'}
          </Texto>
          <Texto variante="chico" color={colores.textoSuave}>
            {`En ${conBicis} de ${estaciones.length} estaciones.`}
          </Texto>
        </View>
      </View>
    </Tarjeta>
  );
}

export default function Bicicletas({ ruta }) {
  const { navegar } = useRuta();
  const { listo, estaciones, error } = useMunicipal(seleccionar);
  const ahora = useAhora(30_000);
  const refMapa = useRef(null);
  const [ancho, alMedir] = useAncho();
  const { width: anchoVentana, height: altoVentana } = useWindowDimensions();
  const ladoALado = esLadoALado(ancho, anchoVentana);
  const refLadoALado = useRef(ladoALado);
  refLadoALado.current = ladoALado;
  // En escritorio el mapa acompaña a la lista, fijo a la vista, y ocupa casi todo el alto visible.
  const altoMapa = ladoALado ? altoMapaLateral(altoVentana) : 300;

  const [seleccionado, setSeleccionado] = useState(ruta?.id ?? null);
  const [posicion, setPosicion] = useState(null);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const tarjetas = useTarjetaALaVista();
  const refsTarjetas = tarjetas.refs;
  const pendienteDeVista = useRef(ruta?.id ?? null);

  // Enlace profundo #/bicicletas/b3: la estación queda elegida en el mapa y la pantalla baja hasta
  // su tarjeta (al tocar un aviso, el vecino ve directamente la estación).
  useEffect(() => {
    if (ruta?.id) {
      setSeleccionado(ruta.id);
      pendienteDeVista.current = ruta.id;
    }
  }, [ruta?.id]);
  const hayTarjetas = listo && estaciones.length > 0;
  useEffect(() => {
    const id = pendienteDeVista.current;
    if (!id || !hayTarjetas) return undefined;
    // Después de que el enrutador sube al inicio de la pantalla nueva.
    const t = setTimeout(() => {
      if (refsTarjetas.current[id]) {
        llevarALaVista({ current: refsTarjetas.current[id] });
        pendienteDeVista.current = null;
      }
    }, 350);
    return () => clearTimeout(t);
  }, [hayTarjetas, ruta?.id]);

  const ordenadas = useMemo(
    () => (posicion ? ordenarPorCercania(estaciones, posicion) : ordenarPorDisponibilidad(ordenarPorCercania(estaciones, null))),
    [estaciones, posicion],
  );
  const filtro = normalizarBusqueda(busqueda);
  const visibles = useMemo(
    () => (filtro
      ? ordenadas.filter((e) => normalizarBusqueda(`${e.nombre} ${e.referencia ?? ''}`).includes(filtro))
      : ordenadas),
    [ordenadas, filtro],
  );
  const masCercana = posicion ? ordenadas.find((e) => e.estado !== 'fuera_de_servicio' && e.bicicletas > 0) : null;

  const puntos = useMemo(
    () => estaciones.map((e) => {
      const estado = estadoEstacion(e);
      return {
        id: e.id,
        lat: e.lat,
        lng: e.lng,
        titulo: e.nombre,
        tono: estado.tonoMapa,
        detalles: e.estado === 'fuera_de_servicio'
          ? ['Fuera de servicio']
          : [plural(e.bicicletas, 'bicicleta'), plural(e.anclajesLibres, 'anclaje libre', 'anclajes libres')],
      };
    }),
    [estaciones],
  );

  const usarUbicacion = useCallback(async () => {
    setUbicando(true);
    setErrorUbicacion(null);
    try {
      const actual = await ubicar({ precision: 'alta' });
      setPosicion(actual);
      const cercanas = ordenarPorCercania(estaciones, actual);
      const primera = cercanas.find((e) => e.estado !== 'fuera_de_servicio' && e.bicicletas > 0) ?? cercanas[0];
      if (primera) setSeleccionado(primera.id);
      evento(EVENTOS.ESTACIONES_CERCANAS, { estacion: primera?.id ?? null });
    } catch (e) {
      setErrorUbicacion(e);
    } finally {
      setUbicando(false);
    }
  }, [estaciones]);

  // Un punto elegido en el mapa: su tarjeta entra a la vista (si la búsqueda la ocultaba, se limpia).
  const elegirEnMapa = (id) => {
    setSeleccionado(id);
    if (!visibles.some((e) => e.id === id)) setBusqueda('');
    tarjetas.pedir(id);
  };

  // "Ver en mapa" centra el punto en el mapa aunque ya estuviera elegido (cada pedido es nuevo).
  const [enfoque, setEnfoque] = useState(0);
  const verEnMapa = useCallback((id) => {
    setSeleccionado(id);
    setEnfoque((n) => n + 1);
    // Lado a lado el mapa ya está a la vista: no hace falta desplazar la pantalla.
    if (!refLadoALado.current) llevarALaVista(refMapa);
  }, []);

  const reportar = useCallback((estacion) => {
    evento(EVENTOS.PROBLEMA_BICI, { estacion: estacion.id });
    navegar('reclamos', 'nuevo', { estacion: estacion.id });
  }, [navegar]);

  const botonUbicacion = (
    <Boton
      titulo={ubicando ? 'Buscando tu ubicación…' : posicion ? 'Actualizar mi ubicación' : 'Usar mi ubicación'}
      icono="navegar"
      cargando={ubicando}
      onPress={usarUbicacion}
      deshabilitado={!listo || !estaciones.length}
      testID="usar-ubicacion"
    />
  );

  let contenido;
  if (!listo) {
    contenido = <Cargando lineas={5} mensaje="Cargando las estaciones…" testID="bicicletas-cargando" />;
  } else if (error && !estaciones.length) {
    contenido = <ErrorCarga error={error} testID="bicicletas-error" />;
  } else if (!estaciones.length) {
    contenido = (
      <Vacio
        icono="bicicleta"
        titulo="Todavía no hay estaciones habilitadas"
        testID="bicicletas-vacio"
      />
    );
  } else {
    const avisos = (
      <>
        {errorUbicacion ? (
          <Aviso
            tono="alerta"
            rol="alert"
            titulo="Elegí una estación en el mapa o en la lista"
            mensaje={errorUbicacion.message}
            onCerrar={() => setErrorUbicacion(null)}
            testID="aviso-ubicacion"
          />
        ) : null}
        {masCercana ? (
          <Aviso
            tono="exito"
            titulo={`La más cercana con bicis: ${masCercana.nombre}`}
            mensaje={`Estás ${distanciaTexto(masCercana.distanciaKm)}. Tu ubicación no se guarda.`}
            testID="aviso-cercana"
          />
        ) : null}
      </>
    );
    const mapa = (
      <>
        <View ref={refMapa}>
          <Mapa
            puntos={puntos}
            seleccionado={seleccionado}
            enfoque={enfoque}
            onSeleccionar={elegirEnMapa}
            ubicacion={posicion}
            alto={altoMapa}
            etiqueta="Mapa de las estaciones de bicicletas de San Francisco"
            testID="mapa-estaciones"
          />
        </View>
        <View style={estilos.leyenda} aria-hidden>
          <Punto color={coloresMapa.normal} texto="Con bicicletas" />
          <Punto color={coloresMapa.neutro} texto="Sin bicicletas" />
          <Punto color={coloresMapa.activo} texto="Fuera de servicio" />
          <Punto color={coloresMapa.seleccionado} texto="Elegida" elegida />
          {posicion ? <Punto color={coloresMapa.ubicacion} texto="Vos" /> : null}
        </View>
      </>
    );
    const lista = (
      <Seccion titulo={posicion ? 'Estaciones por cercanía' : 'Estaciones'}>
        <Campo
          id="buscar-estacion"
          etiqueta="Buscar estación"
          valor={busqueda}
          onCambio={setBusqueda}
          placeholder="Por ejemplo: UTN o Terminal"
          ayuda={filtro ? `${plural(visibles.length, 'estación encontrada', 'estaciones encontradas')}` : undefined}
          teclaEnter="search"
          testID="buscar-estacion"
        />
        {visibles.length ? (
          <Grilla minimo={300} maximo={3}>
            {visibles.map((e) => (
              <TarjetaEstacion
                key={e.id}
                refContenedor={tarjetas.registrar(e.id)}
                estacion={e}
                distanciaKm={e.distanciaKm}
                seleccionada={e.id === seleccionado}
                ahora={ahora}
                onVerEnMapa={verEnMapa}
                onReportar={reportar}
              />
            ))}
          </Grilla>
        ) : (
          <Vacio
            icono="buscar"
            titulo="No encontramos estaciones"
            mensaje={`Ninguna estación coincide con "${busqueda.trim()}".`}
            accion={{ titulo: 'Ver todas', onPress: () => setBusqueda(''), testID: 'limpiar-busqueda' }}
            testID="estaciones-sin-resultados"
          />
        )}
      </Seccion>
    );
    contenido = (
      <View onLayout={alMedir} style={estilos.contenido}>
        {error ? <ErrorCarga error={error} testID="bicicletas-error" /> : null}
        {ladoALado ? (
          <MapaYLista
            ladoALado
            mapa={mapa}
            lista={(
              <>
                <Resumen estaciones={estaciones} />
                {avisos}
                {lista}
              </>
            )}
          />
        ) : (
          <>
            <Resumen estaciones={estaciones} />
            {avisos}
            {mapa}
            {lista}
          </>
        )}
      </View>
    );
  }

  return (
    <Pantalla
      titulo="Bicicletas públicas"
      bajada="Mirá cuántas bicis hay en cada estación y encontrá la más cercana."
      accion={botonUbicacion}
      testID="pantalla-bicicletas"
    >
      {contenido}
    </Pantalla>
  );
}

function Punto({ color, texto, elegida = false }) {
  return (
    <View style={estilos.punto}>
      <View style={[estilos.circulo, { backgroundColor: color }, elegida && estilos.circuloElegido]} />
      <Texto variante="chico" color={colores.textoSuave}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  resumen: { flexDirection: 'row', alignItems: 'center', gap: espacio.l },
  resumenTextos: { flex: 1, minWidth: 0, gap: 2 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, rowGap: espacio.xs, marginTop: -espacio.s },
  punto: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  circulo: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colores.blanco },
  circuloElegido: { width: 14, height: 14, borderRadius: 7, borderColor: colores.texto },
  contenido: { gap: espacio.l },
});
