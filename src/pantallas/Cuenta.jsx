// Mi cuenta (S1, sección 8.2).
// - Nombre y tipo de cuenta (se actualiza solo al vincular: useSesion escucha onIdTokenChanged).
// - Invitado: "Vincular con Google" conserva el uid y todos los datos (sesion.vincular). Si esa cuenta
//   de Google ya existe (error cuenta-existente del popup, o #/cuenta?vinculo=existente después de un
//   redirect, con la credencial de leerCredencialPendiente), un diálogo ofrece entrar con ella
//   avisando que se borran los datos del invitado (sesion.cambiarACuentaExistente).
// - Lo que tenemos guardado del vecino (cantidades): muestra que vincular no pierde nada.
// - Avisos en este dispositivo e instalación de la app.
// - Privacidad completa (aceptarPrivacidad), "Borrar mis datos" con confirmación y "Cerrar sesión".
// - Invitado que cierra sesión (o llega con ?salir=1 desde el menú del marco): diálogo que explica
//   que no podrá volver y ofrece solo vincular o borrar los datos y salir.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSesion } from '../firebase/auth';
import { EVENTOS } from '../firebase/analytics';
import { useMunicipal } from '../datos/almacen';
import { useComando } from '../datos/useComando';
import { borrarCuentaYSalir, cambiarACuentaExistente, salir, vincular } from '../datos/sesion';
import {
  escucharCredencialPendiente,
  leerCredencialPendiente,
  limpiarCredencialPendiente,
  useRuta,
} from '../navegacion';
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
  useAvisoFlotante,
} from '../ui';
import { version } from '../../package.json';
import Avisos from './cuenta/Avisos';
import BotonGoogle from './cuenta/BotonGoogle';
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
const vincularYSalir = conAvisoSalida('vinculada', async () => {
  await vincular();
  await salir();
});

function Perfil({ usuario }) {
  const invitado = usuario?.anonimo !== false;
  const nombre = usuario?.nombre || (invitado ? 'Invitado' : 'Vecino');
  return (
    <View style={estilos.perfil} testID="cuenta-perfil">
      <View style={[estilos.avatar, invitado ? estilos.avatarInvitado : null]} aria-hidden>
        <Texto variante="titulo2" color={invitado ? colores.accionOscuro : colores.blanco}>
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
          <EtiquetaEstado
            texto={invitado ? 'Cuenta de invitado' : 'Cuenta de Google'}
            tono={invitado ? 'alerta' : 'exito'}
            icono={invitado ? 'usuario' : 'checkCirculo'}
            testID="cuenta-tipo"
          />
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

export default function Cuenta({ ruta }) {
  const { usuario } = useSesion();
  const datos = useMunicipal(seleccionarDatos);
  const { navegar } = useRuta();
  const aviso = useAvisoFlotante();
  const invitado = usuario?.anonimo !== false;

  const [dialogo, setDialogo] = useState(null); // 'salir' | 'borrar' | 'existente' | null
  const [credencial, setCredencial] = useState(null);

  const limpiarParametros = useCallback(() => {
    if (ruta?.params && Object.keys(ruta.params).length) navegar('cuenta', null, null, { reemplazar: true });
  }, [navegar, ruta?.params]);

  // ---------- Comandos ----------
  const vinculo = useComando(vincular, {
    evento: EVENTOS.VINCULAR,
    alExito: () => aviso.mostrar('Listo: tu cuenta quedó vinculada con Google. Conservás todos tus datos.'),
  });
  const vinculoYSalida = useComando(vincularYSalir, { evento: EVENTOS.VINCULAR });
  const cambio = useComando(cambiarACuentaExistente, {
    alExito: () => {
      limpiarCredencialPendiente();
      setCredencial(null);
      setDialogo(null);
      aviso.mostrar('Entraste con tu cuenta de Google.');
    },
  });
  const borrado = useComando(borrarYSalir);
  const salida = useComando(salirDeGoogle);

  // cuenta-existente desde el popup (vincular o vincular y salir): abre el diálogo de cambio.
  useEffect(() => {
    const error = vinculo.error?.codigo === 'cuenta-existente' ? vinculo.error
      : vinculoYSalida.error?.codigo === 'cuenta-existente' ? vinculoYSalida.error : null;
    if (!error) return;
    setCredencial(error.datos?.credencial ?? null);
    setDialogo('existente');
  }, [vinculo.error, vinculoYSalida.error]);

  // #/cuenta?vinculo=existente: credencial guardada por App.jsx después de un redirect.
  useEffect(() => {
    if (ruta?.params?.vinculo !== 'existente') return undefined;
    const tomar = (c) => {
      if (!c) return;
      setCredencial(c);
      setDialogo('existente');
    };
    tomar(leerCredencialPendiente());
    return escucharCredencialPendiente(tomar);
  }, [ruta?.params?.vinculo]);

  // #/cuenta?salir=1: "Cerrar sesión" del marco para un invitado.
  useEffect(() => {
    if (ruta?.params?.salir !== '1') return;
    if (invitado) setDialogo('salir');
    else limpiarParametros();
  }, [ruta?.params?.salir, invitado, limpiarParametros]);

  const cerrarDialogo = () => {
    if (borrado.ocupado || cambio.ocupado || vinculoYSalida.ocupado) return;
    if (dialogo === 'existente') {
      limpiarCredencialPendiente();
      setCredencial(null);
    }
    borrado.limpiar();
    cambio.limpiar();
    vinculoYSalida.limpiar();
    setDialogo(null);
    limpiarParametros();
  };

  const cerrarSesion = () => {
    if (invitado) setDialogo('salir');
    else salida.ejecutar();
  };

  const errorVinculo = vinculo.error && vinculo.error.codigo !== 'cuenta-existente' ? vinculo.error : null;
  const errorVinculoSalida = vinculoYSalida.error && vinculoYSalida.error.codigo !== 'cuenta-existente'
    ? vinculoYSalida.error : null;

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

  return (
    <Pantalla
      testID="pantalla-cuenta"
      antetitulo="TU CUENTA"
      titulo="Mi cuenta"
      bajada="Tu perfil, tus avisos, la instalación de la app y el control de tus datos."
    >
      <View style={estilos.columna}>
        <Tarjeta tono={invitado ? 'alerta' : 'normal'}>
          <Perfil usuario={usuario} />
          {invitado ? (
            <View style={estilos.bloque}>
              <Texto variante="chico">
                Estás usando Conecta como invitado. Tus datos quedan en esta cuenta, pero si cerrás la sesión o borrás los
                datos del navegador no vas a poder recuperarlos. Vinculala con Google para conservarlos y usarlos en otro
                dispositivo.
              </Texto>
              <BotonGoogle
                titulo={vinculo.ocupado ? 'Conectando con Google…' : 'Vincular con Google'}
                cargando={vinculo.ocupado}
                deshabilitado={vinculoYSalida.ocupado}
                onPress={() => vinculo.ejecutar()}
                testID="vincular-google"
              />
              {errorVinculo ? (
                <Aviso
                  tono={errorVinculo.causa?.code === 'auth/popup-closed-by-user' ? 'info' : 'peligro'}
                  rol="alert"
                  mensaje={errorVinculo.message}
                  testID="error-vincular"
                />
              ) : null}
            </View>
          ) : (
            <Texto variante="chico" color={colores.textoSuave}>
              Tus datos quedan asociados a tu cuenta de Google: podés entrar desde cualquier celular o computadora.
            </Texto>
          )}
        </Tarjeta>

        {datos.esAdmin ? (
          <Aviso
            tono="info"
            titulo="Sos administrador de la demostración"
            mensaje="Desde el panel municipal podés mover bicicletas, activar alarmas, responder reclamos y publicar avisos."
            accion={{ titulo: 'Abrir el panel municipal', onPress: () => navegar('panel'), testID: 'cuenta-ir-panel' }}
          />
        ) : null}

        <Seccion titulo="Lo que guardamos de vos">
          {datos.errorPerfil ? <ErrorCarga error={datos.errorPerfil} /> : null}
          <Tarjeta>
            {resumenDatos}
            {invitado && datos.listo ? (
              <Texto variante="chico" color={colores.textoSuave}>
                Al vincular con Google todo esto se conserva tal cual.
              </Texto>
            ) : null}
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Notificaciones">
          <Tarjeta>
            <Avisos onElegir={() => navegar('notificaciones')} />
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Instalar la app">
          <Tarjeta testID="cuenta-instalar">
            <Instalar />
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Privacidad">
          <Tarjeta>
            <Privacidad perfil={datos.perfil} listo={datos.listo} />
          </Tarjeta>
        </Seccion>

        <Seccion titulo="Sesión y datos">
          <Tarjeta>
            <View style={estilos.bloque}>
              <Boton
                titulo={salida.ocupado ? 'Cerrando sesión…' : 'Cerrar sesión'}
                icono="salir"
                variante="secundario"
                ancho="completo"
                cargando={salida.ocupado}
                onPress={cerrarSesion}
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

        <Texto variante="chico" color={colores.textoSuave} alineacion="center" testID="cuenta-version">
          San Francisco Conecta · versión {version}
        </Texto>
      </View>

      {/* Invitado que quiere salir: solo vincular o borrar. */}
      <Dialogo
        visible={dialogo === 'salir'}
        titulo="Antes de salir"
        onCerrar={cerrarDialogo}
        cerrable={!borrado.ocupado && !vinculoYSalida.ocupado}
        testID="dialogo-invitado-salir"
        acciones={[
          {
            titulo: 'Borrar mis datos y salir',
            variante: 'peligro',
            cargando: borrado.ocupado,
            deshabilitado: vinculoYSalida.ocupado,
            onPress: () => borrado.ejecutar(),
            testID: 'salir-borrar',
          },
          {
            titulo: vinculoYSalida.ocupado ? 'Conectando con Google…' : 'Vincular con Google y salir',
            variante: 'primario',
            cargando: vinculoYSalida.ocupado,
            deshabilitado: borrado.ocupado,
            onPress: () => vinculoYSalida.ejecutar(),
            testID: 'salir-vincular',
          },
        ]}
      >
        <Texto variante="cuerpo">
          Entraste como invitado. Si cerrás la sesión así, no vas a poder volver a esta cuenta ni recuperar tus datos.
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          Vinculá tu cuenta con Google para volver cuando quieras con todo lo que hiciste, o borrá tus datos para no
          dejar nada guardado.
        </Texto>
        {borrado.error ? <Aviso tono="peligro" rol="alert" mensaje={borrado.error.message} testID="error-borrar" /> : null}
        {errorVinculoSalida ? (
          <Aviso tono="peligro" rol="alert" mensaje={errorVinculoSalida.message} testID="error-salir-vincular" />
        ) : null}
      </Dialogo>

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

      {/* La cuenta de Google ya tenía datos. */}
      <Dialogo
        visible={dialogo === 'existente'}
        titulo="Esa cuenta de Google ya tiene datos"
        onCerrar={cerrarDialogo}
        cerrable={!cambio.ocupado}
        testID="dialogo-cuenta-existente"
        acciones={[
          { titulo: 'Seguir como invitado', variante: 'secundario', deshabilitado: cambio.ocupado, onPress: cerrarDialogo, testID: 'seguir-invitado' },
          {
            titulo: cambio.ocupado ? 'Cambiando de cuenta…' : 'Entrar con esa cuenta',
            variante: 'peligro',
            cargando: cambio.ocupado,
            deshabilitado: !credencial,
            onPress: () => cambio.ejecutar(credencial),
            testID: 'confirmar-cuenta-existente',
          },
        ]}
      >
        <Texto variante="cuerpo">
          Ya usaste Conecta con esa cuenta de Google. Podés entrar con ella, pero lo que hiciste como invitado se va a
          borrar y no se puede recuperar.
        </Texto>
        {datos.listo ? (
          <Texto variante="chico" color={colores.textoSuave}>
            Se borran {datos.tributos} cedulones, {datos.pagos} pagos, {datos.reclamos} reclamos y {datos.sesiones}{' '}
            estacionamientos de este invitado.
          </Texto>
        ) : null}
        {!credencial ? (
          <Aviso
            tono="alerta"
            mensaje="No recibimos los datos de esa cuenta. Cerrá este aviso y volvé a tocar Vincular con Google."
          />
        ) : null}
        {cambio.error ? <Aviso tono="peligro" rol="alert" mensaje={cambio.error.message} testID="error-cambio-cuenta" /> : null}
      </Dialogo>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio.l, width: '100%', maxWidth: 760 },
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
  avatarInvitado: { backgroundColor: colores.celesteClaro },
  flexible: { flex: 1, minWidth: 0, gap: 2 },
  etiqueta: { paddingTop: espacio.xs },
  separador: { height: 1, backgroundColor: colores.borde },
});
