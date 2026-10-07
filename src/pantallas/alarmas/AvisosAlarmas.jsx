// "Tus avisos de alarmas" (S3, 8.6): zonas que sigue el vecino (A4), aviso por cercanía (A3) y
// avisos en este celular con la app cerrada (push). La cercanía la sostiene el almacén (4.5): esta
// pantalla solo la prende y la apaga, así sigue activa al cambiar de pantalla o al recargar.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { activarCercania, desactivarCercania, useMunicipal } from '../../datos/almacen';
import { guardarPreferencias } from '../../datos/repositorio';
import { activarPush } from '../../datos/sesion';
import { useComando } from '../../datos/useComando';
import { estadoPushLocal } from '../../firebase/mensajeria';
import { useConfigRemota } from '../../firebase/configRemota';
import { EVENTOS, registrarEvento } from '../../firebase/analytics';
import { colores, espacio } from '../../tema/tokens';
import { Aviso, Boton, Icono, Interruptor, Selector, Tarjeta, Texto } from '../../ui';
import { ETIQUETAS, ZONAS } from '../../../shared/constantes.mjs';
import { hora } from '../../../shared/formato.mjs';

const OPCIONES_ZONAS = ZONAS.map((z) => ({ valor: z, etiqueta: ETIQUETAS.zonas[z] ?? z }));

function evento(nombre, parametros) {
  try { registrarEvento(nombre, parametros); } catch { /* Analytics es opcional */ }
}

function leerPush() {
  try {
    return estadoPushLocal() ?? { soportado: false };
  } catch {
    return { soportado: false };
  }
}

function radioTexto(km) {
  if (!Number.isFinite(km)) return '1 km';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${String(km).replace('.', ',')} km`;
}

// ---------- Zonas (A4) ----------
function Zonas({ preferencias }) {
  const [pendientes, setPendientes] = useState(null);
  const [estado, setEstado] = useState(null); // null | 'guardando' | 'guardado'
  const deseado = useRef(null);
  const guardando = useRef(false);
  const exito = useRef(false);
  const ultimas = useRef(preferencias);
  ultimas.current = preferencias;

  const comando = useComando(guardarPreferencias, {
    evento: EVENTOS.ZONA_SUSCRIPTA,
    parametrosEvento: (_r, p) => ({ zonas: (p?.zonas ?? []).join(',') || 'ninguna' }),
    alExito: () => { exito.current = true; },
  });

  // Cada toque se guarda; si el vecino toca varias zonas seguidas, se envía la última elección.
  const cambiar = useCallback(async (zonas) => {
    deseado.current = zonas;
    setPendientes(zonas);
    setEstado('guardando');
    if (guardando.current) return;
    guardando.current = true;
    let todoBien = true;
    while (deseado.current) {
      const enviar = deseado.current;
      deseado.current = null;
      exito.current = false;
      await comando.ejecutar({ ...ultimas.current, zonas: enviar });
      todoBien = exito.current;
      if (!todoBien) deseado.current = null;
    }
    guardando.current = false;
    setPendientes(null);
    setEstado(todoBien ? 'guardado' : null);
  }, [comando]);

  const valor = pendientes ?? preferencias.zonas ?? [];
  return (
    <View style={estilos.bloque}>
      <Selector
        etiqueta="Zonas que seguís"
        valor={valor}
        opciones={OPCIONES_ZONAS}
        onCambio={cambiar}
        multiple
        error={comando.error ? comando.error.message : undefined}
        testID="zona"
      />
      <Texto variante="chico" color={colores.textoSuave}>
        Te avisamos cuando se activa una alarma en estas zonas. También filtran los avisos de la ciudad en Notificaciones.
      </Texto>
      <View role="status" aria-live="polite" style={estilos.estado}>
        {estado === 'guardando' ? (
          <Texto variante="chico" color={colores.textoSuave} testID="zonas-guardando">
            Guardando…
          </Texto>
        ) : estado === 'guardado' ? (
          <View style={estilos.fila}>
            <Icono nombre="checkCirculo" tamano={16} color={colores.exito} />
            <Texto variante="chico" color={colores.exito} peso="700" testID="zonas-guardadas">
              Listo, guardamos tus zonas.
            </Texto>
          </View>
        ) : null}
      </View>
      {!valor.length ? (
        <Aviso
          tono="alerta"
          titulo="No seguís ninguna zona"
          mensaje="No te vamos a avisar cuando se active una alarma (salvo las cercanas, si activás el aviso por cercanía). Elegí al menos una zona."
          testID="sin-zonas"
        />
      ) : null}
    </View>
  );
}

// ---------- Cercanía (A3) ----------
function Cercania({ alarmas }) {
  const cercania = useMunicipal((s) => s.cercania);
  const registro = useMunicipal((s) => s.perfil?.cercania ?? null);
  const { radioAlarmaKm, intervaloCercaniaMin } = useConfigRemota();
  const [cambiando, setCambiando] = useState(null);

  const alternar = useCallback(async (prender) => {
    setCambiando(prender);
    try {
      if (prender) {
        const quedo = await activarCercania();
        if (quedo) evento(EVENTOS.CERCANIA_ACTIVADA, { radio_km: radioAlarmaKm });
      } else {
        await desactivarCercania();
      }
    } finally {
      setCambiando(null);
    }
  }, [radioAlarmaKm]);

  const valor = cambiando ?? cercania.activa;
  const nombres = (registro?.alarmas ?? [])
    .map((id) => alarmas.find((a) => a.id === id)?.nombre ?? null)
    .filter(Boolean);
  const radio = radioTexto(radioAlarmaKm);

  return (
    <View style={estilos.bloque}>
      <Interruptor
        etiqueta="Avisarme si se activa una alarma cerca"
        descripcion={`Usamos tu ubicación mientras tengas la app abierta, en un radio de ${radio}.`}
        valor={!!valor}
        onCambio={alternar}
        deshabilitado={cambiando !== null}
        testID="interruptor-cercania"
      />
      {cercania.error ? (
        <Aviso
          tono="alerta"
          rol="alert"
          titulo="No pudimos usar tu ubicación"
          mensaje={cercania.error.message}
          testID="error-cercania"
        />
      ) : null}
      {cercania.activa && registro ? (
        <View style={estilos.cercanas} testID="cercania-activa">
          <Texto variante="chico" peso="700">
            {nombres.length
              ? `Cerca tuyo: ${nombres.join(', ')}.`
              : `No hay alarmas a menos de ${radio}. Si te acercás a una, te avisamos igual.`}
          </Texto>
          {Number.isFinite(registro.vence) ? (
            <Texto variante="chico" color={colores.textoSuave}>
              {`Activo hasta las ${hora(registro.vence)}. Se renueva solo mientras tengas la app abierta.`}
            </Texto>
          ) : null}
        </View>
      ) : null}
      <View style={estilos.fila}>
        <Icono nombre="info" tamano={16} color={colores.textoSuave} />
        <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible} testID="privacidad-cercania">
          {`Tu ubicación no se guarda. Solo registramos qué alarmas están cerca durante ${intervaloCercaniaMin || 30} minutos.`}
        </Texto>
      </View>
    </View>
  );
}

// ---------- Avisos en este celular (push) ----------
function AvisosCelular() {
  const [version, setVersion] = useState(0);
  const push = useMemo(leerPush, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const comando = useComando(activarPush, {
    evento: EVENTOS.PUSH_HABILITADO,
    parametrosEvento: () => ({ origen: 'alarmas' }),
    alExito: () => setVersion((v) => v + 1),
  });

  let contenido;
  if (push.activo) {
    contenido = (
      <View style={estilos.fila} testID="push-activo">
        <Icono nombre="checkCirculo" tamano={18} color={colores.exito} />
        <Texto variante="chico" color={colores.exito} peso="700" estilo={estilos.flexible}>
          Los avisos están activos en este celular, también con la app cerrada.
        </Texto>
      </View>
    );
  } else if (push.soportado && push.permiso === 'denied') {
    contenido = (
      <Texto variante="chico" color={colores.alerta} testID="push-bloqueado">
        Bloqueaste las notificaciones de esta página. Para recibirlas, habilitalas desde la configuración del navegador.
      </Texto>
    );
  } else if (push.soportado) {
    contenido = (
      <View style={estilos.bloqueChico}>
        <Texto variante="chico" color={colores.textoSuave}>
          Para enterarte aunque tengas la app cerrada, activá los avisos en este celular.
        </Texto>
        <Boton
          titulo="Activar avisos en este celular"
          icono="campana"
          variante="secundario"
          cargando={comando.ocupado}
          onPress={() => comando.ejecutar()}
          testID="activar-push"
        />
        {comando.error ? (
          <Texto variante="chico" color={colores.peligro} peso="600" role="alert" testID="error-push">
            {comando.error.message}
          </Texto>
        ) : null}
      </View>
    );
  } else {
    contenido = (
      <Texto variante="chico" color={colores.textoSuave} testID="push-no-disponible">
        {`${push.motivo ?? 'Este navegador no admite avisos con la app cerrada.'} Con la app abierta te avisamos igual.`}
      </Texto>
    );
  }
  return (
    <View style={estilos.bloqueChico}>
      <Texto variante="cuerpo" peso="700">
        Avisos con la app cerrada
      </Texto>
      {contenido}
    </View>
  );
}

// ---------- Sección completa ----------
export default function AvisosAlarmas({ alarmas, preferencias, onIrANotificaciones }) {
  const alarmasApagadas = !(preferencias.tipos ?? []).includes('alarmas');
  const noInmediata = preferencias.frecuencia && preferencias.frecuencia !== 'inmediata';
  return (
    <Tarjeta testID="avisos-alarmas">
      {alarmasApagadas || noInmediata ? (
        <Aviso
          tono="aviso"
          titulo={alarmasApagadas ? 'Tenés apagados los avisos de alarmas' : 'Recibís los avisos en un resumen'}
          mensaje={alarmasApagadas
            ? 'Vas a ver el estado en esta pantalla, pero no te vamos a avisar cuando se active una. Podés cambiarlo en Notificaciones.'
            : `Elegiste "${ETIQUETAS.frecuencias[preferencias.frecuencia] ?? preferencias.frecuencia}". Para enterarte en el momento, cambiá la frecuencia a Inmediata en Notificaciones.`}
          accion={{ titulo: 'Ir a Notificaciones', onPress: onIrANotificaciones, testID: 'ir-notificaciones' }}
          testID="aviso-preferencias"
        />
      ) : null}
      <Zonas preferencias={preferencias} />
      <View style={estilos.separador} />
      <Cercania alarmas={alarmas} />
      <View style={estilos.separador} />
      <AvisosCelular />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.s },
  bloqueChico: { gap: espacio.s },
  estado: { minHeight: 0 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1, minWidth: 0 },
  cercanas: {
    gap: 2,
    padding: espacio.m,
    borderRadius: 12,
    backgroundColor: colores.infoFondo,
  },
  separador: { height: 1, backgroundColor: colores.borde, marginVertical: espacio.xs },
});
