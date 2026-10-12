// Pestaña Reclamos del panel (S8, R3): los últimos 50 reclamos de todos los vecinos, filtro por
// estado en el cliente y "Pasar a En proceso" / "Marcar resuelto" con nota opcional. El avance
// escribe el reclamo y un evento en el mismo lote; el vecino ve la línea de tiempo cambiar sola.
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { avanzarReclamo } from '../../datos/repositorio';
import { useComando } from '../../datos/useComando';
import { useAhora } from '../../datos/useAhora';
import { colores, espacio } from '../../tema/tokens';
import {
  Aviso, Boton, Campo, Cargando, Dialogo, ErrorCarga, EtiquetaEstado, Icono, Selector, Tarjeta, Texto, Vacio,
  useAvisoFlotante,
} from '../../ui';
import { nuevoIdSolicitud, siguienteEstadoReclamo } from '../../../shared/dominio.mjs';
import { ETIQUETAS } from '../../../shared/constantes.mjs';
import { codigoVecino, tiempoPasado } from '../../../shared/formato.mjs';
import { EstadoEnvio, Grilla, TONO_ESTADO_RECLAMO, accionPanel, estilosPanel, fechaCorta, plural } from './comun';

const LARGO_NOTA = 300;
const POR_PAGINA = 12;   // se dibujan de a tandas: 50 tarjetas juntas pesan en un celular modesto
const FILTROS = ['todos', 'recibido', 'en_proceso', 'resuelto'];
const ETIQUETA_FILTRO = { todos: 'Todos', recibido: 'Recibidos', en_proceso: 'En proceso', resuelto: 'Resueltos' };
const TEXTO_AVANCE = { en_proceso: 'Pasar a En proceso', resuelto: 'Marcar resuelto' };

const clave = (r) => `${r.uid}/${r.id}`;

// Cada vecino de demostración arranca con un reclamo sembrado del mismo código (R-000001): para
// distinguirlos en clase, la tarjeta muestra a qué vecino pertenece (el mismo código de Mi cuenta).
function etiquetaVecino(uid) {
  const codigo = codigoVecino(uid);
  return codigo ? `vecino ${codigo}` : 'vecino sin identificar';
}

function coincide(reclamo, texto) {
  if (!texto) return true;
  const t = texto.toLocaleLowerCase('es-AR');
  return [reclamo.codigo, reclamo.direccion, reclamo.descripcion, ETIQUETAS.categorias[reclamo.categoria], etiquetaVecino(reclamo.uid)]
    .some((v) => typeof v === 'string' && v.toLocaleLowerCase('es-AR').includes(t));
}

function LineaTiempo({ cronologia }) {
  const pasos = ['recibido', 'en_proceso', 'resuelto'].filter((e) => typeof cronologia?.[e] === 'number');
  if (!pasos.length) return null;
  return (
    <Texto variante="chico" color={colores.textoSuave}>
      {pasos.map((e) => `${ETIQUETAS.estadosReclamo[e]}: ${fechaCorta(cronologia[e])}`).join('  ·  ')}
    </Texto>
  );
}

function ReclamoPanel({ reclamo, evento, ahora, onAvanzar }) {
  const siguiente = siguienteEstadoReclamo(reclamo.estado);
  const categoria = ETIQUETAS.categorias[reclamo.categoria] ?? reclamo.categoria;
  const adjuntos = reclamo.adjuntos?.length ?? 0;
  return (
    <Tarjeta testID={`reclamo-panel-${reclamo.id}`} estilo={estilosPanel.celda}>
      <View style={estilos.cabecera}>
        <Texto variante="titulo3" numberOfLines={1} estilo={estilos.codigo}>
          {reclamo.codigo ?? 'Reclamo'}
        </Texto>
        <EtiquetaEstado
          texto={ETIQUETAS.estadosReclamo[reclamo.estado] ?? reclamo.estado}
          tono={TONO_ESTADO_RECLAMO[reclamo.estado] ?? 'neutro'}
          testID={`estado-panel-${reclamo.id}`}
        />
      </View>
      <View style={estilos.datos}>
        <Texto variante="chico" peso="700" numberOfLines={1}>
          {`${categoria} · ${reclamo.direccion || 'Sin dirección'}`}
        </Texto>
        {reclamo.descripcion ? (
          <Texto variante="cuerpo" numberOfLines={2}>
            {reclamo.descripcion}
          </Texto>
        ) : null}
        <LineaTiempo cronologia={reclamo.cronologia} />
        <View style={estilosPanel.fila}>
          <Texto variante="chico" color={colores.textoSuave}>
            {`Cargado ${tiempoPasado(reclamo.creadoEn, ahora)} · ${etiquetaVecino(reclamo.uid)}`}
          </Texto>
          {adjuntos ? (
            <View style={estilos.adjuntos}>
              <Icono nombre="adjunto" tamano={14} color={colores.textoSuave} />
              <Texto variante="chico" color={colores.textoSuave}>
                {plural(adjuntos, 'adjunto')}
              </Texto>
            </View>
          ) : null}
        </View>
        {reclamo.notaMunicipal ? (
          <Texto variante="chico" numberOfLines={2}>
            <Texto variante="chico" peso="700">Nota para el vecino: </Texto>
            {reclamo.notaMunicipal}
          </Texto>
        ) : null}
        {reclamo.ultimoEventoId && evento ? (
          <EstadoEnvio evento={evento} testID={`envio-reclamo-${reclamo.id}`} />
        ) : null}
      </View>
      <View style={estilosPanel.empujar} />
      {siguiente ? (
        <Boton
          titulo={TEXTO_AVANCE[siguiente]}
          variante={siguiente === 'en_proceso' ? 'primario' : 'secundario'}
          icono={siguiente === 'resuelto' ? 'check' : 'chevron'}
          onPress={() => onAvanzar(reclamo)}
          etiquetaAccesible={`${TEXTO_AVANCE[siguiente]} el reclamo ${reclamo.codigo ?? ''}`.trim()}
          testID={`avanzar-${reclamo.id}`}
          ancho="completo"
        />
      ) : (
        <View style={estilos.cerrado}>
          <Icono nombre="checkCirculo" tamano={18} color={colores.exito} />
          <Texto variante="chico" color={colores.exito} peso="700">
            Reclamo cerrado
          </Texto>
        </View>
      )}
    </Tarjeta>
  );
}

export default function PestanaReclamos({ reclamos, cargando, error, eventosPorId, onReintentar }) {
  const aviso = useAvisoFlotante();
  const ahora = useAhora(30_000);
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [dialogo, setDialogo] = useState(null);   // { clave, requestId }
  const [nota, setNota] = useState('');
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const mensajeExito = useRef('');

  const avance = useComando(avanzarReclamo, {
    ...accionPanel('avanzar_reclamo'),
    alExito: () => {
      if (mensajeExito.current) aviso.mostrar(mensajeExito.current);
      setDialogo(null);
    },
  });

  const conteos = useMemo(() => {
    const c = { todos: reclamos.length, recibido: 0, en_proceso: 0, resuelto: 0 };
    for (const r of reclamos) if (c[r.estado] !== undefined) c[r.estado] += 1;
    return c;
  }, [reclamos]);

  const visibles = useMemo(
    () => reclamos.filter((r) => (filtro === 'todos' || r.estado === filtro) && coincide(r, busqueda.trim())),
    [reclamos, filtro, busqueda],
  );

  // El reclamo del diálogo, siempre con su estado más reciente (el simulador puede moverlo).
  const actual = dialogo ? reclamos.find((r) => clave(r) === dialogo.clave) ?? dialogo.reclamo : null;
  const siguiente = actual ? siguienteEstadoReclamo(actual.estado) : null;
  const cambioEnElCamino = actual && dialogo && actual.estado !== dialogo.estadoInicial;

  const abrir = (reclamo) => {
    avance.limpiar();
    setNota('');
    setDialogo({ clave: clave(reclamo), reclamo, estadoInicial: reclamo.estado, requestId: nuevoIdSolicitud() });
  };
  const cerrar = () => {
    if (avance.ocupado) return;
    avance.limpiar();
    setDialogo(null);
  };
  const confirmar = () => {
    if (!actual || !siguiente) return;
    mensajeExito.current = `El reclamo ${actual.codigo} pasó a ${ETIQUETAS.estadosReclamo[siguiente]}.`;
    avance.ejecutar(
      { uid: actual.uid, reclamoId: actual.id, estadoActual: actual.estado, nota: nota.trim() || null },
      dialogo.requestId,
    );
  };

  if (cargando) return <Cargando lineas={4} mensaje="Cargando los reclamos de los vecinos…" />;
  if (error && !reclamos.length) return <ErrorCarga error={error} onReintentar={onReintentar} testID="error-reclamos-panel" />;

  const errorGeneral = avance.error && !avance.errorDe('nota') ? avance.error : null;

  return (
    <View style={estilos.contenedor}>
      {error ? <ErrorCarga error={error} onReintentar={onReintentar} testID="error-reclamos-panel" /> : null}
      {reclamos.length ? (
        <View style={estilos.filtros}>
          <View style={estilos.filtro}>
            <Selector
              etiqueta="Mostrar"
              valor={filtro}
              onCambio={setFiltro}
              opciones={FILTROS.map((f) => ({ valor: f, etiqueta: `${ETIQUETA_FILTRO[f]} (${conteos[f]})` }))}
              testID="filtro-reclamos"
            />
          </View>
          <View style={estilos.busqueda}>
            <Campo
              etiqueta="Buscar por código, dirección o descripción"
              valor={busqueda}
              onCambio={setBusqueda}
              placeholder="Por ejemplo: R-1A2B3C o Belgrano"
              id="buscar-reclamos-panel"
              testID="buscar-reclamos-panel"
            />
          </View>
        </View>
      ) : null}

      {!reclamos.length ? (
        <Vacio
          icono="reclamo"
          titulo="Todavía no hay reclamos de vecinos"
          testID="vacio-reclamos-panel"
        />
      ) : !visibles.length ? (
        <Vacio
          icono="buscar"
          titulo="No hay reclamos para mostrar"
          mensaje={busqueda.trim() ? 'Ningún reclamo coincide con la búsqueda.' : 'No hay reclamos en este estado.'}
          accion={{ titulo: 'Ver todos', onPress: () => { setFiltro('todos'); setBusqueda(''); } }}
          testID="vacio-filtro-reclamos"
        />
      ) : (
        <View style={estilos.lista}>
          <Grilla>
            {visibles.slice(0, mostrar).map((r) => (
              <ReclamoPanel
                key={clave(r)}
                reclamo={r}
                evento={r.ultimoEventoId ? eventosPorId.get(r.ultimoEventoId) : null}
                ahora={ahora}
                onAvanzar={abrir}
              />
            ))}
          </Grilla>
          {visibles.length > mostrar ? (
            <Boton
              titulo={`Ver más reclamos (quedan ${visibles.length - mostrar})`}
              variante="secundario"
              ancho="completo"
              onPress={() => setMostrar((n) => n + POR_PAGINA)}
              testID="ver-mas-reclamos-panel"
            />
          ) : null}
        </View>
      )}

      <Dialogo
        visible={!!dialogo}
        titulo={actual && siguiente ? `${TEXTO_AVANCE[siguiente]}: ${actual.codigo}` : 'Avanzar reclamo'}
        onCerrar={cerrar}
        cerrable={!avance.ocupado}
        testID="dialogo-avance"
        acciones={[
          { titulo: 'Cancelar', onPress: cerrar, variante: 'secundario', deshabilitado: avance.ocupado, testID: 'cancelar-avance' },
          {
            titulo: siguiente ? TEXTO_AVANCE[siguiente] : 'Confirmar',
            onPress: confirmar,
            cargando: avance.ocupado,
            deshabilitado: !siguiente,
            testID: 'confirmar-avance',
          },
        ]}
      >
        {actual ? (
          <>
            <Texto variante="cuerpo">
              {siguiente
                ? `El vecino va a ver el reclamo ${actual.codigo} como “${ETIQUETAS.estadosReclamo[siguiente]}” en su línea de tiempo y, si tiene las notificaciones activadas, le llega un aviso.`
                : 'Este reclamo ya está resuelto.'}
            </Texto>
            {cambioEnElCamino ? (
              <Aviso
                tono="info"
                mensaje={`Mientras tanto el reclamo pasó a ${ETIQUETAS.estadosReclamo[actual.estado]}.`}
              />
            ) : null}
            {siguiente ? (
              <Campo
                etiqueta="Nota para el vecino (opcional)"
                valor={nota}
                onCambio={setNota}
                multilinea
                maxLargo={LARGO_NOTA}
                ayuda="Por ejemplo, la cuadrilla pasa mañana a la mañana."
                error={avance.errorDe('nota')}
                id="nota-reclamo"
                testID="nota-reclamo"
              />
            ) : null}
            {errorGeneral ? (
              <Aviso tono="peligro" rol="alert" mensaje={errorGeneral.message} testID="error-avance" />
            ) : null}
          </>
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
  lista: { gap: espacio.m },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s },
  codigo: { flexShrink: 1, minWidth: 0 },
  datos: { gap: espacio.xs },
  adjuntos: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  cerrado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.xs, minHeight: 48 },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: espacio.xl, rowGap: espacio.l },
  filtro: { flexShrink: 0, maxWidth: '100%' },
  busqueda: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
});
