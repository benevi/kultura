// C10: esqueleto de Importar. Sin él heredaría el de `settings/` (tarjetas de
// filas con interruptores, a 640 px), que no se parece a esta página: enlace
// de vuelta, título, introducción, zona de soltar el archivo, la ayuda y la
// tarjeta de exportar a Letterboxd, a 720 px. El pulso solo con `motion-safe`;
// el texto oculto lo anuncia.
import { getTranslations } from 'next-intl/server'

export default async function ImportLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid [&>*]:max-w-[720px] py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="flex flex-col gap-7 motion-safe:animate-pulse">
        <div className="flex flex-col gap-2">
          <div className="flex min-h-[44px] items-center">
            <div className="h-3.5 w-24 rounded-button bg-surface-elevated" />
          </div>
          <div className="h-9 w-56 md:h-11 rounded-button bg-surface-elevated" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-5/6 rounded-button bg-surface-elevated" />
            <div className="h-3.5 w-2/3 rounded-button bg-surface-elevated" />
          </div>
          <div className="flex flex-col items-center gap-3 rounded-bento border-2 border-dashed border-surface-border bg-surface-default px-5 py-8">
            <div className="h-12 w-44 rounded-pill bg-surface-elevated" />
            <div className="h-3.5 w-64 max-w-full rounded-button bg-surface-elevated" />
            <div className="h-3 w-80 max-w-full rounded-button bg-surface-elevated" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="mb-1 h-3 w-32 rounded-button bg-surface-elevated" />
            <div className="h-40 rounded-bento bg-surface-default" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="mb-1 h-3 w-36 rounded-button bg-surface-elevated" />
          <div className="h-32 rounded-bento bg-surface-default" />
        </div>
      </div>
    </main>
  )
}
