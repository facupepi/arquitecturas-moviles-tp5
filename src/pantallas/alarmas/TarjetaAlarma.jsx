// Tarjeta de una alarma comunitaria (S3, 8.6): estado "Activada"/"Desactivada" (texto, nunca solo
// color), zona, si el vecino la sigue o la tiene cerca, "actualizada hace N min" y "Ver en mapa".
// Misma estructura que la tarjeta de estación: nombre con la etiqueta arriba a la derecha y el
// botón abajo de todo, así las tarjetas de una fila quedan alineadas.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton, EtiquetaEstado, Tarjeta, Texto } from '../../ui';
import { colores, espacio } from '../../tema/tokens';
import { tiempoRelativo } from '../../../shared/formato.mjs';
import { actualizadoTexto, nombreZona } from '../bicicletas/utiles';

export default function TarjetaAlarma({ alarma, sigueZona, cerca, seleccionada, ahora, onVerEnMapa, refContenedor }) {
  const activa = alarma.activa;
  const cuando = activa && Number.isFinite(alarma.activadaEn)
    ? `Activada ${tiempoRelativo(Math.min(alarma.activadaEn, ahora), ahora)}`
    : actualizadoTexto(alarma.actualizadoEn, ahora, true);

  return (
    // El contenedor lleva la ref para que un enlace profundo pueda desplazar la pantalla hasta acá.
    <View ref={refContenedor} style={estilos.contenedor}>
      <Tarjeta
        testID={`alarma-${alarma.id}`}
        tono={activa ? 'peligro' : 'normal'}
        etiquetaAccesible={alarma.nombre}
        estilo={[estilos.tarjeta, seleccionada && estilos.elegida]}
      >
        <View style={estilos.cabecera}>
          <Texto variante="titulo3" role="heading" aria-level={3} estilo={estilos.titulo}>
            {alarma.nombre}
          </Texto>
          <View style={estilos.etiqueta}>
            <EtiquetaEstado
              texto={activa ? 'Activada' : 'Desactivada'}
              tono={activa ? 'peligro' : 'info'}
              icono={activa ? 'alerta' : 'check'}
              sobreColor={activa}
              testID={`estado-alarma-${alarma.id}`}
            />
          </View>
        </View>
        {alarma.referencia ? (
          <Texto variante="chico" color={colores.textoSuave} estilo={estilos.referencia}>
            {alarma.referencia}
          </Texto>
        ) : null}
        <View style={estilos.marcas}>
          {seleccionada ? (
            <EtiquetaEstado texto="Elegida en el mapa" tono="alerta" icono="ubicacion" sobreColor={activa} testID={`elegida-${alarma.id}`} />
          ) : null}
          <EtiquetaEstado texto={`Zona ${nombreZona(alarma.zona)}`} tono="neutro" sobreColor={activa} />
          {sigueZona ? <EtiquetaEstado texto="Seguís esta zona" tono="info" icono="campana" sobreColor={activa} /> : null}
          {cerca ? <EtiquetaEstado texto="Cerca tuyo" tono="info" icono="ubicacion" sobreColor={activa} testID={`cerca-${alarma.id}`} /> : null}
        </View>
        <View style={estilos.pie}>
          {cuando ? (
            <Texto variante="chico" color={activa ? colores.peligro : colores.textoSuave} peso={activa ? '700' : undefined}>
              {cuando}
            </Texto>
          ) : null}
          <Boton
            titulo="Ver en mapa"
            icono="ubicacion"
            variante="secundario"
            onPress={() => onVerEnMapa(alarma.id)}
            etiquetaAccesible={`Ver ${alarma.nombre} en el mapa`}
            testID={`ver-mapa-${alarma.id}`}
          />
        </View>
      </Tarjeta>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flexGrow: 1, minWidth: 0 },
  tarjeta: { flexGrow: 1, minWidth: 0 },
  // Borde de 3 px de contraste suficiente y etiqueta "Elegida en el mapa" (no solo color); el
  // relleno baja lo que sube el borde, así el contenido no se mueve. En una activada, el borde de la
  // elegida reemplaza también al acento rojo de la izquierda: un solo borde, de un solo color.
  elegida: {
    borderColor: colores.alerta,
    borderWidth: 3,
    borderLeftColor: colores.alerta,
    borderLeftWidth: 3,
    padding: espacio.l - 2,
  },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s },
  titulo: { flex: 1, minWidth: 0 },
  etiqueta: { flexShrink: 0, paddingTop: 1 },
  referencia: { marginTop: -espacio.s },
  marcas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  // La fecha y el botón van abajo de todo: alineados entre las tarjetas de una misma fila.
  pie: { marginTop: 'auto', gap: espacio.s, alignItems: 'flex-start' },
});
