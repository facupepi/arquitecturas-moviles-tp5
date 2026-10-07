// Diálogo "Ver cedulón" (T1, S4): todos los datos, el importe, el código de pago con su código de
// barras y "Imprimir o guardar PDF". Si el cedulón está impago, ofrece pagarlo desde acá.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios } from '../../tema/tokens';
import { Aviso, Dialogo, EtiquetaEstado, FilaDato, Texto } from '../../ui';
import ContenidoDialogo from './ContenidoDialogo';
import { ESTADOS } from './estado';
import CodigoBarras from './CodigoBarras';

export default function DialogoCedulon({ visible, tributo, datos, onCerrar, onPagar, onImprimir }) {
  const [errorImpresion, setErrorImpresion] = useState(null);
  if (!tributo || !datos) return <Dialogo visible={false} titulo="" onCerrar={onCerrar} />;

  const estado = ESTADOS[tributo.estado] ?? ESTADOS.pendiente;
  const pagado = tributo.estado === 'pagado';

  const imprimir = () => {
    setErrorImpresion(null);
    // Sin await antes: el navegador tiene que ver la impresión como respuesta directa al toque.
    onImprimir(tributo, datos).catch((e) => setErrorImpresion(e?.message ?? 'No pudimos abrir la impresión.'));
  };

  const acciones = [
    { titulo: 'Imprimir o guardar PDF', variante: 'secundario', onPress: imprimir, testID: 'imprimir-cedulon' },
    pagado
      ? { titulo: 'Cerrar', onPress: onCerrar, testID: 'cerrar-cedulon' }
      : { titulo: `Pagar ${datos.importe}`, onPress: () => onPagar(tributo), testID: 'pagar-desde-cedulon' },
  ];

  return (
    <Dialogo visible={visible} titulo={datos.titulo} onCerrar={onCerrar} acciones={acciones} testID="dialogo-cedulon">
      <ContenidoDialogo etiqueta="Datos del cedulón">
        <View style={estilos.cabecera}>
          <EtiquetaEstado texto={estado.texto} tono={estado.tono} icono={estado.icono} testID="estado-cedulon" />
          <Texto variante="chico" color={colores.textoSuave}>
            {datos.municipio}
          </Texto>
        </View>

        <View>
          {datos.filas
            .filter(([etiqueta]) => etiqueta !== 'Estado')
            .map(([etiqueta, valor]) => (
              <FilaDato key={etiqueta} etiqueta={etiqueta} valor={valor} />
            ))}
        </View>

        <View style={estilos.importe}>
          <Texto variante="cuerpo" color={colores.textoSuave}>
            Importe
          </Texto>
          <Texto variante="titulo2" testID="importe-cedulon">
            {datos.importe}
          </Texto>
        </View>

        <View style={estilos.codigo}>
          <Texto variante="antetitulo" color={colores.textoSuave}>
            Código de pago
          </Texto>
          <CodigoBarras codigo={datos.codigo} testID="barras-cedulon" />
          <Texto
            selectable
            variante="cuerpo"
            peso="700"
            alineacion="center"
            testID="codigo-pago"
            estilo={estilos.digitos}
          >
            {datos.codigoAgrupado}
          </Texto>
        </View>

        <Aviso tono="aviso" mensaje={datos.aviso} testID="aviso-cedulon" />

        {errorImpresion ? <Aviso tono="peligro" rol="alert" mensaje={errorImpresion} testID="error-impresion" /> : null}
      </ContenidoDialogo>
    </Dialogo>
  );
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  importe: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espacio.s,
    paddingVertical: espacio.s,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colores.texto,
  },
  codigo: {
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radios.medio,
    backgroundColor: colores.fondo,
    alignItems: 'center',
  },
  digitos: { letterSpacing: 1, fontVariant: ['tabular-nums'] },
});
