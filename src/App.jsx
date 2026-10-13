// Raíz de la app (WP5, 7.4). Reemplaza heredado:src/App.jsx y la parte de sesión de AuthGate.
// - useSesion(): mientras no está listo, Cargando.
// - Al montar, completarRedireccion(): termina un ingreso con Google por redirect (PWA de iOS o
//   popup bloqueado).
// - Sin usuario: Ingreso (con la leyenda arriba). Con usuario: ProveedorMunicipal > Marco > Enrutador
//   y, cuando el almacén queda listo, los servicios diferidos (Analytics, Performance, Remote Config)
//   con refrescarPush al terminar.
// - Solo en desarrollo, #/galeria muestra la galería de componentes aunque no haya sesión.
import React, { Suspense, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { completarRedireccion, useSesion } from './firebase/auth';
import { iniciarServiciosDiferidos } from './firebase/diferidos';
import { ProveedorMunicipal, useMunicipal } from './datos/almacen';
import { refrescarPush } from './datos/sesion';
import { quitarArranque, recordarSesion, sesionAnotada } from './plataforma/arranque';
import { ProveedorNavegacion, useRuta } from './navegacion/ProveedorNavegacion';
import Enrutador from './navegacion/Enrutador';
import { cargarPantalla, precargarPantalla } from './navegacion/pantallas';
import { EN_DESARROLLO, RUTA_GALERIA } from './navegacion/rutasApp';
import LimiteError from './navegacion/LimiteError';
import Marco from './marco/Marco';
import LeyendaPrototipo, { ContextoLeyenda } from './marco/LeyendaPrototipo';
import { colores } from './tema/tokens';
import { ProveedorAvisos } from './ui/AvisoFlotante';
import Cargando from './ui/Cargando';
import Pantalla from './ui/Pantalla';
import Vacio from './ui/Vacio';

let redireccionRevisada = false;
let diferidosIniciados = false;

// Sin sesión anotada, lo más probable es que haya que mostrar el Ingreso: su chunk se baja mientras
// Auth lee la sesión guardada, en lugar de esperar a que termine.
if (!sesionAnotada()) precargarPantalla('Ingreso');

function programarEnReposo(tarea) {
  const enReposo = globalThis.requestIdleCallback;
  if (typeof enReposo === 'function') enReposo(tarea, { timeout: 4000 });
  else setTimeout(tarea, 1500);
}

/** Inicia Analytics, Performance y Remote Config una sola vez, cuando el almacén queda listo. */
function ServiciosDiferidos() {
  const listo = useMunicipal((s) => s.listo);
  useEffect(() => {
    if (!listo || diferidosIniciados) return;
    diferidosIniciados = true;
    programarEnReposo(() => {
      Promise.resolve()
        .then(() => iniciarServiciosDiferidos({ alTerminar: refrescarPush }))
        .catch(() => {});
    });
  }, [listo]);
  return null;
}

/**
 * Ingreso sin sesión. La leyenda la dibuja Ingreso debajo de su banda de marca (en el mismo lugar
 * que en el resto de la app, debajo del encabezado); mientras carga o si falla, va arriba de todo.
 */
function SinSesion() {
  const Ingreso = cargarPantalla('Ingreso');
  const conLeyenda = (contenido) => (
    <View style={estilos.flexible}>
      <LeyendaPrototipo />
      <ContextoLeyenda.Provider value>{contenido}</ContextoLeyenda.Provider>
    </View>
  );
  return (
    <ProveedorAvisos>
      <View style={estilos.raiz}>
        <View style={estilos.flexible}>
          <LimiteError clave="ingreso">
            <Suspense fallback={conLeyenda(<Cargando pantallaCompleta />)}>
              {Ingreso ? (
                <Ingreso />
              ) : (
                conLeyenda(
                  <Pantalla titulo="Ingresá a San Francisco Conecta" testID="pantalla-pendiente">
                    <Vacio icono="usuario" titulo="El ingreso todavía no está disponible" />
                  </Pantalla>,
                )
              )}
            </Suspense>
          </LimiteError>
        </View>
      </View>
    </ProveedorAvisos>
  );
}

/** Galería de componentes sin sesión (solo desarrollo). */
function GaleriaSinSesion() {
  const Galeria = cargarPantalla('_Galeria');
  return (
    <ProveedorAvisos>
      <View style={estilos.raiz}>
        <LeyendaPrototipo />
        <ContextoLeyenda.Provider value>
          <View style={estilos.flexible}>
            <Suspense fallback={<Cargando pantallaCompleta />}>{Galeria ? <Galeria /> : null}</Suspense>
          </View>
        </ContextoLeyenda.Provider>
      </View>
    </ProveedorAvisos>
  );
}

function Contenido() {
  const { usuario, listo } = useSesion();
  const { ruta } = useRuta();

  useEffect(() => {
    if (redireccionRevisada) return;
    redireccionRevisada = true;
    Promise.resolve()
      .then(() => completarRedireccion())
      .catch(() => {
        // Un redirect fallido deja la pantalla de Ingreso, donde se puede volver a intentar.
      });
  }, []);

  const galeria = EN_DESARROLLO && ruta.nombre === RUTA_GALERIA && !usuario;

  // Pantalla de arranque de index.html: sin sesión la quita Ingreso cuando ya está dibujado debajo
  // (es una copia suya); con sesión o en la galería, apenas se sabe qué mostrar.
  useEffect(() => {
    if (!listo) return;
    recordarSesion(Boolean(usuario));
    if (usuario || galeria) quitarArranque();
  }, [listo, usuario, galeria]);

  if (galeria) return <GaleriaSinSesion />;
  if (!listo) return <Cargando pantallaCompleta mensaje="Cargando…" />;
  if (!usuario) return <SinSesion />;
  return (
    <ProveedorMunicipal usuario={usuario}>
      <Marco>
        <Enrutador />
      </Marco>
      <ServiciosDiferidos />
    </ProveedorMunicipal>
  );
}

export default function App() {
  return (
    <View style={estilos.raiz}>
      <ProveedorNavegacion>
        <Contenido />
      </ProveedorNavegacion>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, minHeight: 0, backgroundColor: colores.fondo },
  flexible: { flex: 1, minHeight: 0 },
});
