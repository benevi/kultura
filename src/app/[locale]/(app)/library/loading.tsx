/**
 * Esqueleto de la Biblioteca con la forma real (DIS-13): mismo ancho de
 * retícula que la página, el h1 (`PageHeading`), el selector de vista, las
 * pestañas de formato, el resumen por estado y la primera página del álbum
 * con la rejilla de `MediaGrid` (3/4/5/6 columnas, hueco 12): huecos 2:3 con
 * su banda debajo.
 */
export default function LibraryLoading() {
  return (
    <main className="page-grid py-8">
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-10 w-56 md:h-11 bg-surface-elevated rounded-pill mb-6" />
        <div className="h-11 w-60 bg-surface-elevated rounded-lg mb-5" />

        <div className="flex gap-2 overflow-hidden mb-5 pb-2 border-b-2 border-surface-border">
          {[64, 96, 72, 80, 64, 88].map((w, i) => (
            <div key={i} className="h-9 bg-surface-elevated rounded-lg flex-shrink-0" style={{ width: `${w}px` }} />
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 bg-surface-elevated rounded-lg" />
          ))}
        </div>

        <div className="h-7 w-40 bg-surface-elevated rounded-pill mb-4" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] border-2 border-dashed border-slot-line rounded-cromo" />
              <div className="mt-2 h-3.5 w-3/4 bg-surface-elevated rounded-pill" />
              <div className="mt-1.5 h-6 w-full bg-surface-elevated rounded-cromo" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
