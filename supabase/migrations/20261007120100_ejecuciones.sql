-- Registro de cada ejecución de las Edge Functions programadas o pedidas por el panel.
-- Sirve de evidencia para el informe y para detectar un índice faltante en producción.
create table if not exists public.ejecuciones (
  id bigint generated always as identity primary key,
  tarea text not null,
  inicio timestamptz not null default now(),
  duracion_ms integer,
  ok boolean not null,
  resultado jsonb
);
alter table public.ejecuciones enable row level security;   -- sin políticas: solo la clave secreta
create index if not exists ejecuciones_inicio_idx on public.ejecuciones (inicio desc);
