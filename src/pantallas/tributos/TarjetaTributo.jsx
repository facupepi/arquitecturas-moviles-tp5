// Tarjeta de un cedulón impago (S4): estado, concepto, período, importe, vencimiento y los botones
// "Ver cedulón" y "Pagar". No es tocable entera: tiene botones adentro. La misma estructura en todas:
// la etiqueta arriba en su fila, el concepto en hasta dos líneas y el pie (importe y botones)
// pegado abajo, así en la grilla las tarjetas de una fila quedan alineadas.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../../tema/tokens';
import { Boton, EtiquetaEstado, Tarjeta, Texto } from '../../ui';
import { dinero, fecha } from '../../../shared/formato.mjs';
import { ESTADOS, cuandoVence, nombreTributo } from './estado';

const COLOR_PLAZO = { vencido: colores.peligro, por_vencer: colores.alerta, pendiente: colores.textoSuave };

export default function TarjetaTributo({ tributo, ahora, onVerCedulon, onPagar }) {
  const estado = ESTADOS[tributo.estado] ?? ESTADOS.pendiente;
  const plazo = cuandoVence(tributo.vence, ahora);

  return (
    <Tarjeta
      testID={`tributo-${tributo.id}`}
      tono={estado.tarjeta}
      etiquetaAccesible={`${nombreTributo(tributo)}, ${estado.texto}`}
      estilo={estilos.tarjeta}
    >
      <View style={estilos.estado}>
        <EtiquetaEstado
          texto={estado.texto}
          tono={estado.tono}
          icono={estado.icono}
          sobreColor={estado.tarjeta !== 'normal'}
          testID={`estado-tributo-${tributo.id}`}
        />
      </View>
      <View style={estilos.encabezado}>
        <Texto variante="titulo3" numberOfLines={2}>
          {tributo.concepto}
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          Período {tributo.periodo} · Cedulón {tributo.id}
        </Texto>
      </View>
      <View style={estilos.pie}>
        <View style={estilos.datos}>
          <View style={estilos.dato}>
            <Texto variante="chico" color={colores.textoSuave}>
              Importe
            </Texto>
            <Texto variante="titulo2" testID={`importe-${tributo.id}`}>
              {dinero(tributo.importe)}
            </Texto>
          </View>
          <View style={[estilos.dato, estilos.datoDerecha]}>
            <Texto variante="chico" color={colores.textoSuave}>
              {tributo.estado === 'vencido' ? 'Venció el' : 'Vence el'}
            </Texto>
            <Texto variante="cuerpo" peso="700">
              {fecha(tributo.vence)}
            </Texto>
            <Texto variante="chico" peso="700" color={COLOR_PLAZO[tributo.estado] ?? colores.textoSuave}>
              {plazo}
            </Texto>
          </View>
        </View>
        <View style={estilos.botones}>
          <View style={estilos.boton}>
            <Boton
              titulo="Ver cedulón"
              variante="secundario"
              ancho="completo"
              onPress={() => onVerCedulon(tributo)}
              etiquetaAccesible={`Ver cedulón ${tributo.id}, ${nombreTributo(tributo)}`}
              testID={`ver-cedulon-${tributo.id}`}
            />
          </View>
          <View style={estilos.boton}>
            <Boton
              titulo="Pagar"
              ancho="completo"
              onPress={() => onPagar(tributo)}
              etiquetaAccesible={`Pagar ${nombreTributo(tributo)}, ${dinero(tributo.importe)}`}
              testID={`pagar-${tributo.id}`}
            />
          </View>
        </View>
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { flexGrow: 1 },
  estado: { flexDirection: 'row' },
  encabezado: { gap: 2 },
  pie: { marginTop: 'auto', gap: espacio.m },
  datos: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: espacio.m },
  dato: { gap: 2 },
  datoDerecha: { alignItems: 'flex-end' },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  boton: { flexGrow: 1, flexBasis: 140 },
});
