/**
 * Esqueleto de Inicio con la forma real (DIS-13): el héroe «Continuando» con
 * su radio de héroe, su sombra dura y el bloque de imagen a la izquierda en
 * escritorio, y las filas de pósteres con el mismo ancho, hueco y título
 * debajo que `MediaRow`. Al llegar los datos, nada cambia de sitio.
 */
export default function HomeLoading() {
  return (
    <main className="page-grid [&>*]:max-w-4xl py-6 md:py-8 space-y-8 md:space-y-10">
      <div className="motion-safe:animate-pulse flex flex-col md:flex-row overflow-hidden rounded-bento-xl bg-surface-elevated shadow-hard-sm md:shadow-hard">
        <div className="aspect-[16/9] w-full md:aspect-auto md:h-56 md:w-64 lg:w-80 flex-shrink-0 bg-surface-default" />
        <div className="flex flex-1 flex-col gap-3 p-6 md:p-8">
          <div className="h-7 w-2/3 rounded-pill bg-surface-default" />
          <div className="h-4 w-1/3 rounded-pill bg-surface-default" />
          <div className="mt-auto h-11 w-40 rounded-pill bg-surface-default" />
        </div>
      </div>

      {[0, 1, 2].map((row) => (
        <section key={row} className="motion-safe:animate-pulse">
          <div className="h-7 w-40 bg-surface-elevated rounded-pill mb-3" />
          <div className="flex gap-5 overflow-x-hidden pb-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-28 md:w-36 flex-shrink-0">
                <div className="aspect-[2/3] bg-surface-elevated rounded-2xl" />
                <div className="mt-2 h-3.5 w-3/4 bg-surface-elevated rounded-pill" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
