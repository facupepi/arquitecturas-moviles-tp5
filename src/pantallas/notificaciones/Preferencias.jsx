// Tarjeta de preferencias (S7, N2; zonas compartidas con Alarmas, A4): tipos, zonas, frecuencia
// y avisos en este dispositivo. Cada toque se guarda solo; "Guardando…" y "Cambios guardados." se anuncian debajo.
import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Aviso, ErrorCarga, Selector, Tarjeta, Texto } from '../../ui';
import { colores, espacio } from '../../tema/tokens';
import { ETIQUETAS, FRECUENCIAS, ZONAS } from '../../../shared/constantes.mjs';
import { EXPLICACION_FRECUENCIA, TIPOS_CIUDAD, TIPOS_TRAMITES } from './presentacion';
import AvisosDispositivo from './AvisosDispositivo';

const opcionesTipos = (tipos) => tipos.map((t) => ({ valor: t, etiqueta: ETIQUETAS.tipos[t], testID: `tipo-${t}` }));
const OPCIONES_CIUDAD = opcionesTipos(TIPOS_CIUDAD);
const OPCIONES_TRAMITES = opcionesTipos(TIPOS_TRAMITES);
const OPCIONES_ZONAS = ZONAS.map((z) => ({ valor: z, etiqueta: ETIQUETAS.zonas[z] }));
const OPCIONES_FRECUENCIA = FRECUENCIAS.map((f) => ({ valor: f, etiqueta: ETIQUETAS.frecuencias[f] }));

function Grupo({ titulo, children }) {
  return (
    <View style={estilos.grupo}>
      <Texto role="heading" aria-level={3} variante="titulo3">
        {titulo}
      </Texto>
      {children}
    </View>
  );
}

const Preferencias = forwardRef(function Preferencias({ preferencias, guardado, errorPerfil, refTitulo }, ref) {
  const p = guardado.borrador ?? preferencias;
  const cambiar = (parcial) => guardado.guardar({ ...p, ...parcial });

  // Los tipos se eligen en dos grupos sobre la misma lista (cada Selector solo alterna sus opciones).
  // "emergencias" no se ofrece: llega siempre, y se conserva tal como esté guardada.

  const ningunTipo = !p.tipos.some((t) => TIPOS_CIUDAD.includes(t) || TIPOS_TRAMITES.includes(t));

  let estadoGuardado = '';
  if (guardado.fase === 'guardando') estadoGuardado = 'Guardando…';
  else if (guardado.fase === 'guardado') estadoGuardado = 'Cambios guardados.';
  const errorGeneral = guardado.error && !['tipos', 'zonas', 'frecuencia'].includes(guardado.error.campo) ? guardado.error : null;

  return (
    <View ref={ref} testID="preferencias-notificaciones">
      <Tarjeta>
        <Texto ref={refTitulo} role="heading" aria-level={2} tabIndex={-1} variante="titulo2">
          Qué querés recibir
        </Texto>
        <ErrorCarga error={errorPerfil} />

        <Grupo titulo="Cómo te avisamos">
          <AvisosDispositivo />
          <Selector
            etiqueta="Frecuencia"
            valor={p.frecuencia}
            opciones={OPCIONES_FRECUENCIA}
            onCambio={(frecuencia) => cambiar({ frecuencia })}
            error={guardado.errorDe('frecuencia')}
            testID="frecuencia"
          />
          <Texto variante="chico" color={colores.textoSuave} testID="explicacion-frecuencia">
            {EXPLICACION_FRECUENCIA[p.frecuencia]}
          </Texto>
        </Grupo>

        <Grupo titulo="Temas">
          <Selector
            etiqueta="Avisos de la ciudad"
            multiple
            valor={p.tipos}
            opciones={OPCIONES_CIUDAD}
            onCambio={(tipos) => cambiar({ tipos })}
            testID="tipos-ciudad"
          />
          <Selector
            etiqueta="Tus trámites"
            multiple
            valor={p.tipos}
            opciones={OPCIONES_TRAMITES}
            onCambio={(tipos) => cambiar({ tipos })}
            error={guardado.errorDe('tipos')}
            testID="tipos-tramites"
          />
          <Texto variante="chico" color={colores.textoSuave}>
            Las emergencias te llegan siempre, aunque no elijas ningún tema.
          </Texto>
          {ningunTipo ? (
            <Aviso tono="alerta" mensaje="Como no elegiste ningún tema, solo te llegan las emergencias." testID="aviso-sin-tipos" />
          ) : null}
        </Grupo>

        <Grupo titulo="Zonas que seguís">
          <Selector
            etiqueta="Barrios de la ciudad"
            multiple
            valor={p.zonas}
            opciones={OPCIONES_ZONAS}
            onCambio={(zonas) => cambiar({ zonas })}
            error={guardado.errorDe('zonas')}
            testID="zona"
          />
          <Texto variante="chico" color={colores.textoSuave}>
            Son las mismas zonas que seguís en Alarmas. Los avisos para toda la ciudad te llegan igual.
          </Texto>
          {p.zonas.length === 0 ? (
            <Aviso tono="alerta" mensaje="Como no seguís ninguna zona, solo te llegan los avisos para toda la ciudad." testID="aviso-sin-zonas" />
          ) : null}
        </Grupo>

        <View style={errorGeneral || estadoGuardado ? estilos.pie : null}>
          {errorGeneral ? (
            <Texto role="alert" variante="chico" color={colores.peligro} peso="600" testID="error-preferencias">
              No pudimos guardar el cambio. {errorGeneral.message}
            </Texto>
          ) : (
            <Texto role="status" variante="chico" color={colores.textoSuave} testID="estado-preferencias">
              {estadoGuardado}
            </Texto>
          )}
        </View>
      </Tarjeta>
    </View>
  );
});

export default Preferencias;

const estilos = StyleSheet.create({
  grupo: {
    gap: espacio.m,
    paddingTop: espacio.m,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  pie: { paddingTop: espacio.s, borderTopWidth: 1, borderTopColor: colores.borde },
});
