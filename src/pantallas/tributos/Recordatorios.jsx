// Recordatorios de vencimiento (T4, S4). Son las notificaciones personales que crean vecino/alta
// (en el momento del alta) y la tarea diaria (con push): "vence en N días" y "cedulón vencido".
// Acá se muestran las de cedulones que siguen impagos; tocarlas abre el cedulón y la marca leída.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colores, espacio, medidas, radios } from '../../tema/tokens';
import { Icono, Texto } from '../../ui';
import { tiempoRelativo, unirNumeroYUnidad } from '../../../shared/formato.mjs';

/** "#/tributos/T-1001" → "T-1001" */
export function tributoDeDestino(destino) {
  return /^#\/tributos\/([A-Za-z0-9_-]+)/.exec(destino ?? '')?.[1] ?? null;
}

export default function Recordatorios({ recordatorios, ahora, onAbrir }) {
  if (!recordatorios.length) return null;
  return (
    <View style={estilos.lista} testID="recordatorios-vencimiento">
      {recordatorios.map((n) => {
        const vencido = String(n.id).endsWith('-vencido');
        const acento = vencido ? colores.peligro : colores.alerta;
        return (
          <Pressable
            key={n.id}
            role="button"
            aria-label={`${n.titulo}. ${n.leida ? '' : 'Sin leer. '}Abrir el cedulón`}
            onPress={() => onAbrir(n)}
            testID={`recordatorio-${n.id}`}
            style={({ hovered, pressed }) => [
              estilos.fila,
              { borderLeftColor: acento, backgroundColor: vencido ? colores.peligroFondo : colores.alertaFondo },
              (hovered || pressed) && estilos.resaltada,
            ]}
          >
            <Icono nombre="campana" tamano={20} color={acento} />
            <View style={estilos.textos}>
              <Texto variante="chico" peso="700" color={colores.texto}>
                {unirNumeroYUnidad(n.titulo)}
              </Texto>
              <Texto variante="chico" color={colores.textoSuave}>
                {n.leida ? 'Recordatorio' : 'Nuevo recordatorio'} · {tiempoRelativo(n.creadoEn, Math.max(ahora, n.creadoEn ?? 0))}
              </Texto>
            </View>
            {!n.leida ? <View style={[estilos.punto, { backgroundColor: acento }]} /> : null}
            <Icono nombre="chevron" tamano={18} color={colores.textoSuave} />
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.s },
  fila: {
    minHeight: medidas.toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.s,
    paddingHorizontal: espacio.m,
    borderRadius: radios.medio,
    borderLeftWidth: 5,
    cursor: 'pointer',
  },
  resaltada: { opacity: 0.9 },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  punto: { width: 10, height: 10, borderRadius: radios.pildora },
});
