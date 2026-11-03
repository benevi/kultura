// ============================================================
// KULTURA — Logotipo de marca
// Monograma (badge + 3 cromos solapados y rotados) + wordmark `kultura.` en
// minúsculas con el punto ROSA (#ff2d8a, MARCA.md). El wordmark es lo único
// que no cambia con el sistema: sigue en Bricolage Grotesque 700 (subconjunto
// de sus 6 glifos, `font-logo`), no en la display del álbum. Los cromos del
// monograma van en las tintas de imprenta del álbum (rosa, amarillo, cian):
// sin violeta. Todo SVG/JSX en línea, sin assets externos.
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
 * del canvas F0 v2 ("Kultura Editorial"), ver DISENO.md. */
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
        x="3.5" y="4.5" width="12" height="8.2" rx="2"
        fill="var(--album-pink)"
        transform="rotate(-10 9.5 8.6)"
      />
      <rect
        x="8" y="8.5" width="12" height="8.2" rx="2"
        fill="var(--album-yellow)"
        transform="rotate(6 14 12.6)"
      />
      <rect
        x="4" y="12.5" width="12" height="8.2" rx="2"
        fill="var(--album-cyan)"
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
    <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
      <Mark size={size} />
      {/* `whitespace-nowrap`: sin él, en una fila estrecha (cabecera a 320 px)
          el punto final caía a una segunda línea. `translate="no"`: el
          traductor del navegador lo convertía en «cultura» o «culture» (WIG).
          `data-wordmark`: es la marca, no texto de la escala (el recuento de
          tamaños de `type-scale.spec.ts` la deja fuera). */}
      <span
        data-wordmark=""
        translate="no"
        className="font-logo font-bold tracking-tight text-text-primary leading-none whitespace-nowrap"
        style={{ fontSize: size * 0.78 }}
      >
        kultura
        <span
          aria-hidden="true"
          className="inline-block rounded-full bg-album-pink align-baseline"
          style={{
            width: size * 0.17,
            height: size * 0.17,
            marginLeft: size * 0.04,
          }}
        />
      </span>
    </span>
  )
}
