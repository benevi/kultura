export default function ProfileLoading() {
  return (
    <main className="page-grid [&>*]:max-w-4xl py-8 flex flex-col gap-10">
      {/* Cabecera con la forma de ProfileHeader (DIS-13): banda de héroe y
          avatar con el radio del perfil montado encima. */}
      <section className="w-full motion-safe:animate-pulse">
        <div className="h-[120px] md:h-[160px] rounded-bento-xl bg-surface-elevated" />
        <div className="flex items-end gap-4 md:gap-5 -mt-10 md:-mt-12 pl-4 md:pl-8">
          <div className="w-[88px] h-[88px] md:w-[110px] md:h-[110px] rounded-bento-xl rounded-bl-lg border-[5px] border-bg bg-surface-default flex-shrink-0" />
          <div className="pb-2.5 flex flex-col gap-2">
            <div className="h-7 w-40 bg-surface-elevated rounded-pill" />
            <div className="h-4 w-24 bg-surface-elevated rounded-pill" />
          </div>
        </div>
      </section>

      {/* Filas de pósteres con el ancho, el hueco y el título de MediaRow. */}
      {[0, 1].map((row) => (
        <section key={row} className="motion-safe:animate-pulse">
          <div className="h-7 w-40 bg-surface-elevated rounded-pill mb-3" />
          <div className="flex gap-5 overflow-x-hidden pb-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="w-28 md:w-36 flex-shrink-0">
                <div className="aspect-[2/3] bg-surface-elevated rounded-2xl" />
                <div className="mt-2 h-3.5 w-3/4 bg-surface-elevated rounded-pill" />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Stats grid skeleton */}
      <section className="animate-pulse">
        <div className="h-5 w-32 bg-surface-elevated rounded-pill mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface-elevated rounded-2xl p-4 flex flex-col items-center gap-2"
            >
              <div className="h-7 w-7 bg-surface-base rounded-full" />
              <div className="h-6 w-8 bg-surface-base rounded-pill" />
              <div className="h-3 w-12 bg-surface-base rounded-pill" />
            </div>
          ))}
        </div>
      </section>

      {/* Genres skeleton */}
      <section className="animate-pulse">
        <div className="h-5 w-36 bg-surface-elevated rounded-pill mb-4" />
        <div className="flex flex-wrap gap-2">
          {[80, 64, 96, 72, 88, 56].map((w, i) => (
            <div
              key={i}
              className="h-7 bg-surface-elevated rounded-full"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
