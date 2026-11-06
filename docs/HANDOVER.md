# HANDOVER — última sesión (2026-11-07)

**Fase:** F1 (`PLAN_ESTRATEGICO.md` §7.3). F0 cerrada el 2026-11-06. **Rama:** `docs/f1-entrevistas` (PR abierto, sin fusionar).

## Hecho en esta sesión
- Entregable: `docs/F1_ENTREVISTAS.md`, el guion «Mom test» para validar las dos cuñas de D2 (A: series y películas en español; B: anime y manga en español). Incluye:
  - perfiles con filtro de 3 preguntas y canales con URL y fecha;
  - mensaje de captación neutro, guion de 20 min y versión en formulario;
  - consentimiento y RGPD;
  - plantilla de notas y criterios de síntesis, con la regla de decisión escrita de antemano.
- Canales comprobados el 2026-11-07:
  - Discord «Club de Anime y Manga en Español» (18.821 miembros).
  - Mediavida: foros `tv`, `cine` y `anime-manga`, más su ayuda de moderación.
  - FilmAffinity no tiene foro público, así que no se capta dentro.
  - Bingers (del cofundador de TV Time, hacia el 4/8/2026; TechCrunch).
- **Sin verificar:** los subreddits, porque Reddit bloquea el acceso automático. Víctor los abre a mano y anota URL, miembros, norma y fecha.
- Descartados: los servidores que reparten anime o series sin licencia (p. ej. «Japan Paw!»).
- Revisión independiente: `04_DECISIONES` §4, con 7 graves y 10 menores, todos corregidos.

## Pendiente / ojo
- Squash-merge del PR: solo con el OK de Víctor (con su OK, auto-merge en verde, D-G1).
- Víctor:
  - pide permiso a la moderación (Discord y Mediavida) antes de publicar la captación;
  - crea el formulario (Tally o Google Forms) según §3;
  - entrevista a 8–10 personas, con al menos 3 en directo por cuña.
- Siguiente sesión de F1, cuando haya 8–10 notas anonimizadas: `docs/F1_SINTESIS.md` con `design:research-synthesis`, codificación ciega por subagente (§6.1, paso 4) y una fila de decisión en `04_DECISIONES` §1.
- Las mini-landings de la prueba de humo (`/es/series` y `/es/anime`) son otro entregable y no se han tocado.
- Sigue en pie de F0: el backup programado del lunes (R10), rotar la contraseña de la base si no se hizo, y R9 (no lanzar `db push` contra producción sin decidir lo de las 2 de push).
- `PLAN_ESTRATEGICO.md` y `docs/auditoria/` siguen fuera de git a propósito: hacer `git add` solo con rutas explícitas.
