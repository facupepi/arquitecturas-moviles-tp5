// Medios de pago de Mi cuenta: las tarjetas de crédito y de débito guardadas (hasta 5), "Agregar
// tarjeta" (diálogo con FormularioTarjeta) y "Quitar" con confirmación. Son los únicos medios de la
// pasarela de Tributos y Estacionamiento.
// Seguridad: de cada tarjeta se guarda tipo, red, últimos 4 dígitos, titular y vencimiento. El
// número completo y el código de seguridad viven solo en el formulario y se descartan al guardar o
// cerrar.
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMunicipal } from '../../datos/almacen';
import * as repositorio from '../../datos/repositorioTarjetas';
import { useComando } from '../../datos/useComando';
import { colores, cortes, espacio, medidas, radios } from '../../tema/tokens';
import { Aviso, Boton, Dialogo, ErrorCarga, EtiquetaEstado, Icono, Texto, useAvisoFlotante } from '../../ui';
import { conFoco } from '../../ui/comun';
import { LIMITES } from '../../../shared/constantes.mjs';
import { tarjetaVencida } from '../../../shared/dominio.mjs';
import { enmascarada, textoTarjeta } from '../../../shared/formato.mjs';
import FormularioTarjeta from '../pagos/FormularioTarjeta';
import { nombreAccesibleTarjeta } from '../pagos/MediosDePago';
import { iconoMedio } from '../pagos/pasarela';
import { useAltaTarjeta } from '../pagos/tarjetas';

const seleccionar = (s) => ({ listo: s.listo, tarjetas: s.tarjetas, error: s.errores?.tarjetas ?? null });

function FilaTarjeta({ tarjeta, onQuitar }) {
  const { width } = useWindowDimensions();
  const angosta = width < cortes.tableta;
  const vencida = tarjetaVencida(tarjeta.vence, Date.now());
  // "•••• 4242" y "vence 08/30" no se parten entre renglones (los puntos admiten corte después de cada uno).
  const mascara = enmascarada(tarjeta.ultimos4);
  const nombre = textoTarjeta(tarjeta).replace(mascara, '').trim();
  const quitar = () => onQuitar(tarjeta);
  const etiquetaQuitar = `Quitar ${nombreAccesibleTarjeta(tarjeta)}`;
  return (
    <View style={estilos.fila} testID={`tarjeta-guardada-${tarjeta.id}`}>
      <View style={estilos.icono}>
        <Icono nombre={iconoMedio(tarjeta.tipo)} tamano={22} color={colores.accionOscuro} />
      </View>
      <View style={estilos.textos}>
        <Texto variante="cuerpo" peso="700">
          {nombre}
          {mascara ? <Texto variante="cuerpo" peso="700" estilo={estilos.sinCorte}>{` ${mascara}`}</Texto> : null}
        </Texto>
        <Texto variante="chico" color={colores.textoSuave}>
          {tarjeta.titular ? `${tarjeta.titular} · ` : ''}
          <Texto variante="chico" color={colores.textoSuave} estilo={estilos.sinCorte}>{`vence ${tarjeta.vence}`}</Texto>
        </Texto>
        {vencida ? (
          <View style={estilos.etiqueta}>
            <EtiquetaEstado texto="Vencida" tono="peligro" />
          </View>
        ) : null}
      </View>
      {angosta ? (
        // En el celular, solo el ícono: el texto de la tarjeta usa ese ancho.
        <Pressable
          role="button"
          aria-label={etiquetaQuitar}
          onPress={conFoco(quitar)}
          testID={`quitar-${tarjeta.id}`}
          style={({ hovered, pressed }) => [estilos.quitarIcono, (hovered || pressed) && estilos.quitarResaltado]}
        >
          <Icono nombre="quitar" tamano={20} color={colores.accion} />
        </Pressable>
      ) : (
        <Boton
          titulo="Quitar"
          icono="quitar"
          variante="texto"
          onPress={quitar}
          etiquetaAccesible={etiquetaQuitar}
          testID={`quitar-${tarjeta.id}`}
        />
      )}
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
  sinCorte: { whiteSpace: 'nowrap' },
  quitarIcono: {
    width: medidas.toqueMinimo,
    height: medidas.toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pildora,
    cursor: 'pointer',
  },
  quitarResaltado: { backgroundColor: '#eef7fd' },
  etiqueta: { flexDirection: 'row', paddingTop: 2 },
});
