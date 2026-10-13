// Panel municipal (S8, sección 8.11). Solo para administradores: el Enrutador
// redirige a inicio si esAdmin es falso. Controla todo lo que hacen los vecinos: avanza reclamos,
// sigue los pagos de cedulones y estacionamiento, finaliza sesiones de estacionamiento, activa
// alarmas, mueve bicicletas, publica avisos y dispara el simulador y los recordatorios.
// Todo se escribe y se escucha en Firestore, así que el celular del vecino cambia solo, sin recargar.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAdmin, useControlAdmin } from '../datos/useAdmin';
import { useAhora } from '../datos/useAhora';
import { espacio } from '../tema/tokens';
import { Cargando, Pantalla, Pestanas } from '../ui';
import PestanaReclamos from './panel/PestanaReclamos';
import PestanaPagos from './panel/PestanaPagos';
import PestanaEstacionamiento from './panel/PestanaEstacionamiento';
import PestanaAlarmas from './panel/PestanaAlarmas';
import PestanaBicicletas from './panel/PestanaBicicletas';
import PestanaAvisos from './panel/PestanaAvisos';
import PestanaDemo from './panel/PestanaDemo';

const PESTANAS = ['reclamos', 'pagos', 'estacionamiento', 'alarmas', 'bicicletas', 'avisos', 'demo'];
const ETIQUETAS_PESTANA = {
  reclamos: 'Reclamos', pagos: 'Pagos', estacionamiento: 'Estacionamiento', alarmas: 'Alarmas',
  bicicletas: 'Bicicletas', avisos: 'Avisos', demo: 'Simulación',
};

// useAdmin abre sus escuchas al montarse: para "Reintentar" se vuelve a montar este componente.
function ContenidoPanel({ pestana, onPestana, onReintentar }) {
  const admin = useAdmin();
  // Pagos y cedulones vencidos se escuchan solo con la pestaña Pagos abierta; las sesiones, siempre
  // (son pocas y dan el contador de la pestaña Estacionamiento).
  const control = useControlAdmin({ pagos: pestana === 'pagos', vencidos: pestana === 'pagos' });
  const alarmas = useMunicipal((s) => s.alarmas);
  const ahora = useAhora(15_000);

  const sinResolver = useMemo(() => admin.reclamos.filter((r) => r.estado !== 'resuelto').length, [admin.reclamos]);
  const activas = useMemo(() => alarmas.filter((a) => a.activa).length, [alarmas]);
  const eventosPorId = useMemo(() => new Map(admin.eventos.map((e) => [e.id, e])), [admin.eventos]);
  // Las sesiones que vencen o se finalizan siguen en la escucha: se filtran con la hora actual. Una
  // sesión finalizada tiene fin igual a actualizadoEn (la misma hora del servidor) y sale enseguida.
  const sesionesActivas = useMemo(
    () => control.sesiones.filter((s) => s.fin > ahora && s.fin > (s.actualizadoEn ?? 0)),
    [control.sesiones, ahora],
  );

  const contadores = {
    reclamos: !admin.cargando ? sinResolver : undefined,
    estacionamiento: sesionesActivas.length > 0 ? sesionesActivas.length : undefined,
    alarmas: activas > 0 ? activas : undefined,
  };
  const opciones = PESTANAS.map((valor) => ({ valor, etiqueta: ETIQUETAS_PESTANA[valor], contador: contadores[valor] }));

  const comunes = { eventosPorId, onReintentar };
  return (
    <>
      <Pestanas
        opciones={opciones}
        valor={pestana}
        onCambio={onPestana}
        testID="panel-pestana"
        etiqueta="Secciones del panel"
      />
      <View role="tabpanel" aria-label={ETIQUETAS_PESTANA[pestana]} style={estilos.panel}>
        {pestana === 'reclamos' ? (
          <PestanaReclamos reclamos={admin.reclamos} cargando={admin.cargando} error={admin.error} {...comunes} />
        ) : null}
        {pestana === 'pagos' ? <PestanaPagos control={control} onReintentar={onReintentar} /> : null}
        {pestana === 'estacionamiento' ? (
          <PestanaEstacionamiento control={control} activas={sesionesActivas} onReintentar={onReintentar} />
        ) : null}
        {pestana === 'alarmas' ? <PestanaAlarmas {...comunes} /> : null}
        {pestana === 'bicicletas' ? <PestanaBicicletas /> : null}
        {pestana === 'avisos' ? <PestanaAvisos {...comunes} /> : null}
        {pestana === 'demo' ? (
          <PestanaDemo
            eventos={admin.eventos}
            reclamos={admin.reclamos}
            cargando={admin.cargando}
            error={admin.error}
            onReintentar={onReintentar}
          />
        ) : null}
      </View>
    </>
  );
}

export default function PanelMunicipal({ ruta }) {
  const listo = useMunicipal((s) => s.listo);
  // #/panel/alarmas abre directo esa pestaña; #/panel/simulacion es otro nombre de #/panel/demo.
  const [pestana, setPestana] = useState(() => {
    const id = ruta?.id === 'simulacion' ? 'demo' : ruta?.id;
    return PESTANAS.includes(id) ? id : 'reclamos';
  });
  const [intento, setIntento] = useState(0);

  return (
    <Pantalla
      titulo="Panel municipal"
      antetitulo="ADMINISTRACIÓN MUNICIPAL"
      bajada="Reclamos, pagos, estacionamiento y servicios de la ciudad, en tiempo real."
      testID="pantalla-panel"
    >
      {listo ? (
        <ContenidoPanel
          key={intento}
          pestana={pestana}
          onPestana={setPestana}
          onReintentar={() => setIntento((n) => n + 1)}
        />
      ) : (
        <Cargando lineas={5} mensaje="Cargando el panel…" />
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  panel: { gap: espacio.l },
});
