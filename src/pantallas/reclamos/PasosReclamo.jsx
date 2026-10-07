// Progreso de un reclamo (R3): recibido → en proceso → resuelto, con fecha y hora de cada paso
// tomadas de `cronologia`. Versión compacta para la tarjeta y línea de tiempo para el detalle.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icono, Texto } from '../../ui';
import { colores, espacio, radios } from '../../tema/tokens';
import { fechaHora } from '../../../shared/formato.mjs';
import { ESTADOS_RECLAMO } from '../../../shared/constantes.mjs';
import { etiquetaEstado } from './util';

const DESCRIPCIONES = {
  recibido: 'La Municipalidad registró tu reclamo.',
  en_proceso: 'Un equipo municipal está trabajando en el lugar.',
  resuelto: 'El problema quedó solucionado.',
};

function pasos(reclamo) {
  const actual = Math.max(0, ESTADOS_RECLAMO.indexOf(reclamo?.estado));
  return ESTADOS_RECLAMO.map((estado, i) => ({
    estado,
    hecho: !reclamo?.pendiente && i <= actual,
    actual: !reclamo?.pendiente && i === actual,
    cuando: reclamo?.cronologia?.[estado] ?? null,
  }));
}

function Compacto({ reclamo }) {
  const lista = pasos(reclamo);
  return (
    <View style={estilos.compacto} aria-hidden>
      {lista.map((p, i) => (
        <View key={p.estado} style={estilos.tramo}>
          <View style={[estilos.barra, p.hecho && estilos.barraHecha, i === 0 && estilos.barraPrimera]} />
          <Texto
            variante="chico"
            peso={p.actual ? '700' : '500'}
            color={p.hecho ? colores.accionOscuro : colores.textoSuave}
            estilo={estilos.textoTramo}
            numberOfLines={1}
          >
            {etiquetaEstado(p.estado)}
          </Texto>
        </View>
      ))}
    </View>
  );
}

export default function PasosReclamo({ reclamo, compacto = false }) {
  if (compacto) return <Compacto reclamo={reclamo} />;
  const lista = pasos(reclamo);
  return (
    <View role="list" aria-label="Línea de tiempo del reclamo" testID="linea-tiempo" style={estilos.linea}>
      {lista.map((p, i) => {
        const ultimo = i === lista.length - 1;
        const fechaPaso = p.hecho && p.cuando ? fechaHora(p.cuando) : null;
        const estadoTexto = p.hecho ? (fechaPaso ?? 'Hecho') : 'Pendiente';
        return (
          <View
            key={p.estado}
            role="listitem"
            aria-label={`${etiquetaEstado(p.estado)}: ${estadoTexto}${p.actual ? ', estado actual' : ''}`}
            aria-current={p.actual ? 'step' : undefined}
            testID={`paso-${p.estado}`}
            dataSet={{ hecho: p.hecho ? 'si' : 'no' }}
            style={estilos.paso}
          >
            <View style={estilos.columnaMarca}>
              <View style={[estilos.marca, p.hecho && estilos.marcaHecha, p.actual && estilos.marcaActual]}>
                {p.hecho ? <Icono nombre="check" tamano={16} color={colores.blanco} /> : null}
              </View>
              {!ultimo ? <View style={[estilos.conector, lista[i + 1].hecho && estilos.conectorHecho]} /> : null}
            </View>
            <View style={[estilos.textos, !ultimo && estilos.textosConEspacio]}>
              <Texto variante="cuerpo" peso="700" color={p.hecho ? colores.texto : colores.textoSuave}>
                {etiquetaEstado(p.estado)}
              </Texto>
              <Texto variante="chico" color={p.hecho ? colores.texto : colores.textoSuave} testID={`fecha-${p.estado}`}>
                {estadoTexto}
              </Texto>
              {p.actual ? (
                <Texto variante="chico" color={colores.textoSuave}>
                  {DESCRIPCIONES[p.estado]}
                </Texto>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const MARCA = 28;

const estilos = StyleSheet.create({
  compacto: { flexDirection: 'row', gap: 4 },
  tramo: { flex: 1, gap: 4, minWidth: 0 },
  barra: { height: 6, borderRadius: radios.pildora, backgroundColor: '#e3e9ef' },
  barraHecha: { backgroundColor: colores.accion },
  barraPrimera: {},
  textoTramo: { fontSize: 12, lineHeight: 16 },
  linea: { gap: 0 },
  paso: { flexDirection: 'row', gap: espacio.m },
  columnaMarca: { alignItems: 'center', width: MARCA },
  marca: {
    width: MARCA,
    height: MARCA,
    borderRadius: radios.pildora,
    borderWidth: 2,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaHecha: { backgroundColor: colores.accion, borderColor: colores.accion },
  marcaActual: { boxShadow: '0px 0px 0px 4px rgba(0, 119, 174, 0.18)' },
  conector: { width: 3, flex: 1, minHeight: 24, backgroundColor: '#e3e9ef', marginVertical: 2, borderRadius: 2 },
  conectorHecho: { backgroundColor: colores.accion },
  textos: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2 },
  textosConEspacio: { paddingBottom: espacio.l },
});
