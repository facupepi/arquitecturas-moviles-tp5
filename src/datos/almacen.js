// Almacén de la app (WP3, sección 4.5). Reemplaza heredado:src/useMunicipal.js sin polling:
// abre las suscripciones de Firestore al montarse, cada snapshot actualiza una porción del
// estado y las pantallas leen con useMunicipal(selector). También es el único dueño de las
// alertas en vivo (deduplicadas por claveEntrega) y del seguimiento de cercanía (A3).
import {
  createContext, createElement, useContext, useEffect, useMemo, useRef, useSyncExternalStore,
} from 'react';
import * as repositorio from './repositorio';
import { ErrorApp, desdeFirebase } from './errores';
import { marcarListo, pestanaOculta } from '../plataforma/red';
import { seguirUbicacion } from '../plataforma/ubicacion';
import { mostrarNotificacionLocal } from '../plataforma/notificacionesLocales';
import { leerConfig } from '../firebase/configRemota';
import { registrarInicioConDatos } from '../firebase/rendimiento';
import { estadoTributo } from '../../shared/dominio.mjs';
import { alarmasCercanas, claveEntrega, decidirEntrega, unirNotificaciones } from '../../shared/notificaciones.mjs';
import { ETIQUETAS, LIMITES, PREFERENCIAS_POR_DEFECTO } from '../../shared/constantes.mjs';

const MIN = 60_000;
const PASO_PAGINA = 20;
const LIMITES_INICIALES = { avisos: 50, pagos: 20, reclamos: 20, estacionamiento: 20, notificaciones: 50 };
const MAX_TIMEOUT = 2 ** 31 - 1;
const GRACIA_ALTA_MS = 5000;

function estadoInicial(usuario) {
  return {
    listo: false,
    desdeCache: false,
    errores: {},
    usuario,
    esAdmin: false,
    altaTerminada: false,
    info: null,
    config: null,
    estaciones: [],
    alarmas: [],
    zonas: [],
    contactos: [],
    avisos: [],
    perfil: null,
    preferencias: PREFERENCIAS_POR_DEFECTO,
    tributos: [],
    pagos: [],
    reclamos: [],
    sesiones: [],
    notificaciones: [],
    noLeidas: 0,
    hayMas: { reclamos: false, notificaciones: false, pagos: false, estacionamiento: false },
    cercania: { activa: false, siguiendo: false, error: null },
    alerta: null,
  };
}

function configCercania() {
  let valores = {};
  try { valores = leerConfig() ?? {}; } catch { /* Remote Config todavía no cargó */ }
  const radio = Number(valores.radioAlarmaKm);
  const intervalo = Number(valores.intervaloCercaniaMin);
  return {
    radioAlarmaKm: Number.isFinite(radio) && radio > 0 ? radio : LIMITES.radioAlarmaKm,
    intervaloCercaniaMin: Math.min(Number.isFinite(intervalo) && intervalo > 0 ? intervalo : LIMITES.cercaniaMin, LIMITES.cercaniaMaxMin),
  };
}

function claveSegura(entrada, respaldo) {
  try {
    return claveEntrega(entrada) || respaldo;
  } catch {
    return respaldo;
  }
}

// Crea un almacén para un usuario. No toca la red hasta iniciar(). Se exporta para probarlo
// en Node sin React; las pantallas usan ProveedorMunicipal y useMunicipal.
export function crearAlmacen(usuarioInicial) {
  let estado = estadoInicial(usuarioInicial);
  const oyentes = new Set();
  const cancelaciones = new Map();
  const limites = { ...LIMITES_INICIALES };
  const recibido = { municipal: false, estaciones: false, perfil: false };
  const cargaInicial = {};              // porción → ya llegó su primer snapshot del servidor
  const entregadas = new Set();         // claves de entrega ya mostradas (o registradas sin mostrar)
  const crudo = { personales: [], avisos: [], leidos: new Set(), tributos: [] };
  let activo = false;
  let listoInformado = false;
  let temporizadorSesiones = null;
  let temporizadorCercania = null;
  let sesionesRevisadas = false;
  // Las notificaciones que crea vecino/alta (bienvenida y recordatorios T4) llegan apenas después de
  // la carga inicial: se registran sin aviso flotante mientras el alta corre y unos segundos después
  // (pedido de integración de S2, S4, S6 y S7: el aviso tapaba la parte de abajo al entrar).
  let altaTerminadaEn = 0;
  const enGraciaAlta = () => !estado.altaTerminada || Date.now() - altaTerminadaEn < GRACIA_ALTA_MS;

  // Seguimiento de cercanía (A3): la posición vive solo en memoria.
  const cerca = { detener: null, posicion: null, ids: new Set(), ultimoConjunto: null, ultimaEscritura: 0, refresco: null, reanudada: false };

  // ---------- Estado y notificación a los oyentes ----------
  function actualizar(parcial) {
    estado = { ...estado, ...parcial };
    for (const oyente of oyentes) oyente();
  }

  function fijarError(porcion, error) {
    const errores = { ...estado.errores, [porcion]: error instanceof ErrorApp ? error : desdeFirebase(error) };
    return { errores };
  }

  function limpiarError(porcion) {
    if (!estado.errores[porcion]) return {};
    const errores = { ...estado.errores };
    delete errores[porcion];
    return { errores };
  }

  function derivarNotificaciones(preferencias = estado.preferencias) {
    let notificaciones = [];
    try {
      notificaciones = unirNotificaciones(crudo.personales, crudo.avisos, crudo.leidos, preferencias);
    } catch (e) {
      console.warn('No se pudieron unir las notificaciones:', e);
    }
    return { notificaciones, noLeidas: notificaciones.filter((n) => !n.leida).length };
  }

  function derivarTributos() {
    const ahora = Date.now();
    return crudo.tributos.map((t) => ({ ...t, estado: estadoTributo(t, ahora) }));
  }

  function derivarCercania(perfil = estado.perfil) {
    const vence = perfil?.cercania?.vence ?? 0;
    const activa = vence > Date.now();
    clearTimeout(temporizadorCercania);
    if (activa && activo) {
      temporizadorCercania = setTimeout(() => actualizar({ cercania: derivarCercania() }), Math.min(vence - Date.now() + 50, MAX_TIMEOUT));
    }
    return { ...estado.cercania, activa };
  }

  function comprobarListo() {
    const listo = recibido.municipal && recibido.estaciones && recibido.perfil;
    if (listo && !estado.listo) {
      actualizar({ listo: true });
      if (!listoInformado) {
        listoInformado = true;
        try { registrarInicioConDatos({ desdeCache: estado.desdeCache, autenticado: true }); } catch { /* opcional */ }
        try { marcarListo(); } catch { /* opcional */ }
      }
    }
  }

  // ---------- Alertas en vivo y deduplicación ----------
  function registrarEntrega(clave) {
    if (!clave || entregadas.has(clave)) return false;
    entregadas.add(clave);
    return true;
  }

  function alertar({ clave, notif, cercano = false, titulo, cuerpo, destino = null, tono = 'info' }) {
    let decision;
    try {
      decision = decidirEntrega(notif, estado.preferencias, { cercano });
    } catch {
      return;
    }
    if (!decision?.inmediata) return;
    actualizar({ alerta: { id: clave, titulo, cuerpo, destino, tono } });
    if (pestanaOculta()) {
      try {
        Promise.resolve(mostrarNotificacionLocal({ titulo, cuerpo, destino, tag: clave })).catch(() => {});
      } catch { /* sin permiso o sin service worker */ }
    }
  }

  // Después de la primera carga, cada documento nuevo que no sale de la caché se evalúa una vez.
  function procesarEntregas(porcion, items, meta, describir) {
    const inicial = !cargaInicial[porcion];
    if (meta.desdeCache && !inicial) return;
    for (const item of items) {
      const d = describir(item);
      if (!d?.clave) continue;
      if (inicial || d.silenciosa) {
        entregadas.add(d.clave);
        continue;
      }
      if (registrarEntrega(d.clave)) alertar(d);
    }
    if (!meta.desdeCache) cargaInicial[porcion] = true;
  }

  const tonoDe = (tipo) => (tipo === 'alarmas' || tipo === 'emergencias' ? 'alerta' : 'info');
  const alarmaDeDestino = (destino) => /^#\/alarmas\/([A-Za-z0-9_-]+)/.exec(destino ?? '')?.[1] ?? null;

  const describir = {
    personal: (n) => ({
      clave: claveSegura({ fuente: 'personal', notificacion: n }, n.id),
      silenciosa: n.pendiente || n.origen === 'vecino' || n.leida || enGraciaAlta(),
      notif: { tipo: n.tipo, zona: n.zona ?? null },
      cercano: String(n.id).startsWith('alarma-'),
      titulo: n.titulo, cuerpo: n.cuerpo, destino: n.destino ?? null, tono: tonoDe(n.tipo),
    }),
    aviso: (a) => ({
      clave: claveSegura({ fuente: 'aviso', aviso: a }, a.eventoId || `aviso-${a.id}`),
      notif: { tipo: a.tipo, zona: a.zona },
      cercano: a.tipo === 'alarmas' && cerca.ids.has(alarmaDeDestino(a.destino)),
      titulo: a.titulo, cuerpo: a.cuerpo, destino: a.destino ?? null, tono: tonoDe(a.tipo),
    }),
    alarma: (a) => (a.activa && a.activacionId ? {
      clave: claveSegura({ fuente: 'alarma', alarma: a }, a.activacionId),
      notif: { tipo: 'alarmas', zona: a.zona },
      cercano: cerca.ids.has(a.id),
      titulo: `Alarma activada: ${a.nombre}`,
      cuerpo: a.referencia ? `Se activó la alarma comunitaria (${a.referencia}).` : 'Se activó una alarma comunitaria.',
      destino: `#/alarmas/${a.id}`, tono: 'alerta',
    } : null),
    reclamo: (r) => (r.ultimoEventoId ? {
      clave: claveSegura({ fuente: 'reclamo', reclamo: r }, r.ultimoEventoId),
      notif: { tipo: 'reclamos', zona: null },
      titulo: `Tu reclamo ${r.codigo} pasó a ${ETIQUETAS.estadosReclamo?.[r.estado] ?? r.estado}`,
      cuerpo: r.notaMunicipal || 'Mirá el detalle en Reclamos.',
      destino: `#/reclamos/${r.id}`, tono: 'info',
    } : null),
  };

  // E3 en la app: cuando una sesión entra en el umbral de municipal/config.avisoEstacionamientoMin.
  function revisarSesiones() {
    clearTimeout(temporizadorSesiones);
    if (!activo || !cargaInicial.estacionamiento) return;
    const ahora = Date.now();
    const umbral = (estado.config?.avisoEstacionamientoMin ?? LIMITES.avisoEstacionamientoMinPorDefecto) * MIN;
    let proxima = Infinity;
    for (const s of estado.sesiones) {
      if (!s.fin || s.fin <= ahora) continue;
      const entra = s.fin - umbral;
      if (entra > ahora) {
        proxima = Math.min(proxima, entra);
        continue;
      }
      const clave = claveSegura({ fuente: 'sesion', sesion: s, etapa: 'por_vencer' }, `est-${s.id}-${s.fin}-por_vencer`);
      if (!sesionesRevisadas) {
        entregadas.add(clave);
      } else if (registrarEntrega(clave)) {
        const restantes = Math.max(1, Math.ceil((s.fin - ahora) / MIN));
        alertar({
          clave, notif: { tipo: 'estacionamiento', zona: null },
          titulo: 'Tu estacionamiento está por vencer',
          cuerpo: `Te ${restantes === 1 ? 'queda 1 minuto' : `quedan ${restantes} minutos`} en ${s.zonaNombre} (patente ${s.patente}).`,
          destino: '#/estacionamiento', tono: 'alerta',
        });
      }
    }
    sesionesRevisadas = true;
    if (proxima < Infinity) temporizadorSesiones = setTimeout(revisarSesiones, Math.min(proxima - ahora + 50, MAX_TIMEOUT));
  }

  // ---------- Suscripciones ----------
  function abrir(porcion, abrirFn) {
    cancelaciones.get(porcion)?.();
    try {
      cancelaciones.set(porcion, abrirFn());
    } catch (e) {
      actualizar(fijarError(porcion, e));
    }
  }

  function alFallar(porcion, marcar) {
    return (error) => {
      if (marcar) recibido[marcar] = true;
      actualizar(fijarError(porcion, error));
      comprobarListo();
    };
  }

  const aperturas = {
    municipal: () => repositorio.suscribirMunicipal(({ info, config }) => {
      recibido.municipal = true;
      actualizar({ info, config, ...limpiarError('catalogo') });
      revisarSesiones();
      comprobarListo();
    }, alFallar('catalogo', 'municipal')),

    estaciones: () => repositorio.suscribirEstaciones((estaciones) => {
      recibido.estaciones = true;
      actualizar({ estaciones, ...limpiarError('estaciones') });
      comprobarListo();
    }, alFallar('estaciones', 'estaciones')),

    alarmas: () => repositorio.suscribirAlarmas((alarmas, meta) => {
      actualizar({ alarmas, ...limpiarError('alarmas') });
      if (cerca.detener && cerca.posicion) recalcularCercania(false);
      procesarEntregas('alarmas', alarmas, meta, describir.alarma);
    }, alFallar('alarmas')),

    zonas: () => repositorio.suscribirZonasEstacionamiento((zonas) => {
      actualizar({ zonas, ...limpiarError('zonas') });
    }, alFallar('zonas')),

    contactos: () => repositorio.suscribirContactos((contactos) => {
      actualizar({ contactos, ...limpiarError('contactos') });
    }, alFallar('contactos')),

    avisos: () => repositorio.suscribirAvisos(limites.avisos, (avisos, meta) => {
      crudo.avisos = avisos;
      actualizar({
        avisos, ...derivarNotificaciones(), ...limpiarError('avisos'),
        hayMas: { ...estado.hayMas, notificaciones: avisos.length >= limites.avisos || crudo.personales.length >= limites.notificaciones },
      });
      procesarEntregas('avisos', avisos, meta, describir.aviso);
    }, alFallar('avisos')),

    perfil: () => repositorio.suscribirPerfil(estado.usuario.uid, (perfil, meta) => {
      recibido.perfil = true;
      const preferencias = perfil?.preferencias ?? PREFERENCIAS_POR_DEFECTO;
      actualizar({
        perfil, preferencias, desdeCache: meta.desdeCache, ...limpiarError('perfil'),
        ...derivarNotificaciones(preferencias), cercania: derivarCercania(perfil),
      });
      if (!meta.desdeCache || perfil?.altaEn) asegurar(perfil);
      reanudarCercania(perfil);
      comprobarListo();
    }, alFallar('perfil', 'perfil')),

    esAdmin: () => repositorio.suscribirEsAdmin(estado.usuario.uid, (existe) => {
      actualizar({ esAdmin: Boolean(existe) });
    }, () => actualizar({ esAdmin: false })),

    tributos: () => repositorio.suscribirTributos(estado.usuario.uid, (tributos) => {
      crudo.tributos = tributos;
      actualizar({ tributos: derivarTributos(), ...limpiarError('tributos') });
    }, alFallar('tributos')),

    pagos: () => repositorio.suscribirPagos(estado.usuario.uid, limites.pagos, (pagos) => {
      actualizar({ pagos, hayMas: { ...estado.hayMas, pagos: pagos.length >= limites.pagos }, ...limpiarError('pagos') });
    }, alFallar('pagos')),

    reclamos: () => repositorio.suscribirReclamos(estado.usuario.uid, limites.reclamos, (reclamos, meta) => {
      actualizar({ reclamos, hayMas: { ...estado.hayMas, reclamos: reclamos.length >= limites.reclamos }, ...limpiarError('reclamos') });
      procesarEntregas('reclamos', reclamos, meta, describir.reclamo);
    }, alFallar('reclamos')),

    estacionamiento: () => repositorio.suscribirEstacionamiento(estado.usuario.uid, limites.estacionamiento, (sesiones, meta) => {
      actualizar({
        sesiones, hayMas: { ...estado.hayMas, estacionamiento: sesiones.length >= limites.estacionamiento },
        ...limpiarError('estacionamiento'),
      });
      if (!meta.desdeCache) cargaInicial.estacionamiento = true;
      revisarSesiones();
    }, alFallar('estacionamiento')),

    notificaciones: () => repositorio.suscribirNotificaciones(estado.usuario.uid, limites.notificaciones, (personales, meta) => {
      crudo.personales = personales;
      actualizar({
        ...derivarNotificaciones(), ...limpiarError('notificaciones'),
        hayMas: { ...estado.hayMas, notificaciones: personales.length >= limites.notificaciones || crudo.avisos.length >= limites.avisos },
      });
      procesarEntregas('notificaciones', personales, meta, describir.personal);
    }, alFallar('notificaciones')),

    avisosLeidos: () => repositorio.suscribirAvisosLeidos(estado.usuario.uid, (leidos) => {
      crudo.leidos = leidos;
      actualizar({ ...derivarNotificaciones(), ...limpiarError('avisosLeidos') });
    }, alFallar('avisosLeidos')),
  };

  // ---------- Alta del vecino ----------
  function asegurar(perfil) {
    const usuario = estado.usuario;
    // Solo hay gracia si esta vez el alta escribió datos (mismo criterio que asegurarAlta).
    const escribeDatos = repositorio.necesitaAlta(perfil);
    const terminar = () => {
      if (!activo || estado.usuario.uid !== usuario.uid || estado.altaTerminada) return;
      if (escribeDatos) altaTerminadaEn = Date.now();
      actualizar({ altaTerminada: true });
    };
    repositorio.asegurarAlta(usuario, perfil).then(terminar, terminar);
  }

  // ---------- Cercanía (A3) ----------
  async function recalcularCercania(forzar) {
    if (!cerca.posicion) return;
    const { radioAlarmaKm, intervaloCercaniaMin } = configCercania();
    let ids = [];
    try {
      ids = alarmasCercanas(estado.alarmas, cerca.posicion, radioAlarmaKm) ?? [];
    } catch { ids = []; }
    cerca.ids = new Set(ids);
    const conjunto = [...ids].sort().join(',');
    const vencida = Date.now() - cerca.ultimaEscritura >= (intervaloCercaniaMin * MIN) / 2;
    if (!forzar && conjunto === cerca.ultimoConjunto && !vencida) return;
    cerca.ultimoConjunto = conjunto;
    cerca.ultimaEscritura = Date.now();
    try {
      await repositorio.actualizarCercania(ids, intervaloCercaniaMin);
      if (estado.cercania.error) actualizar({ cercania: { ...estado.cercania, error: null } });
    } catch (e) {
      actualizar({ cercania: { ...estado.cercania, error: desdeFirebase(e) } });
    }
  }

  function detenerSeguimiento() {
    cerca.detener?.();
    cerca.detener = null;
    clearInterval(cerca.refresco);
    cerca.refresco = null;
    cerca.posicion = null;
    cerca.ids = new Set();
    cerca.ultimoConjunto = null;
  }

  // Devuelve true si quedó siguiendo; los errores quedan en estado.cercania.error.
  function activarCercania() {
    if (cerca.detener) return Promise.resolve(true);
    actualizar({ cercania: { ...estado.cercania, siguiendo: true, error: null } });
    return new Promise((resolver) => {
      let primera = true;
      const terminar = (valor) => { if (primera) { primera = false; resolver(valor); } };
      cerca.detener = seguirUbicacion(
        async (posicion) => {
          cerca.posicion = posicion;
          await recalcularCercania(primera);
          terminar(true);
        },
        (error) => {
          const e = error instanceof ErrorApp ? error : desdeFirebase(error);
          if (e.codigo === 'permiso' || e.codigo === 'no-soportado' || primera) {
            detenerSeguimiento();
            actualizar({ cercania: { ...estado.cercania, siguiendo: false, error: e } });
          } else {
            actualizar({ cercania: { ...estado.cercania, error: e } });
          }
          terminar(false);
        },
      );
      const { intervaloCercaniaMin } = configCercania();
      cerca.refresco = setInterval(() => recalcularCercania(true), (intervaloCercaniaMin * MIN) / 2);
    });
  }

  async function desactivarCercania() {
    detenerSeguimiento();
    actualizar({ cercania: { ...estado.cercania, siguiendo: false, error: null } });
    try {
      await repositorio.actualizarCercania(null);
    } catch (e) {
      actualizar({ cercania: { ...estado.cercania, error: desdeFirebase(e) } });
    }
  }

  // Si la cercanía seguía vigente al recargar, se retoma el seguimiento una vez.
  function reanudarCercania(perfil) {
    if (cerca.reanudada || cerca.detener) return;
    if ((perfil?.cercania?.vence ?? 0) > Date.now()) {
      cerca.reanudada = true;
      activarCercania();
    }
  }

  // ---------- Paginación ----------
  // Sube en 20 el limit de la escucha y la vuelve a abrir. Los documentos viejos que llegan
  // con la página nueva se registran sin alertar (cargaInicial vuelve a cero).
  function cargarMas(coleccion) {
    if (!activo) return;
    const reabrir = (porcion) => {
      limites[porcion] += PASO_PAGINA;
      cargaInicial[porcion] = false;
      abrir(porcion, aperturas[porcion]);
    };
    if (coleccion === 'notificaciones') {
      reabrir('notificaciones');
      reabrir('avisos');
      return;
    }
    if (['pagos', 'reclamos', 'estacionamiento'].includes(coleccion)) reabrir(coleccion);
  }

  // ---------- Ciclo de vida ----------
  function iniciar() {
    if (activo) return;
    activo = true;
    for (const [porcion, abrirFn] of Object.entries(aperturas)) abrir(porcion, abrirFn);
  }

  function detener() {
    activo = false;
    for (const cancelar of cancelaciones.values()) {
      try { cancelar?.(); } catch { /* ya estaba cerrada */ }
    }
    cancelaciones.clear();
    clearTimeout(temporizadorSesiones);
    clearTimeout(temporizadorCercania);
    detenerSeguimiento();
    cerca.reanudada = false;
  }

  // Mismo uid, otros datos (por ejemplo, cambió el nombre de la cuenta de Google).
  function cambiarUsuario(usuario) {
    if (!usuario || usuario.uid !== estado.usuario.uid) return;
    const anterior = estado.usuario;
    if (anterior.nombre === usuario.nombre && anterior.email === usuario.email
      && anterior.proveedor === usuario.proveedor) return;
    actualizar({ usuario });
  }

  return {
    uid: usuarioInicial?.uid ?? null,
    obtener: () => estado,
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    iniciar,
    detener,
    cambiarUsuario,
    cargarMas,
    activarCercania,
    desactivarCercania,
    descartarAlerta: () => { if (estado.alerta) actualizar({ alerta: null }); },
    registrarEntrega,
  };
}

// ===================== React =====================

const ContextoMunicipal = createContext(null);
let almacenActivo = null;
const entregadasSinAlmacen = new Set();

export function ProveedorMunicipal({ usuario, children }) {
  const uid = usuario?.uid ?? null;
  // Un almacén por uid: al cambiar de cuenta se cierran todas las suscripciones.
  const almacen = useMemo(() => (uid ? crearAlmacen(usuario) : null), [uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!almacen) return undefined;
    almacen.iniciar();
    almacenActivo = almacen;
    return () => {
      almacen.detener();
      if (almacenActivo === almacen) almacenActivo = null;
    };
  }, [almacen]);

  useEffect(() => {
    if (almacen && usuario) almacen.cambiarUsuario(usuario);
  }, [almacen, usuario, usuario?.nombre, usuario?.email, usuario?.proveedor]);

  return createElement(ContextoMunicipal.Provider, { value: almacen }, children);
}

function igualesSuperficial(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && Object.is(a[k], b[k]));
}

const identidad = (s) => s;

// useMunicipal(selector): solo vuelve a dibujar cuando cambia lo seleccionado.
export function useMunicipal(selector = identidad) {
  const almacen = useContext(ContextoMunicipal);
  if (!almacen) {
    throw new Error('useMunicipal() se usó fuera de <ProveedorMunicipal>. Envolvé la pantalla con el proveedor en App.jsx.');
  }
  const memoria = useRef({ estado: undefined, selector: undefined, valor: undefined });
  const leer = () => {
    const actual = almacen.obtener();
    const m = memoria.current;
    if (m.estado === actual && m.selector === selector) return m.valor;
    const valor = selector(actual);
    const estable = m.estado !== undefined && igualesSuperficial(m.valor, valor) ? m.valor : valor;
    memoria.current = { estado: actual, selector, valor: estable };
    return estable;
  };
  return useSyncExternalStore(almacen.suscribir, leer, leer);
}

// ===================== Acciones (funciones del módulo, no del estado) =====================

export function cargarMas(coleccion) {
  almacenActivo?.cargarMas(coleccion);
}

export function activarCercania() {
  if (!almacenActivo) return Promise.resolve(false);
  return almacenActivo.activarCercania();
}

export function desactivarCercania() {
  if (!almacenActivo) return Promise.resolve();
  return almacenActivo.desactivarCercania();
}

export function descartarAlerta() {
  almacenActivo?.descartarAlerta();
}

// Devuelve true solo la primera vez que se registra una clave (claveEntrega del Anexo A).
export function registrarEntrega(clave) {
  if (almacenActivo) return almacenActivo.registrarEntrega(clave);
  if (!clave || entregadasSinAlmacen.has(clave)) return false;
  entregadasSinAlmacen.add(clave);
  return true;
}
