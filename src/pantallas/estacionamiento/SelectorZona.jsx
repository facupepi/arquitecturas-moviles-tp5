// Selector de zona de estacionamiento (S6, E1). Cada zona es una opción de radio con su tarifa,
// el horario de cobro (horarioTexto) y la etiqueta "En horario" / "Fuera de horario" (enHorario).
// testID de cada opción: zona-<id>. `refOpcion(id)` devuelve la ref de cada opción (para llevar a la
// vista la zona que se eligió en el mapa). `elegidaEnMapa`: id de la zona que se tocó en el mapa; si
// sigue elegida, lleva la etiqueta "Elegida en el mapa", como las tarjetas de Bicicletas y Alarmas.
// Teclado como el patrón radiogroup de WAI-ARIA: solo la zona elegida entra en el orden de
// tabulación y las flechas pasan a la anterior o a la siguiente (eligiéndola y llevándole el foco);
// espacio o Enter eligen la enfocada.
import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../../tema/tokens';
import { EtiquetaEstado, Icono, Texto } from '../../ui';
import { alPresionarEspacio, useIdAccesible } from '../../ui/comun';
import { dinero } from '../../../shared/formato.mjs';
import { zonaEnHorario } from './util';

const SIGUIENTE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function OpcionZona({ zona, elegida, enMapa, enfocable, cobra, onElegir, onTecla, refOpcion }) {
  const elegir = () => onElegir(zona.id);
  return (
    <Pressable
      ref={refOpcion}
      role="radio"
      aria-checked={elegida}
      tabIndex={enfocable ? 0 : -1}
      onPress={elegir}
      onKeyDown={(evento) => {
        if (onTecla(evento)) return;
        alPresionarEspacio(elegir)(evento);
      }}
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
        {/* La de "Elegida en el mapa" va después: al aparecer no corre la del horario. */}
        <View style={estilos.etiquetas}>
          <EtiquetaEstado
            texto={cobra ? 'En horario' : 'Fuera de horario'}
            tono={cobra ? 'exito' : 'neutro'}
            testID={`horario-${zona.id}`}
          />
          {enMapa ? (
            <EtiquetaEstado texto="Elegida en el mapa" tono="alerta" icono="ubicacion" testID={`elegida-${zona.id}`} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function SelectorZona({ zonas, valor, onCambio, ahora, refOpcion, elegidaEnMapa = null }) {
  const idEtiqueta = useIdAccesible('zona-etiqueta');
  const opciones = useRef({});
  // Si ninguna está elegida (todavía), la primera es la que recibe el foco con Tab.
  const indiceElegida = zonas.findIndex((z) => z.id === valor);
  const enfocable = indiceElegida >= 0 ? indiceElegida : 0;

  /** Flechas: elige la zona anterior o la siguiente (en ronda) y le lleva el foco. */
  const alTeclear = (indice) => (evento) => {
    const tecla = evento?.nativeEvent?.key ?? evento?.key;
    const paso = SIGUIENTE[tecla];
    if (!paso || !zonas.length) return false;
    evento.preventDefault?.();
    const destino = zonas[(indice + paso + zonas.length) % zonas.length];
    onCambio(destino.id);
    opciones.current[destino.id]?.focus?.();
    return true;
  };

  return (
    <View style={estilos.contenedor}>
      <Texto id={idEtiqueta} variante="chico" peso="700">
        Zona
      </Texto>
      <View role="radiogroup" aria-labelledby={idEtiqueta} style={estilos.lista}>
        {zonas.map((z, i) => {
          const externa = refOpcion?.(z.id);
          return (
            <OpcionZona
              key={z.id}
              zona={z}
              elegida={z.id === valor}
              enMapa={z.id === valor && z.id === elegidaEnMapa}
              enfocable={i === enfocable}
              cobra={zonaEnHorario(z, ahora)}
              onElegir={onCambio}
              onTecla={alTeclear(i)}
              refOpcion={(nodo) => {
                if (nodo) opciones.current[z.id] = nodo;
                else delete opciones.current[z.id];
                externa?.(nodo);
              }}
            />
          );
        })}
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
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
});
