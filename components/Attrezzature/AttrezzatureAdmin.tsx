'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Attrezzatura, Manutenzione, StatoAttrezzatura, FrequenzaManutenzione, TipoManutenzione } from '@/types'
import { cn } from '@/lib/utils'
import Toast, { type ToastState } from '@/components/ui/Toast'
import {
  Wrench, Plus, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, XCircle, CalendarDays, ClipboardList,
  Loader2, Pencil, Search, Filter,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

const STATO_CONFIG: Record<StatoAttrezzatura, { label: string; color: string; icon: React.ElementType }> = {
  operativo:       { label: 'Operativo',       color: 'text-green-400 bg-green-400/10 border-green-400/30',  icon: CheckCircle2 },
  in_manutenzione: { label: 'In manutenzione', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',  icon: Clock },
  fuori_servizio:  { label: 'Fuori servizio',  color: 'text-red-400 bg-red-400/10 border-red-400/30',        icon: XCircle },
}

const FREQUENZA_LABELS: Record<FrequenzaManutenzione, string> = {
  mensile:     'Mensile',
  trimestrale: 'Trimestrale',
  semestrale:  'Semestrale',
  annuale:     'Annuale',
}

const TIPO_LABELS: Record<TipoManutenzione, string> = {
  ordinaria:    'Ordinaria',
  straordinaria: 'Straordinaria',
  revisione:    'Revisione',
}

function isScadenzaVicina(data: string | null | undefined): boolean {
  if (!data) return false
  const oggi = new Date()
  const scadenza = new Date(data)
  const diffDays = Math.floor((scadenza.getTime() - oggi.getTime()) / 86400000)
  return diffDays <= 30
}

function isScadenzaSuperata(data: string | null | undefined): boolean {
  if (!data) return false
  return new Date(data) < new Date()
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── componente principale ────────────────────────────────────────────────────

interface Props {
  attrezzature: Attrezzatura[]
}

export default function AttrezzatureAdmin({ attrezzature: initialData }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState<Attrezzatura[]>(initialData)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Attrezzatura | null>(null)
  const [manutFor, setManutFor] = useState<Attrezzatura | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStato, setFiltroStato] = useState('')
  const [search, setSearch] = useState('')

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ message: msg, type })
  }

  function refresh() { startTransition(() => router.refresh()) }

  // ── Aggiungi attrezzatura ────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      nome:                       fd.get('nome'),
      categoria:                  fd.get('categoria'),
      numero_seriale:             fd.get('numero_seriale'),
      fornitore_nome:             fd.get('fornitore_nome'),
      data_acquisto:              fd.get('data_acquisto') || null,
      frequenza_manutenzione:     fd.get('frequenza_manutenzione'),
      data_ultima_manutenzione:   fd.get('data_ultima_manutenzione') || null,
      data_prossima_manutenzione: fd.get('data_prossima_manutenzione') || null,
      stato:                      'operativo',
    }
    const res = await fetch('/api/attrezzature', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { showToast('Errore nel salvataggio', 'error'); return }
    const json = await res.json()
    setItems(prev => [...prev, { ...json.attrezzatura, manutenzioni: [] }])
    setShowAdd(false)
    showToast('Attrezzatura aggiunta')
    refresh()
  }

  // ── Modifica attrezzatura ────────────────────────────────────────────────
  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      nome:                       fd.get('nome'),
      categoria:                  fd.get('categoria'),
      numero_seriale:             fd.get('numero_seriale') || null,
      fornitore_nome:             fd.get('fornitore_nome') || null,
      data_acquisto:              fd.get('data_acquisto') || null,
      frequenza_manutenzione:     fd.get('frequenza_manutenzione'),
      data_prossima_manutenzione: fd.get('data_prossima_manutenzione') || null,
    }
    const res = await fetch(`/api/attrezzature/${editTarget.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { showToast('Errore nel salvataggio', 'error'); return }
    setItems(prev => prev.map(i => i.id === editTarget.id ? { ...i, ...body } as Attrezzatura : i))
    setEditTarget(null)
    showToast('Attrezzatura aggiornata')
    refresh()
  }

  // ── Cambia stato (con rollback ottimistico) ──────────────────────────────
  async function handleStatoChange(id: string, stato: StatoAttrezzatura) {
    const prev = items.find(i => i.id === id)?.stato
    setItems(prev => prev.map(i => i.id === id ? { ...i, stato } : i))
    const res = await fetch(`/api/attrezzature/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato }),
    })
    if (!res.ok) {
      // rollback
      if (prev) setItems(p => p.map(i => i.id === id ? { ...i, stato: prev } : i))
      showToast('Errore aggiornamento stato', 'error')
      return
    }
    showToast(`Stato: ${STATO_CONFIG[stato].label}`)
    refresh()
  }

  // ── Registra manutenzione ────────────────────────────────────────────────
  async function handleManutenzione(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!manutFor) return
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      data:          fd.get('data'),
      tipo:          fd.get('tipo'),
      eseguito_da:   fd.get('eseguito_da'),
      note:          fd.get('note'),
      prossima_data: fd.get('prossima_data') || null,
    }
    const res = await fetch(`/api/attrezzature/${manutFor.id}/manutenzione`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) { showToast('Errore nel salvataggio', 'error'); return }
    const json = await res.json()
    setItems(prev => prev.map(i => {
      if (i.id !== manutFor.id) return i
      return {
        ...i,
        ...json.attrUpdates,
        manutenzioni: [json.manutenzione, ...(i.manutenzioni ?? [])],
      }
    }))
    setManutFor(null)
    showToast('Manutenzione registrata')
    refresh()
  }

  // ── Filtri ───────────────────────────────────────────────────────────────
  const categorieUniche = Array.from(new Set(items.map(i => i.categoria).filter(Boolean)))
  const itemsFiltrati = items.filter(i => {
    if (filtroCategoria && i.categoria !== filtroCategoria) return false
    if (filtroStato && i.stato !== filtroStato) return false
    if (search.trim() && !i.nome.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const scadenzeAlert = items.filter(i =>
    i.stato !== 'fuori_servizio' &&
    (isScadenzaSuperata(i.data_prossima_manutenzione) || isScadenzaVicina(i.data_prossima_manutenzione))
  )

  return (
    <div className="space-y-4">
      {/* Toast standard */}
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      {/* Alert scadenze */}
      {scadenzeAlert.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded bg-amber-400/8 border border-amber-400/25 text-amber-400 text-sm">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            {scadenzeAlert.length === 1
              ? `1 attrezzatura con manutenzione in scadenza o scaduta`
              : `${scadenzeAlert.length} attrezzature con manutenzione in scadenza o scaduta`}
            {': '}
            {scadenzeAlert.map(a => a.nome).join(', ')}
          </span>
        </div>
      )}

      {/* Header azioni + filtri */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <p className="text-stone text-sm">
          {itemsFiltrati.length === items.length
            ? `${items.length} attrezzatur${items.length === 1 ? 'a' : 'e'}`
            : `${itemsFiltrati.length} di ${items.length}`}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca…"
              className="pl-7 pr-3 py-1 text-xs bg-obsidian-light/20 border border-obsidian-light rounded text-cream placeholder:text-stone/40 focus:outline-none focus:border-gold/40 w-36"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="text-xs bg-obsidian-light/20 border border-obsidian-light rounded px-2 py-1 text-stone focus:outline-none focus:border-gold/40"
          >
            <option value="">Tutte le categorie</option>
            {categorieUniche.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filtroStato}
            onChange={e => setFiltroStato(e.target.value)}
            className="text-xs bg-obsidian-light/20 border border-obsidian-light rounded px-2 py-1 text-stone focus:outline-none focus:border-gold/40"
          >
            <option value="">Tutti gli stati</option>
            {(Object.keys(STATO_CONFIG) as StatoAttrezzatura[]).map(s => (
              <option key={s} value={s}>{STATO_CONFIG[s].label}</option>
            ))}
          </select>
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="card text-center py-12 text-stone">
          <Wrench size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessuna attrezzatura registrata.</p>
          <p className="text-xs mt-1 opacity-60">Inizia aggiungendo riuniti, autoclavi, compressori…</p>
        </div>
      ) : itemsFiltrati.length === 0 ? (
        <div className="card text-center py-8 text-stone text-sm">
          Nessuna attrezzatura corrisponde ai filtri selezionati.
          <button onClick={() => { setSearch(''); setFiltroCategoria(''); setFiltroStato('') }}
            className="block mx-auto mt-2 text-xs text-gold hover:text-gold/80 transition-colors">
            Reimposta filtri
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {itemsFiltrati.map(item => {
            const cfg = STATO_CONFIG[item.stato]
            const StatoIcon = cfg.icon
            const isOpen = expanded === item.id
            const scaduta = isScadenzaSuperata(item.data_prossima_manutenzione)
            const vicina = !scaduta && isScadenzaVicina(item.data_prossima_manutenzione)

            return (
              <div key={item.id} className="card overflow-hidden">
                {/* Riga principale */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-cream text-sm">{item.nome}</h3>
                      <span className="text-[10px] text-stone/60 uppercase tracking-widest">{item.categoria}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-stone">
                      {item.numero_seriale && (
                        <span>S/N: <span className="text-cream/70">{item.numero_seriale}</span></span>
                      )}
                      {item.fornitore_nome && (
                        <span>Fornitore: <span className="text-cream/70">{item.fornitore_nome}</span></span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarDays size={11} />
                        Prossima: {' '}
                        <span className={cn(
                          scaduta ? 'text-red-400 font-medium' :
                          vicina ? 'text-amber-400 font-medium' : 'text-cream/70'
                        )}>
                          {formatDate(item.data_prossima_manutenzione)}
                        </span>
                        {scaduta && <AlertTriangle size={10} className="text-red-400" />}
                      </span>
                    </div>
                  </div>

                  {/* Stato + azioni */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1', cfg.color)}>
                      <StatoIcon size={10} />
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => setEditTarget(item)}
                      className="text-[11px] px-2 py-1 rounded border border-stone/20 text-stone/60 hover:text-cream hover:border-stone/40 transition-colors flex items-center gap-1"
                      title="Modifica dati"
                    >
                      <Pencil size={11} />
                      <span className="hidden sm:inline">Modifica</span>
                    </button>
                    <button
                      onClick={() => setManutFor(item)}
                      className="text-[11px] px-2 py-1 rounded border border-gold/25 text-gold/70 hover:bg-gold/10 transition-colors flex items-center gap-1"
                      title="Registra manutenzione"
                    >
                      <Wrench size={11} />
                      <span className="hidden sm:inline">Manutenzione</span>
                    </button>
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="text-stone/50 hover:text-stone transition-colors p-1"
                    >
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Dettaglio espanso */}
                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-obsidian-light space-y-4">
                    {/* Cambio stato rapido */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-stone">Stato:</span>
                      {(['operativo', 'in_manutenzione', 'fuori_servizio'] as StatoAttrezzatura[]).map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatoChange(item.id, s)}
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                            item.stato === s
                              ? STATO_CONFIG[s].color
                              : 'border-obsidian-light text-stone/50 hover:text-stone'
                          )}
                        >
                          {STATO_CONFIG[s].label}
                        </button>
                      ))}
                    </div>

                    {/* Note */}
                    {item.note && (
                      <p className="text-xs text-stone/70 italic">{item.note}</p>
                    )}

                    {/* Storico manutenzioni */}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-stone/50 mb-2 flex items-center gap-1">
                        <ClipboardList size={10} /> Storico manutenzioni
                      </p>
                      {(!item.manutenzioni || item.manutenzioni.length === 0) ? (
                        <p className="text-xs text-stone/40 italic">Nessun intervento registrato.</p>
                      ) : (
                        <div className="space-y-2">
                          {item.manutenzioni.map((m: Manutenzione) => (
                            <div key={m.id} className="text-xs border-l-2 border-obsidian-light pl-3 py-0.5">
                              <div className="flex items-center gap-2 text-cream/80">
                                <span className="font-medium">{formatDate(m.data)}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-obsidian-light text-stone">
                                  {TIPO_LABELS[m.tipo]}
                                </span>
                                {m.eseguito_da && <span className="text-stone">— {m.eseguito_da}</span>}
                              </div>
                              {m.note && <p className="text-stone/60 mt-0.5">{m.note}</p>}
                              {m.prossima_data && (
                                <p className="text-stone/50 mt-0.5">
                                  Prossima: {formatDate(m.prossima_data)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal — Aggiungi attrezzatura */}
      {showAdd && (
        <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-serif text-lg text-cream font-light mb-5">Nuova Attrezzatura</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-field block mb-1">Nome *</label>
                  <input name="nome" required className="input" placeholder="es. Riunito Dentsply 1" />
                </div>
                <div>
                  <label className="label-field block mb-1">Categoria</label>
                  <select name="categoria" className="input">
                    <option value="riunito">Riunito</option>
                    <option value="autoclave">Autoclave</option>
                    <option value="compressore">Compressore</option>
                    <option value="radiologia">Radiologia</option>
                    <option value="strumentazione">Strumentazione</option>
                    <option value="aspirazione">Aspirazione</option>
                    <option value="altro" selected>Altro</option>
                  </select>
                </div>
                <div>
                  <label className="label-field block mb-1">Frequenza manutenzione</label>
                  <select name="frequenza_manutenzione" className="input">
                    <option value="mensile">Mensile</option>
                    <option value="trimestrale">Trimestrale</option>
                    <option value="semestrale">Semestrale</option>
                    <option value="annuale" selected>Annuale</option>
                  </select>
                </div>
                <div>
                  <label className="label-field block mb-1">N° Seriale</label>
                  <input name="numero_seriale" className="input" placeholder="opzionale" />
                </div>
                <div>
                  <label className="label-field block mb-1">Fornitore</label>
                  <input name="fornitore_nome" className="input" placeholder="opzionale" />
                </div>
                <div>
                  <label className="label-field block mb-1">Data acquisto</label>
                  <input name="data_acquisto" type="date" className="input" />
                </div>
                <div>
                  <label className="label-field block mb-1">Ultima manutenzione</label>
                  <input name="data_ultima_manutenzione" type="date" className="input" />
                </div>
                <div className="col-span-2">
                  <label className="label-field block mb-1">Prossima manutenzione</label>
                  <input name="data_prossima_manutenzione" type="date" className="input" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Salvataggio…' : 'Aggiungi'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Modifica attrezzatura */}
      {editTarget && (
        <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-serif text-lg text-cream font-light mb-1">Modifica Attrezzatura</h2>
            <p className="text-stone text-xs mb-5">{editTarget.nome}</p>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-field block mb-1">Nome *</label>
                  <input name="nome" required className="input" defaultValue={editTarget.nome} />
                </div>
                <div>
                  <label className="label-field block mb-1">Categoria</label>
                  <select name="categoria" className="input" defaultValue={editTarget.categoria ?? 'altro'}>
                    <option value="riunito">Riunito</option>
                    <option value="autoclave">Autoclave</option>
                    <option value="compressore">Compressore</option>
                    <option value="radiologia">Radiologia</option>
                    <option value="strumentazione">Strumentazione</option>
                    <option value="aspirazione">Aspirazione</option>
                    <option value="altro">Altro</option>
                  </select>
                </div>
                <div>
                  <label className="label-field block mb-1">Frequenza manutenzione</label>
                  <select name="frequenza_manutenzione" className="input" defaultValue={editTarget.frequenza_manutenzione ?? 'annuale'}>
                    <option value="mensile">Mensile</option>
                    <option value="trimestrale">Trimestrale</option>
                    <option value="semestrale">Semestrale</option>
                    <option value="annuale">Annuale</option>
                  </select>
                </div>
                <div>
                  <label className="label-field block mb-1">N° Seriale</label>
                  <input name="numero_seriale" className="input" defaultValue={editTarget.numero_seriale ?? ''} placeholder="opzionale" />
                </div>
                <div>
                  <label className="label-field block mb-1">Fornitore</label>
                  <input name="fornitore_nome" className="input" defaultValue={editTarget.fornitore_nome ?? ''} placeholder="opzionale" />
                </div>
                <div>
                  <label className="label-field block mb-1">Data acquisto</label>
                  <input name="data_acquisto" type="date" className="input" defaultValue={editTarget.data_acquisto ?? ''} />
                </div>
                <div>
                  <label className="label-field block mb-1">Prossima manutenzione</label>
                  <input name="data_prossima_manutenzione" type="date" className="input" defaultValue={editTarget.data_prossima_manutenzione ?? ''} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                  {saving ? 'Salvataggio…' : 'Salva modifiche'}
                </button>
                <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Registra manutenzione */}
      {manutFor && (
        <div className="fixed inset-0 bg-obsidian/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <h2 className="font-serif text-lg text-cream font-light mb-1">Registra Manutenzione</h2>
            <p className="text-stone text-xs mb-5">{manutFor.nome}</p>
            <form onSubmit={handleManutenzione} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field block mb-1">Data intervento *</label>
                  <input
                    name="data" type="date" required className="input"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div>
                  <label className="label-field block mb-1">Tipo</label>
                  <select name="tipo" className="input">
                    <option value="ordinaria">Ordinaria</option>
                    <option value="straordinaria">Straordinaria</option>
                    <option value="revisione">Revisione</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label-field block mb-1">Eseguito da</label>
                  <input name="eseguito_da" className="input" placeholder="Nome tecnico / ditta" />
                </div>
                <div className="col-span-2">
                  <label className="label-field block mb-1">Note</label>
                  <textarea name="note" className="input resize-none" rows={2} placeholder="Dettagli intervento…" />
                </div>
                <div className="col-span-2">
                  <label className="label-field block mb-1">Prossima manutenzione</label>
                  <input name="prossima_data" type="date" className="input" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                  {saving ? 'Salvataggio…' : 'Registra'}
                </button>
                <button type="button" onClick={() => setManutFor(null)} className="btn-secondary">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
