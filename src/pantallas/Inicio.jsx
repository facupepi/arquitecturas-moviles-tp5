// Inicio (S2, sección 8.3). Los siete servicios entran completos en un celular de 360 × 740 sin
// desplazar (UIX-08), cada uno con un dato vivo del almacén. Arriba, el buscador de servicios y
// trámites; debajo de la grilla, el resumen del vecino (deuda, reclamos abiertos, estacionamiento
// activo y avisos sin leer) y el último aviso de la ciudad. Usa solo useMunicipal.
// El banner de emergencia ya lo dibuja el marco arriba de todas las pantallas: no se repite acá.
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { useAhora } from '../datos/useAhora';
import { useConfigRemota } from '../firebase/configRemota';
import { useRuta } from '../navegacion';
import { SERVICIOS } from '../tema/servicios';
import { colores, espacio, medidas, radios, tipografia } from '../tema/tokens';
import {
  Cargando, ErrorCarga, EtiquetaEstado, Icono, Pantalla, Seccion, Tarjeta, Texto, Vacio,
} from '../ui';
import { alPresionarEspacio, conFoco } from '../ui/comun';
import { dinero, fecha, hora, tiempoRelativo, tiempoPasado } from '../../shared/formato.mjs';
import { ETIQUETAS } from '../../shared/constantes.mjs';

const MIN = 60_000;
const GAP = espacio.s;
const SALTO = '\n';

// Palabras con las que un vecino busca cada servicio (sin tildes: se comparan normalizadas).
const CLAVES = {
  bicicletas: 'bici bicis bicicleta estacion anclaje pedalear prestamo',
  tributos: 'cedulon cedulones tasa tasas impuesto deuda pagar pago inmueble contribucion vencimiento comprobante',
  reclamos: 'reclamo queja problema bache bacheo luz luminaria alumbrado basura limpieza foto arreglo',
  contactos: 'telefono llamar 147 whatsapp tana correo mail contacto emergencia hospital policia bomberos ayuda',
  alarmas: 'alarma alarmas seguridad barrio vecinal robo',
  estacionamiento: 'estacionar estacionamiento patente auto parquimetro cochera medido',
  notificaciones: 'aviso avisos notificacion novedades corte obras eventos alerta',
};

// En la grilla angosta "Estacionamiento" no entra al lado del ícono: se usa el verbo de la barra inferior.
const ETIQUETA_TILE = { estacionamiento: 'Estacionar' };

// Atajos a trámites concretos: solo aparecen al buscar.
const ATAJOS = [
  {
    id: 'pagar', titulo: 'Pagar un cedulón', detalle: 'Mis tributos', icono: 'tributo', ruta: 'tributos',
    claves: 'pagar cedulon tasa deuda pago',
  },
  {
    id: 'reclamo', titulo: 'Hacer un reclamo', detalle: 'Centro de reclamos', icono: 'reclamo', ruta: 'reclamos', id_: 'nuevo',
    claves: 'nuevo reclamo reportar problema bache luz basura arreglo',
  },
  {
    id: 'emergencias', titulo: 'Teléfonos de emergencia', detalle: 'Policía 101, Bomberos 100, Emergencias médicas 107',
    icono: 'telefono', ruta: 'contactos', params: { categoria: 'emergencias' },
    claves: 'emergencia urgencia policia bomberos ambulancia defensa civil 100 101 103 107',
  },
  {
    id: 'salud', titulo: 'Hospital Iturraspe', detalle: 'Teléfono del hospital regional', icono: 'telefono',
    ruta: 'contactos', params: { categoria: 'salud' }, claves: 'hospital salud guardia medico iturraspe',
  },
  {
    id: 'cuenta', titulo: 'Mi cuenta y privacidad', detalle: 'Tu perfil, instalar la app o borrar tus datos',
    icono: 'usuario', ruta: 'cuenta', claves: 'cuenta perfil google privacidad datos borrar instalar sesion salir',
  },
];

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function coincide(texto, consulta) {
  const base = normalizar(texto);
  return normalizar(consulta).split(/\s+/).filter(Boolean).every((palabra) => base.includes(palabra));
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// ---------- Datos derivados ----------

function useResumen() {
  const s = useMunicipal((e) => ({
    listo: e.listo,
    errores: e.errores,
    usuario: e.usuario,
    estaciones: e.estaciones,
    alarmas: e.alarmas,
    tributos: e.tributos,
    altaTerminada: e.altaTerminada,
    reclamos: e.reclamos,
    sesiones: e.sesiones,
    notificaciones: e.notificaciones,
    noLeidas: e.noLeidas,
  }));
  // Cada 15 s alcanza para "quedan N min" y para que una sesión vencida deje de figurar activa.
  const tic = useAhora(15000);

  return useMemo(() => {
    // Hora leída al recalcular (no la del último tic): un dato que llega entre tics no queda corrido.
    const ahora = Date.now();
    const operativas = s.estaciones.filter((e) => e.estado !== 'fuera_de_servicio');
    const bicis = operativas.reduce((total, e) => total + (Number(e.bicicletas) || 0), 0);
    const impagos = s.tributos.filter((t) => t.estado !== 'pagado');
    const vencidos = impagos.filter((t) => t.estado === 'vencido');
    const porVencer = impagos.filter((t) => t.estado === 'por_vencer');
    const deuda = impagos.reduce((total, t) => total + (Number(t.importe) || 0), 0);
    const proximo = impagos
      .filter((t) => t.estado !== 'vencido' && typeof t.vence === 'number')
      .sort((a, b) => a.vence - b.vence)[0] ?? null;
    const abiertos = s.reclamos.filter((r) => r.estado !== 'resuelto');
    const activas = s.sesiones
      .filter((x) => typeof x.fin === 'number' && x.fin > ahora)
      .sort((a, b) => a.fin - b.fin);
    const alarmasActivas = s.alarmas.filter((a) => a.activa);
    const ultimoAviso = s.notificaciones.find((n) => n.fuente === 'aviso') ?? null;
    const primeraNoLeida = s.notificaciones.find((n) => !n.leida) ?? null;
    return {
      ...s,
      ahora,
      bicis,
      impagos,
      vencidos,
      porVencer,
      deuda,
      proximo,
      abiertos,
      activas,
      alarmasActivas,
      ultimoAviso,
      primeraNoLeida,
      consultandoTributos: s.tributos.length === 0 && !s.altaTerminada,
    };
  }, [s, tic]);
}

/** Dato vivo de cada acceso: { texto, tono } con tono 'normal' | 'exito' | 'alerta' | 'peligro'. */
function datoDe(ruta, r) {
  if (!r.listo) return { texto: 'Cargando…', tono: 'normal' };
  const conError = (porcion) => (r.errores?.[porcion] ? { texto: 'No disponible', tono: 'normal' } : null);
  switch (ruta) {
    case 'bicicletas':
      return conError('estaciones') ?? (r.bicis > 0
        ? { texto: plural(r.bicis, 'bici disponible', 'bicis disponibles'), tono: 'normal' }
        : { texto: 'Sin bicis libres', tono: 'alerta' });
    case 'tributos': {
      const error = conError('tributos');
      if (error) return error;
      if (r.consultandoTributos) return { texto: 'Consultando…', tono: 'normal' };
      if (!r.impagos.length) return { texto: 'Estás al día', tono: 'exito' };
      // Dos renglones cortos: entran en el acceso angosto sin cortar una frase a la mitad.
      const aPagar = `${r.impagos.length} a pagar`;
      if (r.vencidos.length) return { texto: [aPagar, plural(r.vencidos.length, 'vencido', 'vencidos')].join(SALTO), tono: 'peligro' };
      if (r.porVencer.length) return { texto: [aPagar, 'vence pronto'].join(SALTO), tono: 'alerta' };
      return { texto: aPagar, tono: 'normal' };
    }
    case 'reclamos':
      return conError('reclamos') ?? (r.abiertos.length
        ? { texto: plural(r.abiertos.length, 'en seguimiento', 'en seguimiento'), tono: 'normal' }
        : { texto: 'Sin reclamos abiertos', tono: 'normal' });
    case 'contactos':
      return { texto: '147 y WhatsApp', tono: 'normal' };
    case 'alarmas':
      return conError('alarmas') ?? (r.alarmasActivas.length
        ? { texto: plural(r.alarmasActivas.length, 'activada', 'activadas'), tono: 'peligro' }
        : { texto: 'Ninguna activada', tono: 'normal' });
    case 'estacionamiento': {
      const error = conError('estacionamiento');
      if (error) return error;
      const sesion = r.activas[0];
      if (!sesion) return { texto: 'Sin sesión activa', tono: 'normal' };
      const minutos = Math.max(1, Math.ceil((sesion.fin - r.ahora) / MIN));
      // "quedan N min" no entra en el acceso angosto: se ve "Activo / N min" y se lee completo.
      return { texto: ['Activo', `${minutos} min`].join(SALTO), accesible: `Activo, quedan ${minutos} min`, tono: 'exito' };
    }
    case 'notificaciones':
      return conError('notificaciones') ?? (r.noLeidas > 0
        ? { texto: plural(r.noLeidas, 'aviso sin leer', 'avisos sin leer'), tono: 'alerta' }
        : { texto: 'Estás al día', tono: 'exito' });
    default:
      return { texto: '', tono: 'normal' };
  }
}

const COLOR_TONO = {
  normal: colores.textoSuave,
  exito: colores.exito,
  alerta: colores.alerta,
  peligro: colores.peligro,
};

// ---------- Buscador ----------

function Buscador({ valor, onCambio, onEnviar }) {
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View role="search" style={[estilos.buscador, enfocado && estilos.buscadorEnfocado]}>
      <Icono nombre="buscar" tamano={20} color={colores.textoSuave} />
      <TextInput
        value={valor}
        onChangeText={onCambio}
        onSubmitEditing={onEnviar}
        placeholder="Buscá un servicio o trámite"
        placeholderTextColor={colores.textoSuave}
        aria-label="Buscar un servicio o trámite"
        inputMode="search"
        enterKeyHint="search"
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={60}
        testID="buscar-servicios"
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={estilos.entrada}
      />
      {valor ? (
        <Pressable
          role="button"
          aria-label="Borrar la búsqueda"
          onPress={conFoco(() => onCambio(''))}
          testID="borrar-busqueda"
          style={({ hovered }) => [estilos.borrar, hovered && estilos.borrarResaltado]}
        >
          <Icono nombre="cerrar" tamano={18} color={colores.texto} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Grilla de servicios ----------

function Acceso({ servicio, dato, ancho, completo, onPress }) {
  const etiqueta = ETIQUETA_TILE[servicio.ruta] ?? servicio.corto;
  return (
    <Tarjeta
      onPress={onPress}
      etiquetaAccesible={`${servicio.nombre}: ${dato.accesible ?? dato.texto.split(SALTO).join(', ')}`}
      testID={`servicio-${servicio.ruta}`}
      estilo={[estilos.acceso, { width: ancho }, completo && estilos.accesoCompleto]}
    >
      <View style={estilos.accesoFila}>
        <View style={[estilos.accesoIcono, { backgroundColor: servicio.fondo }]}>
          <Icono nombre={servicio.icono} tamano={20} color={servicio.tinta} />
        </View>
        <View style={estilos.accesoTextos}>
          <Texto variante="cuerpo" peso="700" numberOfLines={1} estilo={estilos.accesoNombre}>
            {completo ? servicio.nombre : etiqueta}
          </Texto>
          <Texto
            variante="chico"
            peso={dato.tono === 'normal' ? '600' : '700'}
            color={COLOR_TONO[dato.tono] ?? colores.textoSuave}
            numberOfLines={2}
            estilo={estilos.accesoDato}
            testID={`dato-${servicio.ruta}`}
          >
            {dato.texto}
          </Texto>
        </View>
      </View>
    </Tarjeta>
  );
}

function columnasPara(ancho) {
  if (ancho >= 760) return 4;
  if (ancho >= 500) return 3;
  return 2;
}

function Grilla({ servicios, resumen, onElegir }) {
  const { width } = useWindowDimensions();
  const [medido, setMedido] = useState(null);
  const ancho = medido ?? Math.max(0, Math.min(width, medidas.anchoMaximo) - 2 * medidas.margenLateral);
  const columnas = columnasPara(ancho);
  const anchoAcceso = Math.floor((ancho - GAP * (columnas - 1)) / columnas);
  const sobrante = servicios.length % columnas;

  return (
    <View
      testID="grilla-servicios"
      style={estilos.grilla}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== medido) setMedido(w);
      }}
    >
      {servicios.map((servicio, i) => {
        // Con dos o tres columnas, el último acceso solo en su fila ocupa todo el ancho.
        const completo = sobrante === 1 && columnas < 4 && i === servicios.length - 1;
        return (
          <Acceso
            key={servicio.ruta}
            servicio={servicio}
            dato={datoDe(servicio.ruta, resumen)}
            ancho={completo ? ancho : anchoAcceso}
            completo={completo}
            onPress={() => onElegir(servicio.ruta)}
          />
        );
      })}
    </View>
  );
}

function Atajos({ atajos, onElegir }) {
  if (!atajos.length) return null;
  return (
    <View style={estilos.atajos}>
      <Texto variante="antetitulo" color={colores.textoSuave}>
        Atajos
      </Texto>
      {atajos.map((a) => (
        <Tarjeta
          key={a.id}
          onPress={() => onElegir(a)}
          etiquetaAccesible={`${a.titulo}. ${a.detalle}`}
          testID={`atajo-${a.id}`}
          estilo={estilos.atajo}
        >
          <View style={estilos.accesoFila}>
            <Icono nombre={a.icono} tamano={20} color={colores.accion} />
            <View style={estilos.accesoTextos}>
              <Texto variante="cuerpo" peso="700">
                {a.titulo}
              </Texto>
              <Texto variante="chico" color={colores.textoSuave}>
                {a.detalle}
              </Texto>
            </View>
            <Icono nombre="chevron" tamano={20} color={colores.textoSuave} />
          </View>
        </Tarjeta>
      ))}
    </View>
  );
}

// ---------- Resumen del vecino ----------

function FilaResumen({ icono, servicio, etiqueta, valor, detalle, tono = 'normal', onPress, testID, ultima }) {
  return (
    <Pressable
      role="link"
      aria-label={`${etiqueta}: ${valor}. ${detalle}`}
      onPress={conFoco(onPress)}
      onKeyDown={alPresionarEspacio(onPress)}
      testID={testID}
      style={({ hovered, pressed }) => [
        estilos.fila,
        !ultima && estilos.filaSeparada,
        (hovered || pressed) && estilos.filaResaltada,
      ]}
    >
      <View style={[estilos.filaIcono, { backgroundColor: servicio.fondo }]}>
        <Icono nombre={icono} tamano={18} color={servicio.tinta} />
      </View>
      <View style={estilos.filaTextos}>
        <View style={estilos.filaCabecera}>
          <Texto variante="chico" peso="700" color={colores.textoSuave} estilo={estilos.flexible}>
            {etiqueta}
          </Texto>
          <Texto variante="cuerpo" peso="700" color={tono === 'normal' ? colores.texto : COLOR_TONO[tono]} testID={`${testID}-valor`}>
            {valor}
          </Texto>
        </View>
        <Texto variante="chico" color={colores.textoSuave}>
          {detalle}
        </Texto>
      </View>
      <Icono nombre="chevron" tamano={18} color={colores.textoSuave} />
    </Pressable>
  );
}

const SERVICIO = Object.fromEntries(SERVICIOS.map((s) => [s.ruta, s]));

function Resumen({ r, navegar }) {
  if (!r.listo) return <Cargando lineas={4} mensaje="Cargando tu resumen…" testID="resumen-cargando" />;

  const errorDe = (porcion) => r.errores?.[porcion] ?? null;
  const primerError = ['tributos', 'reclamos', 'estacionamiento', 'notificaciones'].map(errorDe).find(Boolean);

  // Deuda
  let deuda;
  if (errorDe('tributos')) {
    deuda = { valor: 'No disponible', detalle: 'No pudimos consultar tus tributos.', tono: 'normal' };
  } else if (r.consultandoTributos) {
    deuda = { valor: '…', detalle: 'Consultando tus obligaciones…', tono: 'normal' };
  } else if (!r.impagos.length) {
    deuda = { valor: 'Sin deuda', detalle: 'Estás al día con tus tributos.', tono: 'exito' };
  } else if (r.vencidos.length) {
    deuda = {
      valor: dinero(r.deuda),
      detalle: `${plural(r.vencidos.length, 'cedulón vencido', 'cedulones vencidos')}. Pagalo desde Mis tributos.`,
      tono: 'peligro',
    };
  } else {
    deuda = {
      valor: dinero(r.deuda),
      detalle: r.proximo ? `Próximo vencimiento: ${fecha(r.proximo.vence)} (${tiempoRelativo(r.proximo.vence, r.ahora)}).` : 'Tenés cedulones por pagar.',
      tono: r.porVencer.length ? 'alerta' : 'normal',
    };
  }

  // Reclamos
  const ultimoAbierto = r.abiertos[0];
  const reclamos = errorDe('reclamos')
    ? { valor: 'No disponible', detalle: 'No pudimos consultar tus reclamos.' }
    : ultimoAbierto
      ? {
        valor: String(r.abiertos.length),
        detalle: `${ultimoAbierto.codigo}: ${ETIQUETAS.estadosReclamo[ultimoAbierto.estado] ?? ultimoAbierto.estado}${ultimoAbierto.pendiente ? ' (pendiente de envío)' : ''}.`,
      }
      : { valor: 'Ninguno', detalle: '¿Viste algo para arreglar? Contanos en Reclamos.' };

  // Estacionamiento
  const sesion = r.activas[0];
  const estacionamiento = errorDe('estacionamiento')
    ? { valor: 'No disponible', detalle: 'No pudimos consultar tus sesiones.', tono: 'normal' }
    : sesion
      ? {
        valor: `Quedan ${Math.max(1, Math.ceil((sesion.fin - r.ahora) / MIN))} min`,
        detalle: `${sesion.patente} en ${sesion.zonaNombre}, hasta las ${hora(sesion.fin)}.${r.activas.length > 1 ? ` Y ${plural(r.activas.length - 1, 'sesión más', 'sesiones más')}.` : ''}`,
        tono: 'exito',
      }
      : { valor: 'Sin sesión', detalle: 'Iniciá tu estacionamiento medido en segundos.', tono: 'normal' };

  // Avisos sin leer
  const avisos = errorDe('notificaciones')
    ? { valor: 'No disponible', detalle: 'No pudimos consultar tus avisos.', tono: 'normal' }
    : r.noLeidas > 0
      ? { valor: String(r.noLeidas), detalle: `Último: ${r.primeraNoLeida?.titulo ?? 'tenés avisos nuevos'}.`, tono: 'alerta' }
      : { valor: 'Ninguno', detalle: 'Estás al día con tus avisos.', tono: 'exito' };

  return (
    <View style={estilos.resumen}>
      <ErrorCarga error={primerError} testID="resumen-error" />
      <Tarjeta estilo={estilos.tarjetaResumen}>
        <FilaResumen
          icono="tributo"
          servicio={SERVICIO.tributos}
          etiqueta="Deuda municipal"
          {...deuda}
          onPress={() => navegar('tributos')}
          testID="resumen-deuda"
        />
        <FilaResumen
          icono="reclamo"
          servicio={SERVICIO.reclamos}
          etiqueta="Reclamos abiertos"
          {...reclamos}
          onPress={() => (ultimoAbierto ? navegar('reclamos', ultimoAbierto.id) : navegar('reclamos'))}
          testID="resumen-reclamos"
        />
        <FilaResumen
          icono="estacionamiento"
          servicio={SERVICIO.estacionamiento}
          etiqueta="Estacionamiento"
          {...estacionamiento}
          onPress={() => navegar('estacionamiento')}
          testID="resumen-estacionamiento"
        />
        <FilaResumen
          icono="campana"
          servicio={SERVICIO.notificaciones}
          etiqueta="Avisos sin leer"
          {...avisos}
          onPress={() => navegar('notificaciones')}
          testID="resumen-avisos"
          ultima
        />
      </Tarjeta>
    </View>
  );
}

function UltimoAviso({ r, navegar }) {
  if (!r.listo) return <Cargando lineas={2} mensaje="Buscando avisos…" testID="aviso-cargando" />;
  const error = r.errores?.avisos;
  if (error) return <ErrorCarga error={error} testID="aviso-error" />;
  const aviso = r.ultimoAviso;
  if (!aviso) {
    return (
      <Vacio
        icono="checkCirculo"
        titulo="Estás al día"
        mensaje="No hay avisos de la ciudad para tus zonas. Cuando haya novedades, te las mostramos acá."
        accion={{ titulo: 'Elegir qué avisos recibir', onPress: () => navegar('notificaciones'), testID: 'ir-preferencias' }}
        testID="avisos-vacio"
      />
    );
  }
  const tipo = ETIQUETAS.tipos[aviso.tipo] ?? aviso.tipo;
  const zona = aviso.zona ? ETIQUETAS.zonas[aviso.zona] ?? aviso.zona : null;
  return (
    <Tarjeta
      onPress={() => navegar('notificaciones', aviso.id)}
      etiquetaAccesible={`${aviso.leida ? '' : 'Nuevo. '}${aviso.titulo}. ${aviso.cuerpo}`}
      testID="ultimo-aviso"
    >
      <View style={estilos.avisoEtiquetas}>
        {aviso.leida ? null : <EtiquetaEstado texto="Nuevo" tono="info" />}
        <EtiquetaEstado texto={zona ? `${tipo} · ${zona}` : tipo} tono="neutro" />
      </View>
      <Texto variante="titulo3">{aviso.titulo}</Texto>
      <Texto variante="cuerpo" color={colores.textoSuave} numberOfLines={3}>
        {aviso.cuerpo}
      </Texto>
      <View style={estilos.avisoPie}>
        <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible}>
          {tiempoPasado(aviso.creadoEn, r.ahora)}
        </Texto>
        <Texto variante="chico" peso="700" color={colores.accion}>
          Ver detalle
        </Texto>
        <Icono nombre="chevron" tamano={16} color={colores.accion} />
      </View>
    </Tarjeta>
  );
}

// ---------- Pantalla ----------

export default function Inicio() {
  const { navegar } = useRuta();
  const { mensajeBienvenida } = useConfigRemota() ?? {};
  const r = useResumen();
  const [consulta, setConsulta] = useState('');

  const buscando = consulta.trim().length > 0;
  const servicios = useMemo(
    () => (buscando
      ? SERVICIOS.filter((s) => coincide(`${s.nombre} ${s.corto} ${s.descripcion} ${CLAVES[s.ruta] ?? ''}`, consulta))
      : SERVICIOS),
    [buscando, consulta],
  );
  const atajos = useMemo(
    () => (buscando ? ATAJOS.filter((a) => coincide(`${a.titulo} ${a.detalle} ${a.claves}`, consulta)) : []),
    [buscando, consulta],
  );

  const irAServicio = (ruta) => navegar(ruta);
  const irAAtajo = (a) => navegar(a.ruta, a.id_ ?? null, a.params ?? null);
  const enviar = () => {
    if (servicios.length) irAServicio(servicios[0].ruta);
    else if (atajos.length) irAAtajo(atajos[0]);
  };

  const nombre = (r.usuario?.nombre || '').trim().split(/\s+/)[0];
  const resultados = servicios.length + atajos.length;

  return (
    <Pantalla
      titulo={mensajeBienvenida || 'Tu ciudad, a un toque.'}
      antetitulo={nombre ? `Hola, ${nombre}` : undefined}
      testID="pantalla-inicio"
    >
      <View style={estilos.bloque}>
        <Buscador valor={consulta} onCambio={setConsulta} onEnviar={enviar} />
        {buscando ? (
          <Texto role="status" variante="chico" color={colores.textoSuave} testID="resultado-busqueda">
            {resultados
              ? `${plural(resultados, 'resultado', 'resultados')} para "${consulta.trim()}"`
              : `Sin resultados para "${consulta.trim()}"`}
          </Texto>
        ) : null}
        {servicios.length ? (
          <Grilla servicios={servicios} resumen={r} onElegir={irAServicio} />
        ) : null}
        <Atajos atajos={atajos} onElegir={irAAtajo} />
        {buscando && !resultados ? (
          <Vacio
            icono="buscar"
            titulo="No encontramos ese servicio"
            mensaje="Probá con otra palabra, como cedulón, patente, bici o reclamo."
            accion={{ titulo: 'Ver todos los servicios', onPress: () => setConsulta(''), testID: 'ver-todos' }}
            testID="busqueda-vacia"
          />
        ) : null}
      </View>

      {buscando ? null : (
        <>
          <Seccion titulo="Tu resumen" testID="seccion-resumen">
            <Resumen r={r} navegar={navegar} />
          </Seccion>
          <Seccion titulo="Último aviso de la ciudad" testID="seccion-aviso">
            <UltimoAviso r={r} navegar={navegar} />
          </Seccion>
        </>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.m },
  flexible: { flex: 1, minWidth: 0 },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    minHeight: medidas.toqueMinimo,
    paddingLeft: espacio.m,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    borderRadius: radios.pildora,
    backgroundColor: colores.superficie,
  },
  buscadorEnfocado: { borderColor: colores.foco, borderWidth: 2, paddingLeft: espacio.m - 1 },
  entrada: {
    flex: 1,
    minWidth: 0,
    minHeight: medidas.toqueMinimo - 2,
    fontFamily: tipografia.familia,
    fontSize: 16,
    color: colores.texto,
    paddingVertical: 0,
    outlineStyle: 'none',
  },
  borrar: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
    cursor: 'pointer',
  },
  borrarResaltado: { backgroundColor: colores.fondo },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  acceso: { padding: espacio.m, gap: 0, alignSelf: 'auto', minHeight: 76, justifyContent: 'center' },
  accesoCompleto: {},
  accesoFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accesoIcono: {
    width: 38,
    height: 38,
    borderRadius: radios.pildora,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accesoTextos: { flex: 1, minWidth: 0, gap: 1 },
  accesoNombre: { fontSize: 15, lineHeight: 20 },
  accesoDato: { fontSize: 13, lineHeight: 17 },
  atajos: { gap: espacio.s },
  atajo: { paddingVertical: espacio.m },
  resumen: { gap: espacio.m },
  tarjetaResumen: { padding: 0, gap: 0, overflow: 'hidden' },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    minHeight: medidas.toqueMinimo,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.l,
    cursor: 'pointer',
  },
  filaSeparada: { borderBottomWidth: 1, borderBottomColor: colores.borde },
  filaResaltada: { backgroundColor: '#f2f7fa' },
  filaIcono: {
    width: 34,
    height: 34,
    borderRadius: radios.pildora,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filaTextos: { flex: 1, minWidth: 0, gap: 2 },
  filaCabecera: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s, flexWrap: 'wrap' },
  avisoEtiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  avisoPie: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
});
