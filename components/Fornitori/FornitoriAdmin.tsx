'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fornitore, MagazzinoItem, CanaleOrdine } from '@/types'
import { Plus, Trash2, MessageCircle, Mail, Globe, Phone, Edit2, Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'

interface Props {
  fornitori: Fornitore[]
  magazzino: MagazzinoItem[]
  currentUserId: string
  currentUserNome: string
}

const CANALE_LABEL: Record<CanaleOrdine, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  eshop: 'Eshop',
  telefono: 'Telefono',
}

const CANALE_ICON: Record<CanaleOrdine, React.ReactNode> = {
  whatsapp: <MessageCircle size={13} />,
  email: <Mail size={13} />,
  eshop: <Globe size={13} />,
  telefono: <Phone size={13} />,
}

const CANALE_COLOR: Record<CanaleOrdine, string> = {
  whatsapp: 'text-green-400 bg-green-500/10 border-green-500/30',
  email: 'text-gold bg-gold/10 border-gold/30',
  eshop: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  telefono: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
}

export default function FornitoriAdmin({ fornitori, magazzino, currentUserId, currentUserNome }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form nuovo fornitore
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [canale, setCanale] = useState<CanaleOrdine>('whatsapp')
  const [telefono, setTelefono] = useState('')
  const [emailVal, setEmailVal] = useState('')
  const [sitoEshop, setSitoEshop] = useState('')
  const [note, setNote] = useState('')

  // Editing inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<Fornitore>>({})

  function resetForm() {
    setNome(''); setCanale('whatsapp'); setTelefono('')
    setEmailVal(''); setSitoEshop(''); setNote('')
    setShowForm(false)
  }

  async function addFornitore() {
    if (!nome.trim()) return
    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      canale_ordine: canale,
      note: note.trim() || null,
    }
    if (canale === 'whatsapp' || canale === 'telefono') payload.telefono = telefono.trim() || null
    if (canale === 'email') payload.email = emailVal.trim() || null
    if (canale === 'eshop') payload.sito_eshop = sitoEshop.trim() || null

    await supabase.from('fornitori').insert(payload)
    await logActivity(currentUserId, currentUserNome, 'Fornitore aggiunto', nome.trim(), 'fornitori')
    resetForm()
    startTransition(() => router.refresh())
  }

  function startEdit(f: Fornitore) {
    setEditingId(f.id)
    setEditFields({
      nome: f.nome,
      canale_ordine: f.canale_ordine,
      telefono: f.telefono ?? '',
      email: f.email ?? '',
      sito_eshop: f.sito_eshop ?? '',
      note: f.note ?? '',
    })
  }

  async function saveEdit(f: Fornitore) {
    await supabase.from('fornitori').update({
      nome: editFields.nome,
      canale_ordine: editFields.canale_ordine,
      telefono: editFields.telefono || null,
      email: editFields.email || null,
      sito_eshop: editFields.sito_eshop || null,
      note: editFields.note || null,
    }).eq('id', f.id)
    await logActivity(currentUserId, currentUserNome,
      'Fornitore modificato', editFields.nome ?? f.nome, 'fornitori')
    setEditingId(null)
    startTransition(() => router.refresh())
  }

  async function deleteFornitore(f: Fornitore) {
    if (!confirm(`Eliminare il fornitore "${f.nome}"?`)) return
    await supabase.from('fornitori').delete().eq('id', f.id)
    await logActivity(currentUserId, currentUserNome, 'Fornitore eliminato', f.nome, 'fornitori')
    startTransition(() => router.refresh())
  }

  function getContactInfo(f: Fornitore): string {
    const c = f.canale_ordine ?? 'whatsapp'
    if (c === 'whatsapp' || c === 'telefono') return f.telefono ?? '—'
    if (c === 'email') return f.email ?? '—'
    if (c === 'eshop') return f.sito_eshop ?? '—'
    return '—'
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-stone text-sm">{fornitori.length} fornitore{fornitori.length !== 1 ? 'i' : ''}</p>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus size={13} /> Aggiungi fornitore
        </button>
      </div>

      {/* Form nuovo fornitore */}
      {showForm && (
        <div className="card space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Nuovo fornitore</h3>

          <input className="input" placeholder="Nome fornitore *" value={nome} onChange={e => setNome(e.target.value)} />

          {/* Canale ordine */}
          <div>
            <label className="text-xs text-stone mb-1.5 block">Canale di ordine</label>
            <div className="grid grid-cols-4 gap-2">
              {(['whatsapp', 'email', 'eshop', 'telefono'] as CanaleOrdine[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCanale(c)}
                  className={`flex flex-col items-center gap-1.5 py-2.5 rounded border text-xs transition-colors ${
                    canale === c
                      ? CANALE_COLOR[c]
                      : 'border-obsidian-light/40 text-stone hover:text-cream'
                  }`}
                >
                  {CANALE_ICON[c]}
                  {CANALE_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Campi condizionali */}
          {(canale === 'whatsapp' || canale === 'telefono') && (
            <input className="input" placeholder="Telefono (es. +39 333 1234567)" value={telefono} onChange={e => setTelefono(e.target.value)} />
          )}
          {canale === 'email' && (
            <input className="input" type="email" placeholder="Email fornitore" value={emailVal} onChange={e => setEmailVal(e.target.value)} />
          )}
          {canale === 'eshop' && (
            <input className="input" type="url" placeholder="URL eshop (es. https://store.neodent.com)" value={sitoEshop} onChange={e => setSitoEshop(e.target.value)} />
          )}

          <input className="input" placeholder="Note (opzionale)" value={note} onChange={e => setNote(e.target.value)} />

          <div className="flex gap-3">
            <button onClick={addFornitore} className="btn-primary text-xs" disabled={!nome.trim()}>Salva</button>
            <button onClick={resetForm} className="btn-secondary text-xs">Annulla</button>
          </div>
        </div>
      )}

      {/* Lista fornitori */}
      {fornitori.length === 0 ? (
        <div className="card text-center py-10">
          <Phone size={24} className="text-stone mx-auto mb-3" />
          <p className="text-stone text-sm">Nessun fornitore configurato</p>
          <p className="text-stone/60 text-xs mt-1">Aggiungi i tuoi fornitori per usare la funzione ordini</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {fornitori.map(f => {
            const isEditing = editingId === f.id
            const c = f.canale_ordine ?? 'whatsapp'

            if (isEditing) {
              const editCanale = editFields.canale_ordine ?? 'whatsapp'
              return (
                <div key={f.id} className="px-5 py-4 border-b border-obsidian-light/40 last:border-0 space-y-3">
                  <input
                    className="input text-sm"
                    value={editFields.nome ?? ''}
                    onChange={e => setEditFields(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {(['whatsapp', 'email', 'eshop', 'telefono'] as CanaleOrdine[]).map(cv => (
                      <button
                        key={cv}
                        onClick={() => setEditFields(p => ({ ...p, canale_ordine: cv }))}
                        className={`flex flex-col items-center gap-1 py-2 rounded border text-xs transition-colors ${
                          editCanale === cv ? CANALE_COLOR[cv] : 'border-obsidian-light/40 text-stone hover:text-cream'
                        }`}
                      >
                        {CANALE_ICON[cv]}
                        {CANALE_LABEL[cv]}
                      </button>
                    ))}
                  </div>
                  {(editCanale === 'whatsapp' || editCanale === 'telefono') && (
                    <input className="input text-sm" placeholder="Telefono"
                      value={editFields.telefono ?? ''}
                      onChange={e => setEditFields(p => ({ ...p, telefono: e.target.value }))} />
                  )}
                  {editCanale === 'email' && (
                    <input className="input text-sm" placeholder="Email"
                      value={editFields.email ?? ''}
                      onChange={e => setEditFields(p => ({ ...p, email: e.target.value }))} />
                  )}
                  {editCanale === 'eshop' && (
                    <input className="input text-sm" placeholder="URL eshop"
                      value={editFields.sito_eshop ?? ''}
                      onChange={e => setEditFields(p => ({ ...p, sito_eshop: e.target.value }))} />
                  )}
                  <input className="input text-sm" placeholder="Note"
                    value={editFields.note ?? ''}
                    onChange={e => setEditFields(p => ({ ...p, note: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(f)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30 transition-colors">
                      <Check size={11} /> Salva
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-obsidian-light text-stone hover:text-cream transition-colors">
                      <X size={11} /> Annulla
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={f.id} className="flex items-center gap-4 px-5 py-4 border-b border-obsidian-light/40 last:border-0">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 border ${CANALE_COLOR[c]}`}>
                  {f.nome[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-cream">{f.nome}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${CANALE_COLOR[c]}`}>
                      {CANALE_ICON[c]} {CANALE_LABEL[c]}
                    </span>
                  </div>
                  <p className="text-xs text-stone truncate">{getContactInfo(f)}</p>
                  {f.note && <p className="text-xs text-stone/60 mt-0.5 italic">{f.note}</p>}
                </div>

                {/* Azione rapida */}
                {c === 'whatsapp' && f.telefono && (
                  <a href={`https://wa.me/${f.telefono.replace(/[^0-9+]/g, '')}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors flex-shrink-0">
                    <MessageCircle size={12} /> Apri
                  </a>
                )}
                {c === 'email' && f.email && (
                  <a href={`mailto:${f.email}`}
                     className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors flex-shrink-0">
                    <Mail size={12} /> Scrivi
                  </a>
                )}
                {c === 'eshop' && f.sito_eshop && (
                  <a href={f.sito_eshop} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors flex-shrink-0">
                    <Globe size={12} /> Sito
                  </a>
                )}
                {c === 'telefono' && f.telefono && (
                  <a href={`tel:${f.telefono.replace(/\s/g, '')}`}
                     className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors flex-shrink-0">
                    <Phone size={12} /> Chiama
                  </a>
                )}

                <button onClick={() => startEdit(f)} className="p-1.5 rounded text-stone hover:text-gold transition-colors flex-shrink-0">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteFornitore(f)} className="p-1.5 rounded text-stone hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
