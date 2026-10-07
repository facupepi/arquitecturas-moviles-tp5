-- Bucket privado de adjuntos de reclamos (R2). Única declaración del bucket: config.toml no lo repite.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos-reclamos', 'adjuntos-reclamos', false, 2097152,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- Sin políticas sobre storage.objects para este bucket: solo la clave secreta
-- (las Edge Functions) puede leer o escribir. Las descargas usan URLs firmadas de 5 minutos.
