// Contactos (S2, sección 8.4): C1 (contactos por categoría), C2 (llamar y correo con enlaces del
// sistema) y C3 (WhatsApp, canal Tana). Arriba, la tarjeta destacada de la línea 147 y Tana; debajo,
// el filtro por categoría y una tarjeta por área con dirección, horario y sus medios de contacto.
// Los enlaces los abre <Boton href> con abrirEnlace: tel: y mailto: en la misma ventana (la app del
// sistema toma el control) y https://wa.me en otra pestaña. Funciona sin conexión con la caché.
// Enlace profundo opcional: #/contactos?categoria=emergencias.
// En pantallas anchas, las áreas van en una grilla de 2 o 3 columnas con tarjetas del mismo alto
// (los botones quedan abajo de todo) y la tarjeta destacada pone sus botones a la derecha.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../datos/almacen';
import { registrarEvento, EVENTOS } from '../firebase/analytics';
import { colores, espacio } from '../tema/tokens';
import {
  Boton, Cargando, ErrorCarga, EtiquetaEstado, Icono, Pantalla, Selector, Tarjeta, Texto, Vacio,
} from '../ui';
import { CATEGORIAS_CONTACTO, ETIQUETAS } from '../../shared/constantes.mjs';
import { Grilla, useAncho } from './bicicletas/Disposicion';

// Respaldo de la tarjeta destacada si municipal/info todavía no llegó (mismos datos del catálogo).
const LINEA_VECINO = '147';
const WHATSAPP_TANA = '5493564336062';
const SALUDO = 'Hola, te escribo desde San Francisco Conecta. Quería hacer una consulta.';
// Si el catálogo no llega en este tiempo (sin red y sin caché), se deja de mostrar "Cargando".
const ESPERA_CONTACTOS_MS = 8000;

const TODAS = 'todas';
const OPCIONES = [
  { valor: TODAS, etiqueta: 'Todas' },
  ...CATEGORIAS_CONTACTO.map((c) => ({ valor: c, etiqueta: ETIQUETAS.categoriasContacto[c] ?? c })),
];

const TONO_CATEGORIA = { municipal: 'info', emergencias: 'peligro', salud: 'exito' };

/** "+543564439111" → "+54 3564 43-9111"; los números cortos (147, 107) quedan igual. */
export function telefonoLegible(numero) {
  const limpio = String(numero ?? '').replace(/[^\d+]/g, '');
  const m = /^\+54(\d{4})(\d{2})(\d{4})$/.exec(limpio);
  return m ? `+54 ${m[1]} ${m[2]}-${m[3]}` : String(numero ?? '');
}

const enlaceTelefono = (numero) => `tel:${String(numero).replace(/[^\d+]/g, '')}`;
const enlaceWhatsapp = (numero) => `https://wa.me/${String(numero).replace(/\D/g, '')}?text=${encodeURIComponent(SALUDO)}`;
const enlaceCorreo = (correo, area) => `mailto:${correo}?subject=${encodeURIComponent(`Consulta desde San Francisco Conecta: ${area}`)}`;

function usado(medio, contacto) {
  registrarEvento(EVENTOS.CONTACTO_USADO, { medio, contacto });
}

function Destacada({ info, ancha }) {
  const linea = info?.lineaVecino || LINEA_VECINO;
  const whatsapp = info?.whatsapp || WHATSAPP_TANA;
  return (
    <Tarjeta
      tono="destacada"
      testID="contacto-destacado"
      etiquetaAccesible="Atención al vecino, línea 147 y canal Tana"
      estilo={ancha ? estilos.destacadaAncha : null}
    >
      <View style={ancha ? estilos.destacadaTextos : estilos.destacadaColumna}>
        <View style={estilos.destacadaCabecera}>
          <View style={estilos.destacadaIcono}>
            <Icono nombre="telefono" tamano={24} color={colores.blanco} />
          </View>
          <View style={estilos.flexible}>
            <Texto variante="antetitulo" color={colores.accionOscuro}>
              Atención al vecino
            </Texto>
            <Texto variante="titulo2" role="heading" aria-level={2}>
              {`Línea ${linea}`}
            </Texto>
          </View>
        </View>
        <Texto variante="cuerpo" color={colores.texto}>
          Consultas, trámites y reclamos. Por WhatsApp te atiende Tana, el canal municipal.
        </Texto>
      </View>
      <View style={estilos.botones}>
        <Boton
          titulo={`Llamar al ${linea}`}
          icono="telefono"
          href={enlaceTelefono(linea)}
          etiquetaAccesible={`Llamar al ${linea}, atención al vecino`}
          onPress={() => usado('telefono', 'linea_147')}
          testID="destacado-llamar"
        />
        <Boton
          titulo="WhatsApp"
          icono="mensaje"
          href={enlaceWhatsapp(whatsapp)}
          etiquetaAccesible="Escribir a Tana por WhatsApp (se abre en otra pestaña)"
          onPress={() => usado('whatsapp', 'tana')}
          testID="destacado-whatsapp"
        />
      </View>
    </Tarjeta>
  );
}

function Dato({ icono, children }) {
  return (
    <View style={estilos.dato}>
      <Icono nombre={icono} tamano={16} color={colores.textoSuave} />
      <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible}>
        {children}
      </Texto>
    </View>
  );
}

function TarjetaContacto({ c }) {
  const categoria = ETIQUETAS.categoriasContacto[c.categoria] ?? c.categoria;
  // La etiqueta de categoría solo si agrega algo: un área que ya dice lo mismo ("Emergencias" en un
  // catálogo cargado antes) no se repite al lado.
  const repetida = String(c.area ?? '').trim().toLowerCase() === String(categoria).toLowerCase();
  return (
    <Tarjeta
      testID={`contacto-${c.id}`}
      etiquetaAccesible={`${c.nombre}, ${c.area}`}
      estilo={estilos.tarjeta}
    >
      <View style={estilos.cabecera}>
        <View style={estilos.flexible}>
          <Texto variante="chico" peso="700" color={colores.textoSuave}>
            {c.area}
          </Texto>
          <Texto variante="titulo3" role="heading" aria-level={3}>
            {c.nombre}
          </Texto>
        </View>
        {repetida ? null : (
          <View style={estilos.etiqueta}>
            <EtiquetaEstado texto={categoria} tono={TONO_CATEGORIA[c.categoria] ?? 'neutro'} testID={`etiqueta-${c.id}`} />
          </View>
        )}
      </View>
      {c.descripcion ? (
        <Texto variante="cuerpo" color={colores.texto}>
          {c.descripcion}
        </Texto>
      ) : null}
      <View style={estilos.datos}>
        {c.telefono ? <Dato icono="telefono">{telefonoLegible(c.telefono)}</Dato> : null}
        {c.correo ? <Dato icono="correo">{c.correo}</Dato> : null}
        {c.direccion ? <Dato icono="ubicacion">{c.direccion}</Dato> : null}
        {c.horario ? <Dato icono="reloj">{c.horario}</Dato> : null}
      </View>
      <View style={[estilos.botones, estilos.alPie]}>
        {c.telefono ? (
          <Boton
            titulo="Llamar"
            icono="telefono"
            href={enlaceTelefono(c.telefono)}
            etiquetaAccesible={`Llamar a ${c.nombre} al ${telefonoLegible(c.telefono)}`}
            onPress={() => usado('telefono', c.id)}
            testID={`llamar-${c.id}`}
          />
        ) : null}
        {c.whatsapp ? (
          <Boton
            titulo="WhatsApp"
            icono="mensaje"
            variante="secundario"
            href={enlaceWhatsapp(c.whatsapp)}
            etiquetaAccesible={`Escribir a ${c.nombre} por WhatsApp (se abre en otra pestaña)`}
            onPress={() => usado('whatsapp', c.id)}
            testID={`whatsapp-${c.id}`}
          />
        ) : null}
        {c.correo ? (
          <Boton
            titulo="Correo"
            icono="correo"
            variante="secundario"
            href={enlaceCorreo(c.correo, c.area)}
            etiquetaAccesible={`Escribir un correo a ${c.nombre}, ${c.correo}`}
            onPress={() => usado('correo', c.id)}
            testID={`correo-${c.id}`}
          />
        ) : null}
        {c.sitio ? (
          <Boton
            titulo="Sitio web"
            variante="texto"
            href={c.sitio}
            etiquetaAccesible={`Sitio web de ${c.nombre} (se abre en otra pestaña)`}
            onPress={() => usado('sitio', c.id)}
            testID={`sitio-${c.id}`}
          />
        ) : null}
      </View>
    </Tarjeta>
  );
}

function categoriaInicial(ruta) {
  const pedida = ruta?.params?.categoria;
  return CATEGORIAS_CONTACTO.includes(pedida) ? pedida : TODAS;
}

export default function Contactos({ ruta }) {
  const { listo, contactos, info, error } = useMunicipal((s) => ({
    listo: s.listo,
    contactos: s.contactos,
    info: s.info,
    error: s.errores?.contactos ?? null,
  }));
  const [categoria, setCategoria] = useState(() => categoriaInicial(ruta));
  const [ancho, alMedir] = useAncho();
  const [demorado, setDemorado] = useState(false);

  // El enlace profundo puede cambiar sin desmontar la pantalla (#/contactos?categoria=salud).
  const pedida = ruta?.params?.categoria;
  useEffect(() => {
    if (pedida) setCategoria(categoriaInicial(ruta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida]);

  const sinDatos = contactos.length === 0;
  useEffect(() => {
    if (!sinDatos) return undefined;
    const t = setTimeout(() => setDemorado(true), ESPERA_CONTACTOS_MS);
    return () => clearTimeout(t);
  }, [sinDatos]);

  const visibles = useMemo(
    () => (categoria === TODAS ? contactos : contactos.filter((c) => c.categoria === categoria)),
    [contactos, categoria],
  );
  const opciones = useMemo(
    () => OPCIONES.map((o) => {
      if (!contactos.length) return o;
      const n = o.valor === TODAS ? contactos.length : contactos.filter((c) => c.categoria === o.valor).length;
      return { ...o, etiqueta: `${o.etiqueta} (${n})` };
    }),
    [contactos],
  );

  const cargando = !error && sinDatos && (!listo || !demorado);

  let lista;
  if (error && sinDatos) {
    lista = <ErrorCarga error={error} testID="contactos-error" />;
  } else if (cargando) {
    lista = <Cargando lineas={5} mensaje="Cargando contactos…" testID="contactos-cargando" />;
  } else if (sinDatos) {
    lista = (
      <Vacio
        icono="telefono"
        titulo="Todavía no tenemos la agenda"
        mensaje="No pudimos traer los contactos de las áreas. Mientras tanto, la línea 147 te atiende."
        testID="contactos-sin-datos"
      />
    );
  } else if (!visibles.length) {
    lista = (
      <Vacio
        icono="telefono"
        titulo="No hay contactos en esta categoría"
        accion={{ titulo: 'Ver todos', onPress: () => setCategoria(TODAS), testID: 'ver-todos-contactos' }}
        testID="contactos-vacio"
      />
    );
  } else {
    lista = (
      <Grilla minimo={300} maximo={3} separacion={espacio.l} testID="lista-contactos">
        {visibles.map((c) => (
          <TarjetaContacto key={c.id} c={c} />
        ))}
      </Grilla>
    );
  }

  return (
    <Pantalla
      titulo="Atención al vecino"
      bajada="Llamá, escribí o mandá un WhatsApp a cada área de la Municipalidad."
      testID="pantalla-contactos"
    >
      <View onLayout={alMedir} style={estilos.medida} />
      <Destacada info={info} ancha={ancho >= 720} />
      {error && !sinDatos ? <ErrorCarga error={error} testID="contactos-error" /> : null}
      <Selector
        etiqueta="Categoría"
        valor={categoria}
        opciones={opciones}
        onCambio={setCategoria}
        testID="categoria"
      />
      <View role="region" aria-label="Contactos de las áreas" style={estilos.region}>
        {lista}
      </View>
      <View style={estilos.nota}>
        <Icono nombre="info" tamano={16} color={colores.textoSuave} />
        <Texto variante="chico" color={colores.textoSuave} estilo={estilos.flexible}>
          En una emergencia llamá directamente al 107 (emergencias médicas), 101 (Policía) o 100 (Bomberos).
        </Texto>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  flexible: { flex: 1, minWidth: 0 },
  destacadaCabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.m },
  destacadaColumna: { gap: espacio.m },
  destacadaAncha: { flexDirection: 'row', alignItems: 'center', gap: espacio.xl },
  destacadaTextos: { flex: 1, minWidth: 0, gap: espacio.m },
  // Solo mide el ancho disponible (alto 0); el gap del cuerpo lo compensa el margen negativo.
  medida: { height: 0, marginBottom: -espacio.l },
  tarjeta: { flexGrow: 1 },
  etiqueta: { flexShrink: 0 },
  alPie: { marginTop: 'auto' },
  destacadaIcono: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: colores.accion,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
  datos: { gap: espacio.xs },
  dato: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s },
  region: { alignSelf: 'stretch' },
  nota: { flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start' },
});
