// Pestaña Pagos del panel: lo que pagan los vecinos (cedulones, estacionamiento y extensiones).
// Recaudación del día y del mes calculada en el servidor, los últimos 100 pagos de todos los vecinos
// en tiempo real (filtro por tipo y búsqueda por comprobante o vecino) y los cedulones vencidos sin
// pagar. El vecino se muestra con su código corto, nunca con nombre ni correo.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResumenAdmin, vencidosAl } from '../../datos/useAdmin';
import { useAhora } from '../../datos/useAhora';
import { colores, espacio } from '../../tema/tokens';
import {
  Boton, Campo, Cargando, ErrorCarga, EtiquetaEstado, Seccion, Selector, Texto, Vacio,
} from '../../ui';
import { ZONA_HORARIA } from '../../../shared/constantes.mjs';
import {
  codigoVecino, dinero, fecha, sinSuspensivos, textoMedioPago, textoTarjeta, tiempoPasado,
} from '../../../shared/formato.mjs';
import { Indicadores, Tabla, fechaCorta, plural } from './comun';

const POR_PAGINA = 20;
const FILTROS = ['todos', 'tributo', 'estacionamiento', 'extension'];
const ETIQUETA_FILTRO = { todos: 'Todos', tributo: 'Cedulones', estacionamiento: 'Estacionamiento', extension: 'Extensiones' };
const TIPO_PAGO = {
  tributo: { texto: 'Cedulón', tono: 'info' },
  estacionamiento: { texto: 'Estacionamiento', tono: 'exito' },
  extension: { texto: 'Extensión', tono: 'neutro' },
};
const nombreMes = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: ZONA_HORARIA });

const clave = (x) => `${x.uid}/${x.id}`;
// "Tarjeta de crédito Visa •••• 4242" (la tarjeta siempre enmascarada; los pagos anteriores, solo el medio).
const medioDe = (pago) => (pago.medio ? textoMedioPago(pago.medio, pago.tarjeta) ?? pago.medio : null);
// En la columna de la tabla, la forma corta de Mi cuenta ("Visa crédito •••• 4242"): la larga ocupaba
// tres o cuatro renglones a 1024 px.
const medioCorto = (pago) => (pago.medio && pago.tarjeta?.ultimos4
  ? textoTarjeta({ tipo: pago.medio, red: pago.tarjeta.red, ultimos4: pago.tarjeta.ultimos4 }) || medioDe(pago)
  : medioDe(pago));

// Qué se pagó: el cedulón (T-1001) o la patente de la sesión si sigue activa.
function detalle(pago, patentes) {
  if (pago.tipo === 'tributo') return pago.refId ?? '';
  return patentes.get(pago.refId) ?? '';
}

function coincide(pago, texto) {
  if (!texto) return true;
  const t = sinSuspensivos(texto).toLocaleUpperCase('es-AR');
  if (!t) return true;
  return [pago.comprobante, sinSuspensivos(codigoVecino(pago.uid)), pago.refId]
    .some((v) => typeof v === 'string' && v.toLocaleUpperCase('es-AR').includes(t));
}

function TipoPago({ tipo }) {
  const t = TIPO_PAGO[tipo] ?? { texto: tipo ?? '—', tono: 'neutro' };
  return <EtiquetaEstado texto={t.texto} tono={t.tono} />;
}

function Resumen({ resumen, cargando, ahora }) {
  const r = resumen;
  const esperando = cargando && !r;
  return (
    <Indicadores
      testID="resumen-pagos"
      items={[
        {
          clave: 'dia', icono: 'tributo', etiqueta: 'Recaudado hoy', valor: dinero(r?.dia.total),
          detalle: r ? plural(r.dia.cantidad, 'pago') : '', cargando: esperando, testID: 'recaudado-hoy',
        },
        {
          clave: 'mes', icono: 'reloj', etiqueta: `Recaudado en ${nombreMes.format(new Date(ahora))}`, valor: dinero(r?.mes.total),
          detalle: r ? plural(r.mes.cantidad, 'pago') : '', cargando: esperando, testID: 'recaudado-mes',
        },
        {
          clave: 'vencidos', icono: 'alerta', tono: r?.vencidos.cantidad ? 'peligro' : 'exito',
          etiqueta: 'Cedulones vencidos', valor: dinero(r?.vencidos.total),
          detalle: r ? plural(r.vencidos.cantidad, 'cedulón sin pagar', 'cedulones sin pagar') : '', cargando: esperando, testID: 'vencidos-total',
        },
      ]}
    />
  );
}

function UltimosPagos({ pagos, cargando, error, patentes, ahora, onReintentar }) {
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const conteos = useMemo(() => {
    const c = { todos: pagos.length, tributo: 0, estacionamiento: 0, extension: 0 };
    for (const p of pagos) if (c[p.tipo] !== undefined) c[p.tipo] += 1;
    return c;
  }, [pagos]);
  const visibles = useMemo(
    () => pagos.filter((p) => (filtro === 'todos' || p.tipo === filtro) && coincide(p, busqueda.trim())),
    [pagos, filtro, busqueda],
  );

  const columnas = [
    { clave: 'fecha', titulo: 'Fecha', flex: 1, celda: (p) => fechaCorta(p.creadoEn) },
    { clave: 'vecino', titulo: 'Vecino', flex: 0.7, celda: (p) => codigoVecino(p.uid) || '—' },
    {
      clave: 'concepto',
      titulo: 'Concepto',
      flex: 2.2,
      // Si la patente no entra al lado de la etiqueta, baja al renglón de abajo entera (no se corta).
      celda: (p) => (
        <View style={estilos.concepto}>
          <TipoPago tipo={p.tipo} />
          <Texto variante="chico" peso="700" numberOfLines={1} estilo={estilos.detalleConcepto}>{detalle(p, patentes)}</Texto>
        </View>
      ),
    },
    { clave: 'medio', titulo: 'Medio de pago', flex: 1.9, celda: (p) => medioCorto(p) ?? '' },
    { clave: 'comprobante', titulo: 'Comprobante', flex: 1.4, celda: (p) => p.comprobante ?? '—' },
    {
      clave: 'importe',
      titulo: 'Importe',
      flex: 1,
      alinear: 'right',
      celda: (p) => <Texto variante="cuerpo" peso="700" alineacion="right">{dinero(p.importe)}</Texto>,
    },
  ];

  const compacta = (p) => (
    <>
      <View style={estilos.compactaCabecera}>
        <TipoPago tipo={p.tipo} />
        <Texto variante="cuerpo" peso="700">{dinero(p.importe)}</Texto>
      </View>
      <Texto variante="chico" peso="700" numberOfLines={1}>
        {[detalle(p, patentes), p.comprobante].filter(Boolean).join(' · ')}
      </Texto>
      <Texto variante="chico" color={colores.textoSuave}>
        {[medioDe(p), `vecino ${codigoVecino(p.uid)}`, tiempoPasado(p.creadoEn, ahora)].filter(Boolean).join(' · ')}
      </Texto>
    </>
  );

  let cuerpo;
  if (cargando) cuerpo = <Cargando lineas={4} mensaje="Cargando los pagos…" />;
  else if (error && !pagos.length) cuerpo = <ErrorCarga error={error} onReintentar={onReintentar} testID="error-pagos-panel" />;
  else if (!pagos.length) cuerpo = <Vacio icono="tributo" titulo="Todavía no hay pagos" testID="vacio-pagos-panel" />;
  else {
    cuerpo = (
      <>
        <View style={estilos.filtros}>
          <View style={estilos.filtro}>
            <Selector
              etiqueta="Tipo de pago"
              valor={filtro}
              onCambio={(v) => { setFiltro(v); setMostrar(POR_PAGINA); }}
              opciones={FILTROS.map((f) => ({ valor: f, etiqueta: `${ETIQUETA_FILTRO[f]} (${conteos[f]})` }))}
              testID="filtro-pagos"
            />
          </View>
          <View style={estilos.busqueda}>
            <Campo
              etiqueta="Buscar por comprobante o vecino"
              valor={busqueda}
              onCambio={(v) => { setBusqueda(v); setMostrar(POR_PAGINA); }}
              placeholder="Por ejemplo: REC-1A2B3C4D o A3F2"
              id="buscar-pagos-panel"
              testID="buscar-pagos-panel"
            />
          </View>
        </View>
        {error ? <ErrorCarga error={error} onReintentar={onReintentar} testID="error-pagos-panel" /> : null}
        {!visibles.length ? (
          <Vacio
            icono="buscar"
            titulo="No hay pagos para mostrar"
            mensaje={busqueda.trim() ? 'Ningún pago coincide con la búsqueda.' : 'No hay pagos de este tipo.'}
            accion={{ titulo: 'Ver todos', onPress: () => { setFiltro('todos'); setBusqueda(''); } }}
            testID="vacio-filtro-pagos"
          />
        ) : (
          <>
            <Tabla
              etiqueta="Últimos pagos de los vecinos"
              columnas={columnas}
              filas={visibles.slice(0, mostrar)}
              claveFila={clave}
              compacta={compacta}
              testID="lista-pagos-panel"
              testIDFila={(p) => `pago-panel-${p.id}`}
            />
            {visibles.length > mostrar ? (
              <Boton
                titulo={`Ver más pagos (quedan ${visibles.length - mostrar})`}
                variante="secundario"
                ancho="completo"
                onPress={() => setMostrar((n) => n + POR_PAGINA)}
                testID="ver-mas-pagos-panel"
              />
            ) : null}
          </>
        )}
      </>
    );
  }

  return (
    <Seccion
      titulo="Últimos pagos"
      accion={pagos.length ? <EtiquetaEstado texto="En vivo" tono="exito" icono="reloj" /> : null}
      testID="seccion-pagos"
    >
      {cuerpo}
    </Seccion>
  );
}

function Vencidos({ vencidos, cortada, cargando, error, total, ahora, onReintentar }) {
  const columnas = [
    { clave: 'vecino', titulo: 'Vecino', flex: 0.8, celda: (t) => codigoVecino(t.uid) || '—' },
    {
      clave: 'cedulon',
      titulo: 'Cedulón',
      flex: 2.6,
      // Cedulón y período arriba (siempre enteros); el concepto, que es largo, abajo.
      celda: (t) => (
        <>
          <Texto variante="chico" peso="700">{[t.id, t.periodo].filter(Boolean).join(' · ')}</Texto>
          {t.concepto ? <Texto variante="chico" numberOfLines={1}>{t.concepto}</Texto> : null}
        </>
      ),
    },
    {
      clave: 'vence',
      titulo: 'Venció',
      flex: 1.6,
      celda: (t) => (
        <>
          <Texto variante="chico">{fecha(t.vence)}</Texto>
          <Texto variante="chico" color={colores.textoSuave}>{tiempoPasado(t.vence, ahora)}</Texto>
        </>
      ),
    },
    {
      clave: 'importe',
      titulo: 'Importe',
      flex: 1,
      alinear: 'right',
      celda: (t) => <Texto variante="cuerpo" peso="700" alineacion="right">{dinero(t.importe)}</Texto>,
    },
  ];
  const compacta = (t) => (
    <>
      <View style={estilos.compactaCabecera}>
        <Texto variante="chico" peso="700" numberOfLines={1} estilo={estilos.flexible}>
          {[t.id, t.periodo].filter(Boolean).join(' · ')}
        </Texto>
        <Texto variante="cuerpo" peso="700">{dinero(t.importe)}</Texto>
      </View>
      <Texto variante="chico" numberOfLines={1}>{t.concepto ?? 'Cedulón'}</Texto>
      <Texto variante="chico" color={colores.textoSuave}>
        {`Venció ${tiempoPasado(t.vence, ahora)} · vecino ${codigoVecino(t.uid)}`}
      </Texto>
    </>
  );

  const cantidad = total?.cantidad ?? vencidos.length;
  return (
    <Seccion
      titulo="Cedulones vencidos sin pagar"
      accion={cantidad ? <EtiquetaEstado texto={plural(cantidad, 'cedulón', 'cedulones')} tono="peligro" /> : null}
      testID="seccion-vencidos"
    >
      {cargando ? (
        <Cargando lineas={3} mensaje="Cargando los cedulones vencidos…" />
      ) : error && !vencidos.length ? (
        <ErrorCarga error={error} onReintentar={onReintentar} testID="error-vencidos-panel" />
      ) : !vencidos.length ? (
        <Vacio icono="checkCirculo" titulo="No hay cedulones vencidos sin pagar" testID="vacio-vencidos-panel" />
      ) : (
        <>
          <Tabla
            etiqueta="Cedulones vencidos sin pagar"
            columnas={columnas}
            filas={vencidos}
            claveFila={clave}
            compacta={compacta}
            testID="lista-vencidos-panel"
            testIDFila={(t) => `vencido-panel-${t.uid}-${t.id}`}
          />
          {/* "de M" solo si la escucha llegó a su tope: si no, la lista ya tiene todos los vencidos. */}
          {cortada && cantidad > vencidos.length ? (
            <Texto variante="chico" color={colores.textoSuave}>
              {`Se muestran los ${vencidos.length} más atrasados de ${cantidad}.`}
            </Texto>
          ) : null}
        </>
      )}
    </Seccion>
  );
}

export default function PestanaPagos({ control, onReintentar }) {
  const ahora = useAhora(60_000);
  const { pagos, sesiones, cargando, errores } = control;
  // La escucha trae los cedulones sin pagar; con el reloj del panel se ven los que ya vencieron.
  const vencidos = useMemo(() => vencidosAl(control.vencidos, ahora), [control.vencidos, ahora]);
  // Cada pago nuevo (o un cedulón que vence o deja de estar vencido) recalcula los totales del servidor.
  const senal = `${pagos[0]?.id ?? ''}|${vencidos.lista.length}`;
  const { resumen, cargando: calculando, error: errorResumen } = useResumenAdmin(senal);
  const patentes = useMemo(() => new Map(sesiones.map((s) => [s.id, s.patente])), [sesiones]);

  return (
    <View style={estilos.contenedor}>
      <Resumen resumen={resumen} cargando={calculando} ahora={ahora} />
      {errorResumen && !resumen ? (
        <ErrorCarga error={errorResumen} onReintentar={onReintentar} testID="error-resumen-pagos" />
      ) : null}
      <UltimosPagos
        pagos={pagos}
        cargando={cargando.pagos}
        error={errores.pagos}
        patentes={patentes}
        ahora={ahora}
        onReintentar={onReintentar}
      />
      <Vencidos
        vencidos={vencidos.lista}
        cortada={vencidos.cortada}
        cargando={cargando.vencidos}
        error={errores.vencidos}
        total={resumen?.vencidos}
        ahora={ahora}
        onReintentar={onReintentar}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.xl },
  flexible: { flex: 1, minWidth: 0 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espacio.xl, rowGap: espacio.l },
  filtro: { flexShrink: 0, maxWidth: '100%' },
  busqueda: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
  concepto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espacio.s, rowGap: espacio.xs },
  detalleConcepto: { flexShrink: 0, maxWidth: '100%' },
  compactaCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
});
