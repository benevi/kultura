import { SalaLogo } from "@/components/sala/SalaLogo";
import { CONTENIDO, TEXTO, salaButtonClasses } from "@/components/sala/sala-button-classes";
import { SalaChromeAssets } from "./SalaChromeAssets";

/**
 * Cabecera pública en «Sala» (fase 8.5 M2, `SALA_MARCA=1`). La de hoy
 * (`Header`) con el logo D1 y los botones de «Sala»:
 *
 * - Enlaces `<a>` del servidor, sin el `Link` de next-intl ni `SalaButton`
 *   (REN-9: nada de JS de la cabecera con sesión en las páginas públicas). Las
 *   clases del botón salen de `sala-button-classes`.
 * - Cabe en 320 px: por debajo de 400 px va solo el símbolo y los botones
 *   estrechan su relleno.
 * - Sin línea de abajo: la separa del contenido su tono (biblia §1).
 */
export function SalaPublicHeader({ lang, signIn, signUp }: { lang: string; signIn: string; signUp: string }) {
  const compact = "px-3 sm:px-6";
  const label = (text: string) => (
    <span className={CONTENIDO}>
      <span className={TEXTO}>{text}</span>
    </span>
  );

  return (
    <header data-sala-header="" className="sticky top-0 z-50 bg-sala-background text-sala-ink font-sala-text">
      <SalaChromeAssets />
      <div className="page-grid flex h-16 justify-between items-center gap-2">
        <a href={`/${lang}`} className="flex items-center min-h-sala-target shrink-0 text-sala-ink sala-focused:sala-focus">
          <SalaLogo height={24} variant="symbol" className="h-6 w-auto min-[400px]:hidden" />
          <SalaLogo height={24} className="hidden h-6 w-auto min-[400px]:block" />
        </a>
        <nav className="flex items-center gap-2">
          <a href={`/${lang}/login?mode=login`} className={salaButtonClasses("quiet", compact)}>
            {label(signIn)}
          </a>
          <a href={`/${lang}/login?mode=register`} className={salaButtonClasses("primary", compact)}>
            {label(signUp)}
          </a>
        </nav>
      </div>
    </header>
  );
}
