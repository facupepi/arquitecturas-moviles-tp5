// Alarmas comunitarias (S3, sección 8.6). Cubre A1 (mapa de alarmas), A2 (estado en tiempo real:
// cuando el panel activa una alarma la etiqueta cambia sola), A3 (aviso si se activa una alarma
// cerca) y A4 (suscripción a zonas). El aviso flotante de una alarma nueva lo publica el almacén
// (deduplicado por claveEntrega): esta pantalla no muestra avisos flotantes propios.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useRuta } from '../navegacion';
import { coloresMapa, espacio, colores } from '../tema/tokens';
import { Aviso, Cargando, ErrorCarga, Mapa, Pantalla, Seccion, Texto, Vacio } from '../ui';
import { tiempoRelativo } from '../../shared/formato.mjs';
import AvisosAlarmas from './alarmas/AvisosAlarmas';
import TarjetaAlarma from './alarmas/TarjetaAlarma';
import { llevarALaVista } from './bicicletas/llevarALaVista';
import { Grilla, MapaYLista, altoMapaLateral, esLadoALado, useAncho } from './bicicletas/Disposicion';
import { useTarjetaALaVista } from './bicicletas/useTarjetaALaVista';
import { nombreZona } from './bicicletas/utiles';

const seleccionar = (s) => ({
  listo: s.listo,
  alarmas: s.alarmas,
  preferencias: s.preferencias,
  cercanas: s.perfil?.cercania?.alarmas ?? null,
  cercaniaActiva: s.cercania.activa,
  error: s.errores.alarmas ?? null,
  recibidas: s.alarmas.length > 0 || Boolean(s.errores.alarmas),
});

// Activadas primero (la más reciente arriba); después en el orden del catálogo.
function ordenar(alarmas) {
  return [...alarmas].sort((a, b) => {
    if (a.activa !== b.activa) return a.activa ? -1 : 1;
    if (a.activa) return (b.activadaEn ?? 0) - (a.activadaEn ?? 0);
    return String(a.id).localeCompare(String(b.id));
  });
}

export default function Alarmas({ ruta }) {
  const { navegar } = useRuta();
  const { listo, alarmas, preferencias, cercanas, cercaniaActiva, error, recibidas } = useMunicipal(seleccionar);
  const ahora = useAhora(30_000);
  const refMapa = useRef(null);
  const [ancho, alMedir] = useAncho();
  const { width: anchoVentana, height: altoVentana } = useWindowDimensions();
  const ladoALado = esLadoALado(ancho, anchoVentana);
  const refLadoALado = useRef(ladoALado);
  refLadoALado.current = ladoALado;
  // En escritorio el mapa acompaña a la lista, fijo a la vista, y ocupa casi todo el alto visible.
  const altoMapa = ladoALado ? altoMapaLateral(altoVentana) : 280;
  const [seleccionado, setSeleccionado] = useState(ruta?.id ?? null);
  // Las alarmas llegan por su propia suscripción: se espera un poco antes de decir "no hay".
  const [esperaVencida, setEsperaVencida] = useState(false);

  const tarjetas = useTarjetaALaVista();
  const refsTarjetas = tarjetas.refs;
  const pendienteDeVista = useRef(ruta?.id ?? null);

  // Enlace profundo #/alarmas/a2 (por ejemplo, desde un aviso): la alarma queda elegida en el mapa
  // y la pantalla baja hasta su tarjeta.
  useEffect(() => {
    if (ruta?.id) {
      setSeleccionado(ruta.id);
      pendienteDeVista.current = ruta.id;
    }
  }, [ruta?.id]);
  const hayTarjetas = listo && alarmas.length > 0;
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

  useEffect(() => {
    const t = setTimeout(() => setEsperaVencida(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const ordenadas = useMemo(() => ordenar(alarmas), [alarmas]);
  const activas = ordenadas.filter((a) => a.activa);
  const zonas = preferencias.zonas ?? [];
  const idsCerca = useMemo(() => new Set(cercaniaActiva ? cercanas ?? [] : []), [cercanas, cercaniaActiva]);

  const puntos = useMemo(
    () => alarmas.map((a) => ({
      id: a.id,
      lat: a.lat,
      lng: a.lng,
      titulo: a.nombre,
      tono: a.activa ? 'activo' : 'normal',
      detalles: [
        a.activa ? `Activada${Number.isFinite(a.activadaEn) ? ` ${tiempoRelativo(Math.min(a.activadaEn, Date.now()))}` : ''}` : 'Desactivada',
        `Zona ${nombreZona(a.zona)}`,
      ],
    })),
    [alarmas],
  );

  // Un punto elegido en el mapa: su tarjeta entra a la vista en la lista.
  const elegirEnMapa = useCallback((id) => {
    setSeleccionado(id);
    tarjetas.pedir(id);
  }, [tarjetas.pedir]);

  // "Ver en mapa" centra el punto en el mapa aunque ya estuviera elegido (cada pedido es nuevo).
  const [enfoque, setEnfoque] = useState(0);
  const verEnMapa = useCallback((id) => {
    setSeleccionado(id);
    setEnfoque((n) => n + 1);
    // Lado a lado el mapa ya está a la vista: no hace falta desplazar la pantalla.
    if (!refLadoALado.current) llevarALaVista(refMapa);
  }, []);

  let contenido;
  if (!listo || (!recibidas && !esperaVencida)) {
    contenido = <Cargando lineas={5} mensaje="Cargando el estado de las alarmas…" testID="alarmas-cargando" />;
  } else if (error && !alarmas.length) {
    contenido = <ErrorCarga error={error} testID="alarmas-error" />;
  } else if (!alarmas.length) {
    contenido = (
      <Vacio
        icono="alarma"
        titulo="Todavía no hay alarmas comunitarias"
        testID="alarmas-vacio"
      />
    );
  } else {
    const mapa = (
      <>
        <View ref={refMapa}>
          <Mapa
            puntos={puntos}
            seleccionado={seleccionado}
            enfoque={enfoque}
            onSeleccionar={elegirEnMapa}
            alto={altoMapa}
            etiqueta="Mapa de las alarmas comunitarias de San Francisco"
            testID="mapa-alarmas"
          />
        </View>
        <View style={estilos.leyenda} aria-hidden>
          <Punto color={coloresMapa.normal} texto="Desactivada" />
          <Punto color={coloresMapa.activo} texto="Activada" />
          <Punto color={coloresMapa.seleccionado} texto="Elegida" elegida />
        </View>
      </>
    );
    const avisos = (
      <Seccion titulo="Tus avisos de alarmas">
        <AvisosAlarmas
          alarmas={alarmas}
          preferencias={preferencias}
          onIrANotificaciones={() => navegar('notificaciones')}
        />
      </Seccion>
    );
    const estado = (
      <Seccion titulo="Estado de cada alarma">
        <Grilla minimo={300} maximo={3}>
          {ordenadas.map((a) => (
            <TarjetaAlarma
              key={a.id}
              refContenedor={tarjetas.registrar(a.id)}
              alarma={a}
              sigueZona={zonas.includes(a.zona)}
              cerca={idsCerca.has(a.id)}
              seleccionada={a.id === seleccionado}
              ahora={ahora}
              onVerEnMapa={verEnMapa}
            />
          ))}
        </Grilla>
      </Seccion>
    );
    contenido = (
      <View onLayout={alMedir} style={estilos.contenido}>
        {error ? <ErrorCarga error={error} testID="alarmas-error" /> : null}
        {activas.length ? (
          <Aviso
            tono="peligro"
            titulo={activas.length === 1 ? `Alarma activada: ${activas[0].nombre}` : `${activas.length} alarmas activadas`}
            mensaje={activas.length === 1
              ? `${activas[0].referencia ?? ''}${activas[0].referencia ? '. ' : ''}Si estás cerca, mantené la calma. Ante una emergencia, llamá a la Policía al 101.`
              : `${activas.map((a) => a.nombre).join(', ')}. Ante una emergencia, llamá a la Policía al 101.`}
            testID="aviso-alarmas-activas"
          />
        ) : (
          <Aviso tono="exito" titulo="Todas las alarmas están desactivadas" testID="aviso-sin-alarmas" />
        )}
        {ladoALado ? (
          // En escritorio, el estado de cada alarma queda al lado del mapa.
          <MapaYLista
            ladoALado
            mapa={mapa}
            lista={(
              <>
                {estado}
                {avisos}
              </>
            )}
          />
        ) : (
          <>
            {mapa}
            {avisos}
            {estado}
          </>
        )}
      </View>
    );
  }

  return (
    <Pantalla
      titulo="Alarmas comunitarias"
      bajada="Mirá el estado de las alarmas de la ciudad y elegí cuándo querés que te avisemos."
      testID="pantalla-alarmas"
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
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l, rowGap: espacio.xs, marginTop: -espacio.s },
  punto: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  circulo: { width: 12, height: 12, borderRadius: 6 },
  circuloElegido: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colores.texto },
  contenido: { gap: espacio.l },
});
