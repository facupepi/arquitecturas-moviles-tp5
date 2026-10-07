// Tarjeta de una alarma comunitaria (S3, 8.6): estado "Activada"/"Desactivada" (texto, nunca solo
// color), zona, si el vecino la sigue o la tiene cerca, "actualizada hace N min" y "Ver en mapa".
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
      titulo={alarma.nombre}
      accion={(
        <EtiquetaEstado
          texto={activa ? 'Activada' : 'Desactivada'}
          tono={activa ? 'peligro' : 'info'}
          icono={activa ? 'alerta' : 'check'}
          testID={`estado-alarma-${alarma.id}`}
        />
      )}
      tono={activa ? 'peligro' : 'normal'}
      etiquetaAccesible={alarma.nombre}
      estilo={[estilos.tarjeta, seleccionada && estilos.elegida]}
    >
      <View style={estilos.datos}>
        {alarma.referencia ? (
          <Texto variante="chico" color={colores.textoSuave}>
            {alarma.referencia}
          </Texto>
        ) : null}
        <View style={estilos.marcas}>
          <EtiquetaEstado texto={`Zona ${nombreZona(alarma.zona)}`} tono="neutro" />
          {sigueZona ? <EtiquetaEstado texto="Seguís esta zona" tono="info" icono="campana" /> : null}
          {cerca ? <EtiquetaEstado texto="Cerca tuyo" tono="info" icono="ubicacion" testID={`cerca-${alarma.id}`} /> : null}
        </View>
        {cuando ? (
          <Texto variante="chico" color={activa ? colores.peligro : colores.textoSuave} peso={activa ? '700' : undefined}>
            {cuando}
          </Texto>
        ) : null}
      </View>
      <Boton
        titulo="Ver en mapa"
        icono="ubicacion"
        variante="secundario"
        onPress={() => onVerEnMapa(alarma.id)}
        etiquetaAccesible={`Ver ${alarma.nombre} en el mapa`}
        testID={`ver-mapa-${alarma.id}`}
      />
    </Tarjeta>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flexGrow: 1, flexBasis: 300, minWidth: 0 },
  // Desactivada en azul, como en el mapa y en la leyenda.
  tarjeta: { flexGrow: 1, minWidth: 0 },
  elegida: { borderColor: colores.alertaAcento, borderWidth: 2 },
  datos: { gap: espacio.s },
  marcas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
});
