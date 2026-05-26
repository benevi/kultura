export default function LibraryLoading() {
  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      {/* Filter bar skeleton */}
      <div className="animate-pulse flex flex-col gap-4 mb-6">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-2">
            {[80, 100, 72, 88, 64].map((w, i) => (
              <div
                key={i}
                className="h-8 bg-surface-elevated rounded-pill flex-shrink-0"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Media grid skeleton */}
      <div className="animate-pulse grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="aspect-[2/3] bg-surface-elevated rounded-card" />
            <div className="h-3 w-3/4 bg-surface-elevated rounded-button" />
            <div className="h-3 w-1/2 bg-surface-elevated rounded-button" />
          </div>
        ))}
      </div>
    </main>
  )
}
