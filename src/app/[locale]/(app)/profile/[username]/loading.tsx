// Esqueleto con la forma real del perfil (DIS-13): la tapa (avatar-cromo,
// nombre y cajas de número), dos filas de `ProfileShelf` y las filas por
// formato de `ProfileStats`. Al cargar, nada salta.
export default function ProfileLoading() {
  return (
    <main aria-busy="true" className="page-grid flex flex-col gap-10 py-8 [&>*]:max-w-5xl md:gap-12">
      <section className="flex w-full flex-col gap-5 motion-safe:animate-pulse">
        <div className="flex items-end gap-4 md:gap-6">
          <div className="h-20 w-20 shrink-0 rounded-cromo border-[3px] border-cromo-border bg-surface-elevated md:h-28 md:w-28" />
          <div className="flex flex-col gap-2 pb-1">
            <div className="h-8 w-44 rounded-cromo bg-surface-elevated" />
            <div className="h-4 w-28 rounded-cromo bg-surface-elevated" />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-cromo bg-surface-elevated" />
              <div className="h-4 w-20 rounded-cromo bg-surface-elevated" />
            </div>
          ))}
        </div>
      </section>

      {/* Filas de cromos con el ancho y el hueco de ProfileShelf. */}
      {[0, 1].map((row) => (
        <section key={row} className="flex flex-col gap-4 motion-safe:animate-pulse">
          <div className="h-7 w-40 rounded-cromo bg-surface-elevated" />
          <div className="flex snap-x gap-4 overflow-x-hidden pb-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-28 shrink-0 snap-start md:w-36">
                <div className="aspect-[2/3] rounded-cromo bg-surface-elevated" />
                <div className="mt-2 h-3.5 w-3/4 rounded-cromo bg-surface-elevated" />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Álbum por formato */}
      <section className="motion-safe:animate-pulse">
        <div className="mb-4 h-7 w-36 rounded-cromo bg-surface-elevated" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-bento bg-surface-default" />
          ))}
        </div>
      </section>
    </main>
  )
}
