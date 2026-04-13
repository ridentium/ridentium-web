export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">

      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-7 w-44 bg-obsidian-light rounded mb-2.5" />
        <div className="h-3.5 w-64 bg-obsidian-light/50 rounded" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-56 bg-obsidian-light/60 rounded" />
        <div className="h-9 w-24 bg-obsidian-light/40 rounded" />
        <div className="h-9 w-24 bg-obsidian-light/40 rounded" />
        <div className="h-9 w-20 bg-obsidian-light/40 rounded ml-auto" />
      </div>

      {/* Table skeleton */}
      <div className="card p-0 overflow-hidden">
        {/* Table header */}
        <div className="flex gap-4 px-4 py-3 border-b border-obsidian-light bg-obsidian-light/20">
          {[48, 28, 20, 12, 12, 8, 8, 16].map((w, i) => (
            <div key={i} className={`h-3 w-${w} bg-obsidian-light rounded shrink-0`}
                 style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        {/* Rows */}
        {[...Array(12)].map((_, i) => (
          <div key={i}
               className="flex items-center gap-4 px-4 py-3.5 border-b border-obsidian-light/30 last:border-0"
               style={{ opacity: 1 - i * 0.06 }}>
            <div className="h-3.5 bg-obsidian-light/50 rounded" style={{ width: '192px' }} />
            <div className="h-3 bg-obsidian-light/35 rounded" style={{ width: '112px' }} />
            <div className="h-3 bg-obsidian-light/35 rounded" style={{ width: '80px' }} />
            <div className="h-3 bg-obsidian-light/25 rounded" style={{ width: '48px' }} />
            <div className="h-3 bg-obsidian-light/25 rounded" style={{ width: '48px' }} />
            <div className="h-3 bg-obsidian-light/40 rounded" style={{ width: '32px' }} />
            <div className="h-3 bg-obsidian-light/25 rounded" style={{ width: '32px' }} />
            <div className="h-5 w-20 bg-obsidian-light/30 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
