// Formulario de alta de una tarjeta de crédito o de débito (Mi cuenta y pasarela de pagos):
// tipo, número, titular y vencimiento MM/AA. Cada error va debajo de su campo (Campo y Selector);
// el estado lo maneja useAltaTarjeta. No hay campo de código de seguridad: no se pide ni se guarda.
// La red (Visa, Mastercard, American Express) se muestra como ayuda mientras se escribe el número.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../../tema/tokens';
import { Campo, Icono, Selector, Texto } from '../../ui';
import { useIdAccesible } from '../../ui/comun';
import { digitosTarjeta, redTarjeta } from '../../../shared/dominio.mjs';
import { NOTA_SEGURIDAD_TARJETAS, OPCIONES_TIPO_TARJETA, formatearNumero, formatearVence } from './tarjetas';

/** Nota con el candado: qué se guarda de una tarjeta y qué no se pide nunca. */
export function NotaSeguridadTarjetas({ testID = 'nota-seguridad-tarjetas' }) {
  return (
    <View style={estilos.nota}>
      <Icono nombre="candado" tamano={16} color={colores.textoSuave} />
      <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible} testID={testID}>
        {NOTA_SEGURIDAD_TARJETAS}
      </Texto>
    </View>
  );
}

function ayudaNumero(numero) {
  const digitos = digitosTarjeta(numero);
  const red = digitos.length >= 2 ? redTarjeta(digitos) : null;
  if (red && red !== 'Tarjeta') return `Tarjeta ${red}.`;
  return 'Como figura en el frente de la tarjeta.';
}

/**
 * @param alta     el resultado de useAltaTarjeta()
 * @param enfocar  lleva el foco al tipo al aparecer (cuando reemplaza otro contenido del diálogo)
 */
export default function FormularioTarjeta({ alta, enfocar = false, testID = 'formulario-tarjeta' }) {
  const id = useIdAccesible('tarjeta');
  const { valores, errores, cambiar, enviar, refs, ocupado } = alta;

  useEffect(() => {
    if (!enfocar) return undefined;
    const t = setTimeout(() => { try { refs.tipo.current?.focus?.(); } catch { /* sin foco en nativo */ } }, 0);
    return () => clearTimeout(t);
  }, [enfocar, refs]);

  return (
    <View style={estilos.formulario} testID={testID}>
      <Selector
        ref={refs.tipo}
        etiqueta="Tipo de tarjeta"
        valor={valores.tipo}
        opciones={OPCIONES_TIPO_TARJETA}
        onCambio={(v) => cambiar('tipo', v)}
        error={errores.tipo}
        testID="tarjeta-tipo"
      />
      <Campo
        ref={refs.numero}
        id={`${id}-numero`}
        testID="tarjeta-numero"
        etiqueta="Número de la tarjeta"
        valor={valores.numero}
        onCambio={(t) => cambiar('numero', formatearNumero(t))}
        modoTeclado="numeric"
        autoCompletar="cc-number"
        maxLargo={23}
        placeholder="0000 0000 0000 0000"
        ayuda={ayudaNumero(valores.numero)}
        error={errores.numero}
        teclaEnter="next"
        onEnviar={() => refs.titular.current?.focus?.()}
      />
      <Campo
        ref={refs.titular}
        id={`${id}-titular`}
        testID="tarjeta-titular"
        etiqueta="Titular"
        valor={valores.titular}
        onCambio={(t) => cambiar('titular', t)}
        autoCompletar="cc-name"
        maxLargo={60}
        ayuda="El nombre como figura en la tarjeta."
        error={errores.titular}
        teclaEnter="next"
        onEnviar={() => refs.vence.current?.focus?.()}
      />
      <View style={estilos.vence}>
        <Campo
          ref={refs.vence}
          id={`${id}-vence`}
          testID="tarjeta-vence"
          etiqueta="Vencimiento (MM/AA)"
          valor={valores.vence}
          onCambio={(t) => cambiar('vence', formatearVence(t))}
          modoTeclado="numeric"
          autoCompletar="cc-exp"
          maxLargo={5}
          placeholder="MM/AA"
          error={errores.vence}
          teclaEnter="done"
          onEnviar={ocupado ? undefined : enviar}
        />
      </View>
      <NotaSeguridadTarjetas />
    </View>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espacio.m },
  // El vencimiento no necesita todo el ancho; en el celular igual ocupa la fila.
  vence: { maxWidth: 240, alignSelf: 'stretch' },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs, paddingTop: 2 },
  flexible: { flex: 1, minWidth: 0 },
});
