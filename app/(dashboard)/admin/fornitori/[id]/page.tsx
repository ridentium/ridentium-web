import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, ShoppingCart, MessageCircle, Mail, Globe, Phone } from 'lucide-react'

const CANALE_ICON: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle size={13} />,
  email: <Mail size={13} />,
  eshop: <Globe size={13} />,
  telefono: <Phone size={13} />,
}

const STATO_COLOR: Record<string, string> = {
  inviato: 'text-gold bg-gold/10 border-gold/30',
  confermato: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  ricevuto: 'text-green-400 bg-green-500/10 border-green-500/30',
  annullato: 'text-stone bg-stone/10 border-stone/20',
}

export default async function FornitoreDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [
    { data: fornitore },
    { data: ordini },
    { data: magazzino },
  ] = await Promise.all([
    supabase
      .from('fornitori')
      .select('*, fornitore_contatti(*)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('ordini')
      .select('id, fornitore_nome, canale, stato, note, data_invio, created_at, ordine_righe(prodotto, quantita, unita)')
      .eq('fornitore_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('magazzino')
      .select('id, prodotto, quantita, soglia_minima, unita, categoria')
      .eq('fornitore_id', params.id)
      .order('prodotto', { ascending: true }),
  ])

  if (!fornitore) notFound()

  const contatti = (fornitore as any).fornitore_contatti ?? []
  const totaleOrdini = ordini?.length ?? 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/fornitori" className="mt-1 p-1.5 rounded text-stone hover:text-cream transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-light font-serif text-cream">{fornitore.nome}</h1>
          {fornitore.note && (
            <p className="text-sm text-stone mt-1">{fornitore.note}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Contatti ── */}
        <div className="card">
          <h2 className="text-xs font-medium text-cream uppercase tracking-widest mb-4">Contatti</h2>
          {contatti.length === 0 ? (
            <p className="text-xs text-stone">Nessun contatto registrato</p>
          ) : (
            <div className="space-y-4">
              {contatti.map((c: any) => (
                <div key={c.id} className="pb-4 border-b border-obsidian-light/30 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-cream font-medium">{c.nome || '—'}</p>
                    {c.is_predefinito && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">★ predefinito</span>
                    )}
                  </div>
                  {c.ruolo && <p className="text-xs text-stone mb-2">{c.ruolo}</p>}
                  <div className="space-y-1">
                    {c.telefono && (
                      <p className="text-xs text-stone/70 flex items-center gap-1.5">
                        <Phone size={11} /> {c.telefono}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-stone/70 flex items-center gap-1.5">
                        <Mail size={11} /> {c.email}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── KPI ── */}
        <div className="space-y-4">
          <div className="card text-center">
            <p className="text-3xl font-light font-serif text-cream mb-1">{totaleOrdini}</p>
            <p className="text-[10px] text-stone uppercase tracking-widest">Ordini totali</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-light font-serif text-cream mb-1">{magazzino?.length ?? 0}</p>
            <p className="text-[10px] text-stone uppercase tracking-widest">Prodotti associati</p>
          </div>
        </div>

        {/* ── Prodotti magazzino ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Package size={13} className="text-stone/60" />
            <h2 className="text-xs font-medium text-cream uppercase tracking-widest">Prodotti in magazzino</h2>
          </div>
          {!magazzino?.length ? (
            <p className="text-xs text-stone">Nessun prodotto associato</p>
          ) : (
            <div className="space-y-2">
              {magazzino.map(item => {
                const isAlert = item.quantita < item.soglia_minima
                return (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-obsidian-light/20 last:border-0">
                    <span className="text-sm text-cream/80 truncate mr-2">{item.prodotto}</span>
                    <span className={`text-xs font-medium flex-shrink-0 ${isAlert ? 'text-red-400' : 'text-green-400/80'}`}>
                      {item.quantita} {item.unita ?? 'pz'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Storico Ordini ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <ShoppingCart size={13} className="text-stone/60" />
          <h2 className="text-xs font-medium text-cream uppercase tracking-widest">Storico Ordini</h2>
          <span className="text-[10px] text-stone/40">({totaleOrdini})</span>
        </div>

        {!ordini?.length ? (
          <p className="text-sm text-stone text-center py-8">Nessun ordine registrato per questo fornitore</p>
        ) : (
          <div className="space-y-3">
            {ordini.map((ordine: any) => {
              const righe: any[] = ordine.ordine_righe ?? []
              return (
                <div key={ordine.id} className="border border-obsidian-light/40 rounded-lg p-4 hover:border-obsidian-light transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {CANALE_ICON[ordine.canale] && (
                        <span className="text-stone/60">{CANALE_ICON[ordine.canale]}</span>
                      )}
                      <span className="text-xs text-stone capitalize">{ordine.canale}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded border capitalize ${STATO_COLOR[ordine.stato] ?? 'text-stone bg-stone/10 border-stone/20'}`}>
                        {ordine.stato}
                      </span>
                      <span className="text-[10px] text-stone/40">
                        {new Date(ordine.created_at).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  </div>

                  {righe.length > 0 && (
                    <div className="space-y-1">
                      {righe.map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-cream/70">{r.prodotto}</span>
                          <span className="text-stone">{r.quantita} {r.unita ?? 'pz'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {ordine.note && (
                    <p className="text-xs text-stone/60 italic mt-2 border-t border-obsidian-light/20 pt-2">{ordine.note}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
