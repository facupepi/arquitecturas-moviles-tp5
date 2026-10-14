// Galería de componentes (WP5, 7.2). Solo en desarrollo: ruta #/galeria (con o sin sesión).
// Muestra cada componente de src/ui con sus variantes, para revisarlos sin las pantallas y como
// referencia de uso para los agentes de pantallas. No entra en el build de producción.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios, tipografia } from '../tema/tokens';
import { SERVICIOS } from '../tema/servicios';
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Dialogo,
  ErrorCarga,
  EtiquetaEstado,
  FilaDato,
  Icono,
  Insignia,
  Interruptor,
  Mapa,
  NOMBRES_ICONOS,
  Pantalla,
  Pestanas,
  Seccion,
  Selector,
  Tarjeta,
  Texto,
  Vacio,
  useAvisoFlotante,
} from '../ui';

const PUNTOS = [
  { id: 'b1', lat: -31.4351133, lng: -62.0862566, titulo: 'Estación Plaza General Paz', detalles: ['8 bicicletas', '6 anclajes libres'], tono: 'normal' },
  { id: 'b2', lat: -31.4319946, lng: -62.0797907, titulo: 'Estación Municipalidad', detalles: ['3 bicicletas'], tono: 'normal' },
  { id: 'b3', lat: -31.4254107, lng: -62.0684119, titulo: 'Alarma Parque Cincuentenario', detalles: ['Activada'], tono: 'activo' },
  { id: 'b6', lat: -31.4279816, lng: -62.0679246, titulo: 'Estación Hospital Iturraspe', detalles: ['Sin bicicletas'], tono: 'neutro' },
  { id: 'b4', lat: -31.4297491, lng: -62.0916357, titulo: 'Estación Terminal', detalles: ['Fuera de servicio'], tono: 'alerta' },
  {
    id: 'p3',
    lat: -31.4347,
    lng: -62.0862566,
    titulo: 'Zona Plaza General Paz',
    detalles: ['$600 por hora'],
    tono: 'normal',
    tramo: [
      { lat: -31.4349, lng: -62.0866566 },
      { lat: -31.4353, lng: -62.0858566 },
    ],
  },
];

function Muestra({ titulo, children }) {
  return (
    <View style={estilos.muestra}>
      <Texto variante="chico" peso="700" color={colores.textoSuave}>
        {titulo}
      </Texto>
      <View style={estilos.fila}>{children}</View>
    </View>
  );
}

export default function Galeria() {
  const aviso = useAvisoFlotante();
  const [patente, setPatente] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [minutos, setMinutos] = useState('30');
  const [tipos, setTipos] = useState(['obras', 'cortes']);
  const [zona, setZona] = useState('centro');
  const [pestana, setPestana] = useState('todas');
  const [interruptor, setInterruptor] = useState(true);
  const [dialogo, setDialogo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [seleccionado, setSeleccionado] = useState('b1');
  const [avisoVisible, setAvisoVisible] = useState(true);

  const errorPatente = patente && !/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(patente) ? 'Ingresá una patente válida (ABC123 o AB123CD).' : null;

  return (
    <Pantalla
      titulo="Galería de componentes"
      antetitulo="SOLO EN DESARROLLO"
      bajada="Cada componente de src/ui con sus variantes. Importalos desde '../ui'."
      accion={<Boton titulo="Abrir diálogo" icono="info" onPress={() => setDialogo(true)} testID="galeria-abrir-dialogo" />}
      testID="pantalla-galeria"
    >
      <Seccion titulo="Colores y tipografía">
        <View style={estilos.fila}>
          {Object.entries(colores).map(([nombre, valor]) => (
            <View key={nombre} style={estilos.color}>
              <View style={[estilos.muestraColor, { backgroundColor: valor }]} />
              <Texto variante="chico" peso="700">
                {nombre}
              </Texto>
              <Texto variante="chico" color={colores.textoSuave}>
                {valor}
              </Texto>
            </View>
          ))}
        </View>
        <Tarjeta>
          {['titulo1', 'titulo2', 'titulo3', 'cuerpo', 'chico', 'antetitulo', 'numero'].map((v) => (
            <Texto key={v} variante={v}>
              {v === 'numero' ? '12:45:08' : `${v}: Tu ciudad, a un toque`}
            </Texto>
          ))}
          <Texto variante="chico" color={colores.textoSuave}>
            Familia: {tipografia.familia}
          </Texto>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Íconos">
        <View style={estilos.fila}>
          {NOMBRES_ICONOS.map((n) => (
            <View key={n} style={estilos.icono}>
              <Icono nombre={n} tamano={24} color={colores.accionOscuro} />
              <Texto variante="chico" alineacion="center" estilo={estilos.nombreIcono}>
                {n}
              </Texto>
            </View>
          ))}
        </View>
      </Seccion>

      <Seccion titulo="Botones">
        <Muestra titulo="Variantes">
          <Boton titulo="Primario" onPress={() => aviso.mostrar('Tocaste el botón primario')} testID="galeria-boton-primario" />
          <Boton titulo="Secundario" variante="secundario" onPress={() => {}} />
          <Boton titulo="Texto" variante="texto" enLinea onPress={() => {}} />
          <Boton titulo="Peligro" variante="peligro" icono="alerta" onPress={() => {}} />
        </Muestra>
        <Muestra titulo="Estados">
          <Boton titulo="Pagando…" cargando />
          <Boton titulo="Deshabilitado" deshabilitado />
          <Boton titulo="Con ícono" icono="descargar" variante="secundario" />
        </Muestra>
        <Muestra titulo="Enlaces (href)">
          <Boton titulo="Llamar al 147" icono="telefono" href="tel:147" variante="secundario" etiquetaAccesible="Llamar al 147" />
          <Boton titulo="Portal municipal" href="https://www.sanfrancisco.gov.ar/" variante="texto" />
        </Muestra>
        <Boton titulo="Ancho completo" ancho="completo" onPress={() => {}} />
      </Seccion>

      <Seccion titulo="Campos">
        <Campo
          id="galeria-patente"
          etiqueta="Patente"
          valor={patente}
          onCambio={setPatente}
          mayusculas
          maxLargo={7}
          placeholder="AB123CD"
          ayuda="En mayúsculas, sin espacios."
          error={errorPatente}
          testID="galeria-campo-patente"
        />
        <Campo
          id="galeria-descripcion"
          etiqueta="Descripción"
          valor={descripcion}
          onCambio={setDescripcion}
          multilinea
          maxLargo={500}
          placeholder="Contanos qué pasó"
        />
        <Campo id="galeria-error" etiqueta="Dirección" valor="" onCambio={() => {}} error="Ingresá la dirección del problema." />
        <Campo id="galeria-tel" etiqueta="Teléfono" valor="" onCambio={() => {}} modoTeclado="tel" />
      </Seccion>

      <Seccion titulo="Selectores y pestañas">
        <Selector
          etiqueta="Minutos"
          valor={minutos}
          onCambio={setMinutos}
          opciones={['15', '30', '60', '90', '120', '180', '240'].map((m) => ({ valor: m, etiqueta: `${m} min`, deshabilitada: m === '240' }))}
          testID="galeria-minutos"
        />
        <Selector
          etiqueta="Tipos de aviso"
          multiple
          valor={tipos}
          onCambio={setTipos}
          opciones={[
            { valor: 'obras', etiqueta: 'Obras' },
            { valor: 'cortes', etiqueta: 'Cortes' },
            { valor: 'eventos', etiqueta: 'Eventos' },
            { valor: 'emergencias', etiqueta: 'Emergencias' },
          ]}
          error={tipos.length === 0 ? 'Elegí al menos un tipo.' : null}
        />
        <Selector
          etiqueta="Zona (variante lista)"
          variante="lista"
          valor={zona}
          onCambio={setZona}
          opciones={[
            { valor: 'centro', etiqueta: 'Centro' },
            { valor: 'parque', etiqueta: 'Parque' },
            { valor: 'norte', etiqueta: 'Norte' },
            { valor: 'sur', etiqueta: 'Sur' },
          ]}
          testID="galeria-zona"
        />
        <Pestanas
          etiqueta="Filtro de notificaciones"
          valor={pestana}
          onCambio={setPestana}
          opciones={[
            { valor: 'todas', etiqueta: 'Todas' },
            { valor: 'no-leidas', etiqueta: 'No leídas', contador: 3 },
            { valor: 'ciudad', etiqueta: 'Avisos de la ciudad' },
            { valor: 'tramites', etiqueta: 'Mis trámites' },
          ]}
          testID="galeria-pestanas"
        />
        <Interruptor
          etiqueta="Avisarme si se activa una alarma cerca"
          descripcion="Tu ubicación no se guarda."
          valor={interruptor}
          onCambio={setInterruptor}
          testID="galeria-interruptor"
        />
        <Interruptor etiqueta="Interruptor deshabilitado" valor={false} deshabilitado onCambio={() => {}} />
      </Seccion>

      <Seccion titulo="Estados y avisos">
        <Muestra titulo="EtiquetaEstado">
          <EtiquetaEstado texto="Pagado" tono="exito" icono="check" />
          <EtiquetaEstado texto="Vence en 2 días" tono="alerta" />
          <EtiquetaEstado texto="Vencido" tono="peligro" />
          <EtiquetaEstado texto="En proceso" tono="info" />
          <EtiquetaEstado texto="Pendiente" tono="neutro" />
        </Muestra>
        <Muestra titulo="Insignia">
          <Insignia cantidad={3} />
          <Insignia cantidad={12} />
        </Muestra>
        {avisoVisible ? (
          <Aviso
            tono="info"
            titulo="Sin conexión: tu reclamo se enviará cuando vuelvas a estar en línea"
            mensaje="Podés seguir usando la app."
            onCerrar={() => setAvisoVisible(false)}
          />
        ) : null}
        <Aviso tono="exito" mensaje="Pago registrado. Comprobante REC-1A2B3C4D." />
        <Aviso tono="alerta" titulo="Tu estacionamiento vence en 5 minutos" mensaje="Podés extenderlo 15 o 30 minutos." accion={{ titulo: 'Extender', onPress: () => {} }} />
        <Aviso tono="peligro" rol="alert" titulo="La patente ya tiene una sesión activa" mensaje="Está ocupada hasta las 18:30." />
        <Muestra titulo="Aviso flotante">
          <Boton titulo="Mostrar éxito" variante="secundario" onPress={() => aviso.mostrar('Reclamo enviado')} testID="galeria-flotante" />
          <Boton
            titulo="Mostrar con 'Ver'"
            variante="secundario"
            onPress={() => aviso.mostrar({ titulo: 'Alarma activada', cuerpo: 'Alarma Parque Cincuentenario' }, 'alerta', '#/alarmas/a2')}
            testID="galeria-flotante-ver"
          />
        </Muestra>
        <ErrorCarga error={{ codigo: 'sin-conexion', message: 'No hay conexión. Revisá tu red e intentá de nuevo.' }} onReintentar={() => aviso.mostrar('Reintentando…', 'info')} testID="galeria-error-reintentable" />
        <ErrorCarga error={{ codigo: 'permiso', message: 'No se pudo validar la operación.' }} onReintentar={() => {}} testID="galeria-error-permiso" />
        <Vacio icono="checkCirculo" titulo="Estás al día" mensaje="No hay avisos pendientes de lectura." accion={{ titulo: 'Ver preferencias', onPress: () => {} }} />
        <Cargando />
        <Cargando lineas={3} mensaje="Consultando tus obligaciones…" testID="galeria-esqueleto" />
      </Seccion>

      <Seccion titulo="Tarjetas y datos">
        <Tarjeta titulo="Tasa de servicios municipales" accion={<EtiquetaEstado texto="Por vencer" tono="alerta" />}>
          <FilaDato etiqueta="Período" valor="10/2026" />
          <FilaDato etiqueta="Vence" valor="9 de octubre" />
          <FilaDato etiqueta="Importe" valor="$ 18.500" />
          <View style={estilos.fila}>
            <Boton titulo="Ver cedulón" variante="secundario" onPress={() => {}} />
            <Boton titulo="Pagar" onPress={() => setDialogo(true)} />
          </View>
        </Tarjeta>
        <Tarjeta tono="destacada" titulo="Atención ciudadana 147">
          <Texto>Tarjeta destacada.</Texto>
        </Tarjeta>
        <Tarjeta tono="alerta" titulo="Tono alerta">
          <Texto>Algo requiere tu atención.</Texto>
        </Tarjeta>
        <Tarjeta tono="peligro" titulo="Tono peligro">
          <Texto>Algo salió mal.</Texto>
        </Tarjeta>
        <Tarjeta onPress={() => aviso.mostrar('Tocaste la tarjeta')} etiquetaAccesible="Bicicletas públicas, 24 disponibles" testID="galeria-tarjeta-tocable">
          <Texto variante="titulo3">Tarjeta tocable</Texto>
          <Texto color={colores.textoSuave}>Con onPress es un botón: no pongas botones adentro.</Texto>
        </Tarjeta>
        <View style={estilos.fila}>
          {SERVICIOS.map((s) => (
            <View key={s.ruta} style={[estilos.servicio, { backgroundColor: s.fondo }]}>
              <Icono nombre={s.icono} tamano={22} color={s.tinta} />
              <Texto variante="chico" peso="700" color={s.tinta}>
                {s.corto}
              </Texto>
            </View>
          ))}
        </View>
      </Seccion>

      <Seccion titulo="Mapa">
        <Mapa
          puntos={PUNTOS}
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
          ubicacion={{ lat: -31.431, lng: -62.083 }}
          etiqueta="Mapa de prueba con estaciones, una alarma y un tramo"
          alto={280}
          testID="galeria-mapa"
        />
      </Seccion>

      <Dialogo
        visible={dialogo}
        titulo="Confirmá el pago"
        onCerrar={() => setDialogo(false)}
        cerrable={!procesando}
        testID="galeria-dialogo"
        acciones={[
          { titulo: 'Cancelar', variante: 'secundario', onPress: () => setDialogo(false), deshabilitado: procesando, testID: 'galeria-dialogo-cancelar' },
          {
            titulo: 'Pagar $ 18.500',
            cargando: procesando,
            testID: 'galeria-dialogo-confirmar',
            onPress: () => {
              setProcesando(true);
              setTimeout(() => {
                setProcesando(false);
                setDialogo(false);
                aviso.mostrar('Pago registrado');
              }, 1200);
            },
          },
        ]}
      >
        <FilaDato etiqueta="Concepto" valor="Tasa de servicios municipales" />
        <FilaDato etiqueta="Importe" valor="$ 18.500" />
        <Aviso tono="info" mensaje="Guardamos solo los últimos 4 dígitos de cada tarjeta." />
        <Texto variante="chico" color={colores.textoSuave}>
          Solicitud 3f2a9c1e-0000-4000-8000-000000000000
        </Texto>
      </Dialogo>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  muestra: { gap: espacio.s },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, alignItems: 'center' },
  color: { width: 132, gap: 2 },
  muestraColor: { height: 40, borderRadius: radios.chico, borderWidth: 1, borderColor: colores.borde },
  icono: {
    width: 92,
    alignItems: 'center',
    gap: espacio.xs,
    paddingVertical: espacio.s,
    borderRadius: radios.chico,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  nombreIcono: { fontSize: 12, lineHeight: 16 },
  servicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderRadius: radios.medio,
  },
});
