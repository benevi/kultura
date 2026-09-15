-- ============================================================
-- KULTURA — Iconos de personaje para avatares y grupos (E-AVATAR-ICONS)
--
-- `users` solo tenía iniciales + color, y `groups` solo un color de portada,
-- así que no había dónde guardar el personaje que elige el usuario.
--
-- Ambas columnas son NULLABLE a propósito: NULL = sin icono elegido, y la UI
-- cae a las iniciales de siempre. Así las cuentas y grupos que ya existen
-- siguen funcionando sin tocar un solo registro, y desplegar el código antes o
-- después de esta migración no rompe nada.
--
-- La clave que se guarda es la del catálogo de `components/icons/avatars.tsx`
-- (astronaut, robot, cat…). No se valida con un CHECK en base de datos: el
-- catálogo vive en el código y crece con él; un CHECK obligaría a una
-- migración cada vez que se añade un personaje. La validación real está en
-- `isValidAvatarIcon`, en el borde de escritura (API de ajustes y de grupos).
-- ============================================================

ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "avatar_icon" "text";

ALTER TABLE "public"."groups"
  ADD COLUMN IF NOT EXISTS "icon" "text";
