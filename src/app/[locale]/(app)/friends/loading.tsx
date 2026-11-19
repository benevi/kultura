// C10: esqueleto de Amigos con la forma de `FriendsClient`: título, tarjeta
// del enlace de invitación, acceso a Grupos, buscador y lista de amigos. El
// pulso solo con `motion-safe`; el texto oculto lo anuncia.
import { getTranslations } from 'next-intl/server'

export default async function FriendsLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid [&>*]:max-w-2xl py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-7 h-9 w-40 md:h-11 rounded-button bg-surface-elevated" />
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4 rounded-bento-xl bg-surface-elevated p-5">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded-button bg-surface-default" />
              <div className="h-3 w-2/3 rounded-button bg-surface-default" />
            </div>
            <div className="h-9 w-12 flex-shrink-0 rounded-full bg-surface-default" />
          </div>
          <div className="h-14 rounded-bento bg-surface-default" />
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-3 h-6 w-44 rounded-button bg-surface-elevated" />
              <div className="flex gap-2">
                <div className="h-11 flex-1 rounded-2xl bg-surface-elevated" />
                <div className="h-11 w-24 flex-shrink-0 rounded-full bg-surface-elevated" />
              </div>
            </section>
            <section>
              <div className="mb-3 h-6 w-36 rounded-button bg-surface-elevated" />
              <div className="flex flex-col gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 rounded-bento bg-surface-default px-[22px] py-4">
                    <div className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-elevated" />
                    <div className="h-3.5 w-32 rounded-button bg-surface-elevated" />
                    <div className="ml-auto h-9 w-24 rounded-full bg-surface-elevated" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
