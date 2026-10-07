// Ingreso (S1, sección 8.1). Se muestra sin sesión, fuera del enrutador. Dibuja la leyenda de
// prototipo debajo de su banda de marca, en el mismo lugar que el resto de la app. Textos de bienvenida y beneficios de heredado:AuthGate.jsx:44-89.
// - "Entrar como invitado": el docente entra sin cuenta (usabilidad). Después puede vincular Google.
// - "Continuar con Google": popup con respaldo de redirect (completarRedireccion lo llama App.jsx).
// - Aviso de privacidad breve (protección de datos, Ley 25.326) e instalación de la PWA.
// - Estados: botones con indicador mientras trabajan; error de ingreso debajo de los botones.
import React, { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ingresarComoInvitado, ingresarConGoogle, mensajeDeError } from '../firebase/auth';
import { EVENTOS } from '../firebase/analytics';
import { useComando } from '../datos/useComando';
import { colores, cortes, espacio, radios } from '../tema/tokens';
import { Aviso, Boton, Icono, Pantalla, Tarjeta, Texto } from '../ui';
import LeyendaPrototipo, { ContextoLeyenda } from '../marco/LeyendaPrototipo';
import BotonGoogle from './cuenta/BotonGoogle';
import Instalar from './cuenta/Instalar';
import { MENSAJES_SALIDA, tomarAvisoSalida } from './cuenta/avisoSalida';
import { PRIVACIDAD_BREVE } from './cuenta/textos';

const LOGO = { uri: '/brand/municipalidad-blanco.png' };
const PROPORCION_LOGO = 372 / 217;

const BENEFICIOS = [
  { icono: 'bicicleta', texto: 'Bicicletas y movilidad' },
  { icono: 'tributo', texto: 'Tributos y estacionamiento' },
  { icono: 'reclamo', texto: 'Reclamos y atención' },
  { icono: 'campana', texto: 'Avisos de tu ciudad' },
];

function BandaMarca() {
  return (
    <View role="banner" style={estilos.banda}>
      <Image source={LOGO} aria-hidden resizeMode="contain" style={{ height: 34, width: Math.round(34 * PROPORCION_LOGO) }} />
      <View style={estilos.separador} />
      <View>
        <Texto variante="titulo3" color={colores.blanco} estilo={estilos.marca}>
          Conecta
        </Texto>
        <Texto variante="chico" color={colores.blanco} peso="600" estilo={estilos.subMarca}>
          San Francisco
        </Texto>
      </View>
    </View>
  );
}

function Beneficio({ icono, texto }) {
  return (
    <View role="listitem" style={estilos.beneficio}>
      <View style={estilos.iconoBeneficio}>
        <Icono nombre={icono} tamano={20} color={colores.accionOscuro} />
      </View>
      <Texto variante="chico" peso="700" estilo={estilos.flexible}>
        {texto}
      </Texto>
    </View>
  );
}

function PuntoPrivacidad({ icono, titulo, texto }) {
  return (
    <View role="listitem" style={estilos.punto}>
      <Icono nombre={icono} tamano={18} color={colores.accion} />
      <View style={estilos.flexible}>
        <Texto variante="chico" peso="700">
          {titulo}
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          {texto}
        </Texto>
      </View>
    </View>
  );
}

export default function Ingreso() {
  const { width } = useWindowDimensions();
  const ancho = width >= cortes.escritorio;
  const [avisoSalida] = useState(() => tomarAvisoSalida());

  const invitado = useComando(ingresarComoInvitado, {
    evento: EVENTOS.LOGIN,
    parametrosEvento: () => ({ method: 'anonimo' }),
  });
  const google = useComando(ingresarConGoogle, {
    evento: EVENTOS.LOGIN,
    parametrosEvento: () => ({ method: 'google' }),
  });

  const ocupado = invitado.ocupado || google.ocupado;
  const error = invitado.error || google.error;
  const cerroVentana = error?.causa?.code === 'auth/popup-closed-by-user' || error?.causa?.code === 'auth/cancelled-popup-request';

  const entrarInvitado = () => {
    google.limpiar();
    invitado.ejecutar();
  };
  const entrarGoogle = () => {
    invitado.limpiar();
    google.ejecutar();
  };

  const salida = avisoSalida ? MENSAJES_SALIDA[avisoSalida] : null;

  const tarjetaIngreso = (
    <Tarjeta estilo={estilos.tarjetaIngreso}>
      <View style={estilos.encabezadoTarjeta}>
        <Texto role="heading" aria-level={2} variante="titulo2">
          Ingresá
        </Texto>
        <Texto variante="cuerpo" color={colores.textoSuave}>
          Para probar la app no necesitás cuenta. Si después la vinculás con Google, conservás todo lo que hiciste.
        </Texto>
      </View>
      {salida ? (
        <Aviso tono="exito" titulo={salida.titulo} mensaje={salida.mensaje} testID="aviso-salida" />
      ) : null}
      <View style={estilos.botones}>
        <Boton
          titulo={invitado.ocupado ? 'Entrando…' : 'Entrar como invitado'}
          icono="usuario"
          ancho="completo"
          cargando={invitado.ocupado}
          deshabilitado={ocupado && !invitado.ocupado}
          onPress={entrarInvitado}
          testID="ingresar-invitado"
        />
        <View style={estilos.separadorO}>
          <View style={estilos.linea} />
          <Texto variante="chico" color={colores.textoSuave}>
            o
          </Texto>
          <View style={estilos.linea} />
        </View>
        <BotonGoogle
          titulo={google.ocupado ? 'Conectando con Google…' : 'Continuar con Google'}
          cargando={google.ocupado}
          deshabilitado={ocupado && !google.ocupado}
          onPress={entrarGoogle}
          testID="ingresar-google"
        />
      </View>
      {error ? (
        <Aviso
          tono={cerroVentana ? 'info' : 'peligro'}
          rol="alert"
          titulo={cerroVentana ? 'No se completó el ingreso' : 'No pudimos hacerte ingresar'}
          mensaje={mensajeDeError(error)}
          testID="error-ingreso"
        />
      ) : null}
      <Texto variante="chico" color={colores.textoSuave}>
        Con Google usás la misma cuenta en el celular y en la computadora. No te pedimos ninguna contraseña nueva.
      </Texto>
    </Tarjeta>
  );

  const beneficios = (
    <View role="list" aria-label="Qué podés hacer" style={estilos.beneficios}>
      {BENEFICIOS.map((b) => (
        <Beneficio key={b.icono} {...b} />
      ))}
    </View>
  );

  const privacidad = (
    <Tarjeta titulo="Tus datos, cuidados" testID="privacidad-breve">
      <View role="list" style={estilos.puntos}>
        {PRIVACIDAD_BREVE.map((p) => (
          <PuntoPrivacidad key={p.titulo} {...p} />
        ))}
      </View>
    </Tarjeta>
  );

  const extras = (
    <>
      <Tarjeta titulo="Instalá Conecta en tu celular">
        <Instalar compacto />
      </Tarjeta>
      <View style={estilos.ayuda}>
        <Texto variante="chico" color={colores.textoSuave}>
          ¿Necesitás ayuda con un trámite?
        </Texto>
        <Boton titulo="Llamar al 147" icono="telefono" variante="texto" href="tel:147" etiquetaAccesible="Llamar al 147, atención al vecino" />
      </View>
    </>
  );

  return (
    <View style={estilos.raiz}>
      <BandaMarca />
      <LeyendaPrototipo />
      <ContextoLeyenda.Provider value>
      <Pantalla
        testID="pantalla-ingreso"
        antetitulo="SAN FRANCISCO, CÓRDOBA"
        titulo="Tu ciudad, a un toque."
        bajada="Trámites, recorridos y avisos de tu barrio en un solo lugar."
      >
        {ancho ? (
          <View style={estilos.columnas}>
            <View style={estilos.columnaIzquierda}>
              {beneficios}
              {privacidad}
            </View>
            <View style={estilos.columnaDerecha}>
              {tarjetaIngreso}
              {extras}
            </View>
          </View>
        ) : (
          <>
            {tarjetaIngreso}
            {beneficios}
            {privacidad}
            {extras}
          </>
        )}
      </Pantalla>
      </ContextoLeyenda.Provider>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, minHeight: 0, backgroundColor: colores.fondo },
  banda: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingHorizontal: espacio.l,
    backgroundColor: colores.accion,
  },
  separador: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.45)' },
  marca: { fontSize: 18, lineHeight: 20 },
  subMarca: { fontSize: 12, lineHeight: 15 },
  tarjetaIngreso: { gap: espacio.l },
  encabezadoTarjeta: { gap: espacio.xs },
  botones: { gap: espacio.m },
  separadorO: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  linea: { flex: 1, height: 1, backgroundColor: colores.borde },
  beneficios: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  // Lista con íconos, sin borde ni fondo: con tarjeta parecían botones y no hacen nada.
  beneficio: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingVertical: espacio.xs,
  },
  iconoBeneficio: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntos: { gap: espacio.m },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  flexible: { flex: 1, minWidth: 0 },
  ayuda: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espacio.xs },
  columnas: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xl },
  columnaIzquierda: { flex: 1, minWidth: 0, gap: espacio.l },
  columnaDerecha: { width: 420, gap: espacio.l },
});
