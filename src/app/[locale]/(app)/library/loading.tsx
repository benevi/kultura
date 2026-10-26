/**
 * Esqueleto de la Biblioteca con la forma real (DIS-13): mismo ancho de
 * retícula que la página, el h1 (`PageHeading`), los contadores, la fila de
 * filtros y la rejilla uniforme de `MediaGrid` (3/4/5/6 columnas, hueco 12)
 * con el título debajo de cada póster.
 */
export default function LibraryLoading() {
  return (
    <main className="page-grid py-8">
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-10 w-56 md:h-11 bg-surface-elevated rounded-pill mb-6" />

        <div className="flex flex-wrap gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-24 bg-surface-elevated rounded-2xl" />
          ))}
        </div>

        <div className="flex gap-2 overflow-hidden mb-6 pb-6 border-b border-surface-border">
          {[80, 100, 72, 88, 64, 96].map((w, i) => (
            <div key={i} className="h-9 bg-surface-elevated rounded-pill flex-shrink-0" style={{ width: `${w}px` }} />
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] bg-surface-elevated rounded-2xl" />
              <div className="mt-2 h-3.5 w-3/4 bg-surface-elevated rounded-pill" />
              <div className="mt-1.5 h-3 w-1/3 bg-surface-elevated rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
