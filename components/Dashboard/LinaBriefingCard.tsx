'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Package, CheckSquare, RefreshCw, ShoppingCart, Loader2 } from 'lucide-react'
interface BachecaItem { tipo:'scorta'|'task'|'riordine'|'ricorrente'; priorita:number; titolo:string; dettaglio:string }
interface Props { briefingFallback:string; firstName:string; alertCount:number; tasksCount:number; riordiniCount:number; ricorrentiCount:number }

// TTL della cache briefing: 2 ore. Oltre: rigenera.
const BRIEFING_TTL_MS = 2 * 60 * 60 * 1000

export default function LinaBriefingCard({ briefingFallback, firstName, alertCount, tasksCount, riordiniCount, ricorrentiCount }: Props) {
  const [briefing, setBriefing] = useState(briefingFallback)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Cache key: counts + date (giorno). Stesso giorno + stessi counts = stesso briefing.
    const today = new Date().toISOString().slice(0, 10)
    const cacheKey = `lina-briefing:${today}:${alertCount}:${tasksCount}:${riordiniCount}:${ricorrentiCount}`
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) {
        const { text, ts } = JSON.parse(raw)
        if (Date.now() - ts < BRIEFING_TTL_MS && text) {
          setBriefing(text)
          return // skip API call
        }
      }
    } catch {}

    setLoading(true)
    const ctx = [
      alertCount > 0 ? alertCount+' prodotti sotto soglia' : 'magazzino in ordine',
      tasksCount > 0 ? tasksCount+' task aperti' : null,
      riordiniCount > 0 ? riordiniCount+' riordini da evadere' : null,
      ricorrentiCount > 0 ? ricorrentiCount+' azioni ricorrenti in sospeso' : null,
    ].filter(Boolean).join(', ')
    const ctrl = new AbortController()
    fetch('/api/ai/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ messages:[{ role:'user', content:'Briefing del giorno per '+firstName+'. Situazione attuale: '+ctx+'. Scrivi UNA frase di massimo 25 parole, tono caldo e diretto come una brava segretaria. Nessun prefisso, nessun elenco.' }] }),
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(d => {
        if (d.risposta && d.risposta.length < 200) {
          const text = d.risposta.trim()
          setBriefing(text)
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ text, ts: Date.now() })) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertCount, tasksCount, riordiniCount, ricorrentiCount])

  function openLina() { document.dispatchEvent(new CustomEvent('lina:open')) }
  return (
    <div className="card lg:col-span-2 relative overflow-hidden" style={{ background:'linear-gradient(135deg,#3A2E22 0%,#2C2018 100%)', borderColor:'rgba(201,168,76,0.25)' }}>
      <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(201,168,76,0.1),transparent 70%)', pointerEvents:'none' }} />
      <div className="flex items-start gap-4 relative">
        <div style={{ width:52, height:52, borderRadius:'50%', background:'radial-gradient(circle at 38% 38%,#E8C566,#9A7220)', border:'2px solid rgba(201,168,76,0.7)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 0 20px rgba(201,168,76,0.2)' }}>
          <span style={{ fontFamily:'"Cormorant Garamond",Georgia,serif', fontSize:'1.3rem', fontWeight:600, color:'#1A0E04' }}>L</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] mb-2 font-medium" style={{ color:'rgba(201,168,76,0.7)' }}>Lina · Briefing del giorno</p>
          <div className="min-h-[2.5rem] flex items-center gap-2">
            {loading && <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color:'#C9A84C' }} />}
            <p className={"text-sm leading-relaxed transition-opacity duration-300 "+(loading?'opacity-60':'opacity-100')} style={{ color:'#F2EDE4' }}>{briefing}</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {alertCount > 0 && <Link href="/admin/magazzino" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors" style={{ borderColor:'rgba(224,85,69,0.35)', color:'#F87171', background:'rgba(224,85,69,0.12)' }}><Package size={11}/>{alertCount} sotto soglia<ArrowRight size={10}/></Link>}
            {tasksCount > 0 && <Link href="/admin/tasks" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors" style={{ borderColor:'rgba(201,168,76,0.3)', color:'rgba(201,168,76,0.85)', background:'rgba(201,168,76,0.1)' }}><CheckSquare size={11}/>{tasksCount} task<ArrowRight size={10}/></Link>}
            {riordiniCount > 0 && <Link href="/admin/magazzino" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors" style={{ borderColor:'rgba(201,168,76,0.3)', color:'rgba(201,168,76,0.85)', background:'rgba(201,168,76,0.1)' }}><ShoppingCart size={11}/>{riordiniCount} riordini<ArrowRight size={10}/></Link>}
            {ricorrentiCount > 0 && <Link href="/admin/ricorrenti" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors" style={{ borderColor:'rgba(242,237,228,0.12)', color:'rgba(242,237,228,0.45)', background:'rgba(242,237,228,0.05)' }}><RefreshCw size={11}/>{ricorrentiCount} ricorrenti<ArrowRight size={10}/></Link>}
            <button onClick={openLina} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors" style={{ borderColor:'rgba(201,168,76,0.45)', color:'#C9A84C', background:'rgba(201,168,76,0.1)' }}>Chiedi a Lina →</button>
          </div>
        </div>
      </div>
    </div>
  )
}
