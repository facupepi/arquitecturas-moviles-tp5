// useAdmin() (WP3, sección 4.5): suscripciones del panel municipal. Solo se monta en
// PanelMunicipal: { reclamos (con uid, últimos 50), eventos (últimos 20), cargando, error }.
import { useEffect, useState } from 'react';
import { suscribirEventos, suscribirReclamosAdmin } from './repositorio';

export function useAdmin() {
  const [estado, setEstado] = useState({ reclamos: [], eventos: [], cargando: true, error: null });

  useEffect(() => {
    let vivo = true;
    const llegaron = { reclamos: false, eventos: false };
    const fijar = (cambios) => { if (vivo) setEstado((previo) => ({ ...previo, ...cambios })); };
    const marcar = (porcion) => {
      llegaron[porcion] = true;
      return llegaron.reclamos && llegaron.eventos ? { cargando: false } : {};
    };
    const fallar = (porcion) => (error) => fijar({ error, ...marcar(porcion) });

    const cancelarReclamos = suscribirReclamosAdmin(50, (reclamos) => fijar({ reclamos, error: null, ...marcar('reclamos') }), fallar('reclamos'));
    const cancelarEventos = suscribirEventos(20, (eventos) => fijar({ eventos, ...marcar('eventos') }), fallar('eventos'));
    return () => {
      vivo = false;
      cancelarReclamos();
      cancelarEventos();
    };
  }, []);

  return estado;
}

export default useAdmin;
