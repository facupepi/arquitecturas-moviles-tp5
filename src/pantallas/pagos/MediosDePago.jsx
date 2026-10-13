// Elección del medio de pago de la pasarela (T2, E2, E4): las tarjetas de crédito y de débito que
// el vecino guardó en Mi cuenta ("Visa crédito •••• 4242", titular y vencimiento). Es un grupo de
// radios: cada opción tiene role="radio", aria-checked, área táctil de 64 px y se elige con toque,
// Enter, espacio o las flechas (como pide el patrón radiogroup de WAI-ARIA). El estado elegido no
// depende solo del color: el círculo de la derecha se llena con un tilde y el borde se engrosa.
// Una tarjeta vencida se muestra deshabilitada y las flechas la saltean.
// Sin tarjetas, un aviso con "Agregar tarjeta" abre el alta en el mismo diálogo (useMedioPago).
// Nunca hay campos de número ni de código de seguridad acá: solo se elige una tarjeta guardada.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../../tema/tokens';
import { Aviso, Boton, EtiquetaEstado, Icono, Texto } from '../../ui';
import { alPresionarEspacio, useIdAccesible } from '../../ui/comun';
import { LIMITES } from '../../../shared/constantes.mjs';
import { tarjetaVencida } from '../../../shared/dominio.mjs';
import { textoTarjeta } from '../../../shared/formato.mjs';
import { iconoMedio } from './pasarela';

const SIGUIENTE = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** "Visa crédito terminada en 4242": lo que lee el lector de pantalla en lugar de "•••• 4242". */
export function nombreAccesibleTarjeta(t) {
  return textoTarjeta(t).replace(/••••\s(\d{4})$/, 'terminada en $1');
}

const MediosDePago = forwardRef(function MediosDePago({ medio, deshabilitado = false, testID = 'medio' }, ref) {
  const { tarjetas, valor, error, elegir, abrirAlta, volviendo } = medio;
  const idEtiqueta = useIdAccesible('medios-pago');
  const idError = `${idEtiqueta}-error`;
  const opciones = useRef([]);
  const refAgregar = useRef(null);
  const ahora = Date.now();
  const vencidas = tarjetas.map((t) => tarjetaVencida(t.vence, ahora));
  const habilitadas = tarjetas.map((_, i) => i).filter((i) => !vencidas[i]);

  const enfocar = () => {
    const elegida = tarjetas.findIndex((t) => t.id === valor);
    const destino = elegida >= 0 && !vencidas[elegida] ? elegida : habilitadas[0];
    if (destino != null) opciones.current[destino]?.focus?.();
    else refAgregar.current?.focus?.();
  };

  // ref.focus() lleva el foco a la tarjeta elegida, a la primera que se puede usar o a "Agregar tarjeta".
  useImperativeHandle(ref, () => ({ focus: enfocar }));

  // De vuelta del alta (guardada o cancelada): el foco no se pierde en el documento.
  useEffect(() => {
    if (volviendo) setTimeout(enfocar, 0);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const alTeclear = (indice) => (evento) => {
    const tecla = evento?.nativeEvent?.key ?? evento?.key;
    const paso = SIGUIENTE[tecla];
    if (paso) {
      evento.preventDefault?.();
      const pos = habilitadas.indexOf(indice);
      const destino = habilitadas[(pos + paso + habilitadas.length) % habilitadas.length];
      elegir(tarjetas[destino].id);
      opciones.current[destino]?.focus?.();
      return;
    }
    alPresionarEspacio(() => elegir(tarjetas[indice].id))(evento);
  };

  const puedeAgregar = tarjetas.length < LIMITES.tarjetas;

  return (
    <View style={estilos.contenedor}>
      <Texto id={idEtiqueta} variante="cuerpo" peso="700">
        Elegí cómo pagar
      </Texto>
      {tarjetas.length ? (
        <View
          role="radiogroup"
          aria-labelledby={idEtiqueta}
          aria-describedby={error ? idError : undefined}
          aria-required
          aria-invalid={error ? true : undefined}
          testID={testID}
          style={estilos.opciones}
        >
          {tarjetas.map((t, i) => {
            const elegido = valor === t.id;
            const vencida = vencidas[i];
            const inactiva = deshabilitado || vencida;
            const detalle = [t.titular, vencida ? `venció ${t.vence}` : `vence ${t.vence}`].filter(Boolean).join(' · ');
            return (
              <Pressable
                key={t.id}
                ref={(nodo) => { opciones.current[i] = nodo; }}
                role="radio"
                aria-checked={elegido}
                aria-disabled={inactiva || undefined}
                aria-label={`${nombreAccesibleTarjeta(t)}. ${detalle}${vencida ? '. Vencida' : ''}`}
                disabled={inactiva}
                onPress={() => elegir(t.id)}
                onKeyDown={inactiva ? undefined : alTeclear(i)}
                testID={`${testID}-${t.id}`}
                style={({ hovered }) => [
                  estilos.opcion,
                  elegido && estilos.opcionElegida,
                  hovered && !elegido && !inactiva && estilos.opcionResaltada,
                  error && !elegido && !vencida && estilos.opcionConError,
                  vencida && estilos.opcionVencida,
                ]}
              >
                <View style={[estilos.icono, elegido && estilos.iconoElegido]}>
                  <Icono nombre={iconoMedio(t.tipo)} tamano={22} color={elegido ? colores.blanco : colores.accionOscuro} />
                </View>
                <View style={estilos.textos}>
                  <Texto variante="cuerpo" peso="700" color={elegido ? colores.accionOscuro : colores.texto}>
                    {textoTarjeta(t)}
                  </Texto>
                  <Texto variante="chico" color={colores.textoSuave}>
                    {detalle}
                  </Texto>
                </View>
                {vencida ? (
                  <EtiquetaEstado texto="Vencida" tono="peligro" />
                ) : (
                  <View style={[estilos.radio, elegido && estilos.radioElegido]}>
                    {elegido ? <Icono nombre="check" tamano={14} color={colores.blanco} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Aviso
          tono="info"
          titulo="Todavía no tenés tarjetas guardadas"
          mensaje="Agregá una tarjeta de crédito o de débito para pagar. Queda guardada en Mi cuenta para la próxima."
          testID="sin-tarjetas-pago"
        />
      )}
      {error ? (
        <View style={estilos.filaError}>
          <Icono nombre="alerta" tamano={16} color={colores.peligro} />
          <Texto id={idError} role="alert" variante="chico" peso="600" color={colores.peligro} testID={`${testID}-error`} estilo={estilos.flexible}>
            {error}
          </Texto>
        </View>
      ) : null}
      {puedeAgregar && !deshabilitado ? (
        <Boton
          ref={refAgregar}
          titulo={tarjetas.length ? 'Agregar otra tarjeta' : 'Agregar tarjeta'}
          icono="mas"
          variante={tarjetas.length ? 'texto' : 'secundario'}
          ancho={tarjetas.length ? 'auto' : 'completo'}
          onPress={abrirAlta}
          testID="agregar-tarjeta-pago"
        />
      ) : null}
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
  opcionVencida: { backgroundColor: colores.fondo, cursor: 'default' },
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
  flexible: { flex: 1, minWidth: 0 },
});
