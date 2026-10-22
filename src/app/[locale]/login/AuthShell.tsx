import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";

/**
 * La tarjeta de auth, literal del artboard Login del canvas "Kultura — Diseño
 * completo": `--surface` sólido, radio 32px, padding 44px y la SOMBRA DURA
 * `10px 10px 0 var(--surface-2)` — la misma de las hero cards de F0.
 *
 * En móvil la sombra baja a 6px (DIS-13): con 10px y el gutter de 16px, a
 * 390px la sombra se comía el margen derecho.
 */
export const AUTH_CARD =
  "w-full rounded-bento-xl bg-surface-default p-7 md:p-11 " +
  "shadow-[6px_6px_0_var(--surface-elevated)] md:shadow-[10px_10px_0_var(--surface-elevated)]";

interface AuthShellProps {
  children: React.ReactNode;
  /** Nombre accesible del enlace "← KULTURA" a la portada. */
  backLabel: string;
  cardClassName?: string;
}

/**
 * Marco común de login y contraseña nueva: enlace de vuelta a la portada
 * (DIS-13) y la tarjeta. El gutter derecho es 6px mayor en móvil para que
 * tarjeta + sombra queden con ≥ 16px a cada lado.
 */
export function AuthShell({ children, backLabel, cardClassName }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-base py-10 pl-4 pr-[22px] md:px-4">
      <div className="w-full max-w-[440px]">
        <Link
          href="/"
          aria-label={backLabel}
          className="mb-2 inline-block py-3 font-body text-[13px] font-bold text-text-tertiary underline-offset-4 transition-colors duration-base ease-standard hover:text-text-primary hover:underline"
        >
          <span aria-hidden="true">← </span>KULTURA
        </Link>
        <div className={cn(AUTH_CARD, cardClassName)}>{children}</div>
      </div>
    </main>
  );
}
