'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fornitore, FornitoreContatto, MagazzinoItem, CanaleOrdine } from '@/types'
import { Plus, Trash2, MessageCircle, Mail, Globe, Phone, Edit2, Check, X, Star, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/registro'

interface Props {
  fornitori: (Fornitore & { fornitore_contatti?: FornitoreContatto[] })[]
  magazzino: MagazzinoItem[]
  currentUserId: string
  currentUserNome: string
  userRole?: string
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

function emptyContactForm(): Partial<FornitoreContatto> {
  return { nome: '', ruolo: '', telefono: '', whatsapp: '', email: '', metodo_predefinito: 'whatsapp', is_predefinito: false }
}

export default function FornitoriAdmin({ fornitori, magazzino, currentUserId, currentUserNome, userRole = 'admin' }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const canEdit = userRole === 'admin' || userRole === 'manager'

  // Form nuovo fornitore
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [note, setNote] = useState('')

  // Editing fornitore inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<Fornitore>>({})

  // Expanded fornitore (per vedere i contatti)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Gestione contatti
  const [showContactForm, setShowContactForm] = useState<string | null>(null) // fornitore_id
  const [editContact, setEditContact] = useState<FornitoreContatto | null>(null) // contact being edited
  const [contactForm, setContactForm] = useState<Partial<FornitoreContatto>>(emptyContactForm())
  const [savingContact, setSavingContact] = useState(false)
  const [savingFornitore, setSavingFornitore] = useState(false)

  function resetForm() {
    setNome(''); setNote(''); setShowForm(false)
  }

  async function addFornitore() {
    if (savingFornitore) return // guard doppio-click
    if (!nome.trim()) return
    setSavingFornitore(true)
    try {
      const { data } = await supabase.from('fornitori').insert({ nome: nome.trim(), note: note.trim() || null }).select().single()
      await logActivity(currentUserId, currentUserNome, 'Fornitore aggiunto', nome.trim(), 'fornitori')
      resetForm()
      if (data) setExpandedId(data.id)
      startTransition(() => router.refresh())
    } finally {
      setSavingFornitore(false)
    }
  }

  function startEdit(f: Fornitore) {
    setEditingId(f.id)
    setEditFields({ nome: f.nome, note: f.note ?? '' })
  }

  async function saveEdit(f: Fornitore) {
    await supabase.from('fornitori').update({
      nome: editFields.nome,
      note: editFields.note || null,
    }).eq('id', f.id)
    await logActivity(currentUserId, currentUserNome, 'Fornitore modificato', editFields.nome ?? f.nome, 'fornitori')
    setEditingId(null)
    startTransition(() => router.refresh())
  }

  async function deleteFornitore(f: Fornitore) {
    if (!confirm(`Eliminare il fornitore "${f.nome}"?`)) return
    await supabase.from('fornitori').delete().eq('id', f.id)
    await logActivity(currentUserId, currentUserNome, 'Fornitore eliminato', f.nome, 'fornitori')
    startTransition(() => router.refresh())
  }

  // ── Contatti ────────────────────────────────────────────────────────────────

  function openAddContact(fornitoreId: string) {
    setEditContact(null)
    setContactForm(emptyContactForm())
    setShowContactForm(fornitoreId)
    setExpandedId(fornitoreId)
  }

  function openEditContact(c: FornitoreContatto) {
    setEditContact(c)
    setContactForm({ ...c })
    setShowContactForm(c.fornitore_id)
    setExpandedId(c.fornitore_id)
  }

  function closeContactForm() {
    setShowContactForm(null)
    setEditContact(null)
    setContactForm(emptyContactForm())
  }

  async function saveContact(fornitoreId: string) {
    setSavingContact(true)
    const payload = {
      fornitore_id: fornitoreId,
      nome: contactForm.nome?.trim() || '',
      ruolo: contactForm.ruolo?.trim() || null,
      telefono: contactForm.telefono?.trim() || null,
      whatsapp: contactForm.whatsapp?.trim() || null,
      email: contactForm.email?.trim() || null,
      metodo_predefinito: contactForm.metodo_predefinito ?? 'whatsapp',
      is_predefinito: contactForm.is_predefinito ?? false,
    }

    if (!payload.nome) { setSavingContact(false); return }

    if (editContact) {
      await supabase.from('fornitore_contatti').update(payload).eq('id', editContact.id)
    } else {
      await supabase.from('fornitore_contatti').insert(payload)
    }

    // Se marcato come predefinito, de-seleziona gli altri
    if (payload.is_predefinito) {
      const otherId = editContact?.id ?? null
      await supabase
        .from('fornitore_contatti')
        .update({ is_predefinito: false })
        .eq('fornitore_id', fornitoreId)
        .neq('id', otherId ?? '00000000-0000-0000-0000-000000000000')
    }

    await logActivity(currentUserId, currentUserNome,
      editContact ? 'Contatto fornitore modificato' : 'Contatto fornitore aggiunto',
      payload.nome, 'fornitori')

    setSavingContact(false)
    closeContactForm()
    startTransition(() => router.refresh())
  }

  async function deleteContact(c: FornitoreContatto) {
    if (!confirm(`Eliminare il contatto "${c.nome}"?`)) return
    await supabase.from('fornitore_contatti').delete().eq('id', c.id)
    await logActivity(currentUserId, currentUserNome, 'Contatto fornitore eliminato', c.nome, 'fornitori')
    startTransition(() => router.refresh())
  }

  async function setDefaultContact(fornitoreId: string, contattoId: string) {
    await supabase.from('fornitore_contatti').update({ is_predefinito: false }).eq('fornitore_id', fornitoreId)
    await supabase.from('fornitore_contatti').update({ is_predefinito: true }).eq('id', contattoId)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-stone text-sm">{fornitori.length} fornitor{fornitori.length !== 1 ? 'i' : 'e'}</p>
        {canEdit && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-xs">
            <Plus size={13} /> Aggiungi fornitore
          </button>
        )}
      </div>

      {/* Form nuovo fornitore */}
      {showForm && (
        <div className="card space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-stone font-medium">Nuovo fornitore</h3>
          <input className="input" placeholder="Nome fornitore *" value={nome} onChange={e => setNome(e.target.value)} />
          <input className="input" placeholder="Note (opzionale)" value={note} onChange={e => setNote(e.target.value)} />
          <p className="text-xs text-stone">I contatti si aggiungono dopo aver creato il fornitore.</p>
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
        <div className="space-y-3">
          {fornitori.map(f => {
            const contatti = f.fornitore_contatti ?? []
            const defaultContact = contatti.find(c => c.is_predefinito) ?? contatti[0]
            const isExpanded = expandedId === f.id
            const isEditing = editingId === f.id

            return (
              <div key={f.id} className="card p-0 overflow-hidden">
                {/* Riga fornitore */}
                {isEditing ? (
                  <div className="px-5 py-4 space-y-3">
                    <input
                      className="input text-sm"
                      value={editFields.nome ?? ''}
                      onChange={e => setEditFields(p => ({ ...p, nome: e.target.value }))}
                      placeholder="Nome fornitore"
                    />
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
                ) : (
                  <div className="flex items-center gap-3 px-5 py-4">
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 border ${
                      defaultContact ? CANALE_COLOR[defaultContact.metodo_predefinito ?? 'whatsapp'] : 'border-obsidian-light text-stone'
                    }`}>
                      {f.nome[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-cream">{f.nome}</p>
                      {defaultContact ? (
                        <p className="text-xs text-stone truncate">
                          {defaultContact.nome}
                          {defaultContact.ruolo ? ` · ${defaultContact.ruolo}` : ''}
                          {' — '}
                          {defaultContact.metodo_predefinito === 'whatsapp' && (defaultContact.whatsapp ?? defaultContact.telefono ?? '—')}
                          {defaultContact.metodo_predefinito === 'email' && (defaultContact.email ?? '—')}
                          {defaultContact.metodo_predefinito === 'telefono' && (defaultContact.telefono ?? '—')}
                          {defaultContact.metodo_predefinito === 'eshop' && 'Eshop'}
                        </p>
                      ) : (
                        <p className="text-xs text-stone/50 italic">Nessun contatto</p>
                      )}
                      {f.note && <p className="text-xs text-stone/50 mt-0.5 italic">{f.note}</p>}
                    </div>

                    {/* Quick action */}
                    {defaultContact && (
                      <>
                        {defaultContact.metodo_predefinito === 'whatsapp' && (defaultContact.whatsapp ?? defaultContact.telefono) && (
                          <a href={`https://wa.me/${(defaultContact.whatsapp ?? defaultContact.telefono ?? '').replace(/[^0-9+]/g, '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors flex-shrink-0">
                            <MessageCircle size={12} /> Apri
                          </a>
                        )}
                        {defaultContact.metodo_predefinito === 'email' && defaultContact.email && (
                          <a href={`mailto:${defaultContact.email}`}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors flex-shrink-0">
                            <Mail size={12} /> Scrivi
                          </a>
                        )}
                        {defaultContact.metodo_predefinito === 'telefono' && defaultContact.telefono && (
                          <a href={`tel:${defaultContact.telefono.replace(/\s/g, '')}`}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors flex-shrink-0">
                            <Phone size={12} /> Chiama
                          </a>
                        )}
                      </>
                    )}

                    {/* Espandi/comprimi */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className="p-1.5 rounded text-stone hover:text-cream transition-colors flex-shrink-0 flex items-center gap-1"
                    >
                      <span className="text-xs text-stone/60">{contatti.length}</span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {canEdit && (
                      <>
                        <button onClick={() => startEdit(f)} className="p-1.5 rounded text-stone hover:text-gold transition-colors flex-shrink-0">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteFornitore(f)} className="p-1.5 rounded text-stone hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Sezione contatti espansa */}
                {isExpanded && (
                  <div className="border-t border-obsidian-light/40">
                    {/* Lista contatti */}
                    {contatti.length === 0 && showContactForm !== f.id && (
                      <p className="text-xs text-stone/60 text-center py-4 italic">Nessun contatto aggiunto</p>
                    )}

                    {contatti.map(c => (
                      <div key={c.id} className="px-5 py-3 border-b border-obsidian-light/20 last:border-0">
                        {editContact?.id === c.id && showContactForm === f.id ? (
                          <ContactForm
                            form={contactForm}
                            onChange={setContactForm}
                            onSave={() => saveContact(f.id)}
                            onCancel={closeContactForm}
                            saving={savingContact}
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            {/* Stella predefinito */}
                            {canEdit ? (
                              <button
                                onClick={() => setDefaultContact(f.id, c.id)}
                                title={c.is_predefinito ? 'Contatto predefinito' : 'Imposta come predefinito'}
                                className={`flex-shrink-0 transition-colors ${c.is_predefinito ? 'text-gold' : 'text-stone/30 hover:text-stone'}`}
                              >
                                <Star size={13} fill={c.is_predefinito ? 'currentColor' : 'none'} />
                              </button>
                            ) : (
                              c.is_predefinito && <Star size={13} className="text-gold flex-shrink-0" fill="currentColor" />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-cream font-medium">{c.nome}</span>
                                {c.ruolo && <span className="text-xs text-stone">{c.ruolo}</span>}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${CANALE_COLOR[c.metodo_predefinito ?? 'whatsapp']}`}>
                                  {CANALE_ICON[c.metodo_predefinito ?? 'whatsapp']}
                                  {CANALE_LABEL[c.metodo_predefinito ?? 'whatsapp']}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                {c.telefono && <span className="text-xs text-stone/70">{c.telefono}</span>}
                                {c.whatsapp && c.whatsapp !== c.telefono && <span className="text-xs text-stone/70">WA: {c.whatsapp}</span>}
                                {c.email && <span className="text-xs text-stone/70">{c.email}</span>}
                              </div>
                            </div>

                            {/* Quick actions per contatto */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {(c.whatsapp ?? c.telefono) && (
                                <a href={`https://wa.me/${(c.whatsapp ?? c.telefono ?? '').replace(/[^0-9+]/g, '')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 rounded text-green-400/60 hover:text-green-400 transition-colors">
                                  <MessageCircle size={13} />
                                </a>
                              )}
                              {c.email && (
                                <a href={`mailto:${c.email}`}
                                  className="p-1.5 rounded text-gold/60 hover:text-gold transition-colors">
                                  <Mail size={13} />
                                </a>
                              )}
                              {c.telefono && (
                                <a href={`tel:${c.telefono.replace(/\s/g, '')}`}
                                  className="p-1.5 rounded text-violet-400/60 hover:text-violet-400 transition-colors">
                                  <Phone size={13} />
                                </a>
                              )}
                              {canEdit && (
                                <>
                                  <button onClick={() => openEditContact(c)} className="p-1.5 rounded text-stone hover:text-gold transition-colors">
                                    <Edit2 size={12} />
                                  </button>
                                  <button onClick={() => deleteContact(c)} className="p-1.5 rounded text-stone hover:text-red-400 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Form nuovo contatto */}
                    {showContactForm === f.id && !editContact && (
                      <div className="px-5 py-4 bg-obsidian-light/10">
                        <ContactForm
                          form={contactForm}
                          onChange={setContactForm}
                          onSave={() => saveContact(f.id)}
                          onCancel={closeContactForm}
                          saving={savingContact}
                        />
                      </div>
                    )}

                    {/* Bottone aggiungi contatto */}
                    {canEdit && showContactForm !== f.id && (
                      <div className="px-5 py-3">
                        <button
                          onClick={() => openAddContact(f.id)}
                          className="flex items-center gap-1.5 text-xs text-stone hover:text-cream transition-colors"
                        >
                          <UserPlus size={13} /> Aggiungi contatto
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ContactForm ──────────────────────────────────────────────────────────────

function ContactForm({
  form, onChange, onSave, onCancel, saving
}: {
  form: Partial<FornitoreContatto>
  onChange: (f: Partial<FornitoreContatto>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const set = (k: keyof FornitoreContatto, v: any) => onChange({ ...form, [k]: v })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone mb-1 block">Nome *</label>
          <input className="input text-sm" placeholder="es. Giovanni Rossi"
            value={form.nome ?? ''} onChange={e => set('nome', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-stone mb-1 block">Ruolo</label>
          <input className="input text-sm" placeholder="es. Ufficio ordini"
            value={form.ruolo ?? ''} onChange={e => set('ruolo', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-stone mb-1 block">Telefono</label>
          <input className="input text-sm" placeholder="+39 333 1234567"
            value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-stone mb-1 block">WhatsApp</label>
          <input className="input text-sm" placeholder="(se diverso dal tel.)"
            value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-stone mb-1 block">Email</label>
          <input className="input text-sm" type="email" placeholder="ordini@fornitore.it"
            value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
        </div>
      </div>

      {/* Metodo predefinito */}
      <div>
        <label className="text-xs text-stone mb-1.5 block">Metodo di contatto preferito</label>
        <div className="flex gap-2">
          {(['whatsapp', 'email', 'telefono', 'eshop'] as CanaleOrdine[]).map(c => (
            <button key={c}
              onClick={() => set('metodo_predefinito', c)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border transition-colors ${
                form.metodo_predefinito === c
                  ? 'bg-gold/20 border-gold/50 text-gold'
                  : 'border-obsidian-light text-stone hover:text-cream'
              }`}>
              {c === 'whatsapp' && <MessageCircle size={11} />}
              {c === 'email' && <Mail size={11} />}
              {c === 'telefono' && <Phone size={11} />}
              {c === 'eshop' && <Globe size={11} />}
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Predefinito */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox"
          checked={form.is_predefinito ?? false}
          onChange={e => set('is_predefinito', e.target.checked)}
          className="accent-gold cursor-pointer" />
        <span className="text-xs text-stone">Contatto predefinito per gli ordini</span>
      </label>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !form.nome?.trim()}
          className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50">
          {saving ? 'Salvataggio…' : 'Salva'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-xs py-1.5 px-3">
          Annulla
        </button>
      </div>
    </div>
  )
}
