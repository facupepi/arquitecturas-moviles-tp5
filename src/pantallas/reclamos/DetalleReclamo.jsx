// Detalle de un reclamo (#/reclamos/<id>): datos, línea de tiempo en vivo (R3), nota municipal
// y adjuntos con "Ver" mediante una URL firmada de 5 minutos (urlAdjunto, R2).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Aviso, Boton, EtiquetaEstado, FilaDato, Icono, Seccion, Tarjeta, Texto } from '../../ui';
import { colores, espacio, radios } from '../../tema/tokens';
import { urlAdjunto } from '../../datos/repositorio';
import { desdeFirebase } from '../../datos/errores';
import { useConexion } from '../../plataforma/red';
import { abrirEnlace } from '../../plataforma/enlaces';
import { fechaHora } from '../../../shared/formato.mjs';
import PasosReclamo from './PasosReclamo';
import { esImagen, estadoVisible, etiquetaCategoria, tamanoLegible, ubicacionDeEstacion } from './util';

// Se renuevan antes de que venzan los 5 minutos de la URL firmada.
const MARGEN_RENOVACION_MS = 45_000;
const RENOVAR_CADA_MS = 4 * 60_000;

function useUrlsAdjuntos(uid, adjuntos, activo) {
  const [urls, setUrls] = useState({});
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const clave = (adjuntos ?? []).map((a) => a.ruta).join('|');
  const vigente = useRef(true);

  const pedir = useCallback(async () => {
    const lista = (adjuntos ?? []).filter((a) => a?.ruta);
    if (!lista.length) return {};
    setCargando(true);
    setError(null);
    try {
      const respuestas = await Promise.all(lista.map((a) => urlAdjunto(uid, a.ruta).then((r) => [a.ruta, r])));
      const nuevas = Object.fromEntries(respuestas);
      if (vigente.current) setUrls(nuevas);
      return nuevas;
    } catch (e) {
      if (vigente.current) setError(desdeFirebase(e));
      return null;
    } finally {
      if (vigente.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, clave]);

  useEffect(() => {
    vigente.current = true;
    if (!activo || !clave) return () => { vigente.current = false; };
    pedir();
    const temporizador = setInterval(pedir, RENOVAR_CADA_MS);
    return () => {
      vigente.current = false;
      clearInterval(temporizador);
    };
  }, [activo, clave, pedir]);

  return { urls, error, cargando, pedir };
}

function Adjunto({ adjunto, indice, url, onVer }) {
  const imagen = esImagen(adjunto.tipo);
  return (
    <View style={estilos.adjunto} testID={`adjunto-detalle-${indice}`}>
      {imagen && url ? (
        <Image source={{ uri: url }} style={estilos.miniatura} resizeMode="cover" aria-hidden />
      ) : (
        <View style={[estilos.miniatura, estilos.miniaturaIcono]} aria-hidden>
          <Icono nombre={imagen ? 'adjunto' : 'tributo'} tamano={22} color={colores.accionOscuro} />
        </View>
      )}
      <View style={estilos.datosAdjunto}>
        <Texto variante="chico" peso="700" numberOfLines={1}>
          {adjunto.nombre}
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          {`${imagen ? 'Foto' : 'PDF'}${adjunto.tamano ? ` · ${tamanoLegible(adjunto.tamano)}` : ''}`}
        </Texto>
      </View>
      <Boton
        titulo="Ver"
        variante="secundario"
        onPress={onVer}
        etiquetaAccesible={`Ver ${adjunto.nombre} (se abre en otra pestaña)`}
        testID={`ver-adjunto-${indice}`}
      />
    </View>
  );
}

export default function DetalleReclamo({ reclamo, uid, estaciones }) {
  const { enLinea } = useConexion();
  const adjuntos = reclamo.adjuntos ?? [];
  const { urls, error, cargando, pedir } = useUrlsAdjuntos(uid, adjuntos, enLinea && adjuntos.length > 0);
  const [errorVer, setErrorVer] = useState(null);
  const estado = estadoVisible(reclamo);
  const estacion = reclamo.estacionId ? estaciones.find((e) => e.id === reclamo.estacionId) : null;

  const ver = async (adjunto) => {
    setErrorVer(null);
    let actual = urls[adjunto.ruta];
    if (!actual || (actual.venceEn && actual.venceEn - MARGEN_RENOVACION_MS < Date.now())) {
      const nuevas = await pedir();
      actual = nuevas?.[adjunto.ruta];
    }
    if (!actual?.url) {
      setErrorVer(enLinea ? 'No pudimos abrir el archivo. Probá de nuevo.' : 'Para ver los archivos necesitás conexión.');
      return;
    }
    abrirEnlace(actual.url).catch(() => setErrorVer('El navegador no dejó abrir el archivo.'));
  };

  return (
    <View style={estilos.contenedor}>
      <Tarjeta testID="detalle-reclamo">
        <View style={estilos.cabecera}>
          <View style={estilos.flexible}>
            <Texto variante="chico" color={colores.textoSuave}>
              Categoría
            </Texto>
            <Texto variante="titulo3">{etiquetaCategoria(reclamo.categoria)}</Texto>
          </View>
          <EtiquetaEstado texto={estado.texto} tono={estado.tono} icono={estado.icono} testID="estado-detalle" />
        </View>
        {reclamo.pendiente ? (
          <Aviso
            tono="info"
            icono="sinConexion"
            mensaje="Pendiente de envío: se va a mandar solo cuando vuelvas a estar en línea."
            testID="aviso-pendiente"
          />
        ) : null}
        <View>
          <FilaDato etiqueta="Ubicación" valor={reclamo.direccion} />
          {estacion ? <FilaDato etiqueta="Estación" valor={ubicacionDeEstacion(estacion)} /> : null}
          <FilaDato etiqueta="Creado" valor={reclamo.creadoEn ? fechaHora(reclamo.creadoEn) : 'Recién'} />
          {reclamo.actualizadoEn && reclamo.actualizadoEn !== reclamo.creadoEn ? (
            <FilaDato etiqueta="Última novedad" valor={fechaHora(reclamo.actualizadoEn)} />
          ) : null}
        </View>
        <View style={estilos.descripcion}>
          <Texto variante="chico" peso="700" color={colores.textoSuave}>
            Descripción
          </Texto>
          <Texto variante="cuerpo">{reclamo.descripcion}</Texto>
        </View>
      </Tarjeta>

      <Seccion titulo="Seguimiento">
        <Tarjeta>
          <PasosReclamo reclamo={reclamo} />
          <Texto variante="chico" color={colores.textoSuave}>
            Esta pantalla se actualiza sola cuando la Municipalidad avanza tu reclamo.
          </Texto>
        </Tarjeta>
        {reclamo.notaMunicipal ? (
          <Tarjeta tono="destacada" titulo="Respuesta de la Municipalidad" testID="nota-municipal">
            <Texto variante="cuerpo">{reclamo.notaMunicipal}</Texto>
          </Tarjeta>
        ) : null}
      </Seccion>

      {adjuntos.length ? (
        <Seccion titulo="Archivos adjuntos">
          <View style={estilos.adjuntos}>
            {adjuntos.map((a, i) => (
              <Adjunto key={a.ruta ?? i} adjunto={a} indice={i} url={urls[a.ruta]?.url} onVer={() => ver(a)} />
            ))}
          </View>
          {cargando && !Object.keys(urls).length ? (
            <Texto role="status" variante="chico" color={colores.textoSuave}>
              Preparando las vistas previas…
            </Texto>
          ) : null}
          {!enLinea ? (
            <Texto variante="chico" color={colores.textoSuave}>
              Sin conexión: los archivos se pueden ver cuando vuelvas a estar en línea.
            </Texto>
          ) : null}
          {errorVer || (error && enLinea) ? (
            <View style={estilos.filaError}>
              <Icono nombre="alerta" tamano={16} color={colores.peligro} />
              <Texto role="alert" variante="chico" color={colores.peligro} peso="600" estilo={estilos.flexible} testID="error-adjuntos-detalle">
                {errorVer ?? error?.message}
              </Texto>
            </View>
          ) : null}
        </Seccion>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
  cabecera: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: espacio.s, flexWrap: 'wrap' },
  flexible: { flex: 1, minWidth: 0 },
  descripcion: { gap: espacio.xs },
  adjuntos: { gap: espacio.s },
  adjunto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    padding: espacio.s,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.medio,
    backgroundColor: colores.superficie,
  },
  miniatura: { width: 56, height: 56, borderRadius: radios.chico, backgroundColor: colores.fondo },
  miniaturaIcono: { alignItems: 'center', justifyContent: 'center', backgroundColor: colores.celesteClaro },
  datosAdjunto: { flex: 1, minWidth: 0, gap: 2 },
  filaError: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
});
