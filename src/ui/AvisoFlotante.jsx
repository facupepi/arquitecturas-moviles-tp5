// Aviso flotante (toast) (WP5, 7.2).
//   <ProveedorAvisos margenInferior? arriba?> … </ProveedorAvisos>
// Con `arriba` se dibuja sobre el encabezado (en el celular no tapa la acción principal ni la
// barra inferior); si no, abajo, a `margenInferior` del borde.
//   const aviso = useAvisoFlotante();
//   aviso.mostrar(mensaje, tono = 'exito', destino?)   // destino: hash interno → botón "Ver"
//   aviso.ocultar()
// `mensaje` es un texto o { titulo, cuerpo }. Dura 5 s (se pausa con el puntero o el foco encima),
// se anuncia con role="status" y se limpia al navegar a otra ruta (UIX-12).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios, sombras } from '../tema/tokens';
import { leerHash } from '../plataforma/hash';
import { useRutaOpcional } from '../navegacion/ProveedorNavegacion';
import { rellenoSuperiorSeguro } from './areaSegura';
import Icono from './Icono';
import Texto from './Texto';

export const DURACION_AVISO_MS = 5000;

const ICONOS = { exito: 'checkCirculo', info: 'info', alerta: 'alerta', peligro: 'alerta' };
const ACENTOS = {
  exito: colores.exitoAcento,
  info: colores.municipal,
  alerta: colores.alertaAcento,
  peligro: colores.peligroAcento,
};

const ContextoAvisos = createContext(null);

const SIN_PROVEEDOR = {
  mostrar: () => {
    if (__DEV__) console.warn('useAvisoFlotante() sin <ProveedorAvisos>: el aviso no se muestra.');
  },
  ocultar: () => {},
};

export function useAvisoFlotante() {
  return useContext(ContextoAvisos) ?? SIN_PROVEEDOR;
}

export function ProveedorAvisos({ children, margenInferior = espacio.xl, arriba = false }) {
  const [aviso, setAviso] = useState(null);
  const temporizador = useRef(null);
  const pausado = useRef(false);
  const navegacion = useRutaOpcional();
  const contador = useRef(0);

  const limpiarTemporizador = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  };

  const ocultar = useCallback(() => {
    limpiarTemporizador();
    setAviso(null);
  }, []);

  const programar = useCallback(() => {
    limpiarTemporizador();
    temporizador.current = setTimeout(() => {
      if (!pausado.current) setAviso(null);
    }, DURACION_AVISO_MS);
  }, []);

  const mostrar = useCallback(
    (mensaje, tono = 'exito', destino = null) => {
      contador.current += 1;
      const contenido = typeof mensaje === 'string' ? { titulo: null, cuerpo: mensaje } : { titulo: mensaje?.titulo ?? null, cuerpo: mensaje?.cuerpo ?? '' };
      // Se guarda el hash del momento: si la pantalla navega y después muestra el aviso, no se borra.
      setAviso({ ...contenido, tono, destino, hash: leerHash(), clave: contador.current });
      pausado.current = false;
      programar();
    },
    [programar],
  );

  // Se limpia al navegar (UIX-12).
  const hashActual = navegacion?.hash;
  useEffect(() => {
    setAviso((actual) => (actual && hashActual !== undefined && actual.hash !== hashActual ? null : actual));
  }, [hashActual]);

  useEffect(() => limpiarTemporizador, []);

  const pausar = () => {
    pausado.current = true;
    limpiarTemporizador();
  };
  const reanudar = () => {
    pausado.current = false;
    programar();
  };

  const ver = () => {
    const destino = aviso?.destino;
    ocultar();
    if (destino && navegacion) navegacion.irA(destino);
  };

  const valor = useMemo(() => ({ mostrar, ocultar }), [mostrar, ocultar]);

  return (
    <ContextoAvisos.Provider value={valor}>
      <View style={estilos.raiz}>
        {children}
        {/* La región viva existe siempre para que los lectores de pantalla anuncien el cambio. */}
        <View
          role="status"
          aria-live="polite"
          style={[
            estilos.region,
            arriba ? { top: espacio.s, paddingTop: rellenoSuperiorSeguro } : { bottom: margenInferior },
            { pointerEvents: 'box-none' },
          ]}
          dataSet={{ noImprimir: true }}
        >
          {aviso ? (
            <View
              key={aviso.clave}
              testID="aviso-flotante"
              onPointerEnter={pausar}
              onPointerLeave={reanudar}
              style={[estilos.aviso, { borderLeftColor: ACENTOS[aviso.tono] ?? ACENTOS.exito }]}
            >
              <Icono nombre={ICONOS[aviso.tono] ?? 'info'} tamano={22} color={colores.blanco} />
              <View style={estilos.textos}>
                {aviso.titulo ? (
                  <Texto variante="cuerpo" peso="700" color={colores.blanco}>
                    {aviso.titulo}
                  </Texto>
                ) : null}
                {aviso.cuerpo ? (
                  <Texto variante={aviso.titulo ? 'chico' : 'cuerpo'} color={colores.blanco} numberOfLines={3}>
                    {aviso.cuerpo}
                  </Texto>
                ) : null}
              </View>
              {aviso.destino ? (
                <Pressable
                  role="button"
                  onPress={ver}
                  onFocus={pausar}
                  onBlur={reanudar}
                  testID="aviso-flotante-ver"
                  style={({ hovered }) => [estilos.ver, hovered && estilos.verResaltado]}
                >
                  <Texto variante="chico" peso="700" color={colores.texto}>
                    Ver
                  </Texto>
                </Pressable>
              ) : null}
              <Pressable
                role="button"
                aria-label="Cerrar aviso"
                onPress={ocultar}
                onFocus={pausar}
                onBlur={reanudar}
                style={estilos.cerrar}
              >
                <Icono nombre="cerrar" tamano={18} color={colores.blanco} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </ContextoAvisos.Provider>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, minHeight: 0 },
  region: {
    position: 'absolute',
    left: espacio.l,
    right: espacio.l,
    alignItems: 'center',
    zIndex: 50,
  },
  aviso: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingLeft: espacio.l,
    paddingRight: espacio.xs,
    paddingVertical: espacio.s,
    minHeight: 56,
    borderRadius: radios.medio,
    borderLeftWidth: 5,
    backgroundColor: colores.texto,
    ...sombras.flotante,
  },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  ver: {
    minHeight: medidas.toqueMinimo,
    minWidth: medidas.toqueMinimo,
    paddingHorizontal: espacio.m,
    borderRadius: radios.chico,
    backgroundColor: colores.blanco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verResaltado: { backgroundColor: colores.celesteClaro },
  cerrar: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
  },
});
