// Render con los textos reales (es/en): un texto que falte o un ICU mal
// escrito rompe el test en vez de pintar la clave.
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

export function renderIntl(ui: ReactElement, locale: 'es' | 'en' = 'es') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'es' ? es : en}
      onError={(err) => {
        throw err
      }}
    >
      {ui}
    </NextIntlClientProvider>
  )
}
