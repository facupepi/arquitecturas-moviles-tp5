// "Mis reclamos" (R3 en resumen y R4): buscador sobre lo cargado, tarjetas y "Cargar más".
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton, Campo, EtiquetaEstado, Grilla, Icono, Tarjeta, Texto, Vacio } from '../../ui';
import { colores, espacio } from '../../tema/tokens';
import { fecha, tiempoPasado } from '../../../shared/formato.mjs';
import PasosReclamo from './PasosReclamo';
import { estadoVisible, etiquetaCategoria, filtrarReclamos } from './util';

function TarjetaReclamo({ reclamo, onAbrir }) {
  const estado = estadoVisible(reclamo);
  const cuando = reclamo.creadoEn ? tiempoPasado(reclamo.creadoEn) : '';
  const adjuntos = reclamo.adjuntos?.length ?? 0;
  const etiqueta = [
    `Reclamo ${reclamo.codigo}`,
    estado.texto,
    etiquetaCategoria(reclamo.categoria),
    reclamo.direccion,
    cuando ? `creado ${cuando}` : null,
    'Ver detalle',
  ].filter(Boolean).join(', ');

  return (
    <Tarjeta onPress={() => onAbrir(reclamo.id)} etiquetaAccesible={etiqueta} testID={`reclamo-${reclamo.codigo}`} estilo={estilos.tarjeta}>
      <View style={estilos.fila}>
        <View style={estilos.codigo}>
          <Texto variante="titulo3">{reclamo.codigo}</Texto>
          <Texto variante="chico" color={colores.textoSuave}>
            {etiquetaCategoria(reclamo.categoria)}
          </Texto>
        </View>
        <EtiquetaEstado texto={estado.texto} tono={estado.tono} icono={estado.icono} testID={`estado-reclamo-${reclamo.codigo}`} />
      </View>
      <View style={estilos.direccion}>
        <Icono nombre="ubicacion" tamano={16} color={colores.textoSuave} />
        <Texto variante="cuerpo" numberOfLines={2} estilo={estilos.flexible}>
          {reclamo.direccion}
        </Texto>
      </View>
      <View style={estilos.abajo}>
        <PasosReclamo reclamo={reclamo} compacto />
        <View style={estilos.pie}>
          <Texto variante="chico" color={colores.textoSuave}>
            {reclamo.creadoEn ? `${fecha(reclamo.creadoEn)} · ${cuando}` : 'Recién creado'}
            {adjuntos ? ` · ${adjuntos} ${adjuntos === 1 ? 'adjunto' : 'adjuntos'}` : ''}
          </Texto>
          <View style={estilos.ver}>
            <Texto variante="chico" peso="700" color={colores.accion}>
              Ver detalle
            </Texto>
            <Icono nombre="chevron" tamano={16} color={colores.accion} />
          </View>
        </View>
      </View>
    </Tarjeta>
  );
}

export default function ListaReclamos({ reclamos, hayMas, onCargarMas, onAbrir, cargandoMas }) {
  const [busqueda, setBusqueda] = useState('');
  const visibles = useMemo(() => filtrarReclamos(reclamos, busqueda), [reclamos, busqueda]);
  const buscando = busqueda.trim().length > 0;
  const enSeguimiento = reclamos.filter((r) => r.estado !== 'resuelto').length;

  if (!reclamos.length) {
    return (
      <Vacio
        icono="reclamo"
        titulo="Todavía no hiciste reclamos"
        testID="reclamos-vacio"
      />
    );
  }

  return (
    <View style={estilos.contenedor}>
      <Campo
        id="buscar-reclamos"
        etiqueta="Buscar en mis reclamos"
        valor={busqueda}
        onCambio={setBusqueda}
        placeholder="Código, dirección o descripción"
        testID="buscar-reclamos"
      />
      <Texto variante="chico" color={colores.textoSuave} role="status" testID="resumen-reclamos">
        {buscando
          ? `${visibles.length === 0 ? 'Ningún reclamo coincide' : visibles.length === 1 ? 'Encontramos 1 reclamo' : `Encontramos ${visibles.length} reclamos`} entre los ${reclamos.length} cargados.`
          : `${reclamos.length === 1 ? '1 reclamo' : `${reclamos.length} reclamos`} · ${enSeguimiento} en seguimiento`}
      </Texto>

      {visibles.length ? (
        <Grilla minAncho={340} maxColumnas={3} rol="list" rolCelda="listitem">
          {visibles.map((r) => (
            <TarjetaReclamo key={r.id} reclamo={r} onAbrir={onAbrir} />
          ))}
        </Grilla>
      ) : (
        <Vacio
          icono="buscar"
          titulo="No encontramos reclamos con esa búsqueda"
          mensaje={hayMas ? 'Probá con otras palabras o cargá tus reclamos anteriores.' : 'Probá con el código (R-…), la calle o una palabra de la descripción.'}
          accion={{ titulo: 'Limpiar búsqueda', onPress: () => setBusqueda(''), testID: 'limpiar-busqueda' }}
          testID="busqueda-vacia"
        />
      )}

      {hayMas ? (
        <View style={estilos.mas}>
          {buscando ? (
            <Texto variante="chico" color={colores.textoSuave} alineacion="center">
              La búsqueda mira solo los reclamos cargados. Cargá más para buscar en los anteriores.
            </Texto>
          ) : null}
          <Boton
            titulo="Cargar más reclamos"
            variante="secundario"
            icono="mas"
            onPress={onCargarMas}
            cargando={cargandoMas}
            ancho="completo"
            testID="cargar-mas-reclamos"
          />
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.m },
  tarjeta: { flexGrow: 1 },
  abajo: { marginTop: 'auto', gap: espacio.m },
  fila: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.s },
  codigo: { gap: 0, flexShrink: 1 },
  direccion: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1, minWidth: 0 },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s, flexWrap: 'wrap' },
  ver: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  mas: { gap: espacio.s, paddingTop: espacio.xs },
});
