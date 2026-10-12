// Notificaciones (S7, sección 8.10). Cubre N1 (ver lo que llegó por push o en vivo), N2
// (preferencias: tipos, zonas, frecuencia y avisos en este dispositivo), N3 (historial con
// "Más información" e "Ir al servicio") y A4 (zonas compartidas con Alarmas).
//
// - El historial sale del almacén (notificaciones personales + avisos de la ciudad, ya unidos y
//   filtrados por las preferencias). Con "Ver todos los avisos de la ciudad" se muestran sin filtro.
// - #/notificaciones/<id> abre el detalle y la marca como leída (enlace profundo).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Boton, Cargando, ErrorCarga, Interruptor, Pantalla, Pestanas, Seccion, Texto, Vacio, useAvisoFlotante,
} from '../ui';
import { colores, espacio } from '../tema/tokens';
import { cargarMas, useMunicipal } from '../datos/almacen';
import { useComando } from '../datos/useComando';
import { useAhora } from '../datos/useAhora';
import * as repositorio from '../datos/repositorio';
import { EVENTOS, registrarEvento } from '../firebase/analytics';
import { useRuta } from '../navegacion';
import TarjetaNotificacion from './notificaciones/TarjetaNotificacion';
import DetalleNotificacion from './notificaciones/DetalleNotificacion';
import Preferencias from './notificaciones/Preferencias';
import { useHistorialCompleto } from './notificaciones/useHistorialCompleto';
import { useGuardarPreferencias } from './notificaciones/useGuardarPreferencias';
import { desplazarHasta } from './notificaciones/desplazar';
import { FILTROS, filtrar, textoNoLeidas } from './notificaciones/presentacion';

const LIMITE_INICIAL = 50;
// Desde este ancho de contenido el historial y las preferencias van lado a lado.
const ANCHO_DOS_COLUMNAS = 900;
const PASO = 20;

const VACIOS = {
  todas: {
    icono: 'campana',
    titulo: 'Todavía no tenés notificaciones',
  },
  no_leidas: {
    icono: 'checkCirculo',
    titulo: 'Estás al día',
  },
  ciudad: {
    icono: 'ubicacion',
    titulo: 'No hay avisos para tus zonas',
    mensaje: 'Probá ver todos los avisos de la ciudad o sumá zonas en tus preferencias.',
  },
  tramites: {
    icono: 'tributo',
    titulo: 'Sin novedades de tus trámites',
  },
};

function seleccionar(s) {
  return {
    listo: s.listo,
    uid: s.usuario?.uid ?? null,
    notificaciones: s.notificaciones,
    avisos: s.avisos,
    preferencias: s.preferencias,
    hayMas: s.hayMas.notificaciones,
    errorLista: s.errores.notificaciones || s.errores.avisos || s.errores.avisosLeidos || null,
    errorPerfil: s.errores.perfil || null,
  };
}

export default function Notificaciones({ ruta }) {
  const datos = useMunicipal(seleccionar);
  const { navegar, volver, irA } = useRuta();
  const aviso = useAvisoFlotante();
  const ahora = useAhora(60_000);
  const [filtro, setFiltro] = useState('todas');
  const [verTodos, setVerTodos] = useState(false);
  const [paginas, setPaginas] = useState(0);
  const guardado = useGuardarPreferencias();
  const refPreferencias = useRef(null);
  const refTituloPreferencias = useRef(null);
  const abiertaDesdeLista = useRef(false);
  const [ancho, setAncho] = useState(0);
  const medir = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setAncho((a) => (Math.abs(a - w) > 1 ? w : a));
  }, []);
  const lado = ancho >= ANCHO_DOS_COLUMNAS;

  const completo = useHistorialCompleto({
    activo: verTodos,
    uid: datos.uid,
    avisos: datos.avisos,
    preferencias: datos.preferencias,
    limite: LIMITE_INICIAL + paginas * PASO,
  });
  // Mientras llega el historial completo se sigue mostrando el filtrado (no parpadea a vacío).
  const historial = (verTodos && completo.lista) || datos.notificaciones;
  const noLeidas = useMemo(() => historial.filter((n) => !n.leida).length, [historial]);
  const visibles = useMemo(() => filtrar(historial, filtro), [historial, filtro]);

  // ---------- Detalle (#/notificaciones/<id>) ----------
  const idAbierta = ruta?.id ?? null;
  const abierta = useMemo(() => {
    if (!idAbierta) return null;
    const enLista = historial.find((n) => n.id === idAbierta) ?? datos.notificaciones.find((n) => n.id === idAbierta);
    if (enLista) return enLista;
    // Un aviso que las preferencias ocultan también se puede abrir por enlace.
    const a = datos.avisos.find((x) => x.id === idAbierta);
    return a ? {
      id: a.id, fuente: 'aviso', titulo: a.titulo, cuerpo: a.cuerpo, detalle: a.detalle ?? null, tipo: a.tipo,
      zona: a.zona ?? null, destino: a.destino ?? null, enlace: a.enlace ?? null, creadoEn: a.creadoEn ?? null, leida: false,
    } : null;
  }, [idAbierta, historial, datos.notificaciones, datos.avisos]);

  const marcar = useComando(repositorio.marcarLeida);
  const abiertas = useRef(new Set());
  useEffect(() => {
    if (!abierta || abiertas.current.has(abierta.id)) return;
    abiertas.current.add(abierta.id);
    try { registrarEvento(EVENTOS.AVISO_ABIERTO, { tipo: abierta.tipo, fuente: abierta.fuente }); } catch { /* opcional */ }
    if (!abierta.leida) marcar.ejecutar(abierta);
  }, [abierta]);   // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (n) => {
    abiertaDesdeLista.current = true;
    marcar.limpiar();
    navegar('notificaciones', n.id);
  };
  const cerrar = () => {
    if (abiertaDesdeLista.current) {
      abiertaDesdeLista.current = false;
      volver();
    } else {
      navegar('notificaciones', null, null, { reemplazar: true });
    }
  };
  const irAlServicio = (destino) => {
    abiertaDesdeLista.current = false;
    irA(destino, { reemplazar: true });
  };
  const irAPreferencias = () => {
    if (idAbierta) cerrar();
    // Después de cerrar el diálogo, para que el foco no vuelva a la tarjeta.
    setTimeout(() => desplazarHasta(refPreferencias, refTituloPreferencias), idAbierta ? 120 : 0);
  };

  // ---------- Marcar todas ----------
  const todas = useComando(repositorio.marcarTodasLeidas, {
    alExito: () => aviso.mostrar('Marcamos todas como leídas.'),
  });
  const marcarTodas = () => {
    const pendientes = historial.filter((n) => !n.leida);
    if (!pendientes.length) {
      todas.limpiar();
      aviso.mostrar('No tenés notificaciones sin leer.', 'info');
      return;
    }
    todas.ejecutar(pendientes);
  };

  const verMas = () => {
    cargarMas('notificaciones');
    setPaginas((n) => n + 1);
  };

  const encabezado = (
    <Boton
      titulo="Elegir qué recibir"
      icono="ajustes"
      variante="secundario"
      onPress={irAPreferencias}
      testID="ir-preferencias"
    />
  );

  if (!datos.listo) {
    return (
      <Pantalla titulo="Notificaciones" bajada="Los avisos de la ciudad y de tus trámites, en un solo lugar." testID="pantalla-notificaciones">
        <Cargando lineas={5} mensaje="Cargando tus notificaciones…" testID="cargando-notificaciones" />
      </Pantalla>
    );
  }

  const vacio = VACIOS[filtro];
  const accionVacio = filtro === 'ciudad' && !verTodos
    ? { titulo: 'Ver todos los avisos', onPress: () => setVerTodos(true), testID: 'vacio-ver-todos' }
    : filtro === 'todas' ? { titulo: 'Elegir qué recibir', onPress: irAPreferencias } : undefined;

  return (
    <Pantalla
      titulo="Notificaciones"
      bajada="Los avisos de la ciudad y de tus trámites, en un solo lugar."
      accion={lado ? undefined : encabezado}
      testID="pantalla-notificaciones"
    >
      <View onLayout={medir} style={lado ? estilos.columnas : estilos.unaColumna}>
        <View style={lado ? estilos.principal : null}>
          <Seccion titulo="Historial">
            <Pestanas
              etiqueta="Filtrar notificaciones"
              valor={filtro}
              onCambio={setFiltro}
              opciones={FILTROS.map((f) => (f.valor === 'no_leidas' ? { ...f, contador: noLeidas } : f))}
              testID="filtro"
            />

            <View style={estilos.barra}>
              <Texto variante="chico" peso="700" color={colores.textoSuave} testID="resumen-no-leidas" estilo={estilos.flexible}>
                {textoNoLeidas(noLeidas)}
              </Texto>
              {/* Con todo leído no hay nada que marcar: el botón no se muestra (sigue mientras guarda). */}
              {noLeidas > 0 || todas.ocupado ? (
                <Boton
                  titulo="Marcar todas como leídas"
                  icono="check"
                  variante="secundario"
                  onPress={marcarTodas}
                  cargando={todas.ocupado}
                  testID="marcar-todas"
                />
              ) : null}
            </View>
            {todas.error ? (
              <Texto role="alert" variante="chico" color={colores.peligro} peso="600" testID="error-marcar-todas">
                No pudimos marcarlas como leídas. {todas.error.message}
              </Texto>
            ) : null}

            <Interruptor
              etiqueta="Ver todos los avisos de la ciudad"
              descripcion="Incluye los de zonas y temas que no seguís."
              valor={verTodos}
              onCambio={setVerTodos}
              testID="interruptor-todos"
            />

            <ErrorCarga error={datos.errorLista || completo.error} testID="error-historial" />

            {verTodos && completo.cargando ? (
              <Texto variante="chico" color={colores.textoSuave} role="status">
                Buscando todos los avisos…
              </Texto>
            ) : null}

            {visibles.length ? (
              <View style={estilos.lista} testID="lista-notificaciones">
                {visibles.map((n) => (
                  <TarjetaNotificacion key={`${n.fuente}-${n.id}`} notificacion={n} ahora={ahora} onAbrir={abrir} />
                ))}
              </View>
            ) : (
              <Vacio icono={vacio.icono} titulo={vacio.titulo} mensaje={vacio.mensaje} accion={accionVacio} testID="vacio-notificaciones" />
            )}

            {datos.hayMas ? (
              <Boton titulo="Cargar más" icono="mas" variante="secundario" ancho="completo" onPress={verMas} testID="cargar-mas-notificaciones" />
            ) : null}
          </Seccion>
        </View>

        <View style={lado ? estilos.lateral : null}>
          <Preferencias
            ref={refPreferencias}
            refTitulo={refTituloPreferencias}
            preferencias={datos.preferencias}
            guardado={guardado}
            errorPerfil={datos.errorPerfil}
          />
        </View>
      </View>

      {idAbierta ? (
        <DetalleNotificacion
          notificacion={abierta}
          noEncontrada={!abierta}
          ahora={ahora}
          errorLectura={marcar.error}
          onCerrar={cerrar}
          onIrA={irAlServicio}
          onPreferencias={irAPreferencias}
        />
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: espacio.s },
  flexible: { flexShrink: 1 },
  lista: { gap: espacio.s },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xl },
  unaColumna: { gap: espacio.l },
  principal: { flex: 3, minWidth: 0 },
  lateral: { flex: 2, minWidth: 0, paddingTop: espacio.s },
});
