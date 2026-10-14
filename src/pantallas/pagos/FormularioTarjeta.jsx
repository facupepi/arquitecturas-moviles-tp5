// Formulario de alta de una tarjeta de crédito o de débito (Mi cuenta y pasarela de pagos):
// tipo, número, titular, vencimiento MM/AA y código de seguridad. Cada error va debajo de su campo
// (Campo y Selector); el estado lo maneja useAltaTarjeta. El código de seguridad se pide y se valida
// (3 dígitos, 4 en American Express), y se descarta: nunca se devuelve ni se guarda.
// La red (Visa, Mastercard, American Express) se muestra como ayuda mientras se escribe el número.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { espacio } from '../../tema/tokens';
import { Campo, Selector } from '../../ui';
import { useIdAccesible } from '../../ui/comun';
import { digitosTarjeta, redTarjeta } from '../../../shared/tarjetas.mjs';
import { OPCIONES_TIPO_TARJETA, formatearNumero, formatearVence } from './tarjetas';

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
        <View style={estilos.mitad}>
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
            teclaEnter="next"
            onEnviar={() => refs.codigo.current?.focus?.()}
          />
        </View>
        <View style={estilos.mitad}>
          <Campo
            ref={refs.codigo}
            id={`${id}-codigo`}
            testID="tarjeta-codigo"
            etiqueta="Código de seguridad"
            valor={valores.codigo}
            onCambio={(t) => cambiar('codigo', String(t).replace(/\D/g, '').slice(0, 4))}
            modoTeclado="numeric"
            autoCompletar="cc-csc"
            oculto
            maxLargo={4}
            placeholder="CVV"
            error={errores.codigo}
            teclaEnter="done"
            onEnviar={ocupado ? undefined : enviar}
          />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espacio.m },
  // Vencimiento y código de seguridad lado a lado (uno debajo del otro si no entran). Cada uno en su
  // caja de ancho fijo por la base: un mensaje de error largo no cambia el ancho del campo.
  vence: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m },
  mitad: { flexGrow: 1, flexBasis: 140, minWidth: 0 },
});
