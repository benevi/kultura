export function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-elevated"
    >
      <div className="h-full rounded-pill bg-accent-pink transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}
