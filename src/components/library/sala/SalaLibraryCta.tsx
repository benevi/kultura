'use client'

// ============================================================
// KULTURA — SalaLibraryCta (fase 8.5, ficha con `SALA_FICHA`)
// Sin sesión: «Añadir a mi biblioteca» (va a crear la cuenta y vuelve a la
// ficha) y «¿Ya tienes cuenta? Entra». Es de cliente porque `SalaButton`
// con `asChild` necesita ver el enlace que pinta (desde el servidor llegaría
// como referencia de cliente, sin sus props).
// ============================================================

import { Link } from '@/i18n/navigation'
import { SalaButton } from '@/components/sala/SalaButton'

interface SalaLibraryCtaProps {
  registerHref: string
  loginHref: string
  addLabel: string
  hint: string
  loginLabel: string
}

export function SalaLibraryCta({ registerHref, loginHref, addLabel, hint, loginLabel }: SalaLibraryCtaProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <SalaButton
        asChild
        variant="primary"
        icon={
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-5 w-5">
            <path d="M10 4v12M4 10h12" />
          </svg>
        }
      >
        <Link href={registerHref} rel="nofollow">
          {addLabel}
        </Link>
      </SalaButton>
      <p className="sala-type-small max-w-prose text-sala-ink-secondary">
        {hint}{' '}
        <Link
          href={loginHref}
          rel="nofollow"
          className="inline-flex min-h-sala-target items-center whitespace-nowrap text-sala-ink underline underline-offset-4 sala-focused:sala-focus"
        >
          {loginLabel}
        </Link>
      </p>
    </div>
  )
}
