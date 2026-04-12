'use client'

import { MagazzinoItem, Fornitore } from '@/types'
import { MessageCircle, Mail, AlertTriangle, Globe, Phone } from 'lucide-react'
import { logActivity } from '@/lib/registro'

interface Props {
  alertItems: MagazzinoItem[]
  fornitori: Fornitore[]
  userId: string
  userNome: string
}

export default function SottoSogliaOrdina({ alertItems, fornitori, userId, userNome }: Props) {

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

  function buildMessage(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    const lista = prodotti
      .map(p => `- ${p.prodotto} (${Math.max(p.soglia_minima - p.quantita, 1)} ${p.unita ?? 'pz'})`)
      .join('\n')
    return `Buongiorno,\n\nvorrei ordinare:\n${lista}\n\nGrazie,\nRidentium`
  }

  async function salvaCreaOrdine(fornitore: Fornitore, prodotti: MagazzinoItem[], canale: Fornitore['canale_ordine']) {
    try {
      await fetch('/api/ordini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fornitore_id: fornitore.id,
          fornitore_nome: fornitore.nome,
          canale,
          righe: prodotti.map(p => ({
            magazzino_id: p.id,
            prodotto_nome: p.prodotto,
            quantita_ordinata: Math.max(p.soglia_minima - p.quantita, 1),
            unita: p.unita ?? null,
          })),
        }),
      })
    } catch { /* best-effort */ }
  }

  // IMPORTANTE: window.open va prima di qualsiasi await
  function handleWhatsApp(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    const msg   = buildMessage(fornitore, prodotti)
    const phone = (fornitore.telefono ?? '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    salvaCreaOrdine(fornitore, prodotti, 'whatsapp').catch(() => {})
    logActivity(userId, userNome, 'Ordine inviato via WhatsApp',
      `${fornitore.nome}: ${prodotti.map(p => p.prodotto).join(', ')}`, 'magazzino').catch(() => {})
  }

  function handleEmail(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    const msg     = buildMessage(fornitore, prodotti)
    const subject = encodeURIComponent('Ordine - Ridentium')
    const body    = encodeURIComponent(msg)
    window.open(`mailto:${fornitore.email}?subject=${subject}&body=${body}`)
    salvaCreaOrdine(fornitore, prodotti, 'email').catch(() => {})
    logActivity(userId, userNome, 'Ordine inviato via email',
      `${fornitore.nome}: ${prodotti.map(p => p.prodotto).join(', ')}`, 'magazzino').catch(() => {})
  }

  function handleEshop(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    window.open(fornitore.sito_eshop ?? '#', '_blank')
    salvaCreaOrdine(fornitore, prodotti, 'eshop').catch(() => {})
    logActivity(userId, userNome, 'Ordine avviato via eshop',
      `${fornitore.nome}: ${prodotti.map(p => p.prodotto).join(', ')}`, 'magazzino').catch(() => {})
  }

  function handleTelefono(fornitore: Fornitore, prodotti: MagazzinoItem[]) {
    window.open(`tel:${(fornitore.telefono ?? '').replace(/\s/g, '')}`)
    salvaCreaOrdine(fornitore, prodotti, 'telefono').catch(() => {})
    logActivity(userId, userNome, 'Ordine avviato via telefono',
      `${fornitore.nome}: ${prodotti.map(p => p.prodotto).join(', ')}`, 'magazzino').catch(() => {})
  }

  if (alertItems.length === 0) {
    return <p className="text-stone text-sm py-4 text-center">✓ Tutto in ordine</p>
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([fornitoreId, prodotti]) => {
        const fornitore = fornitori.find(f => f.id === fornitoreId)
        if (!fornitore) return null
        const canale = fornitore.canale_ordine ?? 'whatsapp'

        return (
          <div key={fornitoreId} className="rounded border border-obsidian-light/40 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-medium text-gold uppercase tracking-wider">{fornitore.nome}</p>

              {canale === 'whatsapp' && fornitore.telefono && (
                <button
                  onClick={() => handleWhatsApp(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors">
                  <MessageCircle size={11} /> WhatsApp
                </button>
              )}

              {canale === 'email' && fornitore.email && (
                <button
                  onClick={() => handleEmail(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors">
                  <Mail size={11} /> Email
                </button>
              )}

              {canale === 'eshop' && fornitore.sito_eshop && (
                <button
                  onClick={() => handleEshop(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors">
                  <Globe size={11} /> Vai all&apos;eshop
                </button>
              )}

              {canale === 'telefono' && fornitore.telefono && (
                <button
                  onClick={() => handleTelefono(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors">
                  <Phone size={11} /> {fornitore.telefono}
                </button>
              )}

              {((canale === 'whatsapp' && !fornitore.telefono) ||
                (canale === 'email' && !fornitore.email) ||
                (canale === 'eshop' && !fornitore.sito_eshop) ||
                (canale === 'telefono' && !fornitore.telefono)) && (
                <span className="text-xs text-stone italic">Contatto mancante nel profilo fornitore</span>
              )}
            </div>

            <div className="space-y-1">
              {prodotti.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-obsidian-light/20 last:border-0">
                  <span className="text-sm text-cream/80">{p.prodotto}</span>
                  <span className="badge-alert text-xs">
                    <AlertTriangle size={9} />
                    {p.quantita}/{p.soglia_minima} {p.unita ?? 'pz'}
                  </span>
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
              <span className="badge-alert text-xs">
                <AlertTriangle size={9} />
                {p.quantita}/{p.soglia_minima} {p.unita ?? 'pz'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
