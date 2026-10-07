// Banner de emergencia (WP5, 7.4; FUN-09). Muestra `banner_emergencia` de Remote Config
// ({ texto, nivel: 'alerta' | 'peligro', destino }) o, si no hay, el aviso más reciente de tipo
// `emergencias` con vigenteHasta > ahora. Se puede cerrar (vuelve si cambia el texto).
// En el celular va compacto (una franja de 60 px: título y una línea del mensaje, "Ver" y cerrar)
// para no empujar la grilla de Inicio fuera de la pantalla; el texto completo está en el detalle.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useConfigRemota } from '../firebase/configRemota';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { construirHash } from '../../shared/rutas.mjs';
import { colores, cortes, espacio, medidas, radios } from '../tema/tokens';
import Aviso, { TONOS_AVISO } from '../ui/Aviso';
import Icono from '../ui/Icono';
import Texto from '../ui/Texto';
import { conFoco } from '../ui/comun';

/** El banner vigente, o null. Exportada para la galería y para Inicio. */
export function elegirBanner(bannerConfig, avisos, ahora) {
  if (bannerConfig && typeof bannerConfig.texto === 'string' && bannerConfig.texto.trim()) {
    return {
      clave: `config:${bannerConfig.texto}`,
      titulo: 'Aviso de emergencia',
      mensaje: bannerConfig.texto.trim(),
      tono: bannerConfig.nivel === 'alerta' ? 'alerta' : 'peligro',
      destino: bannerConfig.destino || null,
    };
  }
  const aviso = (avisos ?? []).find(
    (a) => a?.tipo === 'emergencias' && typeof a.vigenteHasta === 'number' && a.vigenteHasta > ahora,
  );
  if (!aviso) return null;
  return {
    clave: `aviso:${aviso.id}`,
    titulo: aviso.titulo,
    mensaje: aviso.cuerpo,
    tono: 'peligro',
    destino: aviso.destino || construirHash('notificaciones', aviso.id),
  };
}

function BannerCompacto({ banner, onVer, onCerrar }) {
  const t = TONOS_AVISO[banner.tono] ?? TONOS_AVISO.peligro;
  return (
    <View
      role="alert"
      testID="banner-emergencia"
      style={[estilos.compacto, { backgroundColor: t.fondo, borderLeftColor: t.acento }]}
    >
      <Icono nombre={t.icono} tamano={20} color={t.texto} />
      <View style={estilos.textos}>
        <Texto variante="chico" peso="700" color={t.texto} numberOfLines={1}>
          {banner.titulo}
        </Texto>
        {banner.mensaje ? (
          <Texto variante="chico" color={colores.texto} numberOfLines={1}>
            {banner.mensaje}
          </Texto>
        ) : null}
      </View>
      {onVer ? (
        <Pressable
          role="button"
          aria-label={`Ver más: ${banner.titulo}`}
          onPress={conFoco(onVer)}
          testID="banner-emergencia-ver"
          style={({ hovered, pressed }) => [estilos.ver, (hovered || pressed) && estilos.verResaltado]}
        >
          <Texto variante="chico" peso="700" color={colores.accionOscuro}>
            Ver más
          </Texto>
        </Pressable>
      ) : null}
      <Pressable
        role="button"
        aria-label="Cerrar aviso"
        onPress={onCerrar}
        style={({ hovered }) => [estilos.cerrar, hovered && { backgroundColor: 'rgba(30,41,57,0.08)' }]}
      >
        <Icono nombre="cerrar" tamano={18} color={colores.texto} />
      </Pressable>
    </View>
  );
}

export default function BannerEmergencia() {
  const { bannerEmergencia } = useConfigRemota() ?? {};
  const avisos = useMunicipal((s) => s.avisos);
  const ahora = useAhora(60000);
  const { irA } = useRuta();
  const { width } = useWindowDimensions();
  const [cerrado, setCerrado] = useState(null);

  const banner = elegirBanner(bannerEmergencia, avisos, ahora);
  if (!banner || cerrado === banner.clave) return null;
  const onVer = banner.destino ? () => irA(banner.destino) : null;
  const onCerrar = () => setCerrado(banner.clave);

  return (
    <View style={estilos.contenedor}>
      {width < cortes.escritorio ? (
        <BannerCompacto banner={banner} onVer={onVer} onCerrar={onCerrar} />
      ) : (
        <Aviso
          tono={banner.tono}
          rol="alert"
          titulo={banner.titulo}
          mensaje={banner.mensaje}
          accion={onVer ? { titulo: 'Ver más', onPress: onVer, testID: 'banner-emergencia-ver' } : undefined}
          onCerrar={onCerrar}
          testID="banner-emergencia"
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { paddingHorizontal: espacio.m, paddingTop: espacio.s },
  compacto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingLeft: espacio.m,
    paddingRight: espacio.xs,
    paddingVertical: 2,
    minHeight: 52,
    borderRadius: radios.medio,
    borderLeftWidth: 5,
  },
  textos: { flex: 1, minWidth: 0 },
  ver: {
    minHeight: medidas.toqueMinimo,
    paddingHorizontal: espacio.s,
    justifyContent: 'center',
    borderRadius: radios.chico,
  },
  verResaltado: { backgroundColor: 'rgba(30,41,57,0.08)' },
  cerrar: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
  },
});
