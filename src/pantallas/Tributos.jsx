// Tributos (S4, sección 8.7): T1 consulta y cedulón imprimible, T2 pago simulado con confirmación,
// T3 historial y estado, T4 estado "por vencer" y recordatorios de vencimiento.
// Enlace profundo: #/tributos/T-1001 abre ese cedulón (lo usan los recordatorios y el push).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio } from '../tema/tokens';
import {
  Aviso, Boton, Cargando, ErrorCarga, Icono, Pantalla, Pestanas, Seccion, Tarjeta, Texto, Vacio,
} from '../ui';
import { useRuta } from '../navegacion';
import { cargarMas, useMunicipal } from '../datos/almacen';
import * as repositorio from '../datos/repositorio';
import { useComando } from '../datos/useComando';
import { useAhora } from '../datos/useAhora';
import { EVENTOS, registrarEvento } from '../firebase/analytics';
import { TRAZAS } from '../firebase/rendimiento';
import { useTextoLeyenda } from '../marco/LeyendaPrototipo';
import { imprimirCedulon } from '../plataforma/cedulon';
import { nuevoIdSolicitud } from '../../shared/dominio.mjs';
import { LIMITES } from '../../shared/constantes.mjs';
import { dinero, fecha } from '../../shared/formato.mjs';
import { conEstado, cuandoVence, ordenarPendientes, plural, resumir } from './tributos/estado';
import { datosCedulon } from './tributos/datosCedulon';
import TarjetaTributo from './tributos/TarjetaTributo';
import DialogoCedulon from './tributos/DialogoCedulon';
import DialogoPago from './tributos/DialogoPago';
import DialogoComprobante from './tributos/DialogoComprobante';
import HistorialPagos from './tributos/HistorialPagos';
import Recordatorios, { tributoDeDestino } from './tributos/Recordatorios';

const seleccionar = (s) => ({
  listo: s.listo,
  altaTerminada: s.altaTerminada,
  tributos: s.tributos,
  pagos: s.pagos,
  hayMasPagos: s.hayMas.pagos,
  errorTributos: s.errores.tributos ?? null,
  errorPagos: s.errores.pagos ?? null,
  municipal: s.info,
  notificaciones: s.notificaciones,
});

function registrar(nombre, parametros) {
  try { registrarEvento(nombre, parametros); } catch { /* Analytics es opcional */ }
}

function Resumen({ resumen, ahora }) {
  const { total, impagos, vencidos, totalVencido, proximo } = resumen;
  const alDia = impagos.length === 0;
  return (
    <Tarjeta tono={vencidos ? 'peligro' : 'destacada'} testID="resumen-tributos">
      <View style={estilos.resumenFila}>
        <View style={estilos.resumenTextos}>
          <Texto variante="antetitulo" color={vencidos ? colores.peligro : colores.accionOscuro}>
            Total pendiente
          </Texto>
          <Texto variante="numero" testID="total-pendiente">
            {dinero(total)}
          </Texto>
        </View>
        <View style={[estilos.resumenIcono, { backgroundColor: vencidos ? colores.blanco : colores.superficie }]}>
          <Icono nombre={alDia ? 'checkCirculo' : 'tributo'} tamano={26} color={vencidos ? colores.peligro : colores.accion} />
        </View>
      </View>
      <Texto variante="chico" color={colores.texto} testID="resumen-detalle">
        {alDia ? 'Estás al día: no tenés cedulones sin pagar.' : `${plural(impagos.length, 'cedulón', 'cedulones')} sin pagar`}
        {vencidos ? (
          <Texto variante="chico" peso="700" color={colores.peligro}>
            {` · incluye ${plural(vencidos, 'vencido', 'vencidos')} (${dinero(totalVencido)})`}
          </Texto>
        ) : null}
      </Texto>
      {proximo ? (
        <Texto variante="chico" color={colores.textoSuave}>
          Próximo vencimiento: {fecha(proximo.vence)}, {cuandoVence(proximo.vence, ahora)}.
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

export default function Tributos({ ruta }) {
  const { navegar } = useRuta();
  const datos = useMunicipal(seleccionar);
  const leyenda = useTextoLeyenda();
  const ahora = useAhora(30_000);
  const [pestana, setPestana] = useState('pendientes');
  // Un solo diálogo visible a la vez: { tipo: 'cedulon' | 'pago' | 'comprobante', tributoId, pago?, recien? }
  const [dialogo, setDialogo] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [visible, setVisible] = useState(false);
  const abiertoPorEnlace = useRef(null);

  const tributos = useMemo(() => conEstado(datos.tributos, ahora), [datos.tributos, ahora]);
  const tributosPorId = useMemo(() => new Map(tributos.map((t) => [t.id, t])), [tributos]);
  const resumen = useMemo(() => resumir(tributos), [tributos]);
  const pendientes = useMemo(() => ordenarPendientes(resumen.impagos), [resumen.impagos]);
  const pagosTributo = useMemo(() => datos.pagos.filter((p) => p.tipo === 'tributo'), [datos.pagos]);
  const recordatorios = useMemo(
    () => datos.notificaciones.filter((n) => n.fuente === 'personal' && String(n.id).startsWith('tributo-')
      && tributosPorId.get(tributoDeDestino(n.destino))?.estado !== 'pagado'
      && tributosPorId.has(tributoDeDestino(n.destino))),
    [datos.notificaciones, tributosPorId],
  );

  const tributoAbierto = dialogo ? tributosPorId.get(dialogo.tributoId) ?? null : null;

  const pago = useComando(repositorio.pagarTributo, {
    // El comprobante se abre antes de que el comando deje de estar ocupado: así la confirmación
    // nunca llega a mostrar "ya está pagado" por el snapshot de nuestro propio pago.
    alExito: (resultado) => {
      if (!resultado) return;
      setDialogo({ tipo: 'comprobante', tributoId: resultado.refId, pago: resultado, recien: true });
      setVisible(true);
    },
    evento: EVENTOS.TRIBUTO_PAGADO,
    traza: TRAZAS.PAGO_TRIBUTO,
    parametrosEvento: (p) => ({ value: p?.importe ?? 0, currency: 'ARS' }),
  });

  // ---------- Apertura y cierre de diálogos ----------
  const abrir = useCallback((nuevo) => {
    setDialogo(nuevo);
    setVisible(true);
  }, []);

  const cerrar = useCallback(() => {
    setVisible(false);
    if (ruta?.id) navegar('tributos', null, null, { reemplazar: true });
  }, [ruta?.id, navegar]);

  const verCedulon = useCallback((tributo) => {
    abrir({ tipo: 'cedulon', tributoId: tributo.id });
    registrar(EVENTOS.CEDULON_EMITIDO, { accion: 'ver' });
  }, [abrir]);

  const pagar = useCallback((tributo) => {
    pago.limpiar();
    // El requestId se genera al abrir la confirmación y se reutiliza en los reintentos (sección 0).
    setRequestId(nuevoIdSolicitud());
    abrir({ tipo: 'pago', tributoId: tributo.id });
  }, [abrir, pago]);

  const confirmarPago = useCallback(async () => {
    if (!dialogo || dialogo.tipo !== 'pago') return;
    await pago.ejecutar(dialogo.tributoId, requestId);
  }, [dialogo, pago, requestId]);

  const imprimir = useCallback((tributo, info) => {
    const promesa = imprimirCedulon(tributo, info);
    return promesa.then((r) => {
      registrar(EVENTOS.CEDULON_EMITIDO, { accion: 'imprimir', modo: r?.modo ?? 'impresion' });
      return r;
    });
  }, []);

  const abrirRecordatorio = useCallback((notificacion) => {
    repositorio.marcarLeida(notificacion).catch(() => {});
    const id = tributoDeDestino(notificacion.destino);
    if (id && tributosPorId.has(id)) verCedulon(tributosPorId.get(id));
  }, [tributosPorId, verCedulon]);

  // ---------- Enlace profundo #/tributos/<id> ----------
  const idEnlace = ruta?.id ?? null;
  const enlaceNoEncontrado = Boolean(idEnlace) && datos.listo && datos.altaTerminada && datos.tributos.length > 0
    && !tributosPorId.has(idEnlace);
  useEffect(() => {
    if (!idEnlace) {
      abiertoPorEnlace.current = null;
      return;
    }
    if (abiertoPorEnlace.current === idEnlace || !tributosPorId.has(idEnlace)) return;
    abiertoPorEnlace.current = idEnlace;
    const t = tributosPorId.get(idEnlace);
    if (t.estado !== 'pagado') setPestana('pendientes');
    abrir({ tipo: 'cedulon', tributoId: idEnlace });
    registrar(EVENTOS.CEDULON_EMITIDO, { accion: 'ver' });
  }, [idEnlace, tributosPorId, abrir]);

  // Otro dispositivo o pestaña pagó mientras la confirmación estaba abierta.
  const yaPagado = visible && dialogo?.tipo === 'pago' && !pago.ocupado && tributoAbierto?.estado === 'pagado';

  const datosDelCedulon = useMemo(
    () => (dialogo?.tipo === 'cedulon' && tributoAbierto
      ? datosCedulon(tributoAbierto, { municipal: datos.municipal, leyenda, ahora })
      : null),
    [dialogo?.tipo, tributoAbierto, datos.municipal, leyenda, ahora],
  );

  // ---------- Contenido ----------
  let contenido;
  if (!datos.listo) {
    contenido = <Cargando lineas={4} mensaje="Cargando tus tributos…" testID="cargando-tributos" />;
  } else if (datos.errorTributos && !datos.tributos.length) {
    contenido = <ErrorCarga error={datos.errorTributos} testID="error-tributos" />;
  } else if (!datos.tributos.length && !datos.altaTerminada) {
    contenido = <Cargando lineas={3} mensaje="Consultando tus obligaciones…" testID="consultando-obligaciones" />;
  } else if (!datos.tributos.length) {
    contenido = (
      <Vacio
        icono="checkCirculo"
        titulo="No tenés cedulones"
        mensaje="No encontramos obligaciones municipales asociadas a tu cuenta."
        testID="tributos-vacio"
      />
    );
  } else {
    contenido = (
      <>
        {datos.errorTributos ? <ErrorCarga error={datos.errorTributos} testID="error-tributos" /> : null}
        <Resumen resumen={resumen} ahora={ahora} />
        <View style={estilos.bloque}>
          <Pestanas
            etiqueta="Cedulones"
            valor={pestana}
            onCambio={setPestana}
            testID="pestanas-tributos"
            opciones={[
              { valor: 'pendientes', etiqueta: 'Pendientes', contador: resumen.impagos.length },
              { valor: 'pagados', etiqueta: 'Pagados', contador: pagosTributo.length },
            ]}
          />
          <View role="tabpanel" aria-label={pestana === 'pendientes' ? 'Cedulones pendientes' : 'Historial de pagos'} style={estilos.panel}>
            {pestana === 'pendientes' ? (
              pendientes.length ? (
                pendientes.map((t) => (
                  <TarjetaTributo key={t.id} tributo={t} ahora={ahora} onVerCedulon={verCedulon} onPagar={pagar} />
                ))
              ) : (
                <Vacio
                  icono="checkCirculo"
                  titulo="No tenés cedulones pendientes"
                  mensaje="Estás al día con tus tributos municipales."
                  accion={{ titulo: 'Ver historial de pagos', onPress: () => setPestana('pagados'), testID: 'ir-a-pagados' }}
                  testID="pendientes-vacio"
                />
              )
            ) : (
              <HistorialPagos
                pagos={pagosTributo}
                tributosPorId={tributosPorId}
                hayMas={datos.hayMasPagos}
                error={datos.errorPagos}
                ahora={ahora}
                onVerComprobante={(p) => abrir({ tipo: 'comprobante', tributoId: p.refId, pago: p })}
                onCargarMas={() => cargarMas('pagos')}
                onReintentar={() => cargarMas('pagos')}
              />
            )}
          </View>
        </View>
        <Seccion
          titulo="Recordatorios"
          accion={<Boton titulo="Ver avisos" variante="texto" onPress={() => navegar('notificaciones')} testID="ver-notificaciones" />}
        >
          <Texto variante="chico" color={colores.textoSuave}>
            Te avisamos {LIMITES.diasAvisoVencimiento} días antes de cada vencimiento y cuando un cedulón vence.
          </Texto>
          {recordatorios.length ? (
            <Recordatorios recordatorios={recordatorios} ahora={ahora} onAbrir={abrirRecordatorio} />
          ) : (
            <Texto variante="chico" color={colores.textoSuave} testID="sin-recordatorios">
              No tenés recordatorios pendientes.
            </Texto>
          )}
        </Seccion>
      </>
    );
  }

  return (
    <Pantalla
      titulo="Tributos"
      bajada="Consultá tus cedulones, imprimilos y pagalos en forma simulada."
      testID="pantalla-tributos"
    >
      {enlaceNoEncontrado ? (
        <Aviso
          tono="alerta"
          titulo={`No encontramos el cedulón ${idEnlace}`}
          mensaje="Revisá el enlace o elegí uno de la lista."
          onCerrar={() => navegar('tributos', null, null, { reemplazar: true })}
          testID="cedulon-no-encontrado"
        />
      ) : null}
      {contenido}

      <DialogoCedulon
        key={`cedulon-${dialogo?.tributoId ?? ''}`}
        visible={visible && dialogo?.tipo === 'cedulon' && !!datosDelCedulon}
        tributo={dialogo?.tipo === 'cedulon' ? tributoAbierto : null}
        datos={datosDelCedulon}
        onCerrar={cerrar}
        onPagar={pagar}
        onImprimir={imprimir}
      />
      <DialogoPago
        visible={visible && dialogo?.tipo === 'pago' && !!tributoAbierto}
        tributo={dialogo?.tipo === 'pago' ? tributoAbierto : null}
        requestId={requestId}
        ahora={ahora}
        ocupado={pago.ocupado}
        error={pago.error}
        yaPagado={yaPagado}
        onConfirmar={confirmarPago}
        onCerrar={cerrar}
      />
      <DialogoComprobante
        visible={visible && dialogo?.tipo === 'comprobante'}
        pago={dialogo?.tipo === 'comprobante' ? dialogo.pago : null}
        tributo={dialogo?.tipo === 'comprobante' ? tributoAbierto : null}
        recien={!!dialogo?.recien}
        onCerrar={cerrar}
        onVerCedulon={verCedulon}
      />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  resumenFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  resumenTextos: { flex: 1, minWidth: 0, gap: 2 },
  resumenIcono: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bloque: { gap: espacio.m },
  panel: { gap: espacio.m },
});
