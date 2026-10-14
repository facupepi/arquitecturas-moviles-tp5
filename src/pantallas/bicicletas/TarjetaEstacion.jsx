// Tarjeta de una estación (S3, 8.5): disponibilidad en números grandes, distancia si hay
// ubicación, "actualizado hace N min", "Ver en mapa" y "Reportar problema".
// No usa onPress: tiene botones adentro (una tarjeta presionable no puede contener botones).
// Misma estructura en todas: nombre con la etiqueta arriba a la derecha (el nombre pasa a dos
// líneas sin mover la etiqueta) y los números con los botones abajo de todo, así las tarjetas de
// una fila quedan alineadas aunque el nombre o la referencia ocupen más.
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
        etiquetaAccesible={estacion.nombre}
        estilo={[estilos.tarjeta, seleccionada && estilos.elegida]}
      >
        <View style={estilos.cabecera}>
          <Texto variante="titulo3" role="heading" aria-level={3} estilo={estilos.titulo}>
            {estacion.nombre}
          </Texto>
          <View style={estilos.etiqueta}>
            <EtiquetaEstado texto={estado.texto} tono={estado.tono} icono={estado.icono ?? undefined} testID={`estado-estacion-${estacion.id}`} />
          </View>
        </View>

        <View style={estilos.lugar}>
          <Texto variante="chico" color={colores.textoSuave}>
            {lugar}
          </Texto>
          {distancia ? (
            <Texto variante="chico" peso="700" color={colores.accionOscuro} testID={`distancia-${estacion.id}`}>
              {`Estás ${distancia}`}
            </Texto>
          ) : null}
        </View>

        {seleccionada ? (
          <View style={estilos.elegidaEtiqueta}>
            <EtiquetaEstado texto="Elegida en el mapa" tono="alerta" icono="ubicacion" testID={`elegida-${estacion.id}`} />
          </View>
        ) : null}

        <View style={estilos.pie}>
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
          {actualizado ? (
            <Texto variante="chico" color={colores.textoSuave} testID={`actualizado-${estacion.id}`}>
              {actualizado}
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
              enLinea
              onPress={() => onReportar(estacion)}
              etiquetaAccesible={`Reportar un problema en ${estacion.nombre}`}
              testID={`reportar-${estacion.id}`}
            />
          </View>
        </View>
      </Tarjeta>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flexGrow: 1, minWidth: 0 },
  tarjeta: { flexGrow: 1, minWidth: 0 },
  // La elegida en el mapa se marca con borde de 3 px de contraste suficiente (un fondo celeste
  // bajaría el de los botones) y con la etiqueta "Elegida en el mapa", así no depende solo del color.
  // El relleno baja lo que sube el borde: el contenido no se mueve.
  elegida: { borderColor: colores.alerta, borderWidth: 3, padding: espacio.l - 2 },
  elegidaEtiqueta: { flexDirection: 'row' },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s },
  titulo: { flex: 1, minWidth: 0 },
  etiqueta: { flexShrink: 0, paddingTop: 1 },
  lugar: { gap: 2, marginTop: -espacio.s },
  // Números, fecha y botones van abajo de todo: alineados entre las tarjetas de una misma fila.
  pie: { marginTop: 'auto', gap: espacio.s },
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
