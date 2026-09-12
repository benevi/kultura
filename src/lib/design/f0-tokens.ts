// ============================================================
// KULTURA — Tokens F0 (OKLCH), valores literales
// ------------------------------------------------------------
// Copiados 1:1 de CLAUDE.md ("Sistema de diseño — fuente de verdad").
// Este worktree se creó antes de que el commit de re-skin de tokens
// (`[design] Re-skin de tokens a la paleta OKLCH real de F0 v2`,
// rama claude/revision-exhaustiva-proyecto-4mcw94) llegara a esta base —
// `globals.css`/`tailwind.config.ts` siguen en la paleta antigua (hex) y
// no deben tocarse desde esta tarea. Estas constantes son el workaround
// documentado para poder aplicar el criterio visual F0 real (colores
// vivos correctos, no una aproximación) sin migrar esos dos archivos.
//
// Cuando esta rama incorpore esa migración, estas literales deberían
// sustituirse por las custom properties reales (`var(--pink)`, etc.) —
// ver la nota en CLAUDE.md "Cuando esto pase a código".
// ============================================================

export const F0 = {
  bg: 'oklch(16% 0.015 280)',
  surface: 'oklch(21% 0.02 280)',
  surface2: 'oklch(26% 0.025 280)',
  stroke: 'oklch(32% 0.025 280)',
  text: 'oklch(97% 0.004 280)',
  // Intermedio entre `text` y `muted` para jerarquía de dos niveles
  // (mismo criterio que usa el re-skin real en la otra rama).
  textSecondary: 'oklch(76% 0.02 280)',
  muted: 'oklch(68% 0.02 280)',

  pink: 'oklch(68% 0.24 350)',
  lime: 'oklch(83% 0.24 130)',
  orange: 'oklch(72% 0.19 55)',
  purple: 'oklch(62% 0.19 300)',
  blue: 'oklch(68% 0.16 250)',
  yellow: 'oklch(85% 0.17 95)',

  onPink: 'oklch(15% 0.02 350)',
  onLime: 'oklch(18% 0.02 130)',
  onPurple: 'oklch(15% 0.02 300)',
} as const

/** Sombra "pegatina" dura (CLAUDE.md — badge de match, cards feature). */
export const F0_STICKER_SHADOW = '4px 4px 0 rgba(0,0,0,.4)'
