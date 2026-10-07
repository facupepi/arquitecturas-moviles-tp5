// Marco de la app con sesión (WP5, 7.4). Reemplaza heredado:src/MunicipalApp.jsx (disposición).
// - Encabezado arriba y, debajo, la leyenda de prototipo (siempre visible).
// - Ancho ≥ 900: MenuLateral fijo a la izquierda. Menos de 900: BarraInferior y menú en un Modal.
// - Monta ProveedorAvisos, BannerEmergencia, IndicadorConexion y ActualizacionDisponible.
// - Muestra `alerta` del almacén como aviso flotante con "Ver" (navega a su destino) y la descarta.
// - Le pasa el pie institucional a cada <Pantalla> por ContextoMarco.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { descartarAlerta, useMunicipal } from '../datos/almacen';
import { useRuta } from '../navegacion/ProveedorNavegacion';
import { colores, cortes, espacio } from '../tema/tokens';
import { ProveedorAvisos, useAvisoFlotante } from '../ui/AvisoFlotante';
import { ContextoMarco } from '../ui/contextoMarco';
import ActualizacionDisponible from './ActualizacionDisponible';
import BannerEmergencia from './BannerEmergencia';
import BarraInferior, { ALTO_BARRA } from './BarraInferior';
import EncabezadoInstitucional from './EncabezadoInstitucional';
import IndicadorConexion from './IndicadorConexion';
import LeyendaPrototipo, { ContextoLeyenda } from './LeyendaPrototipo';
import { MenuLateralFijo, MenuMovil } from './MenuLateral';
import PieInstitucional from './PieInstitucional';

function AlertaEnVivo() {
  const alerta = useMunicipal((s) => s.alerta);
  const aviso = useAvisoFlotante();
  useEffect(() => {
    if (!alerta) return;
    aviso.mostrar(
      { titulo: alerta.titulo, cuerpo: alerta.cuerpo },
      alerta.tono === 'alerta' ? 'alerta' : 'info',
      alerta.destino ?? null,
    );
    descartarAlerta();
  }, [alerta, aviso]);
  return null;
}

function MarcoInterno({ escritorio, children }) {
  const { ruta } = useRuta();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const valorMarco = useMemo(() => ({ pie: <PieInstitucional /> }), []);

  // El menú móvil se cierra al navegar y al pasar a escritorio.
  useEffect(() => setMenuAbierto(false), [ruta.nombre, escritorio]);

  return (
    <View style={estilos.raiz}>
      <AlertaEnVivo />
      <EncabezadoInstitucional />
      <LeyendaPrototipo />
      <IndicadorConexion />
      <BannerEmergencia />
      <ActualizacionDisponible />
      <View style={estilos.cuerpo}>
        {escritorio ? <MenuLateralFijo /> : null}
        <ContextoLeyenda.Provider value>
          <ContextoMarco.Provider value={valorMarco}>
            <View style={estilos.contenido}>{children}</View>
          </ContextoMarco.Provider>
        </ContextoLeyenda.Provider>
      </View>
      {escritorio ? null : <BarraInferior onMenu={() => setMenuAbierto(true)} menuAbierto={menuAbierto} />}
      {escritorio ? null : <MenuMovil visible={menuAbierto} onCerrar={() => setMenuAbierto(false)} />}
    </View>
  );
}

export default function Marco({ children }) {
  const { width } = useWindowDimensions();
  const escritorio = width >= cortes.escritorio;
  return (
    <ProveedorAvisos margenInferior={escritorio ? espacio.xl : ALTO_BARRA + espacio.xl}>
      <MarcoInterno escritorio={escritorio}>{children}</MarcoInterno>
    </ProveedorAvisos>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, minHeight: 0, backgroundColor: colores.fondo },
  cuerpo: { flex: 1, minHeight: 0, flexDirection: 'row' },
  contenido: { flex: 1, minWidth: 0, minHeight: 0 },
});
