// Avisos en este dispositivo (S1, dentro de Cuenta). El interruptor refleja estadoPushLocal()
// (permiso del navegador y token guardado en ESTE navegador, 5.8), no preferencias.push.
// Qué avisos recibir (tipos, zonas, frecuencia) se elige en Notificaciones (S7).
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { activarPush, desactivarPush } from '../../datos/sesion';
import { useComando } from '../../datos/useComando';
import { EVENTOS } from '../../firebase/analytics';
import { estadoPushLocal } from '../../firebase/mensajeria';
import { colores, espacio } from '../../tema/tokens';
import { Aviso, Boton, Interruptor, Texto, useAvisoFlotante } from '../../ui';

function leerEstado() {
  try {
    return estadoPushLocal() ?? { soportado: false, permiso: 'no-soportado', activo: false, motivo: null };
  } catch {
    return { soportado: false, permiso: 'no-soportado', activo: false, motivo: null };
  }
}

function explicacion(estado) {
  if (!estado.soportado) return estado.motivo || 'Este navegador no admite avisos en segundo plano.';
  if (estado.permiso === 'denied') {
    return 'Bloqueaste las notificaciones para este sitio. Para recibirlas, habilitalas en la configuración del navegador.';
  }
  if (estado.activo) return null;
  return 'Activalos para enterarte de alarmas, vencimientos y respuestas a tus reclamos aunque tengas la app cerrada.';
}

export default function Avisos({ onElegir }) {
  const aviso = useAvisoFlotante();
  const [estado, setEstado] = useState(leerEstado);
  const refrescar = useCallback(() => setEstado(leerEstado()), []);

  const activar = useComando(activarPush, {
    evento: EVENTOS.PUSH_HABILITADO,
    alExito: () => {
      refrescar();
      aviso.mostrar('Activaste los avisos en este dispositivo.');
    },
  });
  const desactivar = useComando(desactivarPush, {
    alExito: () => {
      refrescar();
      aviso.mostrar('Dejaste de recibir avisos en este dispositivo.', 'info');
    },
  });

  const ocupado = activar.ocupado || desactivar.ocupado;
  const error = activar.error || desactivar.error;

  const cambiar = async (valor) => {
    activar.limpiar();
    desactivar.limpiar();
    if (valor) await activar.ejecutar();
    else await desactivar.ejecutar();
    refrescar();
  };

  return (
    <View style={estilos.bloque} testID="cuenta-avisos">
      <Interruptor
        etiqueta="Avisos en este dispositivo"
        descripcion={explicacion(estado)}
        valor={estado.activo}
        onCambio={cambiar}
        deshabilitado={ocupado || !estado.soportado || estado.permiso === 'denied'}
        testID="cuenta-interruptor-push"
      />
      {ocupado ? (
        <Texto variante="chico" color={colores.textoSuave} role="status">
          {activar.ocupado ? 'Pidiendo permiso al navegador…' : 'Desactivando los avisos…'}
        </Texto>
      ) : null}
      {error ? <Aviso tono="peligro" rol="alert" mensaje={error.message} testID="cuenta-error-push" /> : null}
      <Boton
        titulo="Elegir qué avisos recibir"
        icono="ajustes"
        variante="secundario"
        onPress={onElegir}
        testID="cuenta-preferencias-avisos"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.m },
});
