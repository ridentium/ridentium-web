'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react'

export default function SOPViewer({ sops }: { sops: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const grouped = sops.reduce((acc: Record<string, any[]>, sop) => {
    const cat = sop.categoria ?? 'Generale'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(sop)
    return acc
  }, {})

  if (sops.length === 0) {
    return (
      <div className="card text-center py-12">
        <BookOpen size={24} className="text-stone mx-auto mb-3" />
        <p className="text-stone text-sm">Nessun protocollo disponibile.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="card">
          <h3 className="text-xs uppercase tracking-widest text-stone mb-4">{cat}</h3>
          <div className="space-y-2">
            {items.map((sop: any) => (
              <div key={sop.id} className="border border-obsidian-light rounded overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-obsidian-light/30 transition-colors"
                  onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}
                >
                  <div className="flex items-center gap-3">
                    {expanded === sop.id
                      ? <ChevronDown size={14} className="text-gold" />
                      : <ChevronRight size={14} className="text-stone" />}
                    <span className="text-sm text-cream font-medium">{sop.titolo}</span>
                    <span className="text-xs text-stone/60">v{sop.versione}</span>
                  </div>
                  <span className="text-xs text-stone">{formatDate(sop.updated_at)}</span>
                </div>
                {expanded === sop.id && (
                  <div className="px-6 py-5 border-t border-obsidian-light bg-obsidian/40">
                    <div className="text-sm text-cream/80 whitespace-pre-wrap leading-relaxed">
                      {sop.contenuto}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
