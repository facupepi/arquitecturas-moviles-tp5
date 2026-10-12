// Pestaña Bicicletas del panel (S8, B2): por estación, botones para quitar y sumar bicicletas y un
// interruptor de "Fuera de servicio". Cada cambio es una transacción sobre estaciones/{id} y el
// mapa y las tarjetas del vecino cambian solos.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import { cambiarBicicletas } from '../../datos/repositorio';
import { useComando } from '../../datos/useComando';
import { useAhora } from '../../datos/useAhora';
import { colores, espacio } from '../../tema/tokens';
import {
  Aviso, Boton, ErrorCarga, EtiquetaEstado, Interruptor, Tarjeta, Texto, Vacio,
} from '../../ui';
import { ETIQUETAS } from '../../../shared/constantes.mjs';
import { tiempoPasado } from '../../../shared/formato.mjs';
import { Grilla, accionPanel, estilosPanel, plural } from './comun';

function estadoVisible(estacion) {
  if (estacion.estado === 'fuera_de_servicio') return { texto: 'Fuera de servicio', tono: 'alerta' };
  if (estacion.bicicletas === 0) return { texto: 'Sin bicicletas', tono: 'neutro' };
  return { texto: 'Operativa', tono: 'exito' };
}

function EstacionPanel({ estacion, ahora }) {
  const cambio = useComando(cambiarBicicletas, {
    ...accionPanel((_, datos) => ({
      accion: datos?.estado && datos.estado !== estacion.estado ? 'estado_estacion' : 'mover_bicicletas',
    })),
  });
  const { id, nombre, bicicletas, capacidad } = estacion;
  const fuera = estacion.estado === 'fuera_de_servicio';
  const estado = estadoVisible(estacion);
  const mover = (delta) => cambio.ejecutar({ estacionId: id, bicicletas: bicicletas + delta });

  return (
    <Tarjeta tono={fuera ? 'alerta' : 'normal'} etiquetaAccesible={nombre} testID={`estacion-panel-${id}`} estilo={estilosPanel.celda}>
      {/* Misma estructura en todas: nombre (hasta dos líneas, con puntos suspensivos si no entra) y debajo
          la zona con la etiqueta de estado a la derecha, así un nombre largo no mueve nada. */}
      <View style={estilos.cabecera}>
        <Texto variante="titulo3" numberOfLines={2}>{nombre}</Texto>
        <View style={estilos.subtitulo}>
          <Texto variante="chico" color={colores.textoSuave} numberOfLines={1} estilo={estilos.zona}>
            {`Zona ${ETIQUETAS.zonas[estacion.zona] ?? estacion.zona}`}
          </Texto>
          <EtiquetaEstado texto={estado.texto} tono={estado.tono} sobreColor={fuera} testID={`estado-estacion-panel-${id}`} />
        </View>
      </View>

      <View style={estilos.cifra}>
        <Texto variante="numero" aria-live="polite" testID={`bicicletas-panel-${id}`}>
          {bicicletas}
        </Texto>
        <Texto variante="cuerpo" color={colores.textoSuave}>
          {`de ${capacidad} bicicletas`}
        </Texto>
      </View>
      <View style={estilos.botones}>
        <View style={estilos.boton}>
          <Boton
            titulo="Quitar"
            icono="menos"
            variante="secundario"
            ancho="completo"
            onPress={() => mover(-1)}
            deshabilitado={cambio.ocupado || bicicletas <= 0}
            etiquetaAccesible={`Quitar una bicicleta de ${nombre}`}
            testID={`menos-${id}`}
          />
        </View>
        <View style={estilos.boton}>
          <Boton
            titulo="Sumar"
            icono="mas"
            variante="secundario"
            ancho="completo"
            onPress={() => mover(1)}
            deshabilitado={cambio.ocupado || bicicletas >= capacidad}
            etiquetaAccesible={`Sumar una bicicleta a ${nombre}`}
            testID={`mas-${id}`}
          />
        </View>
      </View>
      <Texto variante="chico" color={colores.textoSuave} numberOfLines={1}>
        {cambio.ocupado
          ? 'Guardando…'
          : `${plural(Math.max(0, capacidad - bicicletas), 'anclaje libre', 'anclajes libres')} · actualizada ${tiempoPasado(estacion.actualizadoEn, ahora) || 'recién'}`}
      </Texto>

      <Interruptor
        etiqueta="Fuera de servicio"
        valor={fuera}
        onCambio={(valor) => cambio.ejecutar({ estacionId: id, bicicletas, estado: valor ? 'fuera_de_servicio' : 'operativa' })}
        deshabilitado={cambio.ocupado}
        testID={`fuera-servicio-${id}`}
      />
      {cambio.error ? (
        <Aviso tono="peligro" rol="alert" mensaje={cambio.error.message} testID={`error-estacion-${id}`} />
      ) : null}
    </Tarjeta>
  );
}

export default function PestanaBicicletas() {
  const estaciones = useMunicipal((s) => s.estaciones);
  const error = useMunicipal((s) => s.errores.estaciones);
  const ahora = useAhora(30_000);

  const totales = useMemo(() => estaciones.reduce(
    (t, e) => ({
      bicicletas: t.bicicletas + (e.estado === 'fuera_de_servicio' ? 0 : e.bicicletas),
      fuera: t.fuera + (e.estado === 'fuera_de_servicio' ? 1 : 0),
    }),
    { bicicletas: 0, fuera: 0 },
  ), [estaciones]);

  if (error && !estaciones.length) return <ErrorCarga error={error} testID="error-bicicletas-panel" />;
  if (!estaciones.length && !error) {
    // estaciones forma parte de `listo`: si llegó vacía es porque el catálogo no está sembrado.
    return (
      <Vacio
        icono="bicicleta"
        titulo="No hay estaciones cargadas"
        testID="vacio-bicicletas-panel"
      />
    );
  }

  return (
    <View style={estilos.contenedor}>
      {error ? <ErrorCarga error={error} testID="error-bicicletas-panel" /> : null}
      <Aviso
        tono="info"
        icono="bicicleta"
        mensaje={`${plural(totales.bicicletas, 'bicicleta disponible', 'bicicletas disponibles')} en ${plural(estaciones.length - totales.fuera, 'estación operativa', 'estaciones operativas')}${totales.fuera ? ` · ${plural(totales.fuera, 'fuera de servicio', 'fuera de servicio')}` : ''}.`}
        testID="resumen-bicicletas-panel"
      />
      <Grilla>
        {estaciones.map((e) => (
          <EstacionPanel key={e.id} estacion={e} ahora={ahora} />
        ))}
      </Grilla>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
  cabecera: { gap: 2 },
  subtitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  zona: { flexShrink: 1, minWidth: 0 },
  cifra: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s },
  botones: { flexDirection: 'row', gap: espacio.s },
  boton: { flex: 1, minWidth: 0 },
});
