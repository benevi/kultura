-- user_media: lectura solo con sesión iniciada.
--
-- Antes: "user_media_select_public" USING (true) sin rol → cualquiera con la
-- anon key (que va en el JavaScript del cliente) podía descargar la biblioteca
-- y las puntuaciones de todos los usuarios sin cuenta.
--
-- Ahora: solo el rol `authenticated`. Decisión del usuario (16/10/2026): no se
-- cambia nada visible — un usuario con sesión sigue viendo la biblioteca de
-- cualquier perfil. Restringir a dueño + amigos queda como decisión aparte.
--
-- Ninguna ruta pública (fuera de `(app)`) lee user_media; todas las API que la
-- leen exigen sesión.

drop policy if exists "user_media_select_public" on public.user_media;
drop policy if exists "user_media_select_authenticated" on public.user_media;

create policy "user_media_select_authenticated"
  on public.user_media
  for select
  to authenticated
  using (true);
