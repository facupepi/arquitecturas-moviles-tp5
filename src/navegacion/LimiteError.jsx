// Límite de errores por pantalla (WP5). Si una pantalla falla al dibujarse o su chunk no se puede
// descargar (sin red, versión vieja), muestra un aviso con "Reintentar" en lugar de una página en
// blanco, y el resto del marco sigue funcionando.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { espacio, medidas } from '../tema/tokens';
import ErrorCarga from '../ui/ErrorCarga';
import { quitarArranque } from '../plataforma/arranque';

export default class LimiteError extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reintentar = this.reintentar.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    quitarArranque(); // si falla el Ingreso, el aviso no puede quedar tapado por la pantalla estática
    if (typeof console !== 'undefined') console.error('Error en la pantalla:', error);
  }

  componentDidUpdate(previas) {
    if (previas.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }

  reintentar() {
    this.setState({ error: null });
    this.props.alReintentar?.();
  }

  render() {
    if (!this.state.error) return this.props.children;
    const sinRed = /fetch|import|chunk|module/i.test(String(this.state.error?.message ?? ''));
    const error = {
      codigo: sinRed ? 'sin-conexion' : 'servidor',
      message: sinRed
        ? 'No se pudo descargar esta pantalla. Revisá tu conexión e intentá de nuevo.'
        : 'Algo falló al mostrar esta pantalla. Intentá de nuevo.',
    };
    return (
      <View style={estilos.caja} testID="pantalla-error">
        <ErrorCarga error={error} onReintentar={this.reintentar} />
      </View>
    );
  }
}

const estilos = StyleSheet.create({
  caja: { padding: medidas.margenLateral, paddingTop: espacio.xl, width: '100%', maxWidth: medidas.anchoMaximo, alignSelf: 'center' },
});
