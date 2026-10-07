// Mapa con Leaflet para la web (WP5, 7.2). Port de heredado:src/MapView.jsx.
// - Leaflet se monta dentro de un View de RN (en RNW su ref es el nodo DOM) con alto explícito y
//   sin hijos de React: Leaflet trabaja sobre un div propio que se agrega a mano, así React nunca
//   le pisa las clases ni los nodos.
// - Teselas de https://tile.openstreetmap.org con crossOrigin (sin {s}): respuestas CORS que el
//   service worker puede guardar (no opacas).
// - circleMarker (sin imágenes de marcador), polyline para los tramos, popups armados con nodos de
//   texto y no con HTML (evita XSS), aviso si fallan teselas, ResizeObserver y sin zoom con rueda.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { colores, coloresMapa, espacio, radios } from '../tema/tokens';
import { medir, TRAZAS } from '../firebase/rendimiento';
import Texto from './Texto';

const CENTRO_POR_DEFECTO = [-31.429, -62.082]; // municipal/info.centroMapa
const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

function colorDe(punto, elegido) {
  if (elegido) return coloresMapa.seleccionado;
  return coloresMapa[punto.tono] ?? coloresMapa.normal;
}

function armarPopup(punto) {
  const caja = document.createElement('div');
  const titulo = document.createElement('strong');
  titulo.textContent = punto.titulo ?? '';
  caja.append(titulo);
  for (const detalle of punto.detalles ?? []) {
    if (!detalle) continue;
    const linea = document.createElement('p');
    linea.style.margin = '4px 0 0';
    linea.textContent = String(detalle);
    caja.append(linea);
  }
  return caja;
}

function medirPrimeraTesela(capa) {
  const traza = TRAZAS?.CARGA_MAPA ?? 'carga_mapa';
  const espera = new Promise((resolver, rechazar) => {
    const plazo = setTimeout(() => rechazar(new Error('sin teselas')), 20000);
    capa.once('tileload', () => {
      clearTimeout(plazo);
      resolver();
    });
  });
  try {
    Promise.resolve(medir(traza, () => espera)).catch(() => {});
  } catch {
    // Performance no disponible: el mapa funciona igual.
  }
}

export default function MapaLeaflet({ puntos = [], seleccionado, onSeleccionar, ubicacion, alto = 300, etiqueta }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capas = useRef(null);
  const encuadrado = useRef(false);
  const alSeleccionar = useRef(onSeleccionar);
  const [errorTeselas, setErrorTeselas] = useState(false);
  alSeleccionar.current = onSeleccionar;

  // Montaje: una sola vez.
  useEffect(() => {
    const anfitrion = contenedor.current;
    const nodo = document.createElement('div');
    nodo.style.width = '100%';
    nodo.style.height = '100%';
    nodo.setAttribute('role', 'region');
    nodo.setAttribute('aria-label', etiqueta || 'Mapa de San Francisco, Córdoba');
    anfitrion.appendChild(nodo);

    const instancia = L.map(nodo, { scrollWheelZoom: false, zoomControl: false }).setView(CENTRO_POR_DEFECTO, 14);
    L.control.zoom({ zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(instancia);
    instancia.setMinZoom(3);
    const teselas = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,
      attribution: ATRIBUCION,
    }).addTo(instancia);
    teselas.on('tileerror', () => setErrorTeselas(true));
    teselas.on('tileload', () => setErrorTeselas(false));
    medirPrimeraTesela(teselas);

    capas.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;

    const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(() => instancia.invalidateSize()) : null;
    observador?.observe(nodo);

    return () => {
      observador?.disconnect();
      instancia.remove();
      nodo.remove();
      mapa.current = null;
      capas.current = null;
      encuadrado.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Etiqueta accesible si cambia.
  useEffect(() => {
    const nodo = contenedor.current?.firstChild;
    if (nodo) nodo.setAttribute('aria-label', etiqueta || 'Mapa de San Francisco, Córdoba');
  }, [etiqueta]);

  // Puntos, tramos y ubicación.
  useEffect(() => {
    const grupo = capas.current;
    const instancia = mapa.current;
    if (!grupo || !instancia) return;
    grupo.clearLayers();
    const limites = [];
    for (const punto of puntos) {
      const elegido = punto.id === seleccionado;
      const color = colorDe(punto, elegido);
      if (Array.isArray(punto.tramo) && punto.tramo.length > 1) {
        const linea = punto.tramo.map((p) => [p.lat, p.lng]);
        L.polyline(linea, { color, weight: elegido ? 11 : 7, opacity: 0.75 })
          .on('click', () => alSeleccionar.current?.(punto.id))
          .addTo(grupo);
        limites.push(...linea);
      }
      const marcador = L.circleMarker([punto.lat, punto.lng], {
        radius: elegido ? 12 : 9,
        color: '#ffffff',
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(grupo);
      const rotulo = document.createElement('span');
      rotulo.textContent = punto.titulo ?? '';
      marcador.bindTooltip(rotulo, { direction: 'top' });
      marcador.bindPopup(armarPopup(punto));
      marcador.on('click', () => alSeleccionar.current?.(punto.id));
      limites.push([punto.lat, punto.lng]);
    }
    if (ubicacion && Number.isFinite(ubicacion.lat) && Number.isFinite(ubicacion.lng)) {
      L.circleMarker([ubicacion.lat, ubicacion.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: coloresMapa.ubicacion,
        fillOpacity: 1,
      })
        .bindTooltip('Tu ubicación')
        .addTo(grupo);
    }
    // Encuadre inicial: la primera vez que hay puntos. Se mide el contenedor antes de encuadrar
    // (al montarse dentro de Suspense, Leaflet puede haber tomado un tamaño provisorio).
    if (!encuadrado.current && limites.length) {
      encuadrado.current = true;
      instancia.invalidateSize();
      if (limites.length === 1) instancia.setView(limites[0], 16);
      else instancia.fitBounds(limites, { padding: [28, 28], maxZoom: 16 });
    }
  }, [puntos, seleccionado, ubicacion]);

  // Llevar a la vista el punto elegido (por ejemplo, desde la lista o un enlace profundo), solo
  // si quedó afuera: así no se pierde el encuadre de todos los puntos.
  useEffect(() => {
    const punto = puntos.find((p) => p.id === seleccionado);
    const instancia = mapa.current;
    if (!punto || !instancia) return;
    const posicion = L.latLng(punto.lat, punto.lng);
    if (!instancia.getBounds().pad(-0.1).contains(posicion)) instancia.panTo(posicion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

  return (
    <View style={[estilos.marco, { height: alto }]}>
      <View ref={contenedor} style={[estilos.anfitrion, { height: alto }]} />
      {errorTeselas ? (
        <View role="status" style={estilos.errorRed}>
          <Texto variante="chico" peso="600" color={colores.alerta}>
            No se pudo cargar parte del mapa. Revisá tu conexión a internet.
          </Texto>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { width: '100%', position: 'relative' },
  anfitrion: { width: '100%', zIndex: 0 },
  errorRed: {
    position: 'absolute',
    left: espacio.s,
    right: espacio.s,
    bottom: espacio.s,
    padding: espacio.s,
    borderRadius: radios.chico,
    backgroundColor: colores.alertaFondo,
    zIndex: 1000,
  },
});
