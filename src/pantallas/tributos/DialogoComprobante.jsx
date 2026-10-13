// Comprobante del pago de un cedulón (T2 y T3, S4): último paso de la pasarela ("Pago aprobado") y,
// desde el historial, el comprobante de un pago anterior. Muestra el medio elegido con la tarjeta
// enmascarada ("Tarjeta de crédito Visa •••• 4242").
import React from 'react';
import { Dialogo, Texto } from '../../ui';
import { colores } from '../../tema/tokens';
import ContenidoDialogo from './ContenidoDialogo';
import ComprobantePago from '../pagos/ComprobantePago';
import { etiquetaMedio } from '../pagos/pasarela';
import { dinero, fechaHora } from '../../../shared/formato.mjs';

export default function DialogoComprobante({ visible, pago, tributo, recien = false, onCerrar, onVerCedulon }) {
  if (!pago) return <Dialogo visible={false} titulo="" onCerrar={onCerrar} />;
  const acciones = [
    ...(tributo ? [{ titulo: 'Ver cedulón pagado', variante: 'secundario', onPress: () => onVerCedulon(tributo), testID: 'comprobante-ver-cedulon' }] : []),
    { titulo: 'Listo', onPress: onCerrar, testID: 'cerrar-comprobante' },
  ];

  return (
    <Dialogo
      visible={visible}
      titulo="Comprobante de pago"
      onCerrar={onCerrar}
      acciones={acciones}
      testID="comprobante"
    >
      <ContenidoDialogo etiqueta="Detalle del comprobante">
        <ComprobantePago
          numero={pago.comprobante}
          titulo="Pago aprobado"
          bajada={recien ? 'Tu cedulón quedó pagado.' : null}
          filas={[
            { etiqueta: 'Concepto', valor: tributo ? tributo.concepto : `Cedulón ${pago.refId}` },
            tributo ? { etiqueta: 'Período', valor: tributo.periodo } : null,
            { etiqueta: 'Cedulón', valor: pago.refId },
            { etiqueta: 'Importe', valor: dinero(pago.importe) },
            { etiqueta: 'Medio de pago', valor: etiquetaMedio(pago.medio, pago.tarjeta), testID: 'comprobante-medio' },
            { etiqueta: 'Fecha y hora', valor: fechaHora(pago.creadoEn) },
          ]}
        />
        <Texto variante="chico" color={colores.textoSuave}>
          Lo encontrás siempre en la pestaña Pagados.
        </Texto>
      </ContenidoDialogo>
    </Dialogo>
  );
}
