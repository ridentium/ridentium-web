'use client'

import { useState } from 'react'
import { MagazzinoItem, Fornitore, FornitoreContatto, CanaleOrdine } from '@/types'
import { MessageCircle, Mail, AlertTriangle, Globe, Phone, ExternalLink, Clock } from 'lucide-react'

interface Props {
  alertItems: MagazzinoItem[]
  fornitori: (Fornitore & { fornitore_contatti?: FornitoreContatto[] })[]
  /** IDs magazzino già presenti in ordini aperti (da server) */
  orderedItemIds?: string[]
  onOrdineInviato?: (ids: string[]) => void
}

export default function SottoSogliaOrdina({
  alertItems, fornitori,
  orderedItemIds = [], onOrdineInviato,
}: Props) {
  // Traccia localmente gli item appena ordinati (oltre a quelli già da server)
  const [localOrdinati, setLocalOrdinati] = useState<string[]>([])
  // ID fornitore con contatto malformato (es. telefono con soli caratteri speciali)
  const [erroreFornitore, setErroreFornitore] = useState<string | null>(null)

  const tuttiOrdinati = new Set([...orderedItemIds, ...localOrdinati])

  // Separa: già ordinati vs da ordinare
  const daOrdinare = alertItems.filter(i => !tuttiOrdinati.has(i.id))
  const inRiassortimento = alertItems.filter(i => tuttiOrdinati.has(i.id))

  // Raggruppa da ordinare per fornitore / senza fornitore
  const grouped: Record<string, MagazzinoItem[]> = {}
  const senzaFornitore: MagazzinoItem[] = []

  for (const item of daOrdinare) {
    const fid = (item as any).fornitore_id
    if (fid) {
      if (!grouped[fid]) grouped[fid] = []
      grouped[fid].push(item)
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

  function resolveContact(fornitore: Fornitore & { fornitore_contatti?: FornitoreContatto[] }) {
    const contatti = fornitore.fornitore_contatti ?? []
    const defaultContact = contatti.find(c => c.is_predefinito) ?? contatti[0]
    if (defaultContact) {
      return {
        canale: (defaultContact.metodo_predefinito ?? 'whatsapp') as CanaleOrdine,
        telefono: defaultContact.whatsapp ?? defaultContact.telefono ?? null,
        email: defaultContact.email ?? null,
        sitoEshop: fornitore.sito_eshop ?? null,
        nomeContatto: defaultContact.nome,
      }
    }
    return {
      canale: (fornitore.canale_ordine ?? 'whatsapp') as CanaleOrdine,
      telefono: fornitore.telefono ?? null,
      email: fornitore.email ?? null,
      sitoEshop: fornitore.sito_eshop ?? null,
      nomeContatto: null,
    }
  }

  function markOrdinati(prodotti: MagazzinoItem[]) {
    const ids = prodotti.map(p => p.id)
    setLocalOrdinati(prev => Array.from(new Set([...prev, ...ids])))
    onOrdineInviato?.(ids)
  }

  async function salvaCreaOrdine(fornitore: Fornitore, prodotti: MagazzinoItem[], canale: CanaleOrdine) {
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

  function handleWhatsApp(fornitore: Fornitore & { fornitore_contatti?: FornitoreContatto[] }, prodotti: MagazzinoItem[]) {
    const { telefono } = resolveContact(fornitore)
    const phone = (telefono ?? '').replace(/\D/g, '')
    // Minimo 6 cifre: protegge da numeri malformati (es. "+", "039") salvati nel DB
    if (!phone || phone.length < 6) {
      setErroreFornitore(fornitore.id)
      setTimeout(() => setErroreFornitore(null), 4000)
      return
    }
    const msg = buildMessage(fornitore, prodotti)
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    salvaCreaOrdine(fornitore, prodotti, 'whatsapp').catch(() => {})
    markOrdinati(prodotti)
  }

  function handleEmail(fornitore: Fornitore & { fornitore_contatti?: FornitoreContatto[] }, prodotti: MagazzinoItem[]) {
    const { email } = resolveContact(fornitore)
    const msg = buildMessage(fornitore, prodotti)
    const subject = encodeURIComponent('Ordine - Ridentium')
    const body = encodeURIComponent(msg)
    window.open(`mailto:${email}?subject=${subject}&body=${body}`)
    salvaCreaOrdine(fornitore, prodotti, 'email').catch(() => {})
    markOrdinati(prodotti)
  }

  function handleEshop(fornitore: Fornitore & { fornitore_contatti?: FornitoreContatto[] }, prodotti: MagazzinoItem[]) {
    const { sitoEshop } = resolveContact(fornitore)
    window.open(sitoEshop ?? '#', '_blank')
    salvaCreaOrdine(fornitore, prodotti, 'eshop').catch(() => {})
    markOrdinati(prodotti)
  }

  function handleTelefono(fornitore: Fornitore & { fornitore_contatti?: FornitoreContatto[] }, prodotti: MagazzinoItem[]) {
    const { telefono } = resolveContact(fornitore)
    window.open(`tel:${(telefono ?? '').replace(/\s/g, '')}`)
    salvaCreaOrdine(fornitore, prodotti, 'telefono').catch(() => {})
    markOrdinati(prodotti)
  }

  if (alertItems.length === 0) {
    return <p className="text-stone text-sm py-4 text-center">✓ Tutto in ordine</p>
  }

  return (
    <div className="space-y-3">

      {/* ── Prodotti da ordinare ── */}

      {/* Raggruppati per fornitore */}
      {Object.entries(grouped).map(([fornitoreId, prodotti]) => {
        const fornitore = fornitori.find(f => f.id === fornitoreId)
        if (!fornitore) return null
        const { canale, telefono, email, sitoEshop, nomeContatto } = resolveContact(fornitore)
        return (
          <div key={fornitoreId} className="rounded border border-stone/25 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs font-medium text-gold uppercase tracking-wider">{fornitore.nome}</p>
                {nomeContatto && <p className="text-xs text-stone/70">{nomeContatto}</p>}
              </div>
              {canale === 'whatsapp' && telefono && (
                <button onClick={() => handleWhatsApp(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors">
                  <MessageCircle size={11} /> WhatsApp
                </button>
              )}
              {canale === 'email' && email && (
                <button onClick={() => handleEmail(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors">
                  <Mail size={11} /> Email
                </button>
              )}
              {canale === 'eshop' && sitoEshop && (
                <button onClick={() => handleEshop(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors">
                  <Globe size={11} /> Vai all&apos;eshop
                </button>
              )}
              {canale === 'telefono' && telefono && (
                <button onClick={() => handleTelefono(fornitore, prodotti)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors">
                  <Phone size={11} /> {telefono}
                </button>
              )}
              {((canale === 'whatsapp' && !telefono) || (canale === 'email' && !email) ||
                (canale === 'eshop' && !sitoEshop) || (canale === 'telefono' && !telefono)) && (
                <span className="text-xs text-stone italic">Contatto mancante</span>
              )}
              {erroreFornitore === fornitore.id && (
                <span className="w-full text-[11px] text-amber-400/90 italic mt-0.5">
                  Numero non valido — aggiorna il contatto del fornitore
                </span>
              )}
            </div>
            <div className="space-y-1">
              {prodotti.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-stone/10 last:border-0">
                  <span className="text-sm text-obsidian/80">{p.prodotto}</span>
                  <span className="badge-alert text-xs"><AlertTriangle size={9} />{p.quantita}/{p.soglia_minima} {p.unita ?? 'pz'}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Senza fornitore assegnato */}
      {senzaFornitore.length > 0 && (
        <div className="rounded border border-red-400/20 bg-red-400/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wider">
              Fornitore non assegnato
            </p>
            <a
              href="/admin/magazzino"
              className="flex items-center gap-1 text-xs text-gold/70 hover:text-gold transition-colors"
            >
              <ExternalLink size={10} /> Gestisci
            </a>
          </div>
          <p className="text-[10px] text-stone/60">
            Apri il prodotto in Magazzino → modifica → assegna un fornitore per abilitare l&apos;ordine rapido.
          </p>
          {senzaFornitore.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1 border-b border-stone/10 last:border-0">
              <span className="text-sm text-obsidian/70">{p.prodotto}</span>
              <span className="badge-alert text-xs"><AlertTriangle size={9} />{p.quantita}/{p.soglia_minima} {p.unita ?? 'pz'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── In riassortimento (già ordinati) ── */}
      {inRiassortimento.length > 0 && (
        <div className="rounded border border-stone/15 bg-stone/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={11} className="text-stone/50" />
            <p className="text-xs font-medium text-stone uppercase tracking-wider">In riassortimento</p>
          </div>
          {inRiassortimento.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1 border-b border-stone/10 last:border-0">
              <span className="text-sm text-stone/70">{p.prodotto}</span>
              <span className="text-[10px] text-stone/50 flex items-center gap-1">
                <Clock size={9} /> ordinato
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
