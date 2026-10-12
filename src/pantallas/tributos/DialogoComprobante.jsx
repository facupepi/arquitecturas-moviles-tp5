// Comprobante del pago simulado (T2 y T3, S4). Se abre al confirmar un pago y desde el historial.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { Aviso, Dialogo, FilaDato, Icono, Texto } from '../../ui';
import ContenidoDialogo from './ContenidoDialogo';
import { dinero, fechaHora } from '../../../shared/formato.mjs';
import { MEDIO_DE_PAGO, TEXTO_SIN_CARGOS } from './datosCedulon';

export default function DialogoComprobante({ visible, pago, tributo, recien = false, onCerrar, onVerCedulon }) {
  if (!pago) return <Dialogo visible={false} titulo="" onCerrar={onCerrar} />;
  const acciones = [
    ...(tributo ? [{ titulo: 'Ver cedulón pagado', variante: 'secundario', onPress: () => onVerCedulon(tributo), testID: 'comprobante-ver-cedulon' }] : []),
    { titulo: 'Listo', onPress: onCerrar, testID: 'cerrar-comprobante' },
  ];

  return (
    <Dialogo
      visible={visible}
      titulo={recien ? 'Pago registrado' : 'Comprobante de pago'}
      onCerrar={onCerrar}
      acciones={acciones}
      testID="comprobante"
    >
      <ContenidoDialogo etiqueta="Detalle del comprobante">
        <View style={estilos.sello}>
          <View style={estilos.circulo}>
            <Icono nombre="check" tamano={30} color={colores.blanco} />
          </View>
          <Texto variante="cuerpo" color={colores.exito} peso="700" alineacion="center">
            {recien ? '¡Listo! Tu pago quedó registrado.' : 'Pago registrado'}
          </Texto>
          <Texto variante="chico" color={colores.textoSuave}>
            Comprobante
          </Texto>
          <Texto variante="titulo2" selectable testID="numero-comprobante" alineacion="center">
            {pago.comprobante}
          </Texto>
        </View>
        <View>
          <FilaDato etiqueta="Concepto" valor={tributo ? tributo.concepto : `Cedulón ${pago.refId}`} />
          {tributo ? <FilaDato etiqueta="Período" valor={tributo.periodo} /> : null}
          <FilaDato etiqueta="Cedulón" valor={pago.refId} />
          <FilaDato etiqueta="Importe" valor={dinero(pago.importe)} />
          <FilaDato etiqueta="Fecha y hora" valor={fechaHora(pago.creadoEn)} />
          <FilaDato etiqueta="Medio de pago" valor={MEDIO_DE_PAGO} />
        </View>
        <Aviso
          tono="aviso"
          titulo={TEXTO_SIN_CARGOS}
          mensaje="Comprobante sin validez fiscal. Queda guardado en Pagados."
          testID="aviso-comprobante"
        />
      </ContenidoDialogo>
    </Dialogo>
  );
}

const estilos = StyleSheet.create({
  sello: {
    alignItems: 'center',
    gap: espacio.xs,
    paddingVertical: espacio.l,
    borderRadius: radios.medio,
    backgroundColor: colores.exitoFondo,
  },
  circulo: {
    width: 52,
    height: 52,
    borderRadius: radios.pildora,
    backgroundColor: colores.exito,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacio.xs,
  },
});
