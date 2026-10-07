// Barra inferior de celulares (WP5, 7.4): Inicio, Reclamos, Estacionar, Avisos (con insignia) y
// Menú. role="tablist" con pestañas que navegan; "Menú" abre el menú lateral en un Modal.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { colores, espacio, medidas, radios } from '../tema/tokens';
import Icono from '../ui/Icono';
import Insignia from '../ui/Insignia';
import Texto from '../ui/Texto';
import { rellenoInferiorSeguro } from '../ui/areaSegura';
import { alPresionarEspacio, conFoco } from '../ui/comun';

export const ALTO_BARRA = 64;

const ITEMS = [
  { ruta: 'inicio', etiqueta: 'Inicio', icono: 'inicio' },
  { ruta: 'reclamos', etiqueta: 'Reclamos', icono: 'reclamo' },
  { ruta: 'estacionamiento', etiqueta: 'Estacionar', icono: 'estacionamiento' },
  { ruta: 'notificaciones', etiqueta: 'Avisos', icono: 'campana' },
];

function Pestana({ etiqueta, icono, elegida, onPress, testID, contador = 0, etiquetaAccesible, extra }) {
  return (
    <Pressable
      role="tab"
      aria-selected={elegida}
      aria-label={etiquetaAccesible}
      onPress={conFoco(onPress)}
      onKeyDown={alPresionarEspacio(onPress)}
      testID={testID}
      style={({ hovered }) => [estilos.pestana, hovered && estilos.resaltada]}
      {...extra}
    >
      <View style={[estilos.icono, elegida && estilos.iconoElegido]}>
        <Icono nombre={icono} tamano={22} color={elegida ? colores.accionOscuro : colores.textoSuave} />
        <View style={estilos.insignia}>
          <Insignia cantidad={contador} />
        </View>
      </View>
      <Texto variante="chico" peso={elegida ? '700' : '600'} color={elegida ? colores.accionOscuro : colores.textoSuave} estilo={estilos.texto}>
        {etiqueta}
      </Texto>
    </Pressable>
  );
}

export default function BarraInferior({ onMenu, menuAbierto = false }) {
  const { ruta, navegar } = useRuta();
  const noLeidas = useMunicipal((s) => s.noLeidas) ?? 0;
  return (
    <View
      role="tablist"
      aria-label="Accesos rápidos"
      testID="barra-inferior"
      dataSet={{ noImprimir: true }}
      style={[estilos.barra, { paddingBottom: rellenoInferiorSeguro }]}
    >
      {ITEMS.map((item) => {
        const contador = item.ruta === 'notificaciones' ? noLeidas : 0;
        return (
          <Pestana
            key={item.ruta}
            etiqueta={item.etiqueta}
            icono={item.icono}
            elegida={ruta.nombre === item.ruta}
            contador={contador}
            etiquetaAccesible={contador > 0 ? `${item.etiqueta}, ${contador} sin leer` : undefined}
            onPress={() => navegar(item.ruta)}
            testID={`barra-${item.ruta}`}
          />
        );
      })}
      <Pestana
        etiqueta="Menú"
        icono="menu"
        elegida={false}
        onPress={onMenu}
        testID="barra-menu"
        etiquetaAccesible="Menú de servicios"
        extra={{ 'aria-haspopup': 'dialog', 'aria-expanded': menuAbierto }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: colores.superficie,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    boxShadow: '0px -2px 10px rgba(30, 41, 57, 0.08)',
    zIndex: 10,
  },
  pestana: {
    flex: 1,
    minHeight: ALTO_BARRA,
    minWidth: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: espacio.xs,
    cursor: 'pointer',
  },
  resaltada: { backgroundColor: '#f2f7fa' },
  icono: { width: 48, height: 30, borderRadius: radios.pildora, alignItems: 'center', justifyContent: 'center' },
  iconoElegido: { backgroundColor: colores.celesteClaro },
  insignia: { position: 'absolute', top: -4, right: 2 },
  texto: { fontSize: 12, lineHeight: 16 },
});
