-- ============================================================
-- KULTURA — Caché persistente de traducciones (E-SINOPSIS-I18N)
--
-- AniList, RAWG y ComicVine solo sirven inglés (ver `src/lib/api/locale.ts`),
-- así que las sinopsis de anime, videojuegos y cómics salían en inglés aunque
-- la app estuviese en español. Traducirlas con el modelo en cada visita sería
-- caro y lento; traducirlas UNA VEZ y compartir el resultado entre todos los
-- usuarios lo convierte en un coste único por título.
--
-- Por eso la tabla NO tiene user_id: el texto traducido de un título es el
-- mismo para todo el mundo. La clave incluye el hash del texto ORIGINAL, de
-- modo que si el proveedor reescribe la sinopsis la entrada vieja deja de
-- casar y se vuelve a traducir sola — sin invalidación manual.
--
-- RLS activo y SIN políticas a propósito: solo la service-role key (server)
-- lee y escribe aquí. No hay nada que un cliente necesite hacer contra esta
-- tabla directamente, y así no puede envenenarla.
--
-- Desplegar el código antes o después de esta migración es seguro: el módulo
-- de traducción captura cualquier error de la tabla y degrada a "sin caché"
-- (traduce igual, solo que sin memoria entre despliegues).
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."media_translations" (
  "cache_key"   "text" PRIMARY KEY,
  "media_id"    "text" NOT NULL,
  "field"       "text" NOT NULL,
  "locale"      "text" NOT NULL,
  "source_hash" "text" NOT NULL,
  "content"     "text" NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT "now"()
);

-- Para poder purgar por título o por idioma sin escanear la tabla entera.
CREATE INDEX IF NOT EXISTS "media_translations_media_id_idx"
  ON "public"."media_translations" ("media_id");

ALTER TABLE "public"."media_translations" ENABLE ROW LEVEL SECURITY;
