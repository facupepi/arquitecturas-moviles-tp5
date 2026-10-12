// Centro de reclamos (S5, sección 8.8). Cubre R1 (formulario validado), R2 (adjuntos en Supabase
// Storage), R3 (seguimiento en vivo) y R4 (búsqueda y "Cargar más").
//   #/reclamos                    formulario y "Mis reclamos"
//   #/reclamos/nuevo?estacion=b2  formulario con categoría Bicicletas y la estación precargada (B4)
//   #/reclamos/<id>               detalle con la línea de tiempo
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton, Cargando, ErrorCarga, Pantalla, Seccion, Vacio, useAnchoDisponible } from '../ui';
import { espacio } from '../tema/tokens';
import { useRuta } from '../navegacion';
import { cargarMas, useMunicipal } from '../datos/almacen';
import FormularioReclamo from './reclamos/FormularioReclamo';
import ListaReclamos from './reclamos/ListaReclamos';
import DetalleReclamo from './reclamos/DetalleReclamo';
import { ubicacionDeEstacion } from './reclamos/util';

// Desde este ancho de contenido, el formulario y la lista van en dos columnas.
const ANCHO_DOS_COLUMNAS = 900;

const TITULO = 'Centro de reclamos';
const BAJADA = 'Contanos qué pasa en tu barrio y seguí cada reclamo hasta que se resuelva.';

const seleccionar = (s) => ({
  listo: s.listo,
  altaTerminada: s.altaTerminada,
  reclamos: s.reclamos,
  hayMas: s.hayMas.reclamos,
  error: s.errores.reclamos ?? null,
  estaciones: s.estaciones,
  uid: s.usuario?.uid ?? null,
});

function useCargarMas(cantidad) {
  const [esperando, setEsperando] = useState(null);
  // "Cargar más" termina cuando llega la página nueva (o a los 8 s, si no hay nada más).
  useEffect(() => {
    if (esperando === null) return undefined;
    if (cantidad > esperando) {
      setEsperando(null);
      return undefined;
    }
    const t = setTimeout(() => setEsperando(null), 8000);
    return () => clearTimeout(t);
  }, [cantidad, esperando]);
  return {
    cargando: esperando !== null,
    cargar: () => {
      setEsperando(cantidad);
      cargarMas('reclamos');
    },
  };
}

function VolverAMisReclamos({ navegar }) {
  return (
    <Boton
      titulo="Mis reclamos"
      icono="chevronIzquierda"
      variante="texto"
      onPress={() => navegar('reclamos')}
      etiquetaAccesible="Volver a mis reclamos"
      testID="volver-reclamos"
    />
  );
}

export default function Reclamos({ ruta }) {
  const { navegar } = useRuta();
  const { listo, altaTerminada, reclamos, hayMas, error, estaciones, uid } = useMunicipal(seleccionar);
  const masReclamos = useCargarMas(reclamos.length);
  const [ancho, alMedir] = useAnchoDisponible();
  const dosColumnas = ancho >= ANCHO_DOS_COLUMNAS;

  const id = ruta?.id ?? null;
  const enDetalle = id !== null && id !== 'nuevo';
  const estacionId = ruta?.params?.estacion ?? null;

  const precarga = useMemo(() => {
    if (enDetalle || !estacionId) return null;
    const estacion = estaciones.find((e) => e.id === estacionId);
    if (!estacion) return null;
    return {
      estacionId: estacion.id,
      nombre: estacion.nombre,
      referencia: estacion.referencia ?? null,
      direccion: ubicacionDeEstacion(estacion),
    };
  }, [enDetalle, estacionId, estaciones]);

  if (enDetalle) {
    const reclamo = reclamos.find((r) => r.id === id);
    if (!listo || (!reclamo && !altaTerminada && !reclamos.length)) {
      return (
        <Pantalla key="detalle" titulo="Detalle del reclamo" testID="pantalla-reclamos" accion={<VolverAMisReclamos navegar={navegar} />}>
          <Cargando lineas={5} mensaje="Buscando tu reclamo…" />
        </Pantalla>
      );
    }
    if (!reclamo) {
      return (
        <Pantalla key="detalle" titulo="Detalle del reclamo" testID="pantalla-reclamos" accion={<VolverAMisReclamos navegar={navegar} />}>
          {error ? <ErrorCarga error={error} onReintentar={() => cargarMas('reclamos')} /> : null}
          <Vacio
            icono="buscar"
            titulo="No encontramos ese reclamo"
            mensaje={hayMas
              ? 'Puede ser uno de tus reclamos más viejos. Cargá los anteriores para buscarlo.'
              : 'Revisá el enlace o buscalo en tu lista de reclamos.'}
            accion={hayMas
              ? { titulo: 'Cargar reclamos anteriores', onPress: masReclamos.cargar, testID: 'buscar-anteriores' }
              : { titulo: 'Ir a mis reclamos', onPress: () => navegar('reclamos'), testID: 'ir-mis-reclamos' }}
            testID="reclamo-no-encontrado"
          />
        </Pantalla>
      );
    }
    return (
      <Pantalla
        key="detalle"
        titulo={`Reclamo ${reclamo.codigo}`}
        antetitulo="CENTRO DE RECLAMOS"
        accion={<VolverAMisReclamos navegar={navegar} />}
        testID="pantalla-reclamos"
      >
        <DetalleReclamo reclamo={reclamo} uid={uid} estaciones={estaciones} />
      </Pantalla>
    );
  }

  let contenidoLista;
  if (!listo || (!reclamos.length && !altaTerminada && !error)) {
    contenidoLista = <Cargando lineas={4} mensaje="Consultando tus reclamos…" testID="cargando-reclamos" />;
  } else if (error && !reclamos.length) {
    contenidoLista = <ErrorCarga error={error} onReintentar={() => cargarMas('reclamos')} testID="error-reclamos" />;
  } else {
    contenidoLista = (
      <View style={estilos.lista}>
        {error ? <ErrorCarga error={error} onReintentar={() => cargarMas('reclamos')} testID="error-reclamos" /> : null}
        <ListaReclamos
          reclamos={reclamos}
          hayMas={hayMas}
          onCargarMas={masReclamos.cargar}
          cargandoMas={masReclamos.cargando}
          onAbrir={(reclamoId) => navegar('reclamos', reclamoId)}
        />
      </View>
    );
  }

  return (
    <Pantalla key="principal" titulo={TITULO} bajada={BAJADA} testID="pantalla-reclamos">
      <View onLayout={alMedir} style={dosColumnas ? estilos.columnas : estilos.apilado}>
        <View style={dosColumnas ? estilos.columnaFormulario : null}>
          <Seccion titulo="Nuevo reclamo">
            {listo ? (
              <FormularioReclamo
                precarga={precarga}
                onVer={(reclamoId) => navegar('reclamos', reclamoId)}
                onCreado={() => {
                  if (id === 'nuevo') navegar('reclamos', null, null, { reemplazar: true });
                }}
              />
            ) : (
              <Cargando lineas={5} mensaje="Preparando el formulario…" testID="cargando-formulario" />
            )}
          </Seccion>
        </View>
        <View style={dosColumnas ? estilos.columnaLista : null}>
          <Seccion titulo="Mis reclamos">{contenidoLista}</Seccion>
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacio.m },
  apilado: { gap: espacio.l },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xl },
  columnaFormulario: { flex: 5, minWidth: 0 },
  columnaLista: { flex: 7, minWidth: 0 },
});
