// Tarjeta de una estación (S3, 8.5): disponibilidad en números grandes, distancia si hay
// ubicación, "actualizado hace N min", "Ver en mapa" y "Reportar problema".
// No usa onPress: tiene botones adentro (una tarjeta presionable no puede contener botones).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton, EtiquetaEstado, Tarjeta, Texto } from '../../ui';
import { colores, espacio, radios } from '../../tema/tokens';
import { actualizadoTexto, distanciaTexto, estadoEstacion, nombreZona } from './utiles';

function Numero({ valor, etiqueta, testID, apagado }) {
  return (
    <View style={estilos.numero}>
      <Texto variante="numero" color={apagado ? colores.textoSuave : colores.texto} testID={testID}>
        {valor}
      </Texto>
      <Texto variante="chico" color={colores.textoSuave} peso="600">
        {etiqueta}
      </Texto>
    </View>
  );
}

export default function TarjetaEstacion({ estacion, distanciaKm, seleccionada, ahora, onVerEnMapa, onReportar, refContenedor }) {
  const estado = estadoEstacion(estacion);
  const fuera = estacion.estado === 'fuera_de_servicio';
  const lugar = [estacion.referencia, `Zona ${nombreZona(estacion.zona)}`].filter(Boolean).join(' · ');
  const distancia = distanciaTexto(distanciaKm);
  const actualizado = actualizadoTexto(estacion.actualizadoEn, ahora);

  return (
    // El contenedor lleva la ref para que un enlace profundo pueda desplazar la pantalla hasta acá.
    <View ref={refContenedor} style={estilos.contenedor}>
    <Tarjeta
      testID={`estacion-${estacion.id}`}
      titulo={estacion.nombre}
      accion={<EtiquetaEstado texto={estado.texto} tono={estado.tono} icono={estado.icono ?? undefined} testID={`estado-estacion-${estacion.id}`} />}
      etiquetaAccesible={estacion.nombre}
      estilo={[estilos.tarjeta, seleccionada && estilos.elegida]}
    >
      <View style={estilos.lugar}>
        <Texto variante="chico" color={colores.textoSuave}>
          {lugar}
        </Texto>
        {actualizado ? (
          <Texto variante="chico" color={colores.textoSuave} testID={`actualizado-${estacion.id}`}>
            {actualizado}
          </Texto>
        ) : null}
        {distancia ? (
          <Texto variante="chico" peso="700" color={colores.accionOscuro} testID={`distancia-${estacion.id}`}>
            {`Estás ${distancia}`}
          </Texto>
        ) : null}
      </View>

      <View style={estilos.numeros}>
        <Numero
          valor={estacion.bicicletas}
          etiqueta={estacion.bicicletas === 1 ? 'bicicleta' : 'bicicletas'}
          testID={`bicicletas-${estacion.id}`}
          apagado={fuera}
        />
        <Numero
          valor={estacion.anclajesLibres}
          etiqueta={estacion.anclajesLibres === 1 ? 'anclaje libre' : 'anclajes libres'}
          testID={`anclajes-${estacion.id}`}
          apagado={fuera}
        />
      </View>

      {fuera ? (
        <Texto variante="chico" color={colores.peligro} peso="600">
          La estación no está prestando servicio. Probá en otra cercana.
        </Texto>
      ) : null}

      <View style={estilos.acciones}>
        <Boton
          titulo="Ver en mapa"
          icono="ubicacion"
          variante="secundario"
          onPress={() => onVerEnMapa(estacion.id)}
          etiquetaAccesible={`Ver ${estacion.nombre} en el mapa`}
          testID={`ver-mapa-${estacion.id}`}
        />
        <Boton
          titulo="Reportar"
          variante="texto"
          onPress={() => onReportar(estacion)}
          etiquetaAccesible={`Reportar un problema en ${estacion.nombre}`}
          testID={`reportar-${estacion.id}`}
        />
      </View>
    </Tarjeta>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flexGrow: 1, flexBasis: 300, minWidth: 0 },
  tarjeta: { flexGrow: 1, minWidth: 0, gap: espacio.s },
  // La elegida en el mapa se marca con borde (un fondo celeste bajaría el contraste de los botones).
  elegida: { borderColor: colores.alertaAcento, borderWidth: 2 },
  lugar: { gap: 2 },
  numeros: { flexDirection: 'row', gap: espacio.m },
  numero: {
    flex: 1,
    minWidth: 0,
    paddingVertical: espacio.xs,
    paddingHorizontal: espacio.m,
    borderRadius: radios.medio,
    backgroundColor: colores.fondo,
  },
  // "Ver en mapa" y "Reportar" en una sola fila a 360 px.
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, alignItems: 'center' },
});
