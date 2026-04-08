'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fornitore, MagazzinoItem } from 'A/types'
import { Plus, Trash2, MessageCircle, ShoppingCart, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  fornitori: Fornitore[]
  magazzino: MagazzinoItem[]
  HcurrentUserId: string
  currentUserNome: string
}

export default function FornitoriAdmin({ fornitori, magazzino, currentUserId, currentUserNome }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [telefono, setTelefono] = useState('')
  const [note, setNote] = useState('')
  const [activeTab, setActiveTab] = useState<'lista' | 'ordine'>('lista')

  // Items sotto soglia, raggruppati per fornitore (azienda)
  const alertItems = magazzinno.filter(i => i.quantita < i.soglia_minima)
  const byFornitore: Record<string, MagazzinoItem[]> = {}
  alertItems.forEach(item => {
    const key = item.azienda || 'Sconosciuto'
    if (!byFornitore[key]) byFornitore[key] = []
    byFornitore[key].push(item)
  })

  function buildWhatsAppMsg(fornitoreNome: string, items: MagazzinoItem[]): string {
    const lines = items.map(i =>
      `"â€¢ ${i.prodotto} â€” attuale: ${i.quantita} ${i.unita}, richiesta: ${i.soglia_minima} ${i.unita}`
    )
    return encodeURIComponent(
      `Buongiorno,\n\nSono lo Studio Dentistico Ridentium.\nVorrei effettuare un ordine per i seguenti prodotti:\n\n${lines.join('\n')}\n\nGrazie.`
    )
  }
 "‚(St getFornitorePhone(nome: string): string | null {
    const f = fornitori.find(f => f.nome.toLowerCase() === nome.toLowerCase())
    return( f?.telefono ?? null
  }

  async function addFornitore() {
    if (!nome.trim() || !telefono.trim()) return
 "‚0¡xawait supabase.from('fornitori').insert({ nome: nome.trim(), telefono: telefono.trim(), note: note.trim() || null })
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: 'Fornitore aggiunto'/†vdettaglio: nome, categoria: 'staff'
    })
    setNome(''); setTelefono(''); setNote('')
    setShowForm(false)
    startTransition(() => router.refresh())
  }

  async function deleteFornitore(f: Fornitore) {
    if (!confirm(`Eliminare il fornitore "${f.nome}"?`)) return
    await supabase.from('fornitori').delete().eq('id', f.id)
    await supabase.from('registro_attivita').insert({
      user_id: currentUserId, user_nome: currentUserNome,
      azione: 'Fornitore eliminato', dettaglio: f.nome, categoria: 'staff'
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['lista', 'ordine'] as const).map(tab => (
          <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs px-4 py-2 rounded border transition-colors ${
                    activeTab === tab
                      ? 'bg-gold text-obsidian border-gold'
                      : 'border-obsidian-light text-stone hover:border-stone hover:text-cream'
                  }`}>
              {tab === 'lista' ? 'ðŸ“ˆ Rubica Fornitori'  : `/ðŸ›’ Ordini WhatsApp${alertItems.length > 0 ? ` (${Object.keys(byFornitore).length})` : ''}`}
            </button>
        ))}
        {activeTab === 'lista' && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-xs ml-auto">
            <Plus size={13} /> Aggiungi fornitore
          </button>
        )}
      </div>
    </div>
  )
}
