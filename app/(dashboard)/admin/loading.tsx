export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">

      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-3 w-52 rounded mb-5" style={{ background: 'rgba(140,128,112,0.15)' }} />
      </div>

      {/* Lina card skeleton */}
      <div className="rounded-md p-5 lg:col-span-2" style={{ background: '#FDFAF6', border: '1px solid rgba(140,128,112,0.18)' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full flex-shrink-0" style={{ background: 'rgba(201,168,76,0.2)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-24 rounded" style={{ background: 'rgba(140,128,112,0.15)' }} />
            <div className="h-3.5 w-full rounded" style={{ background: 'rgba(140,128,112,0.12)' }} />
            <div className="h-3.5 w-3/4 rounded" style={{ background: 'rgba(140,128,112,0.09)' }} />
            <div className="flex gap-2 mt-3">
              {[80, 64, 72].map((w, i) => (
                <div key={i} className="h-6 rounded-full" style={{ width: w, background: 'rgba(140,128,112,0.12)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-md p-5" style={{ background: '#FDFAF6', border: '1px solid rgba(140,128,112,0.18)' }}>
            <div className="h-3.5 w-3.5 rounded mb-3" style={{ background: 'rgba(140,128,112,0.2)' }} />
            <div className="h-7 w-10 rounded mb-1" style={{ background: 'rgba(140,128,112,0.15)' }} />
            <div className="h-2.5 w-20 rounded" style={{ background: 'rgba(140,128,112,0.1)' }} />
          </div>
        ))}
      </div>

      {/* Task card skeleton */}
      <div className="rounded-md p-5" style={{ background: '#FDFAF6', border: '1px solid rgba(140,128,112,0.18)' }}>
        <div className="flex justify-between mb-4">
          <div className="h-3 w-40 rounded" style={{ background: 'rgba(140,128,112,0.15)' }} />
          <div className="h-3 w-16 rounded" style={{ background: 'rgba(140,128,112,0.1)' }} />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(140,128,112,0.1)' }}>
              <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: 'rgba(140,128,112,0.15)' }} />
              <div className="h-3 rounded flex-1" style={{ background: 'rgba(140,128,112,0.1)', opacity: 1 - i * 0.15 }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
