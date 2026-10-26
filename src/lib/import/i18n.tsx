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
import { createTranslator, type AbstractIntlMessages } from 'next-intl'

type Values = Record<string, string | number | Date>

/** Traductor del namespace `import` (se usa igual que el `t` de next-intl). */
export type ImportTranslator = (key: string, values?: Values) => string

const ImportTextContext = createContext<ImportTranslator | null>(null)

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
  const t = useMemo<ImportTranslator>(() => {
    const translate = createTranslator({ locale, messages: { import: messages }, namespace: 'import' }) as unknown as (
      key: string,
      values?: Values
    ) => string
    return (key, values) => translate(key, values)
  }, [locale, messages])
  return <ImportTextContext.Provider value={t}>{children}</ImportTextContext.Provider>
}

export function useImportT(): ImportTranslator {
  const t = useContext(ImportTextContext)
  if (!t) throw new Error('useImportT necesita <ImportMessages> por encima')
  return t
}

