# HANDOVER — última sesión (2026-11-07)

**Fase:** F2 (identidad y dirección de arte), pasos 1–3 de §6.1 del plan. La cuña A es provisional (D-F1c y D-F1d). **Rama:** `docs/f2-brief`, con el PR abierto y sin fusionar.

## Hecho en esta sesión: brief de diseño
- `docs/02_DISEÑO_BRIEF.md` (v1.1):
  - **§A, plataforma de marca.** A quién hablamos (cuña A, desde evidencia de mesa sin verificar con personas); personalidad: *cinematográfica, exacta, cómplice* frente a *infantil o artesanal, corporativa o SaaS, ruidosa*; promesa y 3 titulares candidatos.
  - **§B, referencias convertidas en reglas medibles.** kprverse (K1–K8), Immersive Garden (I1–I3), Dropbox Brand (D1–D4), Rijksmuseum (R1–R4) y Bruno Simon (B1–B2), cada una con URL y consultada el 2026-11-07 en el navegador integrado, con cifras de `getComputedStyle`. Incluye las reglas de movimiento (M1–M5), la base que los style tiles deben fijar (B.7) y el uso de las skills (B.8).
  - **§C, anti-lista cerrada** (X1–X21), con cómo se detecta cada punto.
  - **§D, rúbrica cerrada:** anclas 1/3/5 y cómo se mide cada criterio; el criterio 7 (accesibilidad) es una puerta.
- `docs/VOZ.md` (v2): registro, presupuesto de palabras, lista negra, palabras de la cuña y qué reglas del `VOZ.md` de la raíz se anulan. El de la raíz no se toca (regla 3) y sus tests siguen mandando.
- Skills usadas: taste-skill, impeccable, ui-ux-pro-max (sus CSV a mano, porque no hay Python), emil-design-eng y design-motion-principles.
- Revisión independiente: Artisan + Advocate, 13 graves y 13 menores, todos corregidos (`04_DECISIONES` §4).

## Decisiones tomadas en el brief (las confirma Víctor)
- No se usa fuente mono: los datos van en cifras tabulares de Bricolage (K7).
- Firma propia, distinta de KPR: el progreso («T2 E5») como forma tipográfica (K8).
- Chaflán con dos tokens: 14 px en controles y 18 px en portadas; el foco va fuera del recorte.
- Sin desplazamiento secuestrado ni giroscopio. Marcar visto se hace con un toque, y hay «Deshacer».

## Pendiente / ojo
- **Víctor**, puerta de F2 (§E del brief):
  - titular: hecho, «Tus series, al día.» (D-F2a);
  - dar el «sí» o cambios a §A, §B, §C y §D.
- **Sesión siguiente, solo tras ese «sí»:** paso 4, 3 style tiles en HTML (390/1440, sin WebGL, reduced-motion) que resuelvan B.7. Máximo 3 alternativas. Conviene Fable 5.1 u Opus 5.5.
- Deuda para el paso 5: `landing.css:60` (0,5 s) y `:84` (curva fuera de M1); decidir si Figtree sale (X21).
- Squash-merge solo con el OK de Víctor.
- Sigue en pie de sesiones anteriores:
  - prueba de humo F1 (publicar mensajes; cerrar F1 con la decisión);
  - backup del lunes (R10), rotar la contraseña de la base y R9.
- `PLAN_ESTRATEGICO.md`, `docs/auditoria/` y `prototipos/` siguen fuera de git: hacer `git add` solo con rutas explícitas.
