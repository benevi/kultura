import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { renderDataAttribution } from '@/components/legal/DataAttribution'

const FOOTER_LINK =
  'inline-flex items-center min-h-11 px-2 rounded-lg text-sm text-text-secondary underline-offset-4 hover:text-text-primary hover:underline transition-colors duration-fast ' +
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring'

/**
 * Pie de la app con sesión. En móvil queda por encima de la `BottomNav`
 * porque el layout pone el relleno inferior en el envoltorio que lo incluye
 * (MOV-6, ROJO-11: la atribución a TMDB y RAWG se ve entera).
 */
export async function AppFooter() {
  const t = await getTranslations('nav')
  const tLegal = await getTranslations('legal')

  return (
    <footer className="border-t-2 border-surface-border mt-8">
      <div className="page-grid pt-2 flex flex-wrap items-center justify-between gap-x-4">
        <span className="font-body text-sm font-bold tracking-widest text-text-tertiary" translate="no">
          KULTURA
        </span>
        <nav aria-label={t('footerNav')}>
          <ul className="flex flex-wrap items-center -mx-2">
            <li>
              <Link href="/privacy" className={FOOTER_LINK}>
                {tLegal('footerPrivacy')}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={FOOTER_LINK}>
                {tLegal('footerTerms')}
              </Link>
            </li>
            <li>
              <Link href="/suggestions" className={FOOTER_LINK}>
                {t('suggestions')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      {await renderDataAttribution('page-grid pt-1 pb-6')}
    </footer>
  )
}
