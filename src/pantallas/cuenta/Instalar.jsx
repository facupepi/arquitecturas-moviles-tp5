// Bloque "Instalar la app" (S1), compartido por Ingreso y Cuenta.
// - Ya instalada: lo confirma.
// - El navegador ofreció la instalación (Chrome, Edge, Samsung Internet): botón "Instalar la app".
// - iPhone o iPad: pasos de Safari ("Compartir" y "Agregar a inicio").
// - Otro caso: cómo hacerlo desde el menú del navegador.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../../tema/tokens';
import { Boton, EtiquetaEstado, Icono, Texto } from '../../ui';
import { useInstalacion } from '../../plataforma/instalacion';

function Paso({ numero, children }) {
  return (
    <View style={estilos.paso}>
      <View style={estilos.numero}>
        <Texto variante="chico" peso="700" color={colores.accionOscuro}>
          {numero}
        </Texto>
      </View>
      <Texto variante="chico" estilo={estilos.flexible}>
        {children}
      </Texto>
    </View>
  );
}

export default function Instalar({ compacto = false }) {
  const { disponible, esIOS, instalada, instalar } = useInstalacion();
  const [respuesta, setRespuesta] = useState(null);

  if (instalada) {
    return (
      <View testID="instalacion-lista" style={estilos.bloque}>
        <EtiquetaEstado texto="App instalada" tono="exito" icono="checkCirculo" />
        <Texto variante="chico" color={colores.textoSuave}>
          Funciona también sin conexión, con los últimos datos guardados.
        </Texto>
      </View>
    );
  }

  if (disponible) {
    return (
      <View testID="instalacion-disponible" style={estilos.bloque}>
        {compacto ? null : (
          <Texto variante="chico" color={colores.textoSuave}>
            Queda un ícono en tu pantalla de inicio, se abre a pantalla completa y funciona sin conexión.
          </Texto>
        )}
        <Boton
          titulo="Instalar la app"
          icono="instalar"
          variante="secundario"
          ancho="completo"
          testID="instalar-app"
          onPress={async () => setRespuesta(await instalar())}
        />
      </View>
    );
  }

  return (
    <View testID={esIOS ? 'instalacion-ios' : 'instalacion-manual'} style={estilos.bloque}>
      {respuesta === 'dismissed' ? (
        <Texto variante="chico" color={colores.textoSuave}>
          Podés instalarla más tarde desde el menú del navegador.
        </Texto>
      ) : null}
      {esIOS ? (
        <>
          <Texto variante="chico" color={colores.textoSuave}>
            En iPhone se instala desde Safari:
          </Texto>
          <Paso numero="1">
            Tocá <Texto variante="chico" peso="700">Compartir</Texto> (el cuadrado con la flecha hacia arriba).
          </Paso>
          <Paso numero="2">
            Elegí <Texto variante="chico" peso="700">Agregar a inicio</Texto> y confirmá con Agregar.
          </Paso>
        </>
      ) : (
        <View style={estilos.fila}>
          <Icono nombre="instalar" tamano={18} color={colores.textoSuave} />
          <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible}>
            Abrí el menú del navegador y elegí{' '}
            <Texto variante="chico" peso="700" color={colores.texto}>
              Instalar app
            </Texto>{' '}
            o{' '}
            <Texto variante="chico" peso="700" color={colores.texto}>
              Agregar a la pantalla principal
            </Texto>
            .
          </Texto>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.s },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s },
  paso: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
  numero: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colores.celesteClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexible: { flex: 1, minWidth: 0 },
});
