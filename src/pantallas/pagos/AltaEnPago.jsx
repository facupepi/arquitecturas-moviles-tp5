// Alta de tarjeta dentro de la pasarela: si el vecino no tiene tarjetas (o quiere usar otra), la
// carga en el mismo diálogo, sin perder el pago. El diálogo cambia de título y de botones
// ("Volver al pago" y "Guardar tarjeta"); al guardarla vuelve al pago con la tarjeta nueva elegida.
// La tarjeta queda guardada en Mi cuenta, igual que si se cargara desde ahí.
//
//   const alta = medio.agregando ? dialogoAlta(medio) : null;
//   <Dialogo titulo={alta?.titulo ?? '…'} acciones={alta?.acciones ?? …} pie={alta ? alta.pie : …}
//            cerrable={… && !alta?.ocupado}>
//     {alta ? <AltaEnPago medio={medio} /> : …}
import React from 'react';
import { colores } from '../../tema/tokens';
import { Aviso, Texto } from '../../ui';
import FormularioTarjeta from './FormularioTarjeta';
import { TITULO_ALTA } from './pasarela';

export function dialogoAlta(medio) {
  const { alta, cerrarAlta } = medio;
  return {
    titulo: TITULO_ALTA,
    ocupado: alta.ocupado,
    acciones: [
      { titulo: 'Volver al pago', variante: 'secundario', deshabilitado: alta.ocupado, onPress: cerrarAlta, testID: 'volver-al-pago' },
      {
        titulo: alta.ocupado ? 'Guardando…' : 'Guardar tarjeta',
        cargando: alta.ocupado,
        onPress: alta.enviar,
        testID: 'guardar-tarjeta',
      },
    ],
    pie: alta.errorGeneral && !alta.ocupado ? (
      <Aviso tono="peligro" rol="alert" titulo="No se pudo guardar la tarjeta" mensaje={alta.errorGeneral.message} testID="error-guardar-tarjeta" />
    ) : null,
  };
}

// La frase entra en un renglón a 360 px: así el alta entra sin desplazarse en un celular de 360 × 740.
export default function AltaEnPago({ medio }) {
  return (
    <>
      <Texto variante="chico" color={colores.textoSuave}>
        Se guarda en Mi cuenta y queda elegida.
      </Texto>
      <FormularioTarjeta alta={medio.alta} enfocar />
    </>
  );
}
