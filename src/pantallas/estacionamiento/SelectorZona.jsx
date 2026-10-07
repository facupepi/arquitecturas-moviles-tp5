// Selector de zona de estacionamiento (S6, E1). Cada zona es una opción de radio con su tarifa,
// el horario de cobro (horarioTexto) y la etiqueta "En horario" / "Fuera de horario" (enHorario).
// testID de cada opción: zona-<id>.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../../tema/tokens';
import { EtiquetaEstado, Icono, Texto } from '../../ui';
import { alPresionarEspacio, useIdAccesible } from '../../ui/comun';
import { dinero } from '../../../shared/formato.mjs';
import { zonaEnHorario } from './util';

function OpcionZona({ zona, elegida, cobra, onElegir }) {
  const elegir = () => onElegir(zona.id);
  return (
    <Pressable
      role="radio"
      aria-checked={elegida}
      onPress={elegir}
      onKeyDown={alPresionarEspacio(elegir)}
      testID={`zona-${zona.id}`}
      style={({ hovered }) => [
        estilos.opcion,
        elegida && estilos.opcionElegida,
        hovered && !elegida && estilos.opcionResaltada,
      ]}
    >
      <View style={[estilos.marca, elegida && estilos.marcaElegida]} aria-hidden>
        {elegida ? <View style={estilos.marcaPunto} /> : null}
      </View>
      <View style={estilos.textos}>
        <Texto variante="cuerpo" peso="700">
          {zona.nombre}
        </Texto>
        {zona.direccion ? (
          <Texto variante="chico" color={colores.textoSuave}>
            {zona.direccion}
          </Texto>
        ) : null}
        <View style={estilos.datos}>
          <Texto variante="chico" peso="700" color={colores.accionOscuro}>
            {`${dinero(zona.tarifaHora)} por hora`}
          </Texto>
          <View style={estilos.horario}>
            <Icono nombre="reloj" tamano={14} color={colores.textoSuave} />
            <Texto variante="chico" color={colores.textoSuave}>
              {zona.horarioTexto}
            </Texto>
          </View>
        </View>
        <EtiquetaEstado
          texto={cobra ? 'En horario' : 'Fuera de horario'}
          tono={cobra ? 'exito' : 'neutro'}
          testID={`horario-${zona.id}`}
        />
      </View>
    </Pressable>
  );
}

export default function SelectorZona({ zonas, valor, onCambio, ahora }) {
  const idEtiqueta = useIdAccesible('zona-etiqueta');
  return (
    <View style={estilos.contenedor}>
      <Texto id={idEtiqueta} variante="chico" peso="700">
        Zona
      </Texto>
      <View role="radiogroup" aria-labelledby={idEtiqueta} style={estilos.lista}>
        {zonas.map((z) => (
          <OpcionZona
            key={z.id}
            zona={z}
            elegida={z.id === valor}
            cobra={zonaEnHorario(z, ahora)}
            onElegir={onCambio}
          />
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s, alignSelf: 'stretch' },
  lista: { gap: espacio.s },
  opcion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.m,
    minHeight: medidas.toqueMinimo,
    padding: espacio.m,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    borderRadius: radios.medio,
    backgroundColor: colores.superficie,
    cursor: 'pointer',
  },
  opcionElegida: { borderColor: colores.accion, borderWidth: 2, backgroundColor: colores.celesteClaro },
  opcionResaltada: { borderColor: colores.accion },
  marca: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: radios.pildora,
    borderWidth: 2,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaElegida: { borderColor: colores.accion },
  marcaPunto: { width: 10, height: 10, borderRadius: radios.pildora, backgroundColor: colores.accion },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  datos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espacio.m, rowGap: 2, paddingVertical: 2 },
  horario: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
});
