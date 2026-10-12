// Encabezado institucional (WP5, 7.4). Estructura de heredado:MunicipalChrome.jsx: logo blanco,
// marca "Conecta · San Francisco", acceso a "Atención 147", campana con la insignia de no leídas
// (testID "boton-notificaciones") y menú de cuenta. Fondo `accion` (el celeste municipal no da
// contraste AA con texto blanco chico).
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { abrirEnlace } from '../plataforma/enlaces';
import { colores, cortes, espacio, medidas, radios, sombras } from '../tema/tokens';
import { useAvisoFlotante } from '../ui/AvisoFlotante';
import Icono from '../ui/Icono';
import Insignia from '../ui/Insignia';
import Texto from '../ui/Texto';
import { conFoco } from '../ui/comun';
import { cerrarSesionDesdeMarco } from './cerrarSesion';
import MenuCuenta from './MenuCuenta';

const LOGO = { uri: '/brand/municipalidad-blanco.png' };
const PROPORCION_LOGO = 372 / 217;

export const ALTO_ENCABEZADO = { angosto: 60, ancho: 72 };

function BotonIcono({ etiqueta, onPress, testID, children, expandido, conPopup }) {
  return (
    <Pressable
      role="button"
      aria-label={etiqueta}
      aria-expanded={expandido}
      aria-haspopup={conPopup}
      onPress={conFoco(onPress)}
      testID={testID}
      style={({ hovered, pressed }) => [estilos.botonIcono, (hovered || pressed) && estilos.botonResaltado]}
    >
      {children}
    </Pressable>
  );
}

export default function EncabezadoInstitucional() {
  const { width } = useWindowDimensions();
  const { navegar } = useRuta();
  const aviso = useAvisoFlotante();
  const noLeidas = useMunicipal((s) => s.noLeidas) ?? 0;
  const usuario = useMunicipal((s) => s.usuario);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const escritorio = width >= cortes.escritorio;
  const alto = escritorio ? ALTO_ENCABEZADO.ancho : ALTO_ENCABEZADO.angosto;
  const altoLogo = escritorio ? 44 : 34;
  const muestraLogo = width >= 340;
  const muestra147 = width >= 380;
  const nombreCorto = (usuario?.nombre || '').split(' ')[0];
  const inicial = (usuario?.nombre || 'V').slice(0, 1).toUpperCase();

  const cerrarSesion = async () => {
    setMenuAbierto(false);
    try {
      await cerrarSesionDesdeMarco();
    } catch {
      aviso.mostrar('No se pudo cerrar la sesión. Intentá de nuevo.', 'peligro');
    }
  };

  return (
    <View role="banner" style={[estilos.barra, { height: alto }]} dataSet={{ noImprimir: true }}>
      <View style={[estilos.interior, { paddingHorizontal: escritorio ? espacio.xl : espacio.m }]}>
        <Pressable
          role="link"
          aria-label="San Francisco Conecta, ir al inicio"
          onPress={() => navegar('inicio')}
          testID="marca-inicio"
          style={estilos.marca}
        >
          {muestraLogo ? (
            <>
              <Image
                source={LOGO}
                aria-hidden
                style={{ height: altoLogo, width: Math.round(altoLogo * PROPORCION_LOGO) }}
                resizeMode="contain"
              />
              <View style={estilos.separador} />
            </>
          ) : null}
          <View>
            <Texto variante="titulo3" color={colores.blanco} estilo={escritorio ? estilos.marcaGrande : estilos.marcaChica}>
              Conecta
            </Texto>
            <Texto variante="chico" color={colores.blanco} peso="600" estilo={estilos.subMarca}>
              San Francisco
            </Texto>
          </View>
        </Pressable>

        <View style={estilos.acciones}>
          {muestra147 ? (
            escritorio ? (
              <Pressable
                role="link"
                aria-label="Llamar al 147, atención al vecino"
                onPress={() => abrirEnlace('tel:147').catch(() => {})}
                testID="encabezado-147"
                style={({ hovered }) => [estilos.ayuda, hovered && estilos.botonResaltado]}
              >
                <Icono nombre="telefono" tamano={18} color={colores.blanco} />
                <Texto variante="chico" color={colores.blanco} peso="700">
                  Atención 147
                </Texto>
              </Pressable>
            ) : (
              <BotonIcono
                etiqueta="Llamar al 147, atención al vecino"
                onPress={() => abrirEnlace('tel:147').catch(() => {})}
                testID="encabezado-147"
              >
                <Icono nombre="telefono" tamano={22} color={colores.blanco} />
              </BotonIcono>
            )
          ) : null}
          <BotonIcono
            etiqueta={noLeidas > 0 ? `Ver notificaciones, ${noLeidas} sin leer` : 'Ver notificaciones'}
            onPress={() => navegar('notificaciones')}
            testID="boton-notificaciones"
          >
            <Icono nombre="campana" tamano={23} color={colores.blanco} />
            <View style={estilos.insignia}>
              <Insignia cantidad={noLeidas} testID="insignia-no-leidas" />
            </View>
          </BotonIcono>
          <Pressable
            role="button"
            aria-label={`Mi cuenta, ${usuario?.nombre || 'vecino'}`}
            aria-haspopup="dialog"
            aria-expanded={menuAbierto}
            onPress={conFoco(() => setMenuAbierto(true))}
            testID="boton-cuenta"
            style={({ hovered }) => [estilos.cuenta, hovered && estilos.botonResaltado]}
          >
            <View style={estilos.avatar}>
              <Texto variante="chico" peso="700" color={colores.accionOscuro}>
                {inicial}
              </Texto>
            </View>
            {escritorio ? (
              <Texto variante="chico" peso="700" color={colores.blanco} numberOfLines={1} estilo={estilos.nombreCuenta}>
                {nombreCorto || 'Mi cuenta'}
              </Texto>
            ) : null}
          </Pressable>
        </View>
      </View>
      <MenuCuenta
        visible={menuAbierto}
        usuario={usuario}
        arriba={alto}
        onCerrar={() => setMenuAbierto(false)}
        onMiCuenta={() => {
          setMenuAbierto(false);
          navegar('cuenta');
        }}
        onCerrarSesion={cerrarSesion}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    backgroundColor: colores.accion,
    zIndex: 10,
    ...sombras.barra,
  },
  interior: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  marca: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: medidas.toqueMinimo, flexShrink: 1, minWidth: 0 },
  separador: { width: 1, alignSelf: 'stretch', marginVertical: 12, backgroundColor: 'rgba(255,255,255,0.45)' },
  marcaGrande: { fontSize: 24, lineHeight: 28 },
  marcaChica: { fontSize: 20, lineHeight: 24 },
  subMarca: { fontSize: 12, lineHeight: 16 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  botonIcono: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
    cursor: 'pointer',
  },
  botonResaltado: { backgroundColor: 'rgba(255,255,255,0.16)' },
  ayuda: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    borderRadius: radios.pildora,
    cursor: 'pointer',
  },
  insignia: { position: 'absolute', top: 4, right: 2 },
  cuenta: {
    minHeight: medidas.toqueMinimo,
    minWidth: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    paddingHorizontal: 6,
    borderRadius: radios.pildora,
    cursor: 'pointer',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radios.pildora,
    backgroundColor: colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombreCuenta: { maxWidth: 140 },
});
