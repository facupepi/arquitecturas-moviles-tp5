// Medios de pago de Mi cuenta: las tarjetas de crédito y de débito guardadas (hasta 5), "Agregar
// tarjeta" (diálogo con FormularioTarjeta) y "Quitar" con confirmación. Son los únicos medios de la
// pasarela de Tributos y Estacionamiento.
// Seguridad: de cada tarjeta se guarda tipo, red, últimos 4 dígitos, titular y vencimiento. El
// número completo vive solo en el formulario y se descarta al guardar o cerrar; no se pide el
// código de seguridad.
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import * as repositorio from '../../datos/repositorioTarjetas';
import { useComando } from '../../datos/useComando';
import { colores, espacio, radios } from '../../tema/tokens';
import { Aviso, Boton, Dialogo, ErrorCarga, EtiquetaEstado, Icono, Texto, useAvisoFlotante } from '../../ui';
import { LIMITES } from '../../../shared/constantes.mjs';
import { tarjetaVencida } from '../../../shared/dominio.mjs';
import { textoTarjeta } from '../../../shared/formato.mjs';
import FormularioTarjeta, { NotaSeguridadTarjetas } from '../pagos/FormularioTarjeta';
import { nombreAccesibleTarjeta } from '../pagos/MediosDePago';
import { iconoMedio } from '../pagos/pasarela';
import { useAltaTarjeta } from '../pagos/tarjetas';

const seleccionar = (s) => ({ listo: s.listo, tarjetas: s.tarjetas, error: s.errores?.tarjetas ?? null });

function FilaTarjeta({ tarjeta, onQuitar }) {
  const vencida = tarjetaVencida(tarjeta.vence, Date.now());
  return (
    <View style={estilos.fila} testID={`tarjeta-guardada-${tarjeta.id}`}>
      <View style={estilos.icono}>
        <Icono nombre={iconoMedio(tarjeta.tipo)} tamano={22} color={colores.accionOscuro} />
      </View>
      <View style={estilos.textos}>
        <Texto variante="cuerpo" peso="700">
          {textoTarjeta(tarjeta)}
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          {[tarjeta.titular, `vence ${tarjeta.vence}`].filter(Boolean).join(' · ')}
        </Texto>
        {vencida ? (
          <View style={estilos.etiqueta}>
            <EtiquetaEstado texto="Vencida" tono="peligro" />
          </View>
        ) : null}
      </View>
      <Boton
        titulo="Quitar"
        icono="quitar"
        variante="texto"
        onPress={() => onQuitar(tarjeta)}
        etiquetaAccesible={`Quitar ${nombreAccesibleTarjeta(tarjeta)}`}
        testID={`quitar-${tarjeta.id}`}
      />
    </View>
  );
}

export default function Tarjetas() {
  const { listo, tarjetas, error } = useMunicipal(seleccionar);
  const aviso = useAvisoFlotante();
  const refAgregar = useRef(null);
  const [agregando, setAgregando] = useState(false);
  const [aQuitar, setAQuitar] = useState(null);

  const alta = useAltaTarjeta({
    alGuardar: (t) => {
      setAgregando(false);
      aviso.mostrar({ titulo: 'Tarjeta guardada', cuerpo: `${textoTarjeta(t)} ya está lista para pagar.` });
    },
  });
  const quitar = useComando(repositorio.quitarTarjeta, {
    alExito: () => {
      const quitada = aQuitar;
      setAQuitar(null);
      if (quitada) aviso.mostrar({ titulo: 'Tarjeta quitada', cuerpo: `Quitamos ${textoTarjeta(quitada)}.` });
      // El botón "Quitar" ya no existe: el foco pasa a "Agregar tarjeta".
      setTimeout(() => refAgregar.current?.focus?.(), 50);
    },
  });

  const abrirAlta = () => {
    alta.reiniciar();
    setAgregando(true);
  };
  const cerrarAlta = () => {
    if (alta.ocupado) return;
    alta.reiniciar();   // el número escrito se descarta
    setAgregando(false);
  };
  const cerrarQuitar = () => {
    if (quitar.ocupado) return;
    quitar.limpiar();
    setAQuitar(null);
  };

  const lleno = tarjetas.length >= LIMITES.tarjetas;

  return (
    <View style={estilos.bloque} testID="cuenta-tarjetas">
      {error && !tarjetas.length ? <ErrorCarga error={error} testID="error-tarjetas" /> : null}
      {tarjetas.length ? (
        <View role="list" aria-label="Tarjetas guardadas" style={estilos.lista}>
          {tarjetas.map((t) => (
            <View role="listitem" key={t.id}>
              <FilaTarjeta tarjeta={t} onQuitar={(x) => { quitar.limpiar(); setAQuitar(x); }} />
            </View>
          ))}
        </View>
      ) : listo ? (
        <Texto variante="chico" color={colores.textoSuave} testID="sin-tarjetas">
          Todavía no guardaste tarjetas. Agregá una de crédito o de débito para pagar cedulones y estacionamiento.
        </Texto>
      ) : null}

      {lleno ? (
        <Texto variante="chico" color={colores.textoSuave} testID="tarjetas-tope">
          {`Llegaste al máximo de ${LIMITES.tarjetas} tarjetas. Quitá una para agregar otra.`}
        </Texto>
      ) : (
        <Boton
          ref={refAgregar}
          titulo="Agregar tarjeta"
          icono="mas"
          variante="secundario"
          ancho="completo"
          onPress={abrirAlta}
          testID="agregar-tarjeta"
        />
      )}
      <NotaSeguridadTarjetas />

      <Dialogo
        visible={agregando}
        titulo="Agregar tarjeta"
        onCerrar={cerrarAlta}
        cerrable={!alta.ocupado}
        testID="dialogo-tarjeta"
        pie={alta.errorGeneral && !alta.ocupado ? (
          <Aviso tono="peligro" rol="alert" titulo="No se pudo guardar la tarjeta" mensaje={alta.errorGeneral.message} testID="error-guardar-tarjeta" />
        ) : null}
        acciones={[
          { titulo: 'Cancelar', variante: 'secundario', deshabilitado: alta.ocupado, onPress: cerrarAlta, testID: 'cancelar-tarjeta' },
          {
            titulo: alta.ocupado ? 'Guardando…' : 'Guardar tarjeta',
            cargando: alta.ocupado,
            onPress: alta.enviar,
            testID: 'guardar-tarjeta',
          },
        ]}
      >
        <FormularioTarjeta alta={alta} />
      </Dialogo>

      <Dialogo
        visible={!!aQuitar}
        titulo="¿Quitar esta tarjeta?"
        onCerrar={cerrarQuitar}
        cerrable={!quitar.ocupado}
        testID="dialogo-quitar-tarjeta"
        pie={quitar.error ? (
          <Aviso tono="peligro" rol="alert" mensaje={quitar.error.message} testID="error-quitar-tarjeta" />
        ) : null}
        acciones={[
          { titulo: 'Cancelar', variante: 'secundario', deshabilitado: quitar.ocupado, onPress: cerrarQuitar, testID: 'cancelar-quitar-tarjeta' },
          {
            titulo: quitar.ocupado ? 'Quitando…' : 'Quitar tarjeta',
            variante: 'peligro',
            cargando: quitar.ocupado,
            onPress: () => quitar.ejecutar(aQuitar.id),
            testID: 'confirmar-quitar-tarjeta',
          },
        ]}
      >
        {aQuitar ? (
          <>
            <Texto variante="cuerpo" peso="700">{textoTarjeta(aQuitar)}</Texto>
            <Texto variante="cuerpo">
              Deja de aparecer como medio de pago. Los pagos que ya hiciste con ella no cambian.
            </Texto>
          </>
        ) : null}
      </Dialogo>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: { gap: espacio.m },
  lista: { gap: espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.s,
    paddingLeft: espacio.m,
    paddingRight: espacio.xs,
    borderRadius: radios.medio,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radios.chico,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.celesteClaro,
  },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  etiqueta: { flexDirection: 'row', paddingTop: 2 },
});
