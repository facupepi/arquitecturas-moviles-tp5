// Inicio de una sesión de estacionamiento (S6, E2): patente, tiempo, importe en vivo y la pasarela
// de pago en el diálogo: elegir una tarjeta guardada (o cargar una ahí mismo) → "Pagar $X" →
// "Procesando el pago…" → "Pago aprobado" con el comprobante; "Listo" cierra y lleva el foco a la sesión nueva. La patente se valida en el cliente con normalizarPatente (la
// misma expresión que las reglas) y el error va debajo del campo; "patente ocupada" también.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colores, espacio, radios, tipografia } from '../../tema/tokens';
import {
  Aviso, Boton, Campo, Dialogo, FilaDato, Icono, Selector, Texto,
} from '../../ui';
import { useComando } from '../../datos/useComando';
import { iniciarEstacionamiento } from '../../datos/repositorio';
import { EVENTOS } from '../../firebase/analytics';
import { TRAZAS } from '../../firebase/rendimiento';
import { comprobante, normalizarPatente, nuevoIdSolicitud } from '../../../shared/dominio.mjs';
import { dinero, fechaHora, hora } from '../../../shared/formato.mjs';
import MediosDePago from '../pagos/MediosDePago';
import Procesando from '../pagos/Procesando';
import ComprobantePago from '../pagos/ComprobantePago';
import AltaEnPago, { dialogoAlta } from '../pagos/AltaEnPago';
import { conProcesamiento, etiquetaMedio, useMedioPago } from '../pagos/pasarela';
import { MS_MINUTO, OPCIONES_MINUTOS, horarioEstricto, importeSeguro, textoMinutos, zonaEnHorario } from './util';

const OPCIONES = OPCIONES_MINUTOS.map((n) => ({ valor: String(n), etiqueta: textoMinutos(n) }));

const MENSAJE_FUERA_DE_HORARIO = 'Esta zona no cobra en este momento. Elegí otra zona o volvé dentro del horario indicado.';

export default function FormularioInicio({ zona, config, ahora, alIniciar, patente: patenteExterna, onPatente }) {
  const [patenteLocal, setPatenteLocal] = useState('');
  const patente = patenteExterna ?? patenteLocal;
  const setPatente = onPatente ?? setPatenteLocal;
  const refPatente = useRef(null);
  const refMedios = useRef(null);
  const medio = useMedioPago();
  const [minutos, setMinutos] = useState('60');
  const [errorPatente, setErrorPatente] = useState(null);
  const [errorBoton, setErrorBoton] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);   // { requestId, patente, minutos, zona, importe }
  const [aprobado, setAprobado] = useState(null);           // { sesion, pago, fecha }: último paso de la pasarela

  // La pasarela muestra "Procesando el pago…" al menos 1,5 s; la traza mide solo el registro.
  const inicio = useComando(conProcesamiento(iniciarEstacionamiento, TRAZAS.INICIO_ESTACIONAMIENTO), {
    evento: EVENTOS.ESTACIONAMIENTO_INICIADO,
    parametrosEvento: (_r, datos) => ({ zona: datos?.zonaId, minutos: datos?.minutos, medio: datos?.tarjeta?.tipo }),
  });

  const min = Number(minutos);
  const importe = zona ? importeSeguro(zona.tarifaHora, min) : null;
  const cobra = zona ? zonaEnHorario(zona, ahora) : false;
  const estricto = horarioEstricto(config);

  // Lleva el foco a la patente: el navegador la trae a la vista (estaba fuera de pantalla, arriba
  // del botón) y el lector anuncia el error que tiene debajo.
  // Con el diálogo abierto se espera a que se cierre y devuelva el foco, para no pisarlo después.
  const enfocarPatente = (demora = 0) => setTimeout(() => refPatente.current?.focus?.(), demora);

  // "Patente ocupada" pertenece al campo: se cierra el diálogo y el error queda debajo de la patente.
  useEffect(() => {
    if (inicio.error?.campo === 'patente') {
      setConfirmacion(null);
      enfocarPatente(400);
    }
  }, [inicio.error]);

  // Al cambiar de zona o de tiempo, el aviso del botón ya no aplica.
  useEffect(() => { setErrorBoton(null); }, [zona?.id, minutos]);

  const cambiarPatente = (texto) => {
    setPatente(texto);
    setErrorPatente(null);
    if (inicio.error) inicio.limpiar();
  };

  const pedirConfirmacion = () => {
    inicio.limpiar();
    setErrorBoton(null);
    let normalizada;
    try {
      normalizada = normalizarPatente(patente);
    } catch (e) {
      setErrorPatente(e.message);
      enfocarPatente();
      return;
    }
    setErrorPatente(null);
    if (!zona) {
      setErrorBoton('Elegí una zona en el mapa o en la lista.');
      return;
    }
    if (estricto && !cobra) {
      setErrorBoton(MENSAJE_FUERA_DE_HORARIO);
      return;
    }
    setPatente(normalizada);
    medio.reiniciar();
    setAprobado(null);
    // El requestId se genera al abrir el diálogo y se reutiliza en los reintentos (sección 0).
    setConfirmacion({ requestId: nuevoIdSolicitud(), patente: normalizada, minutos: min, zona, importe });
  };

  const confirmar = async () => {
    if (!confirmacion) return;
    if (!medio.validar()) {
      setTimeout(() => refMedios.current?.focus?.(), 0);
      return;
    }
    const sesion = await inicio.ejecutar(
      { zonaId: confirmacion.zona.id, patente: confirmacion.patente, minutos: confirmacion.minutos, tarjeta: medio.tarjeta },
      confirmacion.requestId,
    );
    if (!sesion) return;
    // El comprobante muestra el pago registrado (sesion.pago), no la tarjeta elegida ahora: en un
    // reintento del mismo requestId que ya se había cobrado, el vecino pudo haber elegido otra.
    setAprobado({ sesion, pago: sesion.pago ?? null, fecha: sesion.pago?.creadoEn || Date.now() });
  };

  const cerrarConfirmacion = () => {
    if (inicio.ocupado) return;
    const sesion = aprobado?.sesion;
    setConfirmacion(null);
    setAprobado(null);
    inicio.limpiar();
    medio.reiniciar();   // descarta lo que se haya escrito en el alta de tarjeta
    // Con el pago aprobado, el foco pasa al título de la sesión nueva.
    if (sesion) alIniciar?.(sesion);
  };

  let tituloDialogo = 'Confirmá tu estacionamiento';
  let accionesDialogo = [
    { titulo: 'Cancelar', onPress: cerrarConfirmacion, variante: 'secundario', testID: 'cancelar-estacionamiento' },
    {
      titulo: confirmacion?.importe != null ? `Pagar ${dinero(confirmacion.importe)}` : 'Confirmar',
      onPress: confirmar,
      testID: 'confirmar-estacionamiento',
    },
  ];
  const alta = confirmacion && medio.agregando && !inicio.ocupado && !aprobado ? dialogoAlta(medio) : null;
  if (inicio.ocupado) {
    accionesDialogo = [];
  } else if (alta) {
    tituloDialogo = alta.titulo;
    accionesDialogo = alta.acciones;
  } else if (aprobado) {
    tituloDialogo = 'Comprobante de pago';
    accionesDialogo = [{ titulo: 'Listo', onPress: cerrarConfirmacion, testID: 'listo-estacionamiento' }];
  }

  const errorDialogo = inicio.error && inicio.error.campo !== 'patente' ? inicio.error : null;

  return (
    <View style={estilos.formulario}>
      <Campo
        id="campo-patente"
        testID="campo-patente"
        etiqueta="Patente del vehículo"
        valor={patente}
        onCambio={cambiarPatente}
        mayusculas
        maxLargo={10}
        placeholder="AB123CD"
        ayuda="Como figura en la chapa, por ejemplo ABC123 o AB123CD."
        error={errorPatente ?? inicio.errorDe('patente')}
        ref={refPatente}
        teclaEnter="done"
      />

      <Selector
        etiqueta="¿Cuánto tiempo vas a estacionar?"
        valor={minutos}
        opciones={OPCIONES}
        onCambio={setMinutos}
        testID="minutos"
      />

      <View style={estilos.importe} aria-live="polite">
        <View style={estilos.importeTextos}>
          <Texto variante="chico" color={colores.textoSuave}>
            Vas a pagar
          </Texto>
          <Texto variante="numero" testID="importe" estilo={estilos.numero}>
            {importe == null ? '—' : dinero(importe)}
          </Texto>
        </View>
        {zona ? (
          <View style={estilos.importeDetalle}>
            <Texto variante="chico" color={colores.textoSuave}>
              {`${dinero(zona.tarifaHora)} por hora × ${textoMinutos(min)}`}
            </Texto>
            <Texto variante="chico" color={colores.textoSuave}>
              {`Si empezás ahora, termina a las ${hora(ahora + min * MS_MINUTO)}`}
            </Texto>
          </View>
        ) : null}
      </View>

      <View style={estilos.accion}>
        <Boton
          titulo="Iniciar estacionamiento"
          icono="estacionamiento"
          onPress={pedirConfirmacion}
          ancho="completo"
          testID="iniciar-estacionamiento"
        />
        {!errorBoton && (errorPatente || inicio.errorDe('patente')) ? (
          <View style={estilos.errorFila}>
            <Icono nombre="alerta" tamano={16} color={colores.peligro} />
            <Texto variante="chico" peso="600" color={colores.peligro} testID="resumen-error-patente" estilo={estilos.flexible}>
              Revisá la patente, más arriba.
            </Texto>
          </View>
        ) : null}
        {errorBoton ? (
          <View style={estilos.errorFila}>
            <Icono nombre="alerta" tamano={16} color={colores.peligro} />
            <Texto role="alert" variante="chico" peso="600" color={colores.peligro} testID="error-iniciar" estilo={estilos.flexible}>
              {errorBoton}
            </Texto>
          </View>
        ) : null}
      </View>

      <Dialogo
        visible={!!confirmacion}
        titulo={tituloDialogo}
        onCerrar={cerrarConfirmacion}
        cerrable={!inicio.ocupado && !alta?.ocupado}
        testID="dialogo-estacionamiento"
        pie={alta ? alta.pie : errorDialogo && !inicio.ocupado && !aprobado ? (
          <Aviso tono="peligro" rol="alert" titulo="No se pudo iniciar" mensaje={errorDialogo.message} testID="error-estacionamiento" />
        ) : null}
        acciones={accionesDialogo}
      >
        {confirmacion && inicio.ocupado ? (
          <Procesando importe={confirmacion.importe} tarjeta={medio.tarjeta} />
        ) : alta ? (
          <AltaEnPago medio={medio} />
        ) : confirmacion && aprobado ? (
          <ComprobantePago
            enfocar
            numero={comprobante('EST', aprobado.sesion.id)}
            bajada="Tu estacionamiento ya está en curso."
            filas={[
              { etiqueta: 'Patente', valor: aprobado.sesion.patente },
              { etiqueta: 'Zona', valor: aprobado.sesion.zonaNombre ?? confirmacion.zona.nombre },
              { etiqueta: 'Tiempo', valor: textoMinutos(aprobado.sesion.minutos) },
              { etiqueta: 'Termina a las', valor: `${hora(aprobado.sesion.fin)} h` },
              { etiqueta: 'Importe', valor: dinero(aprobado.sesion.importe) },
              { etiqueta: 'Medio de pago', valor: etiquetaMedio(aprobado.pago?.medio, aprobado.pago?.tarjeta), testID: 'comprobante-medio' },
              { etiqueta: 'Fecha y hora', valor: fechaHora(aprobado.fecha) },
            ]}
          />
        ) : confirmacion ? (
          <>
            <View>
              <FilaDato etiqueta="Zona" valor={confirmacion.zona.nombre} />
              <FilaDato etiqueta="Patente" valor={confirmacion.patente} testID="confirmacion-patente" />
              <FilaDato etiqueta="Tiempo" valor={textoMinutos(confirmacion.minutos)} />
              <FilaDato etiqueta="Termina aproximadamente" valor={`${hora(Date.now() + confirmacion.minutos * MS_MINUTO)} h`} />
              <FilaDato etiqueta="Importe" valor={dinero(confirmacion.importe)} testID="confirmacion-importe" />
            </View>
            <MediosDePago ref={refMedios} medio={medio} />
            <Texto variante="chico" color={colores.textoSuave} testID="numero-operacion">
              {`Número de operación: ${comprobante('EST', confirmacion.requestId)}`}
            </Texto>
          </>
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espacio.l },
  importe: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: espacio.s,
    padding: espacio.l,
    borderRadius: radios.medio,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  importeTextos: { gap: 0 },
  numero: { fontFamily: tipografia.familia, color: colores.accionOscuro },
  importeDetalle: { gap: 2, flexShrink: 1 },
  accion: { gap: espacio.s },
  errorFila: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.xs },
  flexible: { flex: 1 },
});
