// useAhora(intervaloMs): milisegundos actuales, para temporizadores (WP3, sección 4.1).
import { useEffect, useState } from 'react';

export function useAhora(intervaloMs = 1000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}

export default useAhora;
