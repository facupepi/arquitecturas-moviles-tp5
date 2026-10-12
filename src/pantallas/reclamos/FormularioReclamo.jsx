// Formulario de un reclamo nuevo (R1 y R2). Valida en el cliente con las mismas funciones del
// dominio que replican las reglas y muestra cada error debajo de su campo (UIX-04). Los adjuntos
// se suben a Supabase Storage dentro de crearReclamo, un archivo por solicitud, con progreso.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Aviso, Boton, Campo, Selector, Tarjeta, Texto } from '../../ui';
import { colores, espacio } from '../../tema/tokens';
import { useComando } from '../../datos/useComando';
import { useMunicipal } from '../../datos/almacen';
import { crearReclamo } from '../../datos/repositorio';
import { useConexion } from '../../plataforma/red';
import { elegirArchivos, liberarVistaPrevia, prepararArchivo } from '../../plataforma/archivos';
import { EVENTOS } from '../../firebase/analytics';
import { TRAZAS } from '../../firebase/rendimiento';
import { nuevoIdSolicitud } from '../../../shared/dominio.mjs';
import { LIMITES } from '../../../shared/constantes.mjs';
import Adjuntos from './Adjuntos';
import { CAMPOS, LARGOS, OPCIONES_CATEGORIA, erroresDeReclamo } from './util';

const VACIO = { categoria: '', direccion: '', descripcion: '', estacionId: null };
let contadorAdjuntos = 0;

function MensajeResultado({ resultado, enLinea, onVer, onCerrar }) {
  if (!resultado) return null;
  if (resultado.enCola) {
    return (
      <Aviso
        tono="info"
        icono={enLinea ? 'reloj' : 'sinConexion'}
        titulo={enLinea ? 'Estamos enviando tu reclamo' : 'Guardamos tu reclamo en el teléfono'}
        mensaje={
          enLinea
            ? `Código ${resultado.codigo}.`
            : `Código ${resultado.codigo}. Sin conexión: tu reclamo se enviará cuando vuelvas a estar en línea.`
        }
        onCerrar={onCerrar}
        testID="resultado-reclamo"
      />
    );
  }
  return (
    <Aviso
      tono="exito"
      titulo="Recibimos tu reclamo"
      mensaje={`Código ${resultado.codigo}. Te vamos a avisar cuando cambie de estado.`}
      accion={{ titulo: 'Ver seguimiento', onPress: onVer, testID: 'ver-reclamo-creado' }}
      onCerrar={onCerrar}
      testID="resultado-reclamo"
    />
  );
}

export default function FormularioReclamo({ precarga, onCreado, onVer }) {
  const { enLinea } = useConexion();
  const [datos, setDatos] = useState(VACIO);
  const [archivos, setArchivos] = useState([]);
  const [intentado, setIntentado] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [errorAdjuntos, setErrorAdjuntos] = useState(null);
  const [avisoAdjuntos, setAvisoAdjuntos] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const idSolicitud = useRef(nuevoIdSolicitud());
  // Un reclamo guardado en cola pasa a confirmado cuando el servidor lo recibe: el aviso cambia solo.
  const idResultado = resultado?.id ?? null;
  const pendienteEnServidor = useMunicipal((s) => {
    if (!idResultado) return null;
    const r = s.reclamos.find((x) => x.id === idResultado);
    return r ? r.pendiente : null;
  });
  const resultadoVisible = resultado && resultado.enCola && pendienteEnServidor === false
    ? { ...resultado, enCola: false }
    : resultado;
  const refs = { categoria: useRef(null), direccion: useRef(null), descripcion: useRef(null) };
  const archivosVivos = useRef(archivos);
  archivosVivos.current = archivos;

  const envio = useComando(crearReclamo, {
    evento: EVENTOS?.RECLAMO_CREADO,
    traza: TRAZAS?.ALTA_RECLAMO,
    parametrosEvento: (r, d) => ({
      categoria: d?.categoria,
      adjuntos: d?.archivos?.length ?? 0,
      en_cola: r?.enCola ? 1 : 0,
    }),
  });

  // Precarga de "Reportar problema" en Bicicletas (#/reclamos/nuevo?estacion=b2, B4).
  const clavePrecarga = precarga ? `${precarga.estacionId}|${precarga.direccion}` : '';
  useEffect(() => {
    if (!precarga) return;
    setDatos((d) => ({ ...d, categoria: 'bicicletas', direccion: precarga.direccion, estacionId: precarga.estacionId }));
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePrecarga]);

  // Las miniaturas son URL temporales: se liberan al salir de la pantalla.
  useEffect(() => () => archivosVivos.current.forEach(liberarVistaPrevia), []);

  const errores = intentado ? erroresDeReclamo(datos) : {};
  const errorDe = (campo) => errores[campo] ?? envio.errorDe(campo);
  const cantidadErrores = CAMPOS.filter((c) => errorDe(c)).length;

  const cambiar = (campo) => (valor) => {
    setDatos((d) => {
      const nuevo = { ...d, [campo]: valor };
      // La estación precargada solo tiene sentido en un reclamo de Bicicletas.
      if (campo === 'categoria' && valor !== 'bicicletas') nuevo.estacionId = null;
      return nuevo;
    });
    if (envio.error) envio.limpiar();
    if (resultado) setResultado(null);
  };

  const agregar = useCallback(async () => {
    setErrorAdjuntos(null);
    setAvisoAdjuntos(null);
    if (envio.error?.codigo === 'adjunto-invalido') envio.limpiar();
    const libres = LIMITES.adjuntos - archivosVivos.current.length;
    if (libres <= 0) return;
    let elegidos = [];
    try {
      elegidos = await elegirArchivos({ maximo: libres });
    } catch (e) {
      setErrorAdjuntos(e?.message || 'No se pudo abrir el selector de archivos.');
      return;
    }
    if (!elegidos.length) return;
    if (elegidos.descartados) {
      setAvisoAdjuntos(`Se agregaron ${elegidos.length} de los archivos elegidos: el máximo es ${LIMITES.adjuntos}.`);
    }
    setPreparando(true);
    const listos = [];
    const fallas = [];
    for (const archivo of elegidos) {
      try {
        const preparado = await prepararArchivo(archivo);
        contadorAdjuntos += 1;
        listos.push({ ...preparado, id: `adj-${contadorAdjuntos}` });
      } catch (e) {
        fallas.push(`${archivo.nombre}: ${e?.message || 'no se pudo adjuntar.'}`);
      }
    }
    setArchivos((actuales) => [...actuales, ...listos].slice(0, LIMITES.adjuntos));
    if (fallas.length) setErrorAdjuntos(fallas.join(' '));
    setPreparando(false);
  }, [envio]);

  const quitar = (id) => {
    setArchivos((actuales) => {
      const quitado = actuales.find((a) => a.id === id);
      if (quitado) liberarVistaPrevia(quitado);
      return actuales.filter((a) => a.id !== id);
    });
    setErrorAdjuntos(null);
    setAvisoAdjuntos(null);
    if (envio.error && !envio.error.campo) envio.limpiar();
  };

  const enviar = async () => {
    setIntentado(true);
    setResultado(null);
    const conError = CAMPOS.find((c) => erroresDeReclamo(datos)[c]);
    if (conError) {
      // El foco va al primer campo con error: el navegador lo trae a la vista y el lector lo anuncia.
      setTimeout(() => refs[conError].current?.focus?.(), 0);
      return;
    }
    const pedido = {
      categoria: datos.categoria,
      direccion: datos.direccion,
      descripcion: datos.descripcion,
      estacionId: datos.categoria === 'bicicletas' ? datos.estacionId : null,
      archivos: archivos.map(({ nombre, tipo, tamano, blob }) => ({ nombre, tipo, tamano, blob })),
    };
    const r = await envio.ejecutar(pedido, idSolicitud.current, {
      alProgreso: (i, total) => setProgreso({ i, total }),
    });
    setProgreso(null);
    if (!r) return;
    archivos.forEach(liberarVistaPrevia);
    setArchivos([]);
    setDatos(VACIO);
    setIntentado(false);
    setErrorAdjuntos(null);
    setAvisoAdjuntos(null);
    idSolicitud.current = nuevoIdSolicitud();
    setResultado(r);
    onCreado?.(r);
  };

  const errorGeneral = envio.error && !envio.error.campo && envio.error.codigo !== 'adjunto-invalido' ? envio.error : null;
  const errorDeAdjuntos = errorAdjuntos
    ?? envio.errorDe('adjuntos')
    ?? (envio.error?.codigo === 'adjunto-invalido' ? envio.error.message : null);
  const tituloBoton = progreso
    ? `Subiendo archivos (${progreso.i} de ${progreso.total})…`
    : envio.ocupado
      ? 'Enviando…'
      : 'Enviar reclamo';

  return (
    <Tarjeta testID="formulario-reclamo">
      <View style={estilos.campos}>
        <Selector
          etiqueta="¿Sobre qué es tu reclamo?"
          valor={datos.categoria}
          opciones={OPCIONES_CATEGORIA}
          onCambio={cambiar('categoria')}
          error={errorDe('categoria')}
          ref={refs.categoria}
          testID="campo-categoria"
        />
        {precarga && datos.estacionId === precarga.estacionId ? (
          <Aviso
            tono="info"
            icono="bicicleta"
            mensaje={`Vas a reportar un problema en la ${precarga.nombre}${precarga.referencia ? ` (${precarga.referencia})` : ''}. Contanos qué pasó.`}
            testID="aviso-estacion"
          />
        ) : null}
        <Campo
          id="reclamo-direccion"
          etiqueta="Ubicación"
          valor={datos.direccion}
          onCambio={cambiar('direccion')}
          placeholder="Por ejemplo: Bv. 25 de Mayo 1500"
          ayuda="Calle y altura, una esquina o un lugar conocido."
          error={errorDe('direccion')}
          maxLargo={LARGOS.direccion}
          ref={refs.direccion}
          teclaEnter="next"
          onEnviar={() => refs.descripcion.current?.focus?.()}
          testID="campo-direccion"
        />
        <Campo
          id="reclamo-descripcion"
          etiqueta="Descripción"
          valor={datos.descripcion}
          onCambio={cambiar('descripcion')}
          placeholder="¿Qué pasa y desde cuándo?"
          ayuda="Al menos 10 caracteres."
          error={errorDe('descripcion')}
          ref={refs.descripcion}
          multilinea
          maxLargo={LARGOS.descripcion}
          testID="campo-descripcion"
        />
        <Adjuntos
          archivos={archivos}
          onAgregar={agregar}
          onQuitar={quitar}
          preparando={preparando}
          deshabilitado={envio.ocupado}
          error={errorDeAdjuntos}
          aviso={avisoAdjuntos ?? (!enLinea && archivos.length
            ? 'Para enviar archivos necesitás conexión. Podés quitarlos y enviar el reclamo igual.'
            : null)}
        />
      </View>

      <View style={estilos.envio}>
        <Boton
          titulo={tituloBoton}
          icono="reclamo"
          onPress={enviar}
          cargando={envio.ocupado}
          deshabilitado={preparando}
          ancho="completo"
          testID="enviar-reclamo"
        />
        {progreso ? (
          <Texto role="status" variante="chico" color={colores.textoSuave} alineacion="center" testID="progreso-adjuntos">
            {`Subiendo archivos (${progreso.i} de ${progreso.total})…`}
          </Texto>
        ) : null}
        {cantidadErrores ? (
          <Texto variante="chico" color={colores.peligro} peso="600" alineacion="center" testID="resumen-errores">
            {cantidadErrores === 1 ? 'Revisá el campo marcado arriba.' : `Revisá los ${cantidadErrores} campos marcados arriba.`}
          </Texto>
        ) : null}
        {errorGeneral ? (
          <Aviso
            tono="peligro"
            rol="alert"
            titulo="No pudimos enviar el reclamo"
            mensaje={errorGeneral.message}
            testID="error-envio"
          />
        ) : null}
        <MensajeResultado
          resultado={resultadoVisible}
          enLinea={enLinea}
          onVer={() => resultado && onVer?.(resultado.id)}
          onCerrar={() => setResultado(null)}
        />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  campos: { gap: espacio.l },
  envio: { gap: espacio.s, paddingTop: espacio.s },
});
