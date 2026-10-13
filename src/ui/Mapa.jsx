// Mapa (WP5, 7.2). Envoltorio con React.lazy de ./MapaLeaflet (en la web, MapaLeaflet.web.jsx:
// Leaflet queda en un chunk diferido, fuera del paquete inicial). Debajo del mapa muestra el
// nombre del punto seleccionado (como heredado:MapView.jsx:91-95) y un lector de pantalla anuncia
// "Elegiste <nombre>." cada vez que cambia (región aria-live que no se ve).
//
// PuntoMapa = { id, lat, lng, titulo, detalles: string[], tono: 'normal'|'activo'|'alerta'|'neutro',
//               tramo?: { lat, lng }[] }
// `enfoque`: contador que la pantalla sube en cada "Ver en mapa"; cada valor nuevo centra el punto
// elegido aunque ya estuviera elegido.
import React, { Suspense, lazy } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, coloresMapa, espacio, radios } from '../tema/tokens';
import Cargando from './Cargando';
import Texto from './Texto';

const MapaLeaflet = lazy(() => import('./MapaLeaflet'));

export default function Mapa({ puntos = [], seleccionado, enfoque, onSeleccionar, ubicacion, alto = 300, etiqueta, testID }) {
  const actual = puntos.find((p) => p.id === seleccionado);
  return (
    <View testID={testID} style={estilos.marco}>
      <View style={[estilos.lienzo, { height: alto }]}>
        <Suspense fallback={<Cargando mensaje="Cargando el mapa…" testID={testID ? `${testID}-cargando` : 'mapa-cargando'} />}>
          <MapaLeaflet
            puntos={puntos}
            seleccionado={seleccionado}
            enfoque={enfoque}
            onSeleccionar={onSeleccionar}
            ubicacion={ubicacion}
            alto={alto}
            etiqueta={etiqueta}
          />
        </Suspense>
      </View>
      <View style={estilos.seleccion}>
        <View
          style={[
            estilos.punto,
            { backgroundColor: actual ? coloresMapa.seleccionado : colores.bordeCampo },
          ]}
        />
        <Texto variante="chico" peso="600" estilo={estilos.flexible} testID={testID ? `${testID}-seleccion` : undefined}>
          {actual ? actual.titulo : 'Seleccioná un punto en el mapa'}
        </Texto>
        <View style={estilos.soloLector} aria-live="polite" aria-atomic="true">
          <Texto variante="chico" testID={testID ? `${testID}-anuncio` : undefined}>
            {actual ? `Elegiste ${actual.titulo}.` : ''}
          </Texto>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: {
    borderRadius: radios.grande,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  lienzo: { width: '100%', backgroundColor: '#e8eef3', justifyContent: 'center' },
  seleccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  punto: { width: 12, height: 12, borderRadius: radios.pildora },
  flexible: { flex: 1, minWidth: 0 },
  // Fuera de la vista pero leído por los lectores de pantalla (1 × 1 px, recortado).
  soloLector: { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', borderWidth: 0 },
});
