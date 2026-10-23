// Render con los textos reales de messages/es.json (así un texto que falte
// rompe el test en vez de pintar la clave).
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement } from 'react'
import es from '../../../messages/es.json'

export function renderEs(ui: ReactElement) {
  return render(
    <NextIntlClientProvider
      locale="es"
      messages={es}
      onError={(err) => {
        throw err
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  )
}
