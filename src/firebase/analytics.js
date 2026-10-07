// Analytics diferido (WP4, sección 5.5).
//
// registrarEvento() se puede llamar desde el primer momento: encola hasta que el SDK carga con
// iniciarAnalytics() (lo llama diferidos.js). No se inicializa con emuladores ni sin measurementId,
// y si el navegador no lo admite (bloqueadores, navegación privada) queda inactivo sin error.
// Ningún parámetro lleva datos personales: ni nombre, ni patente, ni dirección.
import { app } from './app.js';
import { USAR_EMULADORES, DESARROLLO, firebaseConfig } from './config.js';

export const EVENTOS = Object.freeze({
  LOGIN: 'login',
  VINCULAR: 'vincular_cuenta',
  PANTALLA: 'screen_view',
  RECLAMO_CREADO: 'reclamo_creado',
  TRIBUTO_PAGADO: 'tributo_pagado',
  CEDULON_EMITIDO: 'cedulon_emitido',
  ESTACIONAMIENTO_INICIADO: 'estacionamiento_iniciado',
  ESTACIONAMIENTO_EXTENDIDO: 'estacionamiento_extendido',
  ESTACIONAMIENTO_FINALIZADO: 'estacionamiento_finalizado',
  ESTACIONES_CERCANAS: 'estaciones_cercanas',
  PROBLEMA_BICI: 'problema_bici_reportado',
  ZONA_SUSCRIPTA: 'zona_suscripta',
  CERCANIA_ACTIVADA: 'cercania_activada',
  PUSH_HABILITADO: 'push_habilitado',
  PREFERENCIAS_GUARDADAS: 'preferencias_guardadas',
  CONTACTO_USADO: 'contacto_usado',
  AVISO_ABIERTO: 'aviso_abierto',
  PWA_INSTALADA: 'pwa_instalada',
  PANEL_ACCION: 'panel_accion',
  ERROR_OPERACION: 'error_operacion',
});

const MAXIMO_EN_COLA = 100;
let cola = [];
let estado = 'pendiente'; // 'pendiente' | 'cargando' | 'activo' | 'inactivo'
let sdk = null;
let analytics = null;
let inicio = null;

// Solo valores simples y cortos (límite de Analytics: 100 caracteres por valor).
function limpiar(parametros) {
  const salida = {};
  for (const [clave, valor] of Object.entries(parametros || {})) {
    if (typeof valor === 'string') salida[clave] = valor.slice(0, 100);
    else if (typeof valor === 'number' && Number.isFinite(valor)) salida[clave] = valor;
    else if (typeof valor === 'boolean') salida[clave] = valor ? 'si' : 'no';
  }
  // En desarrollo los eventos aparecen en DebugView de la consola.
  if (DESARROLLO) salida.debug_mode = true;
  return salida;
}

function enviar(nombre, parametros) {
  try {
    sdk.logEvent(analytics, nombre, parametros);
  } catch (e) {
    console.warn('[Analytics] No se pudo registrar el evento:', nombre, e);
  }
}

/** Registra un evento de EVENTOS. Nunca lanza. */
export function registrarEvento(nombre, parametros = {}) {
  if (!nombre || estado === 'inactivo') return;
  const limpios = limpiar(parametros);
  if (estado === 'activo') { enviar(nombre, limpios); return; }
  if (cola.length < MAXIMO_EN_COLA) cola.push([nombre, limpios]);
}

/** Carga el SDK (import dinámico, fuera del paquete inicial) y vacía la cola. Idempotente. */
export function iniciarAnalytics() {
  if (inicio) return inicio;
  inicio = (async () => {
    if (USAR_EMULADORES || !firebaseConfig.measurementId) {
      estado = 'inactivo';
      cola = [];
      return false;
    }
    estado = 'cargando';
    try {
      sdk = await import('firebase/analytics');
      if (!(await sdk.isSupported())) throw new Error('Analytics no es compatible con este navegador');
      analytics = sdk.getAnalytics(app);
      estado = 'activo';
      const pendientes = cola;
      cola = [];
      for (const [nombre, parametros] of pendientes) enviar(nombre, parametros);
      return true;
    } catch (e) {
      console.info('[Analytics] Inactivo:', e?.message || e);
      estado = 'inactivo';
      cola = [];
      return false;
    }
  })();
  return inicio;
}
