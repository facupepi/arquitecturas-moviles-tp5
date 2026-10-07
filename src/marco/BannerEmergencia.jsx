// Banner de emergencia (WP5, 7.4; FUN-09). Muestra `banner_emergencia` de Remote Config
// ({ texto, nivel: 'alerta' | 'peligro', destino }) o, si no hay, el aviso más reciente de tipo
// `emergencias` con vigenteHasta > ahora. Se puede cerrar (vuelve si cambia el texto).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useConfigRemota } from '../firebase/configRemota';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { construirHash } from '../../shared/rutas.mjs';
import { espacio } from '../tema/tokens';
import Aviso from '../ui/Aviso';

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

export default function BannerEmergencia() {
  const { bannerEmergencia } = useConfigRemota() ?? {};
  const avisos = useMunicipal((s) => s.avisos);
  const ahora = useAhora(60000);
  const { irA } = useRuta();
  const [cerrado, setCerrado] = useState(null);

  const banner = elegirBanner(bannerEmergencia, avisos, ahora);
  if (!banner || cerrado === banner.clave) return null;

  return (
    <View style={estilos.contenedor}>
      <Aviso
        tono={banner.tono}
        rol="alert"
        titulo={banner.titulo}
        mensaje={banner.mensaje}
        accion={banner.destino ? { titulo: 'Ver más', onPress: () => irA(banner.destino), testID: 'banner-emergencia-ver' } : undefined}
        onCerrar={() => setCerrado(banner.clave)}
        testID="banner-emergencia"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { paddingHorizontal: espacio.m, paddingTop: espacio.s },
});
