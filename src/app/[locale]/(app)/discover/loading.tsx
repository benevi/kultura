export default function DiscoverLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      {/* Filter bar skeleton */}
      <div className="animate-pulse flex gap-2 mb-6">
        {[80, 60, 72, 56, 68, 64, 76].map((w, i) => (
          <div
            key={i}
            className="h-8 bg-surface-elevated rounded-pill flex-shrink-0"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>

      {/* Media grid skeleton */}
      <div className="animate-pulse grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
        {Array.from({ length: 18 }).map((_, i) => (
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
