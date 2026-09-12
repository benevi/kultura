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

/** Icono de marca: badge redondeado conteniendo 3 formas solapadas y
 * rotadas entre sí (monograma abstracto, no un glifo literal). */
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
        x="7.4" y="3.6" width="14.4" height="8" rx="4"
        fill="var(--accent-lime)"
        transform="rotate(-20 14.6 7.6)"
      />
      <rect
        x="2" y="11.4" width="14.8" height="8.2" rx="4.1"
        fill="var(--accent-pink)"
        transform="rotate(16 9.4 15.5)"
      />
      <circle cx="16.2" cy="16" r="4.4" fill="var(--accent-purple)" />
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
