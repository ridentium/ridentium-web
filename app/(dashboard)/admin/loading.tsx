const BG = '#221A12'
const BORDER = 'rgba(74,59,44,0.5)'
const S1 = 'rgba(74,59,44,0.35)'
const S2 = 'rgba(74,59,44,0.2)'
const S3 = 'rgba(74,59,44,0.12)'

function Block({ className }: { className?: string }) {
  return <div className={`rounded animate-pulse ${className}`} style={{ background: S1 }} />
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className ?? ''}`} style={{ background: BG, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  )
}

export default function AdminLoading() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <Block className="h-2.5 w-44" />
        <Block className="h-6 w-24" />
      </div>

      {/* Quick actions bar */}
      <div className="flex gap-2">
        {[80, 96, 88, 72, 80].map((w, i) => (
          <div key={i} className="h-9 rounded-lg animate-pulse" style={{ width: w, background: S2, border: `1px solid ${BORDER}` }} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Lina card */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex-shrink-0 animate-pulse" style={{ background: S1 }} />
            <div className="flex-1 space-y-2.5">
              <Block className="h-2.5 w-20" />
              <Block className="h-3.5 w-full" />
              <Block className="h-3.5 w-4/5" />
              <div className="flex gap-2 pt-1">
                {[76, 60, 68].map((w, i) => (
                  <div key={i} className="h-6 rounded-full animate-pulse" style={{ width: w, background: S2 }} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* KPI cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <Block className="h-3.5 w-3.5 mb-3" />
              <Block className="h-8 w-12 mb-1.5" />
              <Block className="h-2.5 w-20 mb-1" />
              <div className="h-2 w-16 rounded animate-pulse" style={{ background: S3 }} />
            </Card>
          ))}
        </div>

        {/* Task + Ricorrenti */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <Block className="h-2.5 w-40" />
            <Block className="h-2.5 w-16" />
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${BORDER}`, opacity: 1 - i * 0.12 }}>
                <div className="w-5 h-5 rounded border animate-pulse flex-shrink-0" style={{ background: S2, borderColor: BORDER }} />
                <Block className="h-3 flex-1" />
                <Block className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  )
}
