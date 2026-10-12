// Menú lateral (WP5, 7.4): las rutas de NAVEGACION, contador en Notificaciones, "Panel municipal"
// si corresponde, acceso al 147 y cerrar sesión. En escritorio (≥ 900) está fijo a la izquierda;
// en celulares se abre dentro de un Modal desde la barra inferior (MenuMovil).
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { abrirEnlace } from '../plataforma/enlaces';
import { NAVEGACION, PANEL } from '../tema/servicios';
import { colores, espacio, medidas, radios, sombras } from '../tema/tokens';
import { useAvisoFlotante } from '../ui/AvisoFlotante';
import Icono from '../ui/Icono';
import Insignia from '../ui/Insignia';
import Texto from '../ui/Texto';
import { rellenoInferiorSeguro } from '../ui/areaSegura';
import { cerrarSesionDesdeMarco } from './cerrarSesion';
import { useDevolverFoco, useEscape } from '../ui/comun';

function Item({ item, actual, noLeidas, onPress }) {
  const contador = item.ruta === 'notificaciones' ? noLeidas : 0;
  const etiqueta = contador > 0 ? `${item.corto}, ${contador} sin leer` : undefined;
  return (
    <Pressable
      role="link"
      aria-current={actual ? 'page' : undefined}
      aria-label={etiqueta}
      onPress={onPress}
      testID={`menu-${item.ruta}`}
      style={({ hovered }) => [estilos.item, actual && estilos.itemActual, hovered && !actual && estilos.itemResaltado]}
    >
      <Icono nombre={item.icono} tamano={22} color={actual ? colores.accionOscuro : colores.textoSuave} />
      <Texto variante="cuerpo" peso={actual ? '700' : '600'} color={actual ? colores.accionOscuro : colores.texto} estilo={estilos.flexible}>
        {item.corto}
      </Texto>
      <Insignia cantidad={contador} />
    </Pressable>
  );
}

/** Contenido del menú. `alElegir` se llama después de navegar (el menú móvil se cierra). */
export default function MenuLateral({ alElegir }) {
  const { ruta, navegar } = useRuta();
  const aviso = useAvisoFlotante();
  const noLeidas = useMunicipal((s) => s.noLeidas) ?? 0;
  const esAdmin = useMunicipal((s) => s.esAdmin);
  const usuario = useMunicipal((s) => s.usuario);
  const items = esAdmin ? [...NAVEGACION, PANEL] : NAVEGACION;

  const ir = (nombre) => {
    navegar(nombre);
    alElegir?.();
  };

  const cerrarSesion = async () => {
    alElegir?.();
    try {
      await cerrarSesionDesdeMarco();
    } catch {
      aviso.mostrar('No se pudo cerrar la sesión. Intentá de nuevo.', 'peligro');
    }
  };

  return (
    <View style={estilos.contenido}>
      <View role="navigation" aria-label="Navegación principal" style={estilos.lista}>
        {items.map((item) => (
          <Item
            key={item.ruta}
            item={item}
            actual={ruta.nombre === item.ruta}
            noLeidas={noLeidas}
            onPress={() => ir(item.ruta)}
          />
        ))}
      </View>
      <Pressable
        role="link"
        aria-label="Llamar al 147, atención al vecino"
        onPress={() => abrirEnlace('tel:147').catch(() => {})}
        testID="menu-147"
        style={({ hovered }) => [estilos.ayuda, hovered && estilos.ayudaResaltada]}
      >
        <Icono nombre="telefono" tamano={24} color={colores.accionOscuro} />
        <View style={estilos.flexible}>
          <Texto variante="titulo3" color={colores.accionOscuro}>
            147
          </Texto>
          <Texto variante="chico" color={colores.texto}>
            Atención al vecino
          </Texto>
        </View>
        <Icono nombre="externo" tamano={18} color={colores.accionOscuro} />
      </Pressable>
      <Pressable
        role="button"
        onPress={cerrarSesion}
        testID="menu-cerrar-sesion"
        style={({ hovered }) => [estilos.item, hovered && estilos.itemResaltado]}
      >
        <Icono nombre="salir" tamano={22} color={colores.textoSuave} />
        <Texto variante="cuerpo" peso="600">
          Cerrar sesión
        </Texto>
      </Pressable>
    </View>
  );
}

/** Menú lateral fijo de escritorio. */
export function MenuLateralFijo() {
  return (
    // Sin cabecera ni barra de desplazamiento propia: a 1366 × 768 entra entero, con el Panel, y en una ventana más
    // baja se puede seguir desplazando con la rueda o el teclado sin que aparezca la barra.
    <ScrollView
      style={estilos.fijo}
      contentContainerStyle={estilos.fijoContenido}
      showsVerticalScrollIndicator={false}
      dataSet={{ noImprimir: true }}
    >
      <MenuLateral />
    </ScrollView>
  );
}

/** Menú lateral de celulares, en un Modal (Escape y el fondo lo cierran; el foco vuelve a "Menú"). */
export function MenuMovil({ visible, onCerrar }) {
  const { width } = useWindowDimensions();
  const ancho = Math.min(320, width - 28);
  useDevolverFoco(!!visible);
  useEscape(!!visible, onCerrar);
  return (
    <Modal visible={!!visible} transparent animationType="none" onRequestClose={onCerrar} aria-label="Menú de servicios" testID="menu-movil">
      <View style={estilos.capa}>
        <View style={[estilos.panelMovil, { width: ancho }]}>
          <View style={[estilos.cabecera, estilos.cabeceraMovil]}>
            <Texto variante="titulo3" estilo={estilos.flexible}>
              Tus servicios
            </Texto>
            <Pressable
              role="button"
              aria-label="Cerrar menú"
              onPress={onCerrar}
              testID="menu-cerrar"
              style={({ hovered }) => [estilos.cerrar, hovered && estilos.itemResaltado]}
            >
              <Icono nombre="cerrar" tamano={24} color={colores.texto} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[estilos.fijoContenido, { paddingBottom: rellenoInferiorSeguro }]}>
            <MenuLateral alElegir={onCerrar} />
          </ScrollView>
        </View>
        <Pressable aria-hidden focusable={false} tabIndex={-1} onPress={onCerrar} style={estilos.fondo} />
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: espacio.m },
  lista: { gap: 0 },
  item: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.m,
    borderRadius: radios.medio,
    cursor: 'pointer',
  },
  itemActual: { backgroundColor: colores.celesteClaro },
  itemResaltado: { backgroundColor: '#eef4f8' },
  flexible: { flex: 1, minWidth: 0 },
  ayuda: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.m,
    borderRadius: radios.medio,
    borderWidth: 1,
    borderColor: '#b9dff3',
    backgroundColor: colores.celesteClaro,
    cursor: 'pointer',
  },
  ayudaResaltada: { borderColor: colores.accion },
  fijo: {
    width: medidas.anchoMenu,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colores.superficie,
    borderRightWidth: 1,
    borderRightColor: colores.borde,
  },
  fijoContenido: { padding: espacio.l, gap: espacio.l },
  cabecera: { gap: 2, paddingHorizontal: espacio.m },
  cabeceraMovil: { flexDirection: 'row', alignItems: 'center', paddingTop: espacio.m, paddingLeft: espacio.xl, paddingRight: espacio.s },
  capa: { flex: 1, flexDirection: 'row' },
  panelMovil: {
    zIndex: 1,
    height: '100%',
    backgroundColor: colores.superficie,
    ...sombras.flotante,
  },
  fondo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    backgroundColor: 'rgba(16,43,61,0.55)',
  },
  cerrar: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
  },
});
