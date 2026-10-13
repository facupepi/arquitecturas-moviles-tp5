// Pestaña Avisos del panel (S8, N1 y N3): formulario para publicar un aviso municipal. Se valida en
// el cliente con los mismos límites que las reglas, se confirma en un diálogo (el requestId nace al
// abrirlo) y se publica con publicarAviso: aviso + evento en un lote y después el envío del push.
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import { publicarAviso } from '../../datos/repositorio';
import { useComando } from '../../datos/useComando';
import { useAhora } from '../../datos/useAhora';
import { SERVICIOS } from '../../tema/servicios';
import { colores, espacio } from '../../tema/tokens';
import {
  Aviso, Boton, Campo, Dialogo, EtiquetaEstado, FilaDato, Seccion, Selector, Tarjeta, Texto, Vacio,
  useAvisoFlotante,
} from '../../ui';
import { nuevoIdSolicitud } from '../../../shared/dominio.mjs';
import { ETIQUETAS, TIPOS_AVISO, ZONAS } from '../../../shared/constantes.mjs';
import { tiempoPasado } from '../../../shared/formato.mjs';
import { DosColumnas, EstadoEnvio, accionPanel, estilosPanel } from './comun';

const LARGOS = { titulo: 100, cuerpo: 500, detalle: 3000, enlace: 300 };
const SIN_DESTINO = 'ninguno';
const SIN_VENCIMIENTO = 'sin';
const VIGENCIAS = [
  { valor: SIN_VENCIMIENTO, etiqueta: 'Sin vencimiento' },
  { valor: '2', etiqueta: '2 horas' },
  { valor: '12', etiqueta: '12 horas' },
  { valor: '24', etiqueta: '1 día' },
  { valor: '72', etiqueta: '3 días' },
];
const ETIQUETA_VIGENCIA = Object.fromEntries(VIGENCIAS.map((v) => [v.valor, v.etiqueta]));

const VACIO = {
  titulo: '', cuerpo: '', detalle: '', tipo: null, zona: 'todas', destino: SIN_DESTINO, enlace: '', vigencia: SIN_VENCIMIENTO,
};

const OPCIONES_TIPO = TIPOS_AVISO.map((t) => ({ valor: t, etiqueta: ETIQUETAS.tipos[t] ?? t }));
const OPCIONES_ZONA = ['todas', ...ZONAS].map((z) => ({ valor: z, etiqueta: ETIQUETAS.zonas[z] ?? z }));
const OPCIONES_DESTINO = [
  { valor: SIN_DESTINO, etiqueta: 'Sin botón a un servicio' },
  ...SERVICIOS.map((s) => ({ valor: s.ruta, etiqueta: s.nombre })),
];
const NOMBRE_DESTINO = Object.fromEntries(OPCIONES_DESTINO.map((o) => [o.valor, o.etiqueta]));
// En el orden del formulario: el foco va al primero que tenga error.
const CAMPOS = ['titulo', 'cuerpo', 'tipo', 'zona', 'detalle', 'enlace', 'vigencia'];

// Mismos límites que validarAviso del repositorio y que las reglas: el error aparece antes de enviar.
function validar(f) {
  const errores = {};
  const titulo = f.titulo.trim();
  const cuerpo = f.cuerpo.trim();
  const enlace = f.enlace.trim();
  if (titulo.length < 3) errores.titulo = 'Escribí un título de al menos 3 letras.';
  else if (titulo.length > LARGOS.titulo) errores.titulo = `El título puede tener hasta ${LARGOS.titulo} caracteres.`;
  if (cuerpo.length < 10) errores.cuerpo = 'Escribí el aviso con al menos 10 caracteres.';
  else if (cuerpo.length > LARGOS.cuerpo) errores.cuerpo = `El aviso puede tener hasta ${LARGOS.cuerpo} caracteres.`;
  if (f.detalle.trim().length > LARGOS.detalle) errores.detalle = `La información extra puede tener hasta ${LARGOS.detalle} caracteres.`;
  if (!TIPOS_AVISO.includes(f.tipo)) errores.tipo = 'Elegí de qué se trata el aviso.';
  if (!(f.zona === 'todas' || ZONAS.includes(f.zona))) errores.zona = 'Elegí una zona o toda la ciudad.';
  if (enlace && !/^https:\/\/[^\s]{4,300}$/.test(enlace)) errores.enlace = 'El enlace tiene que empezar con https:// (por ejemplo, https://www.sanfrancisco.gov.ar).';
  return errores;
}

function datosParaPublicar(f) {
  return {
    titulo: f.titulo.trim(),
    cuerpo: f.cuerpo.trim(),
    detalle: f.detalle.trim(),
    tipo: f.tipo,
    zona: f.zona,
    destino: f.destino === SIN_DESTINO ? null : `#/${f.destino}`,
    enlace: f.enlace.trim() || null,
    vigenteHoras: f.vigencia === SIN_VENCIMIENTO ? null : Number(f.vigencia),
  };
}

function VistaPrevia({ form }) {
  if (!form.titulo.trim() && !form.cuerpo.trim()) return null;
  return (
    <View style={estilos.vistaPrevia} testID="vista-previa-aviso">
      <Texto variante="antetitulo" color={colores.textoSuave}>Así lo ven los vecinos</Texto>
      <Tarjeta tono={form.tipo === 'emergencias' ? 'alerta' : 'destacada'}>
        <View style={estilosPanel.fila}>
          {form.tipo ? <EtiquetaEstado texto={ETIQUETAS.tipos[form.tipo]} tono="info" /> : null}
          <EtiquetaEstado texto={ETIQUETAS.zonas[form.zona] ?? form.zona} tono="neutro" icono="ubicacion" />
        </View>
        <Texto variante="titulo3">{form.titulo.trim() || 'Título del aviso'}</Texto>
        {form.cuerpo.trim() ? <Texto variante="cuerpo">{form.cuerpo.trim()}</Texto> : null}
      </Tarjeta>
    </View>
  );
}

function UltimosAvisos({ eventosPorId }) {
  const avisos = useMunicipal((s) => s.avisos);
  const ahora = useAhora(30_000);
  const recientes = useMemo(() => avisos.filter((a) => a.tipo !== 'alarmas').slice(0, 5), [avisos]);
  return (
    <Seccion titulo="Últimos avisos publicados">
      {!recientes.length ? (
        <Vacio icono="campana" titulo="Todavía no publicaste avisos" />
      ) : (
        recientes.map((a) => {
          const evento = a.eventoId ? eventosPorId.get(a.eventoId) : null;
          return (
            <Tarjeta key={a.id} testID={`aviso-panel-${a.id}`}>
              <View style={estilosPanel.fila}>
                <EtiquetaEstado texto={ETIQUETAS.tipos[a.tipo] ?? a.tipo} tono={a.tipo === 'emergencias' ? 'alerta' : 'info'} />
                <EtiquetaEstado texto={ETIQUETAS.zonas[a.zona] ?? a.zona} tono="neutro" />
                <Texto variante="chico" color={colores.textoSuave}>
                  {`${tiempoPasado(a.creadoEn, ahora)}${a.autor === 'simulador' ? ' · simulador' : ''}`}
                </Texto>
              </View>
              <Texto variante="cuerpo" peso="700" numberOfLines={2}>{a.titulo}</Texto>
              {evento ? <EstadoEnvio evento={evento} testID={`envio-aviso-${a.id}`} /> : null}
            </Tarjeta>
          );
        })
      )}
    </Seccion>
  );
}

export default function PestanaAvisos({ eventosPorId }) {
  const aviso = useAvisoFlotante();
  const [form, setForm] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState(null);   // { requestId }
  const refs = useRef(Object.fromEntries(CAMPOS.map((c) => [c, React.createRef()]))).current;

  // Lleva el foco y la vista al primer campo con error (en un selector de chips, a su primera opción).
  const enfocarPrimerError = (encontrados) => {
    const campo = CAMPOS.find((c) => encontrados[c]);
    if (!campo) return;
    setTimeout(() => {
      const nodo = refs[campo].current;
      try {
        nodo?.focus?.();
        nodo?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      } catch { /* sin foco en nativo */ }
    }, 0);
  };

  const publicacion = useComando(publicarAviso, {
    ...accionPanel((_, datos) => ({ accion: 'publicar_aviso', tipo: datos?.tipo, zona: datos?.zona })),
    alExito: () => {
      aviso.mostrar('Aviso publicado. Ya lo ven los vecinos en Notificaciones.');
      setConfirmacion(null);
      setForm(VACIO);
      setErrores({});
    },
  });

  const cambiar = (campo) => (valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const revisar = () => {
    const encontrados = validar(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) {
      enfocarPrimerError(encontrados);
      return;
    }
    publicacion.limpiar();
    setConfirmacion({ requestId: nuevoIdSolicitud() });
  };

  const publicar = () => {
    publicacion.ejecutar(datosParaPublicar(form), confirmacion.requestId);
  };

  const cerrar = () => {
    if (publicacion.ocupado) return;
    setConfirmacion(null);
  };

  // Un error de campo que viniera del repositorio se muestra igual debajo del campo.
  const errorDe = (campo) => errores[campo] ?? (publicacion.errorDe(campo === 'vigencia' ? 'vigenteHoras' : campo));
  const hayErrores = Object.values(errores).some(Boolean);

  return (
    <View style={estilos.contenedor}>
      <DosColumnas
        proporcion={[3, 2]}
        principal={(
          <Tarjeta titulo="Publicar un aviso">
            <Texto variante="chico" color={colores.textoSuave}>
              Lo reciben los vecinos que siguen este tipo de aviso y esta zona. Las emergencias les llegan a todos.
            </Texto>
            <Campo
              etiqueta="Título"
              valor={form.titulo}
              onCambio={cambiar('titulo')}
              error={errorDe('titulo')}
              maxLargo={LARGOS.titulo}
              placeholder="Ej.: Corte de agua en zona Sur"
              id="aviso-titulo"
              ref={refs.titulo}
              testID="campo-aviso-titulo"
            />
            <Campo
              etiqueta="Aviso"
              valor={form.cuerpo}
              onCambio={cambiar('cuerpo')}
              error={errorDe('cuerpo')}
              ayuda="Contá qué pasa, dónde y hasta cuándo."
              multilinea
              maxLargo={LARGOS.cuerpo}
              id="aviso-cuerpo"
              ref={refs.cuerpo}
              testID="campo-aviso-cuerpo"
            />
            <Selector
              etiqueta="Tipo de aviso"
              valor={form.tipo}
              opciones={OPCIONES_TIPO}
              onCambio={cambiar('tipo')}
              error={errorDe('tipo')}
              testID="aviso-tipo"
              ref={refs.tipo}
            />
            <Selector
              etiqueta="Zona"
              valor={form.zona}
              opciones={OPCIONES_ZONA}
              onCambio={cambiar('zona')}
              error={errorDe('zona')}
              testID="aviso-zona"
              ref={refs.zona}
            />
            <Campo
              etiqueta="Más información (opcional)"
              valor={form.detalle}
              onCambio={cambiar('detalle')}
              error={errorDe('detalle')}
              ayuda="Se muestra al abrir el aviso."
              multilinea
              maxLargo={LARGOS.detalle}
              id="aviso-detalle"
              ref={refs.detalle}
              testID="campo-aviso-detalle"
            />
            <Selector
              etiqueta="Botón para ir a un servicio de la app (opcional)"
              valor={form.destino}
              opciones={OPCIONES_DESTINO}
              onCambio={cambiar('destino')}
              variante="lista"
              testID="aviso-destino"
            />
            <Campo
              etiqueta="Enlace a una página externa (opcional)"
              valor={form.enlace}
              onCambio={cambiar('enlace')}
              error={errorDe('enlace')}
              placeholder="https://www.sanfrancisco.gov.ar"
              modoTeclado="url"
              maxLargo={LARGOS.enlace}
              id="aviso-enlace"
              ref={refs.enlace}
              testID="campo-aviso-enlace"
            />
            <Selector
              etiqueta="¿Hasta cuándo está vigente?"
              valor={form.vigencia}
              opciones={VIGENCIAS}
              onCambio={cambiar('vigencia')}
              error={errorDe('vigencia')}
              testID="aviso-vigencia"
              ref={refs.vigencia}
            />
            {form.tipo === 'emergencias' && form.vigencia !== SIN_VENCIMIENTO ? (
              <Aviso tono="alerta" mensaje="Mientras esté vigente, la emergencia se muestra en un cartel arriba de todo en la app." />
            ) : null}
            <VistaPrevia form={form} />
            {hayErrores ? (
              <Aviso tono="peligro" rol="alert" mensaje="Revisá los campos marcados antes de publicar." testID="errores-aviso" />
            ) : null}
            <Boton titulo="Revisar y publicar" icono="campana" onPress={revisar} ancho="completo" testID="publicar-aviso" />
          </Tarjeta>
        )}
        lateral={<UltimosAvisos eventosPorId={eventosPorId} />}
      />

      <Dialogo
        visible={!!confirmacion}
        titulo="¿Publicar este aviso?"
        onCerrar={cerrar}
        cerrable={!publicacion.ocupado}
        testID="dialogo-publicar"
        acciones={[
          { titulo: 'Seguir editando', onPress: cerrar, variante: 'secundario', deshabilitado: publicacion.ocupado, testID: 'cancelar-publicacion' },
          { titulo: 'Publicar', onPress: publicar, cargando: publicacion.ocupado, testID: 'confirmar-publicacion' },
        ]}
      >
        <Texto variante="titulo3">{form.titulo.trim()}</Texto>
        <Texto variante="cuerpo">{form.cuerpo.trim()}</Texto>
        <View>
          <FilaDato etiqueta="Tipo" valor={ETIQUETAS.tipos[form.tipo] ?? '—'} />
          <FilaDato etiqueta="Zona" valor={ETIQUETAS.zonas[form.zona] ?? form.zona} />
          <FilaDato etiqueta="Vigencia" valor={ETIQUETA_VIGENCIA[form.vigencia]} />
          <FilaDato etiqueta="Botón a un servicio" valor={form.destino === SIN_DESTINO ? 'No' : NOMBRE_DESTINO[form.destino]} />
          {form.enlace.trim() ? <FilaDato etiqueta="Enlace externo" valor={form.enlace.trim()} /> : null}
        </View>
        <Texto variante="chico" color={colores.textoSuave}>
          Se publica para los vecinos y se envía la notificación. No se puede deshacer.
        </Texto>
        {publicacion.error ? (
          <Aviso tono="peligro" rol="alert" mensaje={publicacion.error.message} testID="error-publicacion" />
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio.l },
  vistaPrevia: { gap: espacio.s },
});
