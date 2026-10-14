// Mi cuenta (S1, sección 8.2). Solo hay cuentas de Google (no hay acceso anónimo).
// - Nombre, correo y código de vecino (useSesion escucha onIdTokenChanged).
// - Lo que tenemos guardado del vecino (cantidades).
// - Medios de pago: tarjetas de crédito y de débito guardadas (cuenta/Tarjetas), los únicos medios
//   de la pasarela. Solo tipo, red, últimos 4 dígitos, titular y vencimiento.
// - Avisos en este dispositivo e instalación de la app.
// - Privacidad completa (aceptarPrivacidad), "Borrar mis datos" con confirmación y "Cerrar sesión".
// - Desde 760 px de contenido (medido, no la ventana): dos columnas parejas que ocupan todo el ancho
//   de <Pantalla>, como el resto de las pantallas. En el celular, una sola columna en el orden de siempre;
//   en dos columnas, ese mismo orden partido en dos (el foco y el lector recorren lo mismo).
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
  anchoContenidoEstimado,
} from '../ui';
import { version } from '../../package.json';
import Avisos from './cuenta/Avisos';
import Instalar from './cuenta/Instalar';
import Privacidad from './cuenta/Privacidad';
import Tarjetas from './cuenta/Tarjetas';
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
  tarjetas: s.tarjetas.length,
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
  const [anchoMedido, setAnchoMedido] = useState(null);
  const dosColumnas = (anchoMedido ?? anchoContenidoEstimado(width)) >= ANCHO_DOS_COLUMNAS;
  const medir = (e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== anchoMedido) setAnchoMedido(w);
  };

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
      <FilaDato etiqueta="Tarjetas guardadas" valor={String(datos.tarjetas)} testID="dato-tarjetas" />
      <FilaDato
        etiqueta="Notificaciones personales"
        valor={cantidad(datos.notificaciones, datos.masNotificaciones)}
        testID="dato-notificaciones"
      />
    </View>
  );

  const perfil = (
    <Seccion titulo="Tu perfil">
      <Tarjeta>
        <Perfil usuario={usuario} />
      </Tarjeta>
    </Seccion>
  );

  const avisoAdmin = datos.esAdmin ? (
    <Aviso
      tono="info"
      titulo="Sos personal municipal"
      accion={{ titulo: 'Abrir el panel municipal', icono: 'panel', onPress: () => navegar('panel'), testID: 'cuenta-ir-panel' }}
    />
  ) : null;

  const guardado = (
    <Seccion titulo="Lo que guardamos de vos">
      {datos.errorPerfil ? <ErrorCarga error={datos.errorPerfil} /> : null}
      <Tarjeta>{resumenDatos}</Tarjeta>
    </Seccion>
  );

  const mediosPago = (
    <Seccion titulo="Medios de pago" testID="cuenta-medios-pago">
      <Tarjeta>
        <Tarjetas />
      </Tarjeta>
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
            Borra para siempre tu usuario y todo lo que guardamos de vos, incluidos los adjuntos de tus reclamos.
          </Texto>
          <Boton
            titulo="Borrar mis datos"
            variante="peligro"
            ancho="completo"
            onPress={() => setDialogo('borrar')}
            testID="borrar-datos"
          />
        </View>
        <Texto variante="chico" color={colores.textoSuave} testID="cuenta-version">
          San Francisco Conecta · versión {version}
        </Texto>
      </Tarjeta>
    </Seccion>
  );

  return (
    <Pantalla
      testID="pantalla-cuenta"
      antetitulo="TU CUENTA"
      titulo="Mi cuenta"
    >
      {/* Columnas de alto parecido (medido de 1280 a 1920 px, con 0 y 2 tarjetas): a la izquierda la
          cuenta, los medios de pago, los avisos y la instalación; a la derecha la privacidad, que es lo
          más largo, y la sesión. */}
      <View onLayout={medir}>
      {dosColumnas ? (
        <View style={estilos.columnas}>
          <View style={estilos.columnaDoble}>
            {perfil}
            {avisoAdmin}
            {guardado}
            {mediosPago}
            {notificaciones}
            {instalar}
          </View>
          <View style={estilos.columnaDoble}>
            {privacidad}
            {sesionYDatos}
          </View>
        </View>
      ) : (
        <View style={estilos.columna}>
          {perfil}
          {avisoAdmin}
          {guardado}
          {mediosPago}
          {notificaciones}
          {instalar}
          {privacidad}
          {sesionYDatos}
        </View>
      )}
      </View>

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
          Vamos a eliminar tu perfil, tus cedulones y pagos, tus tarjetas guardadas, tus reclamos con sus adjuntos,
          tus estacionamientos, tus notificaciones y tu usuario. No se puede deshacer.
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          Podés volver a entrar cuando quieras, empezando de cero.
        </Texto>
        {borrado.error ? <Aviso tono="peligro" rol="alert" mensaje={borrado.error.message} testID="error-borrar" /> : null}
      </Dialogo>

    </Pantalla>
  );
}

const ANCHO_DOS_COLUMNAS = 760;

const estilos = StyleSheet.create({
  columna: { gap: espacio.l },
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
