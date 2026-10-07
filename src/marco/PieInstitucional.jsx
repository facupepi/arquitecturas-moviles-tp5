// Pie institucional (WP5, 7.4). Va al final del contenido desplazable de cada <Pantalla>.
// - Celular: corto (leyenda, 147 y portal municipal) para no alargar la página (UIX-13).
// - Escritorio: las tres columnas de heredado:MunicipalChrome.jsx:193-298 y la leyenda.
import React from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { abrirEnlace } from '../plataforma/enlaces';
import { colores, cortes, espacio, medidas, radios } from '../tema/tokens';
import Icono from '../ui/Icono';
import Texto from '../ui/Texto';
import { useTextoLeyenda } from './LeyendaPrototipo';

const PORTAL = 'https://www.sanfrancisco.gov.ar/';
const TANA = 'https://wa.me/5493564336062';
const TELEFONOS_UTILES = 'https://www.sanfrancisco.gov.ar/contenidos/telefonos-utiles-355';
const REDES = [
  { nombre: 'Facebook', url: 'https://www.facebook.com/municipalidaddesanfrancisco/' },
  { nombre: 'Instagram', url: 'https://www.instagram.com/municipalidaddesanfrancisco/' },
  { nombre: 'YouTube', url: 'https://www.youtube.com/@SanFcoTeVe' },
];

function Enlace({ texto, onPress, externo = false, etiqueta, compacto = false, testID }) {
  return (
    <Pressable
      role="link"
      onPress={onPress}
      aria-label={etiqueta ?? (externo ? `${texto} (se abre en otra pestaña)` : undefined)}
      testID={testID}
      style={[estilos.enlace, compacto ? estilos.enlaceCompacto : estilos.enlaceTactil]}
    >
      {({ hovered, focused }) => (
        <>
          <Texto
            variante="chico"
            peso="600"
            color={colores.pieTexto}
            estilo={hovered || focused ? estilos.subrayado : null}
          >
            {texto}
          </Texto>
          {externo ? <Icono nombre="externo" tamano={14} color={colores.pieTexto} /> : null}
        </>
      )}
    </Pressable>
  );
}

function Columna({ titulo, children }) {
  return (
    <View style={estilos.columna}>
      <Texto role="heading" aria-level={3} variante="cuerpo" peso="700" color={colores.blanco}>
        {titulo}
      </Texto>
      <View style={estilos.enlaces}>{children}</View>
    </View>
  );
}

export default function PieInstitucional() {
  const { width } = useWindowDimensions();
  const { navegar } = useRuta();
  const leyenda = useTextoLeyenda();
  const escritorio = width >= cortes.escritorio;
  const abrir = (url) => () => abrirEnlace(url).catch(() => {});
  const ir = (ruta) => () => navegar(ruta);

  if (!escritorio) {
    return (
      <View role="contentinfo" testID="pie-institucional" style={[estilos.pie, estilos.pieMovil]} dataSet={{ noImprimir: true }}>
        <Texto variante="chico" color={colores.pieTexto} estilo={estilos.leyenda}>
          {leyenda}
        </Texto>
        <View style={estilos.filaMovil}>
          <Enlace texto="Llamar al 147" etiqueta="Llamar al 147, atención al vecino" onPress={abrir('tel:147')} />
          <Enlace texto="Portal municipal" externo onPress={abrir(PORTAL)} />
        </View>
      </View>
    );
  }

  return (
    <View role="contentinfo" testID="pie-institucional" style={estilos.pie} dataSet={{ noImprimir: true }}>
      <View style={estilos.interior}>
        <View style={estilos.ayuda}>
          <View style={estilos.flexible}>
            <Texto role="heading" aria-level={2} variante="titulo2" color={colores.blanco}>
              Estamos cerca.
            </Texto>
            <Texto variante="cuerpo" color={colores.pieTexto}>
              Encontrá el canal de atención que necesitás.
            </Texto>
          </View>
          <Pressable
            role="link"
            aria-label="Hablá con Tana por WhatsApp (se abre en otra pestaña)"
            onPress={abrir(TANA)}
            style={({ hovered }) => [estilos.tana, hovered && estilos.tanaResaltada]}
          >
            <Icono nombre="mensaje" tamano={20} color={colores.pie} />
            <Texto variante="cuerpo" peso="700" color={colores.pie}>
              Hablá con Tana
            </Texto>
            <Icono nombre="externo" tamano={16} color={colores.pie} />
          </Pressable>
        </View>

        <View style={estilos.columnas}>
          <Columna titulo="Servicios al vecino">
            <Enlace compacto texto="Bicicletas públicas" onPress={ir('bicicletas')} />
            <Enlace compacto texto="Mis tributos" onPress={ir('tributos')} />
            <Enlace compacto texto="Centro de reclamos" onPress={ir('reclamos')} />
            <Enlace compacto texto="Estacionamiento" onPress={ir('estacionamiento')} />
          </Columna>
          <Columna titulo="Tu ciudad">
            <Enlace compacto texto="Alarmas comunitarias" onPress={ir('alarmas')} />
            <Enlace compacto texto="Avisos y novedades" onPress={ir('notificaciones')} />
            <Enlace compacto texto="Líneas de atención" onPress={ir('contactos')} />
            <Enlace compacto texto="Portal municipal" externo onPress={abrir(PORTAL)} />
          </Columna>
          <Columna titulo="Contacto municipal">
            <Texto variante="chico" color={colores.pieTexto}>
              Bv. 9 de Julio 1187{'\n'}San Francisco, Córdoba
            </Texto>
            <Enlace compacto texto="03564 439111" etiqueta="Llamar al conmutador municipal, 03564 439111" onPress={abrir('tel:+543564439111')} />
            <Enlace compacto texto="147, Atención ciudadana" etiqueta="Llamar al 147, atención ciudadana" onPress={abrir('tel:147')} />
            <Enlace compacto texto="Teléfonos útiles" externo onPress={abrir(TELEFONOS_UTILES)} />
          </Columna>
        </View>

        <View style={estilos.inferior}>
          <View style={estilos.identidad}>
            <Image
              source={{ uri: '/brand/municipalidad-blanco.png' }}
              aria-label="Municipalidad de San Francisco"
              style={estilos.logo}
              resizeMode="contain"
            />
            <View>
              <Texto variante="chico" peso="700" color={colores.blanco}>
                San Francisco Conecta
              </Texto>
              <Texto variante="chico" color={colores.pieTexto}>
                Servicios al vecino
              </Texto>
            </View>
          </View>
          <View role="navigation" aria-label="Redes del municipio" style={estilos.redes}>
            {REDES.map((r) => (
              <Enlace key={r.nombre} compacto texto={r.nombre} externo onPress={abrir(r.url)} />
            ))}
          </View>
        </View>
        <Texto variante="chico" color={colores.pieTexto} estilo={estilos.leyenda}>
          {leyenda}
        </Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pie: { backgroundColor: colores.pie, alignSelf: 'stretch' },
  pieMovil: { paddingHorizontal: medidas.margenLateral, paddingVertical: espacio.l, gap: espacio.s },
  filaMovil: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espacio.l },
  interior: {
    width: '100%',
    maxWidth: medidas.anchoMaximo,
    alignSelf: 'center',
    paddingHorizontal: espacio.xl,
    paddingTop: espacio.xxl,
    paddingBottom: espacio.xl,
    gap: espacio.xl,
  },
  ayuda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.l,
    paddingBottom: espacio.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220,231,240,0.2)',
  },
  flexible: { flex: 1, gap: espacio.xs },
  tana: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.l,
    borderRadius: radios.pildora,
    backgroundColor: colores.pieTexto,
    cursor: 'pointer',
  },
  tanaResaltada: { backgroundColor: colores.blanco },
  columnas: { flexDirection: 'row', gap: espacio.xl },
  columna: { flex: 1, gap: espacio.s },
  enlaces: { gap: 2 },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', cursor: 'pointer' },
  enlaceTactil: { minHeight: medidas.toqueMinimo },
  enlaceCompacto: { minHeight: 32 },
  subrayado: { textDecorationLine: 'underline' },
  inferior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: espacio.l,
    paddingTop: espacio.l,
    borderTopWidth: 1,
    borderTopColor: 'rgba(220,231,240,0.2)',
  },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  logo: { width: 96, height: 56 },
  redes: { flexDirection: 'row', gap: espacio.l },
  leyenda: { opacity: 1 },
});
