// ============================================================
// KULTURA — Logotipo de marca (F6)
// Monograma abstracto propio (badge + 3 formas solapadas/rotadas con los
// acentos decorativos de F7) + wordmark "kultura" en font-display, con un
// cuadradito de color rotado sustituyendo el punto final — detalle
// tipográfico propio en vez de un gradiente/glifo de stock. Todo inline
// SVG/JSX, sin assets externos, mismo criterio que src/components/icons.
// ============================================================

interface LogoProps {
  /** Alto del icono/mark en px. El wordmark escala proporcionalmente. */
  size?: number
  /** 'full' = icono + wordmark (por defecto). 'mark' = solo el icono, para espacios muy estrechos. */
  variant?: 'full' | 'mark'
  className?: string
}

/** Icono de marca: badge redondeado conteniendo 3 rectángulos rotados en
 * cascada (monograma abstracto, no un glifo literal) — geometría literal
 * del canvas F0 v2 ("Kultura Editorial"), ver CLAUDE.md. */
function Mark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="1" y="1" width="22" height="22" rx="7.5" fill="var(--surface-elevated)" />
      <rect
        x="3.5" y="4.5" width="12" height="8.2" rx="3.8"
        fill="var(--accent-pink)"
        transform="rotate(-10 9.5 8.6)"
      />
      <rect
        x="8" y="8.5" width="12" height="8.2" rx="3.8"
        fill="var(--accent-lime)"
        transform="rotate(6 14 12.6)"
      />
      <rect
        x="4" y="12.5" width="12" height="8.2" rx="3.8"
        fill="var(--accent-purple)"
        transform="rotate(-4 10 16.6)"
      />
    </svg>
  )
}

export function Logo({ size = 26, variant = 'full', className = '' }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span className={className}>
        <Mark size={size} />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={size} />
      <span
        className="font-display font-bold tracking-tight text-text-primary leading-none"
        style={{ fontSize: size * 0.78 }}
      >
        kultura
        <span
          aria-hidden="true"
          className="inline-block bg-accent-lime align-middle"
          style={{
            width: size * 0.15,
            height: size * 0.15,
            borderRadius: 3,
            marginLeft: size * 0.06,
            marginBottom: size * 0.02,
            transform: 'rotate(14deg)',
          }}
        />
      </span>
    </span>
  )
}
