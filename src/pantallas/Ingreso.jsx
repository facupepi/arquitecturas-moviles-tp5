// Ingreso (S1, sección 8.1). Se muestra sin sesión, fuera del enrutador. Solo se ingresa con una
// cuenta de Google (no hay acceso anónimo).
// - Una sola columna centrada en los dos ejes, de 460 px como máximo: tarjeta con la marca, el
//   título, la bajada y "Continuar con Google" (popup con respaldo de redirect; completarRedireccion
//   lo llama App.jsx), con el error justo debajo del botón.
// - Debajo, compactos: privacidad resumida (Ley 25.326) e instalación de la PWA; al pie, el 147.
// - La leyenda de prototipo va arriba de todo, como en el resto de la app.
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ingresarConGoogle, mensajeDeError } from '../firebase/auth';
import { EVENTOS } from '../firebase/analytics';
import { useComando } from '../datos/useComando';
import { useTituloDocumento } from '../navegacion/useTituloDocumento';
import { colores, cortes, espacio, medidas, radios, sombras } from '../tema/tokens';
import { Aviso, Boton, Icono, Texto } from '../ui';
import LeyendaPrototipo, { ContextoLeyenda } from '../marco/LeyendaPrototipo';
import { quitarArranque } from '../plataforma/arranque';
import BotonGoogle from './cuenta/BotonGoogle';
import Instalar from './cuenta/Instalar';
import { MENSAJES_SALIDA, tomarAvisoSalida } from './cuenta/avisoSalida';
import { LEY, PRIVACIDAD_BREVE } from './cuenta/textos';

// Copia del logo a 174 × 102 (3 × 58 × 34) y 256 colores, 4 KB en lugar de 60: la pantalla de arranque
// de index.html lo pide antes que el JavaScript y así casi no le quita ancho de banda.
const LOGO = { uri: '/brand/municipalidad-blanco-ingreso.png' };
const PROPORCION_LOGO = 372 / 217;
const ANCHO_COLUMNA = 460;
const TITULO = 'Tu ciudad, a un toque.';
// index.html trae una copia estática de esta pantalla (#arranque) que tapa a React mientras carga.
// Se quita cuando el logo ya se ve (si no, parpadearía) o, como mucho, a este tiempo del montaje.
const ESPERA_MAXIMA_LOGO_MS = 600;

function Marca({ alCargarLogo }) {
  return (
    <View style={estilos.marca}>
      <Image
        source={LOGO}
        aria-hidden
        resizeMode="contain"
        onLoad={alCargarLogo}
        onError={alCargarLogo}
        style={{ height: 34, width: Math.round(34 * PROPORCION_LOGO) }}
      />
      <View style={estilos.separadorMarca} />
      <View>
        <Texto variante="titulo3" color={colores.blanco} estilo={estilos.nombreMarca}>
          Conecta
        </Texto>
        <Texto variante="chico" color={colores.blanco} peso="600" estilo={estilos.subMarca}>
          San Francisco
        </Texto>
      </View>
    </View>
  );
}

function Subtitulo({ children }) {
  return (
    <Texto role="heading" aria-level={2} variante="cuerpo" peso="700">
      {children}
    </Texto>
  );
}

export default function Ingreso() {
  useTituloDocumento(TITULO);
  const { width } = useWindowDimensions();
  const angosto = width < cortes.tableta;
  const margen = angosto ? medidas.margenLateral : espacio.xl;
  const [avisoSalida] = useState(() => tomarAvisoSalida());

  useEffect(() => {
    const espera = setTimeout(quitarArranque, ESPERA_MAXIMA_LOGO_MS);
    return () => clearTimeout(espera);
  }, []);

  const google = useComando(ingresarConGoogle, {
    evento: EVENTOS.LOGIN,
    parametrosEvento: () => ({ method: 'google' }),
  });
  const error = google.error;
  const cerroVentana = error?.causa?.code === 'auth/popup-closed-by-user' || error?.causa?.code === 'auth/cancelled-popup-request';
  const salida = avisoSalida ? MENSAJES_SALIDA[avisoSalida] : null;

  return (
    <View style={estilos.raiz}>
      <LeyendaPrototipo />
      <ContextoLeyenda.Provider value>
        <ScrollView
          testID="pantalla-ingreso"
          style={estilos.desplazable}
          contentContainerStyle={[estilos.centrado, { paddingHorizontal: margen }]}
        >
          <View role="main" style={estilos.columna}>
            <View style={estilos.tarjeta}>
              <Marca alCargarLogo={quitarArranque} />
              <View style={estilos.cuerpoTarjeta}>
                <View style={estilos.textos}>
                  <Texto variante="antetitulo" color={colores.accion} alineacion="center">
                    San Francisco, Córdoba
                  </Texto>
                  <Texto
                    role="heading"
                    aria-level={1}
                    variante="titulo1"
                    alineacion="center"
                    testID="titulo-pantalla"
                    estilo={width < 380 ? estilos.tituloChico : null}
                  >
                    {TITULO}
                  </Texto>
                  <Texto variante="cuerpo" color={colores.textoSuave} alineacion="center" estilo={angosto ? estilos.bajadaAngosta : null}>
                    Trámites, recorridos y avisos en un solo lugar.
                  </Texto>
                </View>
                {salida ? (
                  <Aviso tono="exito" titulo={salida.titulo} mensaje={salida.mensaje} testID="aviso-salida" />
                ) : null}
                <View style={estilos.accion}>
                  <BotonGoogle
                    titulo={google.ocupado ? 'Conectando con Google…' : 'Continuar con Google'}
                    cargando={google.ocupado}
                    onPress={() => google.ejecutar()}
                    testID="ingresar-google"
                  />
                  {error ? (
                    <Aviso
                      tono={cerroVentana ? 'info' : 'peligro'}
                      rol="alert"
                      titulo={cerroVentana ? 'No se completó el ingreso' : 'No pudimos hacerte ingresar'}
                      mensaje={mensajeDeError(error)}
                      testID="error-ingreso"
                    />
                  ) : null}
                </View>
                <Texto variante="chico" color={colores.textoSuave} alineacion="center">
                  Usás la misma cuenta en el celular y en la computadora.
                </Texto>
              </View>
            </View>

            <View style={estilos.panel}>
              <View testID="privacidad-breve" style={estilos.bloque}>
                <Subtitulo>Tus datos, cuidados</Subtitulo>
                <View role="list" style={estilos.puntos}>
                  {PRIVACIDAD_BREVE.map((p) => (
                    <View key={p.titulo} role="listitem" style={estilos.punto}>
                      <Icono nombre={p.icono} tamano={18} color={colores.accion} />
                      <Texto variante="chico" estilo={estilos.flexible}>
                        {p.titulo}
                      </Texto>
                    </View>
                  ))}
                </View>
                <Texto variante="chico" color={colores.textoSuave}>
                  {`Tus derechos según la ${LEY}. El detalle completo está en Mi cuenta.`}
                </Texto>
              </View>
              <View style={estilos.linea} />
              <View style={estilos.bloque}>
                <Subtitulo>Instalá Conecta en tu celular</Subtitulo>
                <Instalar compacto />
              </View>
            </View>

            <View style={estilos.ayuda}>
              <Texto variante="chico" color={colores.textoSuave}>
                ¿Necesitás ayuda?
              </Texto>
              <Boton titulo="Llamar al 147" icono="telefono" variante="texto" href="tel:147" etiquetaAccesible="Llamar al 147, atención al vecino" />
            </View>
          </View>
        </ScrollView>
      </ContextoLeyenda.Provider>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, minHeight: 0, backgroundColor: colores.fondo },
  desplazable: { flex: 1, minHeight: 0 },
  // flexGrow + justifyContent: centrado vertical cuando entra; si no entra, empieza arriba y desplaza.
  centrado: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: espacio.xl },
  columna: { width: '100%', maxWidth: ANCHO_COLUMNA, gap: espacio.l },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radios.grande,
    borderWidth: 1,
    borderColor: colores.borde,
    overflow: 'hidden',
    ...sombras.tarjeta,
  },
  marca: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.m,
    backgroundColor: colores.accion,
  },
  separadorMarca: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.45)' },
  nombreMarca: { fontSize: 18, lineHeight: 20 },
  subMarca: { fontSize: 12, lineHeight: 15 },
  cuerpoTarjeta: { paddingHorizontal: espacio.xl, paddingTop: espacio.xl, paddingBottom: espacio.xl, gap: espacio.l },
  textos: { gap: espacio.s, alignItems: 'center' },
  // En el celular corta la bajada en dos líneas parejas, sin una palabra sola abajo.
  bajadaAngosta: { maxWidth: 240 },
  // En 360 px el título entra en una línea.
  tituloChico: { fontSize: 24, lineHeight: 30 },
  accion: { gap: espacio.m },
  panel: {
    backgroundColor: colores.superficie,
    borderRadius: radios.grande,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.l,
    gap: espacio.l,
  },
  bloque: { gap: espacio.s },
  puntos: { gap: espacio.s },
  punto: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  flexible: { flex: 1, minWidth: 0 },
  linea: { height: 1, backgroundColor: colores.borde },
  ayuda: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: espacio.xs },
});
