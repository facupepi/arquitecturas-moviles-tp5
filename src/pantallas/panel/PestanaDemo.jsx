// Pestaña Demo del panel (S8): parámetros de municipal/config (simulador, horario estricto y aviso
// de estacionamiento), las tareas de Supabase a pedido (paso del simulador, recordatorios T4 y
// resumen N2), "Restablecer valores de demo" y los últimos 20 eventos de la bandeja de salida.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import { configurarDemo, ejecutarTarea, restablecerDemo } from '../../datos/repositorio';
import { useComando } from '../../datos/useComando';
import { useAhora } from '../../datos/useAhora';
import { colores, espacio } from '../../tema/tokens';
import {
  Aviso, Boton, Cargando, Dialogo, ErrorCarga, Interruptor, Seccion, Selector, Tarjeta, Texto, Vacio,
  useAvisoFlotante,
} from '../../ui';
import { ETIQUETAS, LIMITES } from '../../../shared/constantes.mjs';
import { tiempoPasado } from '../../../shared/formato.mjs';
import { EtiquetaEvento, TIPOS_EVENTO, accionPanel, estilosPanel, plural } from './comun';

const MINUTOS_SIMULADOR = [1, 2, 5, 10];
const AVISO_CLASE = LIMITES.avisoEstacionamientoMinMax;   // 14: con 15 minutos, avisa al minuto de empezar
const OPCIONES_AVISO_EST = Array.from({ length: LIMITES.avisoEstacionamientoMinMax }, (_, i) => {
  const n = i + 1;
  return { valor: String(n), etiqueta: `${plural(n, 'minuto')} antes del fin${n === AVISO_CLASE ? ' (recomendado para la clase)' : ''}` };
});

// ---------- Textos de los resultados de las tareas ----------

function textoSimulador(resultado, { estaciones, reclamos }) {
  const cambios = resultado?.cambios ?? [];
  if (!cambios.length) return { titulo: 'Este paso no cambió nada', lineas: ['El simulador elige al azar. Probá de nuevo en unos segundos.'] };
  const lineas = cambios.map((c) => {
    if (c.tipo === 'bicicletas') {
      const nombre = estaciones.find((e) => e.id === c.id)?.nombre ?? c.id;
      return `${nombre}: ${c.antes} → ${c.despues} bicicletas`;
    }
    const codigo = reclamos.find((r) => r.id === c.id && (!c.uid || r.uid === c.uid))?.codigo ?? 'Un reclamo';
    return `${codigo}: pasó a ${ETIQUETAS.estadosReclamo[c.despues] ?? c.despues}`;
  });
  return { titulo: `El simulador hizo ${plural(cambios.length, 'cambio')}`, lineas };
}

function textoRecordatorios(r) {
  const n = r?.notificaciones ?? 0;
  const push = r?.push ?? 0;
  if (!n) {
    return {
      titulo: 'No había recordatorios nuevos',
      lineas: ['Los vecinos con cedulones vencidos o por vencer ya tenían su aviso. No se repite el mismo recordatorio.'],
    };
  }
  return {
    titulo: `Se crearon ${plural(n, 'recordatorio')} de vencimiento`,
    lineas: [push ? `Se enviaron ${plural(push, 'notificación push', 'notificaciones push')}.` : 'Ningún celular tenía las notificaciones push activadas: lo ven en Notificaciones.'],
  };
}

function textoResumen(r) {
  const push = r?.push ?? 0;
  return push
    ? { titulo: `Se envió el resumen a ${plural(push, 'celular', 'celulares')}`, lineas: [] }
    : { titulo: 'No había a quién enviarle el resumen', lineas: ['Llega a los vecinos que eligieron “Resumen diario” y tienen las notificaciones activadas.'] };
}

// ---------- Piezas ----------

function Resultado({ resultado, testID }) {
  if (!resultado) return null;
  return (
    <Aviso tono="exito" titulo={resultado.titulo} mensaje={resultado.lineas.join('\n') || undefined} testID={testID} />
  );
}

function AccionTarea({ titulo, descripcion, boton, icono, tarea, armarTexto, testID, testIDResultado }) {
  const [resultado, setResultado] = useState(null);
  const comando = useComando(ejecutarTarea, accionPanel(`tarea_${tarea}`));
  const ejecutar = async () => {
    setResultado(null);
    const r = await comando.ejecutar(tarea);
    if (r) setResultado(armarTexto(r));
  };
  return (
    <View style={estilos.accion}>
      <Texto variante="cuerpo" peso="700">{titulo}</Texto>
      <Texto variante="chico" color={colores.textoSuave}>{descripcion}</Texto>
      <Boton titulo={boton} icono={icono} variante="secundario" onPress={ejecutar} cargando={comando.ocupado} testID={testID} />
      {comando.error ? (
        <Aviso tono="peligro" rol="alert" mensaje={comando.error.message} testID={`${testIDResultado}-error`} />
      ) : null}
      <Resultado resultado={resultado} testID={testIDResultado} />
    </View>
  );
}

function Configuracion({ config }) {
  const aviso = useAvisoFlotante();
  const guardar = useComando(configurarDemo, {
    ...accionPanel((_, cambios) => ({ accion: 'configurar_demo', campo: Object.keys(cambios ?? {}).join(',') })),
    alExito: () => aviso.mostrar('Configuración guardada.'),
  });
  const cada = config.simuladorCadaMin;
  const opcionesCada = (MINUTOS_SIMULADOR.includes(cada) ? MINUTOS_SIMULADOR : [...MINUTOS_SIMULADOR, cada].sort((a, b) => a - b))
    .map((n) => ({ valor: String(n), etiqueta: `${n} min`, deshabilitada: guardar.ocupado }));
  const errorGeneral = guardar.error && !guardar.error.campo ? guardar.error : null;

  return (
    <Tarjeta titulo="Configuración de la demo">
      <Interruptor
        etiqueta="Simulador automático"
        descripcion="Mueve bicicletas y avanza reclamos solo, cada tantos minutos. Nunca activa alarmas."
        valor={config.simuladorActivo}
        onCambio={(v) => guardar.ejecutar({ simuladorActivo: v })}
        deshabilitado={guardar.ocupado}
        testID="interruptor-simulador"
      />
      <Selector
        etiqueta="Cada cuántos minutos corre el simulador"
        valor={String(cada)}
        opciones={opcionesCada}
        onCambio={(v) => guardar.ejecutar({ simuladorCadaMin: Number(v) })}
        error={guardar.errorDe('simuladorCadaMin')}
        testID="simulador-cada"
      />
      <Interruptor
        etiqueta="Cobro de estacionamiento solo en horario"
        descripcion="Si lo apagás, se puede estacionar a cualquier hora (útil si la clase es de noche)."
        valor={config.horarioEstricto}
        onCambio={(v) => guardar.ejecutar({ horarioEstricto: v })}
        deshabilitado={guardar.ocupado}
        testID="interruptor-horario"
      />
      <Selector
        etiqueta="Aviso de estacionamiento por vencer"
        valor={String(config.avisoEstacionamientoMin)}
        opciones={OPCIONES_AVISO_EST}
        onCambio={(v) => guardar.ejecutar({ avisoEstacionamientoMin: Number(v) })}
        variante="lista"
        error={guardar.errorDe('avisoEstacionamientoMin')}
        testID="aviso-estacionamiento-min"
      />
      <Texto variante="chico" color={colores.textoSuave}>
        {`Con ${AVISO_CLASE} minutos, una sesión de 15 minutos avisa “por vencer” alrededor de un minuto después de empezar.`}
      </Texto>
      {errorGeneral ? <Aviso tono="peligro" rol="alert" mensaje={errorGeneral.message} testID="error-configuracion" /> : null}
      <Boton
        titulo="Usar valores para la clase"
        icono="ajustes"
        variante="texto"
        onPress={() => guardar.ejecutar({ avisoEstacionamientoMin: AVISO_CLASE, simuladorActivo: false })}
        deshabilitado={guardar.ocupado}
        etiquetaAccesible={`Usar valores para la clase: aviso ${AVISO_CLASE} minutos antes y simulador apagado`}
        testID="valores-clase"
      />
    </Tarjeta>
  );
}

function descripcionEvento(e, { avisos, alarmas, reclamos }) {
  if (e.tipo === 'aviso') return avisos.find((a) => a.id === e.refId)?.titulo ?? 'Aviso municipal';
  if (e.tipo === 'alarma') return alarmas.find((a) => a.id === e.refId)?.nombre ?? 'Alarma comunitaria';
  if (e.tipo === 'reclamo') {
    const r = reclamos.find((x) => x.id === e.refId && (!e.uid || x.uid === e.uid));
    return r ? `${r.codigo} · ${ETIQUETAS.estadosReclamo[r.estado] ?? r.estado}` : 'Reclamo de un vecino';
  }
  return e.refId;
}

function Eventos({ eventos, reclamos, cargando, error, onReintentar }) {
  const avisos = useMunicipal((s) => s.avisos);
  const alarmas = useMunicipal((s) => s.alarmas);
  const ahora = useAhora(30_000);
  const contexto = useMemo(() => ({ avisos, alarmas, reclamos }), [avisos, alarmas, reclamos]);
  return (
    <Seccion titulo="Últimos eventos enviados">
      <Texto variante="chico" color={colores.textoSuave} estilo={estilosPanel.ayuda}>
        Cada alarma, aviso o avance de reclamo deja un evento. El servidor lo toma y envía las notificaciones.
      </Texto>
      {cargando ? (
        <Cargando lineas={3} mensaje="Cargando eventos…" />
      ) : error ? (
        <ErrorCarga error={error} onReintentar={onReintentar} testID="error-eventos" />
      ) : !eventos.length ? (
        <Vacio icono="campana" titulo="Todavía no hay eventos" mensaje="Activá una alarma o publicá un aviso para ver acá cómo se envía." testID="vacio-eventos" />
      ) : (
        <View style={estilos.lista} testID="lista-eventos">
          {eventos.map((e) => (
            <View key={e.id} style={estilos.evento} testID={`evento-${e.id}`}>
              <View style={estilos.eventoTexto}>
                <Texto variante="chico" peso="700">
                  {`${TIPOS_EVENTO[e.tipo] ?? e.tipo}: ${descripcionEvento(e, contexto)}`}
                </Texto>
                <Texto variante="chico" color={colores.textoSuave}>
                  {[
                    tiempoPasado(e.creadoEn, ahora),
                    e.origen === 'simulador' ? 'desde el simulador' : 'desde el panel',
                    e.estado === 'enviado' ? (e.enviados ? plural(e.enviados, 'push enviado', 'push enviados') : 'sin push') : null,
                    e.estado === 'error' && e.error ? e.error : null,
                  ].filter(Boolean).join(' · ')}
                </Texto>
              </View>
              <EtiquetaEvento estado={e.estado} testID={`estado-evento-${e.id}`} />
            </View>
          ))}
        </View>
      )}
    </Seccion>
  );
}

// ---------- Pestaña ----------

export default function PestanaDemo({ eventos, reclamos, cargando, error, onReintentar }) {
  const config = useMunicipal((s) => s.config);
  const errorCatalogo = useMunicipal((s) => s.errores.catalogo);
  const estaciones = useMunicipal((s) => s.estaciones);
  const aviso = useAvisoFlotante();
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false);
  const restablecer = useComando(restablecerDemo, {
    ...accionPanel('restablecer_demo'),
    alExito: () => {
      setConfirmarRestablecer(false);
      aviso.mostrar('Listo: bicicletas, alarmas y configuración volvieron a los valores iniciales.');
    },
  });

  return (
    <View style={estilos.contenedor}>

      <Tarjeta titulo="Acciones inmediatas">
        <AccionTarea
          titulo="Un paso del simulador"
          descripcion="Mueve algunas bicicletas y avanza reclamos que esperan hace unos minutos."
          boton="Ejecutar un paso del simulador ahora"
          icono="actualizar"
          tarea="simulador"
          armarTexto={(r) => textoSimulador(r, { estaciones, reclamos })}
          testID="simulador-ahora"
          testIDResultado="resultado-simulador"
        />
        <View style={estilos.separador} />
        <AccionTarea
          titulo="Recordatorios de vencimiento"
          descripcion="Avisa a los vecinos con cedulones vencidos o que vencen en los próximos 3 días."
          boton="Enviar recordatorios ahora"
          icono="tributo"
          tarea="diaria"
          armarTexto={textoRecordatorios}
          testID="recordatorios-ahora"
          testIDResultado="resultado-recordatorios"
        />
        <View style={estilos.separador} />
        <AccionTarea
          titulo="Resumen diario"
          descripcion="Envía el resumen del día a quienes eligieron “Resumen diario” en sus preferencias."
          boton="Enviar resumen ahora"
          icono="campana"
          tarea="resumen"
          armarTexto={textoResumen}
          testID="resumen-ahora"
          testIDResultado="resultado-resumen"
        />
        <View style={estilos.separador} />
        <View style={estilos.accion}>
          <Texto variante="cuerpo" peso="700">Volver a empezar</Texto>
          <Texto variante="chico" color={colores.textoSuave}>
            Deja las bicicletas como al principio, desactiva todas las alarmas y restablece la configuración.
          </Texto>
          <Boton
            titulo="Restablecer valores de demo"
            icono="actualizar"
            variante="texto"
            onPress={() => { restablecer.limpiar(); setConfirmarRestablecer(true); }}
            testID="restablecer-demo"
          />
        </View>
      </Tarjeta>

      {errorCatalogo && !config ? <ErrorCarga error={errorCatalogo} testID="error-config" /> : null}
      {config ? <Configuracion config={config} /> : !errorCatalogo ? <Cargando lineas={3} /> : null}

      <Eventos eventos={eventos} reclamos={reclamos} cargando={cargando} error={error} onReintentar={onReintentar} />

      <Dialogo
        visible={confirmarRestablecer}
        titulo="¿Restablecer la demo?"
        onCerrar={() => !restablecer.ocupado && setConfirmarRestablecer(false)}
        cerrable={!restablecer.ocupado}
        testID="dialogo-restablecer"
        acciones={[
          { titulo: 'Cancelar', onPress: () => setConfirmarRestablecer(false), variante: 'secundario', deshabilitado: restablecer.ocupado, testID: 'cancelar-restablecer' },
          { titulo: 'Restablecer', onPress: () => restablecer.ejecutar(), variante: 'peligro', cargando: restablecer.ocupado, testID: 'confirmar-restablecer' },
        ]}
      >
        <Texto variante="cuerpo">
          Las bicicletas vuelven a sus cantidades iniciales, todas las alarmas se desactivan y la configuración
          vuelve a sus valores de fábrica (horario estricto prendido, aviso 5 minutos antes, simulador apagado).
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          Los reclamos, avisos y pagos de los vecinos no se borran.
        </Texto>
        {restablecer.error ? (
          <Aviso tono="peligro" rol="alert" mensaje={restablecer.error.message} testID="error-restablecer" />
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
  accion: { gap: espacio.s },
  separador: { height: 1, backgroundColor: colores.borde },
  lista: {
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 18,
    overflow: 'hidden',
  },
  evento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    paddingVertical: espacio.m,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  eventoTexto: { flex: 1, minWidth: 0, gap: 2 },
});
