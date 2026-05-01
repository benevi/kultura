# gate-keeper — CHECKLISTS

## Checklist Fase 1 — Fundación

### Técnico
- [ ] `npm run build` pasa sin errores
- [ ] `npm run lint` pasa sin warnings
- [ ] `tsc --noEmit` pasa sin errores TypeScript
- [ ] No hay `any` innecesarios en el código
- [ ] No hay `@ts-ignore` sin justificación

### Supabase / Seguridad
- [ ] RLS activado en TODAS las tablas
- [ ] COMICVINE_KEY no aparece en ningún archivo cliente
- [ ] ANTHROPIC_API_KEY no aparece en ningún archivo cliente
- [ ] SUPABASE_SERVICE_ROLE_KEY no aparece en ningún archivo cliente
- [ ] `.env.local` no está en el repositorio (está en .gitignore)
- [ ] `.env.example` existe con todas las variables documentadas

### Funcionalidad
- [ ] Registro de usuario funciona contra Supabase real
- [ ] Login funciona contra Supabase real
- [ ] El trigger crea perfil automáticamente al registrarse
- [ ] Redirect a /home tras login exitoso
- [ ] Redirect a /login si no hay sesión en rutas protegidas
- [ ] La landing carga correctamente sin login

### Diseño
- [ ] Tema dark aplicado globalmente
- [ ] Fuentes cargando: Bebas Neue, DM Sans, JetBrains Mono
- [ ] Acento rojo #E82020 aplicado correctamente
- [ ] Layout responsivo en móvil (375px) y escritorio (1440px)
- [ ] Grain overlay visible

### i18n
- [ ] `/es` muestra interfaz en español
- [ ] `/en` muestra interfaz en inglés
- [ ] No hay texto hardcodeado en componentes

### Documentación
- [ ] Todos los PROGRESS.md actualizados
- [ ] SCHEMA.md refleja el esquema actual
- [ ] COMPONENTS.md tiene todos los componentes creados documentados
- [ ] Todos los commits son atómicos y con prefijo de agente

---

## Checklist Fase 2 — APIs y contenido

### APIs
- [ ] TMDB: películas y series cargan correctamente
- [ ] Jikan: anime carga correctamente
- [ ] Google Books: libros cargan correctamente
- [ ] Open Library: fallback funciona cuando Google Books falla
- [ ] MangaDex: manga carga correctamente
- [ ] ComicVine: cómics cargan via proxy server-side
- [ ] RAWG: videojuegos cargan correctamente
- [ ] Todas las respuestas normalizadas a MediaItem
- [ ] APIS.md actualizado con todos los endpoints usados

### Funcionalidad
- [ ] Filtros funcionan: género, año, rating mínimo, idioma original
- [ ] Búsqueda global funciona
- [ ] Búsqueda por categoría funciona
- [ ] Autocompletado funciona
- [ ] Página de detalle muestra: sinopsis, rating externo, tráiler embebido
- [ ] Streaming providers aparecen en detalle (películas y series)
- [ ] Tráiler embebido de YouTube funciona
- [ ] Caché en tabla media funcionando

### Técnico
- [ ] `npm run build` pasa sin errores
- [ ] `tsc --noEmit` pasa sin errores
- [ ] No hay API keys expuestas al cliente

---

## Checklist Fase 3 — Biblioteca

- [ ] Marcar estado funciona (completed/in_progress/pending/abandoned)
- [ ] Puntuación 1-5 estrellas funciona
- [ ] Fecha exacta se guarda correctamente
- [ ] Progreso episodios funciona para series y anime
- [ ] Biblioteca personal filtra correctamente
- [ ] Estadísticas: total por tipo correcto
- [ ] Estadísticas: géneros más consumidos correcto
- [ ] Perfil público muestra biblioteca de otros usuarios

---

## Checklist Fase 4 — Social

- [ ] Enlace de invitación genera URL única
- [ ] Aceptar invitación crea amistad correctamente
- [ ] Feed muestra actividad de amigos en tiempo real
- [ ] Recomendar título desde detalle funciona
- [ ] Mensaje opcional se guarda y muestra
- [ ] Listas colaborativas: crear, invitar, añadir títulos
- [ ] Notificaciones: recomendación recibida aparece
- [ ] Notificaciones: invitación a lista aparece
- [ ] Reportes se guardan en BD

---

## Checklist Fase 5 — IA

- [ ] ANTHROPIC_API_KEY solo en server-side
- [ ] PROMPT-001 (si te gustó X) retorna recomendaciones válidas
- [ ] PROMPT-002 (popular en círculo) retorna recomendaciones válidas
- [ ] PROMPT-003 (novedades géneros) retorna recomendaciones válidas
- [ ] PROMPTS.md actualizado con prompts finales
- [ ] Manejo de errores si Claude API falla

---

## Checklist Fase 6 — Pulido

- [ ] i18n completo: todas las claves traducidas (es + en)
- [ ] SEO: metadata dinámica en páginas de detalle
- [ ] next/image usado para todas las imágenes
- [ ] Rate limiting en Route Handlers sensibles
- [ ] Build de producción optimizado
- [ ] Deploy en Vercel funcionando
