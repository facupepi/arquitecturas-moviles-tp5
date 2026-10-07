// Panel municipal de demostración (S8, sección 8.11). Solo para administradores: el Enrutador
// redirige a inicio si esAdmin es falso. Simula los sistemas de la Municipalidad: avanza reclamos,
// activa alarmas, mueve bicicletas, publica avisos y dispara el simulador y los recordatorios.
// Todo se escribe en Firestore, así que el celular del vecino cambia solo, sin recargar.
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAdmin } from '../datos/useAdmin';
import { espacio } from '../tema/tokens';
import { Cargando, Pantalla, Pestanas } from '../ui';
import PestanaReclamos from './panel/PestanaReclamos';
import PestanaAlarmas from './panel/PestanaAlarmas';
import PestanaBicicletas from './panel/PestanaBicicletas';
import PestanaAvisos from './panel/PestanaAvisos';
import PestanaDemo from './panel/PestanaDemo';

const PESTANAS = ['reclamos', 'alarmas', 'bicicletas', 'avisos', 'demo'];
const ETIQUETAS_PESTANA = {
  reclamos: 'Reclamos', alarmas: 'Alarmas', bicicletas: 'Bicicletas', avisos: 'Avisos', demo: 'Demo',
};

// useAdmin abre sus escuchas al montarse: para "Reintentar" se vuelve a montar este componente.
function ContenidoPanel({ pestana, onPestana, onReintentar }) {
  const admin = useAdmin();
  const alarmas = useMunicipal((s) => s.alarmas);

  const sinResolver = useMemo(() => admin.reclamos.filter((r) => r.estado !== 'resuelto').length, [admin.reclamos]);
  const activas = useMemo(() => alarmas.filter((a) => a.activa).length, [alarmas]);
  const eventosPorId = useMemo(() => new Map(admin.eventos.map((e) => [e.id, e])), [admin.eventos]);

  const opciones = PESTANAS.map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_PESTANA[valor],
    contador: valor === 'reclamos' && !admin.cargando ? sinResolver : valor === 'alarmas' && activas > 0 ? activas : undefined,
  }));

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
  // #/panel/alarmas abre directo esa pestaña.
  const [pestana, setPestana] = useState(() => (PESTANAS.includes(ruta?.id) ? ruta.id : 'reclamos'));
  const [intento, setIntento] = useState(0);

  return (
    <Pantalla
      titulo="Panel municipal de demostración"
      antetitulo="ADMINISTRACIÓN MUNICIPAL"
      bajada="Simula los sistemas municipales: cada cambio se ve al instante en el celular de los vecinos."
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
