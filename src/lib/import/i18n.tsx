'use client'

// ============================================================
// KULTURA — Textos del importador en el navegador (F-26)
//
// El namespace `import` (~8 KB) solo lo necesitan /settings/import y el paso
// opcional de /welcome. En vez de sumarlo a las listas de REN-5 (que lo
// mandarían en el HTML de TODAS las páginas con sesión), la página que monta
// el importador pasa ese subárbol aquí y los componentes lo leen con
// `useImportT()`. Sin `<ImportMessages>` por encima, `useImportT` falla en
// desarrollo en vez de pintar claves sueltas.
// ============================================================

import { createContext, useContext, useMemo } from 'react'
// Tipo solo (se borra al compilar): ningún código de next-intl/use-intl entra
// por aquí; ver `format-message.ts`.
import type { AbstractIntlMessages } from 'next-intl'
import { formatMessage, type MessageValues } from './format-message'

/** Traductor del namespace `import` (se usa igual que el `t` de next-intl). */
export type ImportTranslator = (key: string, values?: MessageValues) => string

const ImportTextContext = createContext<ImportTranslator | null>(null)

/** `"counts.added"` → el texto del subárbol, o `undefined`. */
function lookup(messages: AbstractIntlMessages, key: string): string | undefined {
  let node: unknown = messages
  for (const part of key.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  }
  return typeof node === 'string' ? node : undefined
}

export function ImportMessages({
  locale,
  messages,
  children,
}: {
  locale: string
  /** El subárbol `import` de los mensajes del idioma. */
  messages: AbstractIntlMessages
  children: React.ReactNode
}) {
  const t = useMemo<ImportTranslator>(
    () => (key, values) => {
      const message = lookup(messages, key)
      if (message === undefined) {
        // Como next-intl: la clave a la vista y un aviso, nunca una pantalla rota.
        if (process.env.NODE_ENV !== 'production') console.error(`[import] falta el texto "${key}"`)
        return `import.${key}`
      }
      return formatMessage(message, values, locale)
    },
    [locale, messages]
  )
  return <ImportTextContext.Provider value={t}>{children}</ImportTextContext.Provider>
}

export function useImportT(): ImportTranslator {
  const t = useContext(ImportTextContext)
  if (!t) throw new Error('useImportT necesita <ImportMessages> por encima')
  return t
}

/**
 * Como `useImportT`, pero `null` sin proveedor: para el paso opcional de
 * /welcome, que sin textos del importador simplemente no se pinta.
 */
export function useOptionalImportT(): ImportTranslator | null {
  return useContext(ImportTextContext)
}
