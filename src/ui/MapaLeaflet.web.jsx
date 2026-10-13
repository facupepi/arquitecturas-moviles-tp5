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

// Botones de zoom de 44 × 44 (Leaflet los trae de 30 px, debajo del mínimo táctil). Se inyecta una
// sola vez desde este archivo .web: el resto de la app no escribe CSS.
let estiloInyectado = false;
function inyectarEstilo() {
  if (estiloInyectado || typeof document === 'undefined') return;
  estiloInyectado = true;
  const estilo = document.createElement('style');
  estilo.setAttribute('data-mapa-conecta', '');
  estilo.textContent = [
    '.leaflet-bar a, .leaflet-touch .leaflet-bar a { width: 44px; height: 44px; line-height: 44px; font-size: 22px; }',
    '.leaflet-control-attribution a { display: inline-block; min-height: 24px; line-height: 24px; }',
  ].join(' ');
  document.head.appendChild(estilo);
}

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

export default function MapaLeaflet({ puntos = [], seleccionado, enfoque = 0, onSeleccionar, ubicacion, alto = 300, etiqueta }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capas = useRef(null);
  const encuadrado = useRef(false);
  const enfoqueAnterior = useRef(enfoque);
  const alSeleccionar = useRef(onSeleccionar);
  const [errorTeselas, setErrorTeselas] = useState(false);
  alSeleccionar.current = onSeleccionar;

  // Montaje: una sola vez.
  useEffect(() => {
    inyectarEstilo();
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

    // Un aviso de tamaño puede llegar después de desmontar: sin esta guarda, Leaflet intenta
    // recalcular un mapa ya destruido y falla al leer la posición de sus capas.
    let vigente = true;
    const observador =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            if (vigente) instancia.invalidateSize({ pan: false });
          })
        : null;
    observador?.observe(nodo);

    return () => {
      vigente = false;
      observador?.disconnect();
      // Detener primero cualquier desplazamiento o zoom en curso: si la animación sigue
      // después de remove(), Leaflet accede a capas que ya no existen.
      instancia.stop();
      instancia.off();
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
      const conTramo = Array.isArray(punto.tramo) && punto.tramo.length > 1;
      // El elegido lleva un anillo oscuro además del color: se distingue de cualquier tono.
      const marcador = L.circleMarker([punto.lat, punto.lng], {
        radius: conTramo ? (elegido ? 8 : 6) : elegido ? 12 : 9,
        color: elegido ? colores.texto : '#ffffff',
        weight: elegido ? 4 : 3,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(grupo);
      if (conTramo) {
        // El tramo va encima del marcador (que es más chico): así la calle se ve entera.
        const linea = punto.tramo.map((p) => [p.lat, p.lng]);
        L.polyline(linea, { color, weight: elegido ? 11 : 7, opacity: 0.8 })
          .on('click', () => alSeleccionar.current?.(punto.id))
          .addTo(grupo);
        limites.push(...linea);
      }
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
    // (al montarse dentro de Suspense, Leaflet puede haber tomado un tamaño provisorio). Arriba a la
    // izquierda deja lugar para los botones de zoom: ningún marcador queda debajo de ellos.
    if (!encuadrado.current && limites.length) {
      encuadrado.current = true;
      // Encuadre instantáneo: evita una animación que puede quedar viva si el vecino sale de
      // la pantalla enseguida.
      instancia.invalidateSize({ pan: false });
      if (limites.length === 1) instancia.setView(limites[0], 16, { animate: false });
      else {
        instancia.fitBounds(limites, {
          paddingTopLeft: [64, 28],
          paddingBottomRight: [28, 28],
          maxZoom: 16,
          animate: false,
        });
      }
    }
  }, [puntos, seleccionado, ubicacion]);

  // Llevar a la vista el punto elegido (por ejemplo, desde la lista o un enlace profundo), solo
  // si quedó afuera: así no se pierde el encuadre de todos los puntos. Un `enfoque` nuevo ("Ver en
  // mapa", aunque sea el punto ya elegido) lo centra siempre.
  useEffect(() => {
    const punto = puntos.find((p) => p.id === seleccionado);
    const instancia = mapa.current;
    const pedido = enfoque !== enfoqueAnterior.current;
    enfoqueAnterior.current = enfoque;
    if (!punto || !instancia) return;
    const posicion = L.latLng(punto.lat, punto.lng);
    if (pedido || !instancia.getBounds().pad(-0.1).contains(posicion)) instancia.panTo(posicion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado, enfoque]);

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
