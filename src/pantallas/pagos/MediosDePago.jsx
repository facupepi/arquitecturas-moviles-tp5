// Elección del medio de pago de la pasarela (T2, E2, E4). Es un grupo de radios: cada opción tiene
// role="radio", aria-checked, área táctil de 64 px y se elige con toque, Enter, espacio o las
// flechas (como pide el patrón radiogroup de WAI-ARIA). El estado elegido no depende solo del
// color: el círculo de la derecha se llena con un tilde y el borde se engrosa.
// No hay campos de tarjeta ni de cuenta: solo se elige el medio (requisito de seguridad).
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../../tema/tokens';
import { Icono, Texto } from '../../ui';
import { alPresionarEspacio, useIdAccesible } from '../../ui/comun';
import { OPCIONES_MEDIO } from './pasarela';

const SIGUIENTE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

const MediosDePago = forwardRef(function MediosDePago({ valor, onCambio, error, deshabilitado = false, testID = 'medio' }, ref) {
  const idEtiqueta = useIdAccesible('medios-pago');
  const idError = `${idEtiqueta}-error`;
  const opciones = useRef([]);

  // ref.focus() lleva el foco a la opción elegida o a la primera (cuando falta elegir).
  useImperativeHandle(ref, () => ({
    focus: () => {
      const i = Math.max(0, OPCIONES_MEDIO.findIndex((o) => o.valor === valor));
      opciones.current[i]?.focus?.();
    },
  }), [valor]);

  const alTeclear = (indice) => (evento) => {
    const tecla = evento?.nativeEvent?.key ?? evento?.key;
    const paso = SIGUIENTE[tecla];
    if (paso) {
      evento.preventDefault?.();
      const destino = (indice + paso + OPCIONES_MEDIO.length) % OPCIONES_MEDIO.length;
      onCambio(OPCIONES_MEDIO[destino].valor);
      opciones.current[destino]?.focus?.();
      return;
    }
    alPresionarEspacio(() => onCambio(OPCIONES_MEDIO[indice].valor))(evento);
  };

  return (
    <View style={estilos.contenedor}>
      <Texto id={idEtiqueta} variante="cuerpo" peso="700">
        Elegí cómo pagar
      </Texto>
      <View
        role="radiogroup"
        aria-labelledby={idEtiqueta}
        aria-describedby={error ? idError : undefined}
        aria-required
        aria-invalid={error ? true : undefined}
        testID={testID}
        style={estilos.opciones}
      >
        {OPCIONES_MEDIO.map((o, i) => {
          const elegido = valor === o.valor;
          return (
            <Pressable
              key={o.valor}
              ref={(nodo) => { opciones.current[i] = nodo; }}
              role="radio"
              aria-checked={elegido}
              aria-disabled={deshabilitado || undefined}
              disabled={deshabilitado}
              onPress={() => onCambio(o.valor)}
              onKeyDown={deshabilitado ? undefined : alTeclear(i)}
              testID={`${testID}-${o.valor}`}
              style={({ hovered }) => [
                estilos.opcion,
                elegido && estilos.opcionElegida,
                hovered && !elegido && !deshabilitado && estilos.opcionResaltada,
                error && !elegido && estilos.opcionConError,
              ]}
            >
              <View style={[estilos.icono, elegido && estilos.iconoElegido]}>
                <Icono nombre={o.icono} tamano={22} color={elegido ? colores.blanco : colores.accionOscuro} />
              </View>
              <View style={estilos.textos}>
                <Texto variante="cuerpo" peso="700" color={elegido ? colores.accionOscuro : colores.texto}>
                  {o.etiqueta}
                </Texto>
                <Texto variante="chico" color={colores.textoSuave}>
                  {o.ayuda}
                </Texto>
              </View>
              <View style={[estilos.radio, elegido && estilos.radioElegido]}>
                {elegido ? <Icono nombre="check" tamano={14} color={colores.blanco} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <View style={estilos.filaError}>
          <Icono nombre="alerta" tamano={16} color={colores.peligro} />
          <Texto id={idError} role="alert" variante="chico" peso="600" color={colores.peligro} testID={`${testID}-error`} estilo={estilos.flexible}>
            {error}
          </Texto>
        </View>
      ) : null}
      <View style={estilos.seguridad}>
        <Icono nombre="candado" tamano={16} color={colores.textoSuave} />
        <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible} testID="nota-seguridad-pago">
          No te pedimos ni guardamos los datos de tu tarjeta o de tu cuenta.
        </Texto>
      </View>
    </View>
  );
});

export default MediosDePago;

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  // Una opción por fila también en el escritorio: en el diálogo (560 px) dos columnas cortan las etiquetas.
  opciones: { gap: espacio.s },
  opcion: {
    minWidth: 0,
    minHeight: Math.max(64, medidas.toqueMinimo),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.s,
    paddingLeft: espacio.m,
    paddingRight: espacio.m,
    borderRadius: radios.medio,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    cursor: 'pointer',
  },
  // El borde pasa de 1 a 2 px: se compensa el relleno para que el contenido no salte.
  opcionElegida: {
    borderWidth: 2,
    borderColor: colores.accion,
    backgroundColor: colores.celesteClaro,
    paddingVertical: espacio.s - 1,
    paddingLeft: espacio.m - 1,
    paddingRight: espacio.m - 1,
  },
  opcionResaltada: { borderColor: colores.accion },
  opcionConError: { borderColor: colores.peligro },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radios.chico,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.celesteClaro,
  },
  iconoElegido: { backgroundColor: colores.accion },
  textos: { flex: 1, minWidth: 0 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radios.pildora,
    borderWidth: 2,
    borderColor: colores.textoSuave,   // 3:1 o más contra el fondo (WCAG 1.4.11)
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioElegido: { borderColor: colores.accion, backgroundColor: colores.accion },
  filaError: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  seguridad: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs, paddingTop: 2 },
  flexible: { flex: 1, minWidth: 0 },
});
