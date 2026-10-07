// Historial de sesiones terminadas (S6) con "Cargar más" (cargarMas('estacionamiento') del almacén).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../../tema/tokens';
import { Boton, EtiquetaEstado, Tarjeta, Texto } from '../../ui';
import { dinero, fecha, hora } from '../../../shared/formato.mjs';
import { terminoAntes, textoMinutos } from './util';

function SesionTerminada({ sesion }) {
  const antes = terminoAntes(sesion);
  return (
    <Tarjeta testID={`historial-${sesion.id}`}>
      <View style={estilos.fila}>
        <View style={estilos.textos}>
          <Texto variante="cuerpo" peso="700">
            {`${sesion.patente} · ${sesion.zonaNombre ?? 'Estacionamiento'}`}
          </Texto>
          <Texto variante="chico" color={colores.textoSuave}>
            {`${fecha(sesion.inicio)}, de ${hora(sesion.inicio)} a ${hora(sesion.fin)} h · ${textoMinutos(sesion.minutos)} pagados`}
          </Texto>
        </View>
        <Texto variante="cuerpo" peso="700">
          {dinero(sesion.importe)}
        </Texto>
      </View>
      <View style={estilos.etiquetas}>
        <EtiquetaEstado texto={antes ? 'Terminada antes de tiempo' : 'Finalizada'} tono={antes ? 'info' : 'neutro'} />
        {sesion.extensiones > 0 ? (
          <EtiquetaEstado texto={sesion.extensiones === 1 ? '1 extensión' : `${sesion.extensiones} extensiones`} tono="neutro" />
        ) : null}
      </View>
    </Tarjeta>
  );
}

export default function Historial({ sesiones, hayMas, alCargarMas }) {
  if (!sesiones.length && !hayMas) {
    return (
      <Texto variante="cuerpo" color={colores.textoSuave} testID="historial-vacio">
        Todavía no tenés sesiones terminadas.
      </Texto>
    );
  }
  return (
    <View style={estilos.lista}>
      {sesiones.map((s) => <SesionTerminada key={s.id} sesion={s} />)}
      {hayMas ? (
        <Boton titulo="Cargar más" variante="secundario" icono="mas" onPress={alCargarMas} testID="cargar-mas-estacionamiento" />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.m },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
});
