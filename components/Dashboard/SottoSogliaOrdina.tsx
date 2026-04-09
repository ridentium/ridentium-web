'use client'

import { MagazzinoItem, Fornitore } from '@/types'
import { MessageCircle, Mail, AlertTriangle } from 'lucide-react'
import { logActivity } from '@/lib/registro'
import { createClient } from '@/lib/supabase/client'

interface Props {
  alertItems: MagazzinoItem[]
  fornitori: Fornitore[]
  userId: string
  userNome: string
}

export default function SottoSogliaOrdina({ alertItems, fornitori, userId, userNome }: Props) {
  const supabase = createClient()

  const grouped: Record<string, MagazzinoItem[]> = {}
  const senzaFornitore: MagazzinoItem[] = []

  for (const item of alertItems) {
    if (item.fornitore_id) {
      if (!grouped[item.fornitore_id]) grouped[item.fornitore_id] = []
      grouped[item.fornitore_id].push(item)
    } else {
      senzaFornitore.push(item)
    }
  }

  function buildMessage(prodotti: MagazzinoItem[]) {
    const lista = prodotti
      .map(p => `- ${p.prodotto} (${Math.max(p.soglia_minima - p.quantita, 1)} ${p.unita ?? 'pz'})`)
      .join('\n')
    return `Buongiorno,\n\nvorrei ordinare:\n${lista}\n\nGrazie,\nRidentium`
  }

  async function creaOrdine(fornitore: Fornitore, prodotti: MagazzinoItem[], canale: 'whatsapp' | 'email') {
    try {
      const { data: ordine, error } = await supabase
        .from('ordini')
        .insert({ fornitore_id: fornitore.id, fornitore_nome: fornitore.nome, stato: 'inviato', canale, created_by: userId })
        .select('id').single()
      if (error || !ordine) return
      await supabase.from('ordini_righe').insert(
        prodotti.map(p => ({ ordine_id: ordine.id, magazzino_id: p.id, prodotto_nome: p.prodotto, quantita_ordinata: Math.max(p.soglia_minima - p.quantita, 1), unita: p.unita ?? null }))
      )
    } catch { /* Non bloccare l'UI */ }
  }

  async function handleWhatsApp(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    const msg = buildMessage(prodotti)
    await creaOrdine(fornitore, prodotti, 'whatsapp')
    await logActivity(userId, userNome, 'Ordine inviato via WhatsApp', `${fornitore.nome}: ${prodotti.map(p => p.prodotto).join(', ')}`, 'magazzino')
    const phone = (fornitore.telefono ?? '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleEmail(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    const msg = buildMessage(prodotti)
    await creaOrdine(fornitore, prodotti, 'email')
    await logActivity(userId, userNome, 'Ordine inviato via email', `${fornitore.nome}: ${prodotti.map(p => p.prodotto).join(', ')}`, 'magazzino')
    window.open(`mailto:${fornitore.email}?subject=${encodeURIComponent('Ordine - Ridentium')}&body=${encodeURIComponent(msg)}`, '_blank')
  }

  if (alertItems.length === 0) return <p className="text-stone text-sm py-4 text-center">✓ Tutto in ordine</p>

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([fornitoreId, prodotti]) => {
        const fornitore = fornitori.find(f => f.id === fornitoreId)
        if (!fornitore) return null
        return (
          <div key={fornitoreId} className="rounded border border-obsidian-light/40 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-medium text-gold uppercase tracking-wider">{fornitore.nome}</p>
              <div className="flex gap-2">
                {fornitore.telefono && (
                  <button onClick={() => handleWhatsApp(fornitore, prodotti)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors">
                    <MessageCircle size={11} /> WhatsApp
                  </button>
                )}
                {fornitore.email && (
                  <button onClick={() => handleEmail(fornitore, prodotti)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors">
                    <Mail size={11} /> Email
                  </button>
                )}
                {!fornitore.telefono && !fornitore.email && <span className="text-xs text-stone italic">Nessun contatto</span>}
              </div>
            </div>
            <div className="space-y-1">
              {prodotti.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-obsidian-light/20 last:border-0">
                  <span className="text-sm text-cream/80">{p.prodotto}</span>
                  <span className="badge-alert text-xs"><AlertTriangle size={9} />{p.quantita}/{p.soglia_minima} {p.unita ?? 'pz'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {senzaFornitore.length > 0 && (
        <div className="rounded border border-obsidian-light/30 p-3 space-y-2">
          <p className="text-xs font-medium text-stone uppercase tracking-wider">Fornitore non assegnato</p>
          {senzaFornitore.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1 border-b border-obsidian-light/20 last:border-0">
              <span className="text-sm text-cream/80">{p.prodotto}</span>
              <span className="badge-alert text-xs"><AlertTriangle size={9} />{p.quantita}/{p.soglia_minima} {p.unita ?? 'pz'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
