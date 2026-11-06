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
- **Decisión D-F1 (Víctor, 2026-11-07):** las entrevistas pasan a antes del relanzamiento (F4). F1 se cierra con la prueba de humo y una decisión escrita; con < 30 altas, la cuña es A por §2.2. El riesgo queda en R11 de `04_DECISIONES`.
- Revisión independiente: `04_DECISIONES` §4, con 7 graves y 10 menores, todos corregidos.

## Pendiente / ojo
- Squash-merge del PR: solo con el OK de Víctor (con su OK, auto-merge en verde, D-G1).
- **Siguiente entregable de F1:** las mini-landings de la prueba de humo (`/es/series` y `/es/anime`, con UTM). Después, la decisión escrita de la cuña.
- Entrevistas (D-F1): al final de F3 o al empezar F4. Entonces, pedir permiso a la moderación (Discord y Mediavida), crear el formulario (§3) y hacer 8–10 entrevistas, con al menos 3 en directo por cuña.
- Síntesis, cuando haya 8–10 notas anonimizadas (ya en F4): `docs/F1_SINTESIS.md` con `design:research-synthesis`, codificación ciega por subagente (§6.1, paso 4) y una fila de decisión en `04_DECISIONES` §1.
- Sigue en pie de F0: el backup programado del lunes (R10), rotar la contraseña de la base si no se hizo, y R9 (no lanzar `db push` contra producción sin decidir lo de las 2 de push).
- `PLAN_ESTRATEGICO.md` y `docs/auditoria/` siguen fuera de git a propósito: hacer `git add` solo con rutas explícitas.
