// "Avisos en este dispositivo" (S7, N1 y 5.8). El valor del interruptor sale de estadoPushLocal()
// (permiso del navegador y token guardado en ESTE navegador), no de preferencias.push, que vale para
// la cuenta. Explica el permiso y por qué no se puede cuando el navegador no lo admite.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Aviso, EtiquetaEstado, Interruptor, Texto, useAvisoFlotante } from '../../ui';
import { colores, espacio } from '../../tema/tokens';
import { useComando } from '../../datos/useComando';
import * as sesion from '../../datos/sesion';
import { estadoPushLocal, soportaPush } from '../../firebase/mensajeria';
import { EVENTOS } from '../../firebase/analytics';

const PERMISOS = {
  granted: { texto: 'Permiso concedido', tono: 'exito', icono: 'check' },
  denied: { texto: 'Permiso bloqueado', tono: 'peligro', icono: 'alerta' },
  default: { texto: 'Permiso sin pedir', tono: 'neutro' },
  'no-soportado': { texto: 'No disponible en este navegador', tono: 'neutro' },
};

function leerEstado() {
  try {
    return estadoPushLocal() ?? { soportado: false, permiso: 'no-soportado', activo: false };
  } catch {
    return { soportado: false, permiso: 'no-soportado', activo: false };
  }
}

export default function AvisosDispositivo() {
  const aviso = useAvisoFlotante();
  const [estado, setEstado] = useState(leerEstado);
  const [soporte, setSoporte] = useState(null);   // null mientras se comprueba
  const refrescar = useCallback(() => setEstado(leerEstado()), []);

  useEffect(() => {
    let vigente = true;
    Promise.resolve()
      .then(() => soportaPush())
      .then((si) => { if (vigente) setSoporte(Boolean(si)); }, () => { if (vigente) setSoporte(false); });
    return () => { vigente = false; };
  }, []);

  const activar = useComando(sesion.activarPush, {
    evento: EVENTOS.PUSH_HABILITADO,
    alExito: () => { refrescar(); aviso.mostrar('Activaste los avisos en este dispositivo.'); },
  });
  const desactivar = useComando(sesion.desactivarPush, {
    alExito: () => { refrescar(); aviso.mostrar('Ya no vas a recibir avisos en este dispositivo.', 'info'); },
  });
  const ocupado = activar.ocupado || desactivar.ocupado;
  const error = activar.error || desactivar.error;

  const alCambiar = async (valor) => {
    activar.limpiar();
    desactivar.limpiar();
    await (valor ? activar.ejecutar() : desactivar.ejecutar());
    refrescar();   // el permiso pudo cambiar aunque falle (por ejemplo, si lo bloqueó)
  };

  const sinSoporte = soporte === false || !estado.soportado;
  const bloqueado = estado.permiso === 'denied' && !estado.activo;
  let descripcion = 'Te avisamos aunque tengas la app cerrada.';
  if (soporte === null && estado.soportado) descripcion = 'Comprobando si este navegador admite avisos…';
  else if (sinSoporte) descripcion = null;
  else if (bloqueado) descripcion = 'Bloqueaste las notificaciones para este sitio. Habilitalas desde la configuración del navegador y volvé a intentar.';
  else if (estado.activo) descripcion = 'Activados en este dispositivo.';

  const permiso = PERMISOS[sinSoporte ? 'no-soportado' : estado.permiso] ?? PERMISOS.default;

  return (
    <View style={estilos.contenedor}>
      <Interruptor
        etiqueta="Avisos en este dispositivo"
        descripcion={descripcion}
        valor={estado.activo}
        onCambio={alCambiar}
        deshabilitado={ocupado || sinSoporte || soporte === null || bloqueado}
        testID="interruptor-push"
      />
      <View style={[estilos.estado, sinSoporte && estilos.oculto]}>
        <EtiquetaEstado texto={permiso.texto} tono={permiso.tono} icono={permiso.icono} testID="estado-permiso-push" />
        {ocupado ? (
          <Texto variante="chico" color={colores.textoSuave} role="status">
            {activar.ocupado ? 'Activando…' : 'Desactivando…'}
          </Texto>
        ) : null}
      </View>
      {sinSoporte ? (
        <Aviso
          tono="info"
          titulo="No disponible en este navegador"
          mensaje={estado.motivo || 'Este navegador no admite avisos con la app cerrada. Podés consultar el historial cuando quieras.'}
          testID="push-no-disponible"
        />
      ) : null}
      {error ? (
        <Texto role="alert" variante="chico" color={colores.peligro} peso="600" testID="error-push">
          {error.message}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.s },
  oculto: { display: 'none' },
  estado: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacio.s, paddingLeft: espacio.xs },
});
