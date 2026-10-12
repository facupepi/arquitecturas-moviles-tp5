// Mi cuenta (S1, sección 8.2). Solo hay cuentas de Google (no hay acceso anónimo).
// - Nombre, correo y código de vecino (useSesion escucha onIdTokenChanged).
// - Lo que tenemos guardado del vecino (cantidades).
// - Avisos en este dispositivo e instalación de la app.
// - Privacidad completa (aceptarPrivacidad), "Borrar mis datos" con confirmación y "Cerrar sesión".
// - Escritorio ancho (≥ 1200 px): dos columnas parejas que ocupan todo el ancho del contenido, como el
//   resto de las pantallas. En el celular, una sola columna en el orden de siempre.
import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSesion } from '../firebase/auth';
import { useMunicipal } from '../datos/almacen';
import { useComando } from '../datos/useComando';
import { borrarCuentaYSalir, salir } from '../datos/sesion';
import { useRuta } from '../navegacion';
import { colores, espacio, radios } from '../tema/tokens';
import {
  Aviso,
  Boton,
  Cargando,
  Dialogo,
  ErrorCarga,
  EtiquetaEstado,
  FilaDato,
  Pantalla,
  Seccion,
  Tarjeta,
  Texto,
} from '../ui';
import { version } from '../../package.json';
import Avisos from './cuenta/Avisos';
import Instalar from './cuenta/Instalar';
import Privacidad from './cuenta/Privacidad';
import { dejarAvisoSalida } from './cuenta/avisoSalida';
import { codigoVecino } from '../../shared/formato.mjs';

const seleccionarDatos = (s) => ({
  listo: s.listo,
  errorPerfil: s.errores?.perfil ?? null,
  perfil: s.perfil,
  esAdmin: s.esAdmin,
  tributos: s.tributos.length,
  pagos: s.pagos.length,
  reclamos: s.reclamos.length,
  sesiones: s.sesiones.length,
  notificaciones: s.notificaciones.filter((n) => n.fuente === 'personal').length,
  masPagos: s.hayMas?.pagos ?? false,
  masReclamos: s.hayMas?.reclamos ?? false,
  masSesiones: s.hayMas?.estacionamiento ?? false,
  masNotificaciones: s.hayMas?.notificaciones ?? false,
});

const cantidad = (n, hayMas) => (hayMas ? `${n} o más` : String(n));

// Envuelve una salida para dejarle el mensaje a Ingreso ANTES de cerrar la sesión: al cerrarse,
// esta pantalla se desmonta y el aviso flotante del marco ya no existe.
function conAvisoSalida(tipo, operacion) {
  return async (...args) => {
    dejarAvisoSalida(tipo);
    try {
      return await operacion(...args);
    } catch (e) {
      dejarAvisoSalida(null);
      throw e;
    }
  };
}

const borrarYSalir = conAvisoSalida('borrado', borrarCuentaYSalir);
const salirDeGoogle = conAvisoSalida('salida', salir);

function Perfil({ usuario }) {
  const nombre = usuario?.nombre || 'Vecino';
  return (
    <View style={estilos.perfil} testID="cuenta-perfil">
      <View style={estilos.avatar} aria-hidden>
        <Texto variante="titulo2" color={colores.blanco}>
          {nombre.slice(0, 1).toUpperCase()}
        </Texto>
      </View>
      <View style={estilos.flexible}>
        <Texto variante="titulo3" numberOfLines={1} testID="cuenta-nombre">
          {nombre}
        </Texto>
        {usuario?.email ? (
          <Texto variante="chico" color={colores.textoSuave} numberOfLines={1}>
            {usuario.email}
          </Texto>
        ) : null}
        <View style={estilos.etiqueta}>
          <EtiquetaEstado texto="Cuenta de Google" tono="exito" icono="checkCirculo" testID="cuenta-tipo" />
        </View>
        {codigoVecino(usuario?.uid) ? (
          <Texto variante="chico" color={colores.textoSuave} testID="cuenta-codigo">
            {`Tu código de vecino: ${codigoVecino(usuario.uid)}`}
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

export default function Cuenta() {
  const { usuario } = useSesion();
  const datos = useMunicipal(seleccionarDatos);
  const { navegar } = useRuta();
  const { width } = useWindowDimensions();
  const dosColumnas = width >= ANCHO_DOS_COLUMNAS;

  const [dialogo, setDialogo] = useState(null); // 'borrar' | null

  // ---------- Comandos ----------
  const borrado = useComando(borrarYSalir);
  const salida = useComando(salirDeGoogle);

  const cerrarDialogo = () => {
    if (borrado.ocupado) return;
    borrado.limpiar();
    setDialogo(null);
  };

  // ---------- Contenido ----------
  const resumenDatos = !datos.listo ? (
    <Cargando lineas={4} mensaje="Buscando tus datos…" testID="cuenta-cargando" />
  ) : (
    <View testID="cuenta-datos">
      <FilaDato etiqueta="Cedulones" valor={String(datos.tributos)} testID="dato-tributos" />
      <FilaDato etiqueta="Pagos" valor={cantidad(datos.pagos, datos.masPagos)} testID="dato-pagos" />
      <FilaDato etiqueta="Reclamos" valor={cantidad(datos.reclamos, datos.masReclamos)} testID="dato-reclamos" />
      <FilaDato etiqueta="Estacionamientos" valor={cantidad(datos.sesiones, datos.masSesiones)} testID="dato-estacionamientos" />
      <FilaDato
        etiqueta="Notificaciones personales"
        valor={cantidad(datos.notificaciones, datos.masNotificaciones)}
        testID="dato-notificaciones"
      />
    </View>
  );

  const perfil = (
    <Tarjeta>
      <Perfil usuario={usuario} />
      <Texto variante="chico" color={colores.textoSuave}>
        Tus datos quedan asociados a tu cuenta de Google: podés entrar desde cualquier celular o computadora.
      </Texto>
    </Tarjeta>
  );

  const avisoAdmin = datos.esAdmin ? (
    <Aviso
      tono="info"
      titulo="Sos administrador de la demostración"
      mensaje="Desde el panel municipal podés mover bicicletas, activar alarmas, responder reclamos y publicar avisos."
      accion={{ titulo: 'Abrir el panel municipal', onPress: () => navegar('panel'), testID: 'cuenta-ir-panel' }}
    />
  ) : null;

  const guardado = (
    <Seccion titulo="Lo que guardamos de vos">
      {datos.errorPerfil ? <ErrorCarga error={datos.errorPerfil} /> : null}
      <Tarjeta>{resumenDatos}</Tarjeta>
    </Seccion>
  );

  const notificaciones = (
    <Seccion titulo="Notificaciones">
      <Tarjeta>
        <Avisos onElegir={() => navegar('notificaciones')} />
      </Tarjeta>
    </Seccion>
  );

  const instalar = (
    <Seccion titulo="Instalar la app">
      <Tarjeta testID="cuenta-instalar">
        <Instalar />
      </Tarjeta>
    </Seccion>
  );

  const privacidad = (
    <Seccion titulo="Privacidad">
      <Tarjeta>
        <Privacidad perfil={datos.perfil} listo={datos.listo} />
      </Tarjeta>
    </Seccion>
  );

  const sesionYDatos = (
    <Seccion titulo="Sesión y datos">
      <Tarjeta>
        <View style={estilos.bloque}>
          <Boton
            titulo={salida.ocupado ? 'Cerrando sesión…' : 'Cerrar sesión'}
            icono="salir"
            variante="secundario"
            ancho="completo"
            cargando={salida.ocupado}
            onPress={() => salida.ejecutar()}
            testID="cerrar-sesion"
          />
          {salida.error ? <Aviso tono="peligro" rol="alert" mensaje={salida.error.message} testID="error-salir" /> : null}
        </View>
        <View style={estilos.separador} />
        <View style={estilos.bloque}>
          <Texto variante="chico" color={colores.textoSuave}>
            Borra para siempre tu perfil, tus cedulones, pagos, reclamos con sus adjuntos, estacionamientos y
            notificaciones, y también tu usuario.
          </Texto>
          <Boton
            titulo="Borrar mis datos"
            variante="peligro"
            ancho="completo"
            onPress={() => setDialogo('borrar')}
            testID="borrar-datos"
          />
        </View>
      </Tarjeta>
    </Seccion>
  );

  return (
    <Pantalla
      testID="pantalla-cuenta"
      antetitulo="TU CUENTA"
      titulo="Mi cuenta"
      bajada="Tu perfil, tus avisos, la instalación de la app y el control de tus datos."
    >
      {dosColumnas ? (
        <View style={estilos.columnas}>
          <View style={estilos.columnaDoble}>
            {perfil}
            {avisoAdmin}
            {guardado}
            {sesionYDatos}
          </View>
          <View style={estilos.columnaDoble}>
            {notificaciones}
            {instalar}
            {privacidad}
          </View>
        </View>
      ) : (
        <View style={estilos.columna}>
          {perfil}
          {avisoAdmin}
          {guardado}
          {notificaciones}
          {instalar}
          {privacidad}
          {sesionYDatos}
        </View>
      )}

      <Texto variante="chico" color={colores.textoSuave} alineacion="center" testID="cuenta-version">
        San Francisco Conecta · versión {version}
      </Texto>

      {/* Confirmación del borrado. */}
      <Dialogo
        visible={dialogo === 'borrar'}
        titulo="¿Borrar todos tus datos?"
        onCerrar={cerrarDialogo}
        cerrable={!borrado.ocupado}
        testID="dialogo-borrar"
        acciones={[
          { titulo: 'Cancelar', variante: 'secundario', deshabilitado: borrado.ocupado, onPress: cerrarDialogo, testID: 'cancelar-borrado' },
          {
            titulo: borrado.ocupado ? 'Borrando…' : 'Borrar mis datos',
            variante: 'peligro',
            cargando: borrado.ocupado,
            onPress: () => borrado.ejecutar(),
            testID: 'confirmar-borrado',
          },
        ]}
      >
        <Texto variante="cuerpo">
          Vamos a eliminar tu perfil, tus cedulones y pagos, tus reclamos con sus adjuntos, tus estacionamientos, tus
          notificaciones y tu usuario. No se puede deshacer.
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          Después vas a volver a la pantalla de ingreso. Podés entrar de nuevo cuando quieras, empezando de cero.
        </Texto>
        {borrado.error ? <Aviso tono="peligro" rol="alert" mensaje={borrado.error.message} testID="error-borrar" /> : null}
      </Dialogo>

    </Pantalla>
  );
}

const ANCHO_DOS_COLUMNAS = 1200;

const estilos = StyleSheet.create({
  columna: { gap: espacio.l, width: '100%', maxWidth: 760 },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xl },
  columnaDoble: { flex: 1, minWidth: 0, gap: espacio.l },
  bloque: { gap: espacio.m },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radios.pildora,
    backgroundColor: colores.accion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexible: { flex: 1, minWidth: 0, gap: 2 },
  etiqueta: { paddingTop: espacio.xs },
  separador: { height: 1, backgroundColor: colores.borde },
});
