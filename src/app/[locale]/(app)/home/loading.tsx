export default function HomeLoading() {
  return (
    <main className="page-grid py-6 md:py-8 space-y-8 md:space-y-10">
      {/* Hero skeleton */}
      <div className="animate-pulse rounded-2xl overflow-hidden bg-surface-elevated aspect-[16/7] w-full" />

      {/* Media row skeleton */}
      {[0, 1, 2].map((row) => (
        <section key={row} className="animate-pulse">
          <div className="h-5 w-40 bg-surface-elevated rounded-button mb-3" />
          <div className="flex gap-3 overflow-x-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-24 md:w-32 flex-shrink-0 aspect-[2/3] bg-surface-elevated rounded-2xl"
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
