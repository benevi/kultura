export default function ProfileLoading() {
  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-10">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 bg-surface-default rounded-card p-6 md:p-8 border border-surface-border flex flex-col gap-4 animate-pulse">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-surface-elevated flex-shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="h-5 w-32 bg-surface-elevated rounded-button" />
              <div className="h-3 w-24 bg-surface-elevated rounded-button" />
            </div>
          </div>
          <div className="h-3 w-3/4 bg-surface-elevated rounded-button" />
          <div className="flex items-center gap-6 pt-2 border-t border-surface-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-7 w-8 bg-surface-elevated rounded-button" />
                <div className="h-3 w-16 bg-surface-elevated rounded-button" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 h-8 w-28 bg-surface-elevated rounded-button animate-pulse" />
      </div>

      {/* Media row skeleton */}
      {[0, 1].map((row) => (
        <section key={row} className="animate-pulse">
          <div className="h-5 w-40 bg-surface-elevated rounded-button mb-3" />
          <div className="flex gap-3 overflow-x-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-24 md:w-32 flex-shrink-0 aspect-[2/3] bg-surface-elevated rounded-card"
              />
            ))}
          </div>
        </section>
      ))}

      {/* Stats grid skeleton */}
      <section className="animate-pulse">
        <div className="h-5 w-32 bg-surface-elevated rounded-button mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface-elevated rounded-card p-4 flex flex-col items-center gap-2"
            >
              <div className="h-7 w-7 bg-surface-base rounded-full" />
              <div className="h-6 w-8 bg-surface-base rounded-button" />
              <div className="h-3 w-12 bg-surface-base rounded-button" />
            </div>
          ))}
        </div>
      </section>

      {/* Genres skeleton */}
      <section className="animate-pulse">
        <div className="h-5 w-36 bg-surface-elevated rounded-button mb-4" />
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
