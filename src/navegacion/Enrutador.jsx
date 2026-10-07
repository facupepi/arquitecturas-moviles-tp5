// Enrutador (WP5, 7.3). Carga cada pantalla con React.lazy desde src/pantallas/<Archivo>.jsx
// (default export, prop `ruta`). `panel` exige esAdmin; si no, redirige a inicio. Una ruta
// desconocida va a inicio. Al cambiar de ruta: sube al inicio, registra screen_view y (en el
// proveedor de avisos) limpia el aviso flotante; el foco va al título (lo hace <Encabezado>).
import React, { Suspense, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { registrarEvento, EVENTOS } from '../firebase/analytics';
import { subirAlInicio } from '../plataforma/hash';
import { servicioPorRuta } from '../tema/servicios';
import Cargando from '../ui/Cargando';
import Pantalla from '../ui/Pantalla';
import Vacio from '../ui/Vacio';
import LimiteError from './LimiteError';
import { useRuta } from './ProveedorNavegacion';
import { cargarPantalla } from './pantallas';
import { ARCHIVO_POR_RUTA, EN_DESARROLLO, RUTA_GALERIA, esRutaConocida } from './rutasApp';

// Tiempo de gracia antes de sacar a un no admin de #/panel: esAdmin llega por su propia
// suscripción y puede tardar un poco más que `listo`.
export const ESPERA_ADMIN_MS = 1500;

function PantallaPendiente({ ruta }) {
  const servicio = servicioPorRuta(ruta.nombre);
  return (
    <Pantalla titulo={servicio?.nombre ?? 'Pantalla'} testID="pantalla-pendiente">
      <Vacio
        icono="info"
        titulo="Esta pantalla todavía no está disponible"
        mensaje="Estamos terminando esta sección. Probá con otro servicio desde el menú."
      />
    </Pantalla>
  );
}

function archivoDe(nombre) {
  if (EN_DESARROLLO && nombre === RUTA_GALERIA) return '_Galeria';
  return ARCHIVO_POR_RUTA[nombre];
}

/** Primer segmento del hash crudo ("#/reclamos/x?y" y "#reclamos" dan "reclamos"). */
function segmentoDe(hash) {
  return String(hash ?? '').replace(/^#\/?/, '').split(/[/?]/)[0];
}

export default function Enrutador() {
  const { ruta, hash, navegar } = useRuta();
  const esAdmin = useMunicipal((s) => s.esAdmin);
  const listo = useMunicipal((s) => s.listo);
  const [reintento, setReintento] = useState(0);

  // parsearHash puede devolver la ruta desconocida o ya 'inicio': se mira también el hash crudo
  // para dejar la URL en #/inicio en los dos casos.
  const segmento = segmentoDe(hash);
  const conocida = esRutaConocida(ruta.nombre) && (!segmento || esRutaConocida(segmento));
  const esperandoAdmin = ruta.nombre === 'panel' && !esAdmin;

  // Ruta desconocida → inicio (reemplaza la entrada para que "atrás" no vuelva a ella).
  useEffect(() => {
    if (!conocida) navegar('inicio', null, null, { reemplazar: true });
  }, [conocida, navegar]);

  // Panel sin admin → inicio, después de la gracia.
  useEffect(() => {
    if (!esperandoAdmin || !listo) return undefined;
    const t = setTimeout(() => navegar('inicio', null, null, { reemplazar: true }), ESPERA_ADMIN_MS);
    return () => clearTimeout(t);
  }, [esperandoAdmin, listo, navegar]);

  // Efectos de cada cambio de pantalla.
  useEffect(() => {
    if (!conocida) return;
    subirAlInicio();
    try {
      registrarEvento(EVENTOS?.PANTALLA ?? 'screen_view', { firebase_screen: ruta.nombre });
    } catch {
      // Analytics nunca rompe la navegación.
    }
  }, [ruta.nombre, conocida]);

  if (!conocida || esperandoAdmin) {
    return <Cargando pantallaCompleta mensaje={esperandoAdmin ? 'Verificando permisos…' : 'Cargando…'} />;
  }

  const Componente = cargarPantalla(archivoDe(ruta.nombre), reintento);
  return (
    <View style={estilos.contenedor}>
      <LimiteError clave={`${ruta.nombre}-${reintento}`} alReintentar={() => setReintento((n) => n + 1)}>
        <Suspense fallback={<Cargando pantallaCompleta />}>
          {Componente ? (
            <Componente key={`${ruta.nombre}-${reintento}`} ruta={ruta} />
          ) : (
            <PantallaPendiente key={ruta.nombre} ruta={ruta} />
          )}
        </Suspense>
      </LimiteError>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, minHeight: 0 },
});
