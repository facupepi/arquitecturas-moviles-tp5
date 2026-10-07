// Pestaña Alarmas del panel (S8, A2): un interruptor por alarma comunitaria. Es la única forma de
// activar una alarma en la demo (el simulador no las toca). Activar escribe la alarma y un evento
// en el mismo lote y después pide el envío de notificaciones; desactivar solo cambia la alarma.
import React, { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import { cambiarAlarma } from '../../datos/repositorio';
import { useComando } from '../../datos/useComando';
import { useAhora } from '../../datos/useAhora';
import { colores, espacio } from '../../tema/tokens';
import {
  Aviso, Cargando, ErrorCarga, EtiquetaEstado, Interruptor, Tarjeta, Texto, Vacio, useAvisoFlotante,
} from '../../ui';
import { nuevoIdSolicitud } from '../../../shared/dominio.mjs';
import { ETIQUETAS } from '../../../shared/constantes.mjs';
import { tiempoPasado } from '../../../shared/formato.mjs';
import { EstadoEnvio, Grilla, accionPanel, estilosPanel, plural, useVacioConfirmado } from './comun';

function AlarmaPanel({ alarma, evento, ahora }) {
  const aviso = useAvisoFlotante();
  const zona = ETIQUETAS.zonas[alarma.zona] ?? alarma.zona;
  const mensaje = useRef('');
  const cambio = useComando(cambiarAlarma, {
    ...accionPanel((_, datos) => ({ accion: datos?.activa ? 'activar_alarma' : 'desactivar_alarma' })),
    alExito: () => aviso.mostrar(mensaje.current, 'exito'),
  });

  const alternar = (activa) => {
    mensaje.current = activa
      ? `${alarma.nombre} activada. Avisamos a los vecinos de la zona ${zona} y a los que están cerca.`
      : `${alarma.nombre} desactivada.`;
    cambio.ejecutar({ alarmaId: alarma.id, activa }, activa ? nuevoIdSolicitud() : undefined);
  };

  return (
    <Tarjeta tono={alarma.activa ? 'peligro' : 'normal'} testID={`alarma-panel-tarjeta-${alarma.id}`} estilo={estilosPanel.celda}>
      <Interruptor
        etiqueta={alarma.nombre}
        descripcion={`${alarma.referencia ?? ''} · Zona ${zona}`.replace(/^ · /, '')}
        valor={alarma.activa}
        onCambio={alternar}
        deshabilitado={cambio.ocupado}
        testID={`alarma-panel-${alarma.id}`}
      />
      <View style={estilosPanel.fila}>
        <EtiquetaEstado
          texto={alarma.activa ? 'Activada' : 'Desactivada'}
          tono={alarma.activa ? 'peligro' : 'neutro'}
          icono={alarma.activa ? 'alarma' : undefined}
          testID={`estado-alarma-panel-${alarma.id}`}
        />
        <Texto variante="chico" color={colores.textoSuave}>
          {cambio.ocupado
            ? 'Guardando…'
            : alarma.activa && alarma.activadaEn
              ? `Activada ${tiempoPasado(alarma.activadaEn, ahora)}`
              : alarma.actualizadoEn
                ? `Actualizada ${tiempoPasado(alarma.actualizadoEn, ahora)}`
                : ''}
        </Texto>
      </View>
      {alarma.activa && alarma.activacionId ? (
        <EstadoEnvio evento={evento} testID={`envio-alarma-${alarma.id}`} />
      ) : null}
      {cambio.error ? (
        <Aviso tono="peligro" rol="alert" mensaje={cambio.error.message} testID={`error-alarma-${alarma.id}`} />
      ) : null}
    </Tarjeta>
  );
}

export default function PestanaAlarmas({ eventosPorId }) {
  const alarmas = useMunicipal((s) => s.alarmas);
  const error = useMunicipal((s) => s.errores.alarmas);
  const ahora = useAhora(30_000);
  const vacio = useVacioConfirmado(!alarmas.length && !error);
  const activas = useMemo(() => alarmas.filter((a) => a.activa).length, [alarmas]);

  if (error && !alarmas.length) return <ErrorCarga error={error} testID="error-alarmas-panel" />;
  if (!alarmas.length && !vacio) return <Cargando lineas={4} mensaje="Cargando las alarmas…" />;

  return (
    <View style={estilos.contenedor}>
      <Texto variante="chico" color={colores.textoSuave} estilo={estilosPanel.ayuda}>
        Al activar una alarma, les avisamos a los vecinos que siguen esa zona y a los que están cerca.
        En sus celulares el mapa y la etiqueta cambian solos.
      </Texto>
      {error ? <ErrorCarga error={error} testID="error-alarmas-panel" /> : null}
      {!alarmas.length ? (
        <Vacio
          icono="alarma"
          titulo="No hay alarmas cargadas"
          mensaje="Las alarmas comunitarias se cargan con el catálogo de la ciudad."
          testID="vacio-alarmas-panel"
        />
      ) : (
        <>
          <Aviso
            tono={activas ? 'peligro' : 'exito'}
            icono={activas ? 'alarma' : 'checkCirculo'}
            mensaje={activas ? `${plural(activas, 'alarma activada', 'alarmas activadas')} en este momento.` : 'Todas las alarmas están desactivadas.'}
            testID="resumen-alarmas-panel"
          />
          <Grilla>
            {alarmas.map((a) => (
              <AlarmaPanel
                key={a.id}
                alarma={a}
                evento={a.activacionId ? eventosPorId.get(a.activacionId) : null}
                ahora={ahora}
              />
            ))}
          </Grilla>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
});
