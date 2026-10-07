// Aviso de privacidad completo (S1, dentro de Cuenta). Si el vecino todavía no lo leyó, ofrece
// "Entendido" (repositorio.aceptarPrivacidad, que guarda privacidadAceptadaEn en su perfil).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { aceptarPrivacidad } from '../../datos/repositorio';
import { useComando } from '../../datos/useComando';
import { colores, espacio } from '../../tema/tokens';
import { Aviso, Boton, EtiquetaEstado, Texto } from '../../ui';
import { fecha } from '../../../shared/formato.mjs';
import { PRIVACIDAD_COMPLETA } from './textos';

export default function Privacidad({ perfil, listo }) {
  const aceptar = useComando(aceptarPrivacidad);
  const aceptadaEn = perfil?.privacidadAceptadaEn ?? null;

  return (
    <View style={estilos.bloque} testID="privacidad-completa">
      {PRIVACIDAD_COMPLETA.map((p) => (
        <View key={p.titulo} style={estilos.punto}>
          <Texto role="heading" aria-level={3} variante="cuerpo" peso="700">
            {p.titulo}
          </Texto>
          <Texto variante="chico" color={colores.textoSuave}>
            {p.texto}
          </Texto>
        </View>
      ))}
      {aceptadaEn ? (
        <View style={estilos.leida} testID="privacidad-leida">
          <EtiquetaEstado texto="Leído" tono="exito" icono="check" />
          <Texto variante="chico" color={colores.textoSuave}>
            Confirmaste que leíste este aviso el {fecha(aceptadaEn)}.
          </Texto>
        </View>
      ) : (
        <View style={estilos.accion}>
          <Boton
            titulo="Entendido"
            icono="check"
            variante="secundario"
            cargando={aceptar.ocupado}
            deshabilitado={!listo || !perfil}
            onPress={() => aceptar.ejecutar()}
            testID="aceptar-privacidad"
          />
          {aceptar.error ? (
            <Aviso tono="peligro" rol="alert" mensaje={aceptar.error.message} testID="error-privacidad" />
          ) : null}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.m },
  punto: { gap: 2 },
  leida: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacio.s },
  accion: { gap: espacio.s },
});
