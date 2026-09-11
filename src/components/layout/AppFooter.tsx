import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export async function AppFooter() {
  const t = await getTranslations('nav')
  const tLegal = await getTranslations('legal')

  return (
    <footer className="border-t border-border/40 mt-8">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <span className="font-display text-sm tracking-widest text-muted">KULTURA</span>
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-xs text-muted hover:text-accent-positive transition-colors"
          >
            {tLegal('footerPrivacy')}
          </Link>
          <Link
            href="/terms"
            className="text-xs text-muted hover:text-accent-positive transition-colors"
          >
            {tLegal('footerTerms')}
          </Link>
          <Link
            href="/suggestions"
            className="text-xs text-muted hover:text-accent-positive transition-colors"
          >
            {t('suggestions')}
          </Link>
        </div>
      </div>
    </footer>
  )
}
