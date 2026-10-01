// ============================================================
// KULTURA — Tokens F0 para estilos en línea
// ------------------------------------------------------------
// Apuntan a las custom properties REALES de `globals.css`, no a literales
// OKLCH (E-F0-TOKENS-VAR).
//
// Nacieron como literales clavados: este módulo se creó en un worktree
// anterior al re-skin de tokens, cuando `globals.css` y `tailwind.config.ts`
// seguían en la paleta hex antigua y no podían tocarse desde aquella tarea.
// Su propia cabecera decía que, cuando esa migración llegara, las literales
// debían sustituirse por `var(--…)`. Llegó, y durante un tiempo no se hizo:
// trece archivos pintaban con valores clavados, inmunes a cualquier cambio
// de token — exactamente la mezcla de paletas que CLAUDE.md prohíbe.
//
// La sustitución es 1:1 (los literales coincidían exactamente con los valores
// de `globals.css`), así que no cambia un píxel; lo que cambia es que a partir
// de ahora estos trece archivos SIGUEN al sistema de diseño en vez de
// congelar una copia suya.
//
// Son valores CSS, así que `var(--x)` sirve en cualquier sitio donde servía la
// literal: `style={{ background: F0.pink }}`, dentro de un `linear-gradient()`
// interpolado, etc.
//
// Para código NUEVO, preferir las clases de Tailwind (`bg-accent-pink`,
// `text-text-secondary`…). Este objeto es para los estilos en línea que ya
// existen y para los casos en que Tailwind no puede generar la clase.
// ============================================================

export const F0 = {
  bg: 'var(--surface-base)',
  surface: 'var(--surface-default)',
  surface2: 'var(--surface-elevated)',
  stroke: 'var(--surface-border)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  muted: 'var(--text-tertiary)',

  pink: 'var(--accent-pink)',
  lime: 'var(--accent-lime)',
  orange: 'var(--accent-orange)',
  purple: 'var(--accent-purple)',
  blue: 'var(--accent-blue)',
  yellow: 'var(--accent-yellow)',

  onPink: 'var(--on-accent-pink)',
  onLime: 'var(--on-accent-lime)',
  onPurple: 'var(--on-accent-purple)',
} as const
