// Aviso de versión nueva (WP5, 7.4). NO registra el service worker (eso pasa en index.web.js):
// solo escucha alHaberActualizacion de plataforma/registroSW y ofrece aplicarActualizacion().
// React Native puro: no necesita variante .web.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { alHaberActualizacion, aplicarActualizacion } from '../plataforma/registroSW';
import { espacio } from '../tema/tokens';
import Aviso from '../ui/Aviso';

export default function ActualizacionDisponible() {
  const [hay, setHay] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    try {
      return alHaberActualizacion(() => setHay(true));
    } catch {
      return undefined;
    }
  }, []);

  if (!hay) return null;
  return (
    <View style={estilos.contenedor}>
      <Aviso
        tono="info"
        titulo="Hay una versión nueva"
        mensaje={aplicando ? 'Actualizando…' : 'Actualizá para usar la última versión de la app.'}
        accion={
          aplicando
            ? undefined
            : {
                titulo: 'Actualizar',
                testID: 'actualizar-app',
                onPress: () => {
                  setAplicando(true);
                  Promise.resolve(aplicarActualizacion()).catch(() => setAplicando(false));
                },
              }
        }
        onCerrar={() => setHay(false)}
        testID="actualizacion-disponible"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { paddingHorizontal: espacio.m, paddingTop: espacio.s },
});
