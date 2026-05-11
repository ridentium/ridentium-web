import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildOperativoSnapshot } from '@/lib/operativo-snapshot'

// Rate limit: 30 messaggi per ora per utente autenticato.
const AI_RATE_LIMIT = 30
const AI_WINDOW_MS  = 60 * 60 * 1000  // 1 ora

// Usa Groq llama-3.3-70b-versatile — completamente gratuito
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

// ── Tool definitions — solo lettura, nessuna scrittura ────────────────────────
// Sprint 3B: Lina è read-only. Nessun create_task / create_ordine / create_riordine.

const ALL_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_magazzino',
      description: 'Legge le scorte del magazzino. Usalo per rispondere su prodotti, quantità, scorte o cosa è sotto soglia.',
      parameters: {
        type: 'object',
        properties: {
          categoria:  { type: 'string', description: 'Filtra per categoria (es. Impianti, Consumabili). Ometti per tutte.' },
          solo_alert: { type: 'boolean', description: 'Se true, restituisce solo prodotti sotto la soglia minima.' },
          cerca:      { type: 'string', description: 'Testo per cercare prodotto per nome o azienda.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tasks',
      description: 'Legge i task del gestionale. Usa solo se l\'utente chiede dettagli non presenti nello snapshot.',
      parameters: {
        type: 'object',
        properties: {
          stato: { type: 'string', enum: ['da_fare', 'in_corso', 'completato'], description: 'Filtra per stato. Ometti per tutti.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_fornitori',
      description: 'Legge la lista dei fornitori con contatti.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_riordini',
      description: 'Legge le richieste di riordino aperte.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_staff',
      description: 'Legge la lista del personale attivo con nome, cognome e ruolo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ricorrenti',
      description: 'Legge le azioni ricorrenti (giornaliere, settimanali, mensili).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_adempimenti',
      description: 'Legge gli adempimenti normativi e scadenze di compliance dello studio (HACCP, privacy, manutenzioni obbligatorie, ecc.).',
      parameters: {
        type: 'object',
        properties: {
          solo_urgenti: { type: 'boolean', description: 'Se true, restituisce solo adempimenti in scadenza entro 30 giorni.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_attrezzature',
      description: 'Legge le attrezzature cliniche con stato operativo e prossima manutenzione.',
      parameters: {
        type: 'object',
        properties: {
          solo_alert: { type: 'boolean', description: 'Se true, restituisce solo attrezzature con manutenzione scaduta o in scadenza entro 30 giorni.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_agenda',
      description: 'Legge l\'agenda unificata: task, azioni ricorrenti e adempimenti. Usalo per rispondere su cosa c\'è in programma, scadenze imminenti o carichi di lavoro.',
      parameters: {
        type: 'object',
        properties: {
          profilo_id: { type: 'string', description: 'Filtra per uno specifico membro dello staff (ID profilo). Ometti per tutti.' },
          giorni:     { type: 'number', description: 'Numero di giorni futuri da considerare (default 30).' },
        },
      },
    },
  },
]

// ── Tool executor — solo lettura ──────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, any>,
  db: ReturnType<typeof createAdminClient>,
) {
  try {
    switch (toolName) {

      case 'get_magazzino': {
        let q = db.from('magazzino')
          .select('id, prodotto, categoria, azienda, quantita, soglia_minima, unita, diametro, lunghezza')
          .order('categoria').order('prodotto')
        if (input.categoria) q = (q as any).eq('categoria', input.categoria)
        if (input.cerca)     q = (q as any).ilike('prodotto', `%${input.cerca}%`)
        const { data } = await q
        let items = data ?? []
        if (input.solo_alert) items = items.filter((i: any) => i.quantita < i.soglia_minima)
        return {
          prodotti:    items.slice(0, 50),
          totale:      items.length,
          sotto_soglia: (data ?? []).filter((i: any) => i.quantita < i.soglia_minima).length,
        }
      }

      case 'get_tasks': {
        let q = db.from('tasks')
          .select('id, titolo, descrizione, stato, priorita, scadenza, assegnato_a_profilo:profili!tasks_assegnato_a_fkey(nome, cognome)')
          .is('deleted_at', null)
          .order('priorita', { ascending: false }).order('created_at', { ascending: false })
        if (input.stato) q = (q as any).eq('stato', input.stato)
        const { data } = await q
        return { tasks: (data ?? []).slice(0, 30) }
      }

      case 'get_fornitori': {
        const { data } = await db.from('fornitori')
          .select('id, nome, telefono, email, note, fornitore_contatti(nome, ruolo, telefono, whatsapp, email, metodo_predefinito, is_predefinito)')
          .order('nome')
        return { fornitori: data ?? [] }
      }

      case 'get_riordini': {
        const { data } = await db.from('riordini')
          .select('id, created_at, note, stato, profili(nome, cognome), magazzino(prodotto, quantita, soglia_minima)')
          .eq('stato', 'aperta').order('created_at', { ascending: false })
        return { riordini: data ?? [] }
      }

      case 'get_staff': {
        const { data } = await db.from('profili').select('id, nome, cognome, ruolo, email').eq('attivo', true)
        return { staff: data ?? [] }
      }

      case 'get_ricorrenti': {
        const { data } = await db.from('ricorrenti').select('*').eq('attiva', true).order('frequenza')
        return { ricorrenti: data ?? [] }
      }

      case 'get_adempimenti': {
        const oggi = new Date().toISOString().split('T')[0]
        let q = db.from('adempimenti')
          .select('id, titolo, categoria, frequenza, prossima_scadenza, preavviso_giorni, responsabile_profilo:profili!adempimenti_responsabile_profilo_id_fkey(nome, cognome)')
          .eq('attivo', true)
          .order('prossima_scadenza', { ascending: true })
        if (input.solo_urgenti) {
          const tra30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
          q = (q as any).lte('prossima_scadenza', tra30)
        }
        const { data } = await q.limit(30)
        const oggiD = new Date(oggi)
        return {
          adempimenti: (data ?? []).map((a: any) => ({
            ...a,
            stato: a.prossima_scadenza < oggi ? 'SCADUTO' : (() => {
              const diff = Math.floor((new Date(a.prossima_scadenza).getTime() - oggiD.getTime()) / 86400000)
              return diff <= (a.preavviso_giorni ?? 30) ? `scade_tra_${diff}_giorni` : 'ok'
            })(),
          })),
        }
      }

      case 'get_attrezzature': {
        const { data } = await db.from('attrezzature')
          .select('id, nome, categoria, stato, data_ultima_manutenzione, data_prossima_manutenzione, frequenza_manutenzione, fornitore_nome')
          .order('nome')
        const ora = Date.now()
        let items = data ?? []
        if (input.solo_alert) {
          items = items.filter((a: any) => {
            if (!a.data_prossima_manutenzione) return false
            const diff = Math.floor((new Date(a.data_prossima_manutenzione).getTime() - ora) / 86400000)
            return diff <= 30
          })
        }
        return {
          attrezzature: items.map((a: any) => ({
            ...a,
            stato_manutenzione: (() => {
              if (!a.data_prossima_manutenzione) return 'non_programmata'
              const diff = Math.floor((new Date(a.data_prossima_manutenzione).getTime() - ora) / 86400000)
              if (diff < 0) return 'SCADUTA'
              if (diff <= 30) return `scade_tra_${diff}_giorni`
              return 'ok'
            })(),
          })),
        }
      }

      case 'get_agenda': {
        const giorni  = input.giorni ?? 30
        const ora_    = new Date()
        const fino    = new Date(ora_.getTime() + giorni * 24 * 60 * 60 * 1000)
        const oggiStr = ora_.toISOString().split('T')[0]
        const finoStr = fino.toISOString().split('T')[0]

        let tasksQ = db.from('tasks')
          .select('id, titolo, stato, priorita, scadenza, assegnato_a, profili!tasks_assegnato_a_fkey(nome, cognome)')
          .in('stato', ['da_fare', 'in_corso'])
          .is('deleted_at', null)
          .lte('scadenza', finoStr)
          .gte('scadenza', oggiStr)
          .order('scadenza')
        if (input.profilo_id) tasksQ = (tasksQ as any).eq('assegnato_a', input.profilo_id)
        const { data: tasks } = await tasksQ

        let ademQ = db.from('adempimenti')
          .select('id, titolo, categoria, prossima_scadenza, preavviso_giorni, responsabile_profilo_id, responsabile_profilo:profili!adempimenti_responsabile_profilo_id_fkey(nome, cognome)')
          .eq('attivo', true)
          .lte('prossima_scadenza', finoStr)
          .gte('prossima_scadenza', oggiStr)
          .order('prossima_scadenza')
        if (input.profilo_id) ademQ = (ademQ as any).eq('responsabile_profilo_id', input.profilo_id)
        const { data: adempimenti } = await ademQ

        return {
          periodo:              `${oggiStr} → ${finoStr}`,
          tasks:                (tasks ?? []).slice(0, 30),
          adempimenti:          (adempimenti ?? []).slice(0, 30),
          totale_task:          tasks?.length ?? 0,
          totale_adempimenti:   adempimenti?.length ?? 0,
        }
      }

      default:
        return { errore: `Strumento sconosciuto: ${toolName}` }
    }
  } catch (err: any) {
    return { errore: err?.message ?? String(err) }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const adminDb = createAdminClient()
  const { data: profilo } = await adminDb.from('profili').select('nome, cognome, ruolo').eq('id', user.id).single()
  if (!profilo) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 403 })

  // ── Rate limiting per utente ──────────────────────────────────────────────
  const rl = checkRateLimit(`ai:${user.id}`, AI_RATE_LIMIT, AI_WINDOW_MS)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Hai raggiunto il limite di messaggi per questa ora. Riprova tra ${rl.retryAfterSeconds < 120 ? `${rl.retryAfterSeconds} secondi` : `${Math.ceil(rl.retryAfterSeconds / 60)} minuti`}.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'GROQ_API_KEY non configurata. Vai su Vercel → Settings → Environment Variables e aggiungila.',
    }, { status: 500 })
  }

  // ── Leggi il body (snapshot client ignorato — lo generiamo server-side) ──
  const { messages, sessionId } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Nessun messaggio' }, { status: 400 })

  // ── Snapshot operativo server-side — sempre fresco, sempre trusted ────────
  let snapshotOperativo = ''
  try {
    snapshotOperativo = await buildOperativoSnapshot(adminDb)
  } catch {
    // Fallback: Lina risponde senza snapshot (gli strumenti restano disponibili)
    snapshotOperativo = '(snapshot operativo non disponibile — usa gli strumenti per dati reali)'
  }

  const userRole: string = profilo.ruolo
  const userName = `${profilo.nome} ${profilo.cognome}`.trim()
  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const systemMessage = {
    role: 'system' as const,
    content: `Sei Lina, l'assistente AI integrata nel gestionale RIDENTIUM di uno studio dentistico.
Stai parlando con ${userName} (ruolo: ${userRole}). Data odierna: ${today}

IDENTITÀ:
- Nome: Lina
- Tono: professionale, preciso e cordiale. Usa sempre l'italiano.

STATO OPERATIVO ATTUALE DELLO STUDIO (generato in tempo reale dal gestionale):
${snapshotOperativo}

Usa questo snapshot per rispondere immediatamente a domande sullo stato del studio.
Per elenchi completi, nomi specifici o dettagli aggiuntivi non presenti nello snapshot, usa gli strumenti.
Se un dato non è presente nello snapshot né nei risultati degli strumenti, di' chiaramente che non è disponibile — non inventare mai numeri o informazioni.

RUOLO:
- Sei un assistente di analisi e briefing operativo.
- Non puoi creare task, ordini o riordini. Non puoi modificare dati nel gestionale.
- Se l'utente chiede di creare qualcosa, spiegagli come farlo manualmente nella sezione corretta del gestionale.
- Per azioni urgenti (es. adempimento scaduto, prodotto esaurito), descrivi cosa fare e dove andare nel gestionale.

REGOLE:
1. Rispondi in italiano, sii conciso ma completo
2. Usa sempre lo snapshot come prima fonte — è già aggiornato
3. Chiama gli strumenti solo se l'utente chiede dettagli non coperti dallo snapshot
4. Non inventare mai dati non presenti nello snapshot o negli strumenti
5. Menziona sempre la sezione del gestionale dove l'utente può agire (es. "vai in /admin/adempimenti")

ID utente: ${user.id}`,
  }

  // ── Agentic loop ──────────────────────────────────────────────────────────
  const conversationMessages: any[] = [systemMessage, ...messages]
  let finalText = ''
  const MAX_ITERATIONS = 6

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let resp: Response
    try {
      resp = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:        MODEL,
          messages:     conversationMessages,
          tools:        ALL_TOOLS,
          tool_choice:  'auto',
          max_tokens:   2048,
          temperature:  0.3,
        }),
      })
    } catch (networkErr) {
      console.error('[ai/chat] Groq network error:', networkErr)
      return NextResponse.json({ error: 'Servizio AI temporaneamente non disponibile. Riprova tra qualche momento.' }, { status: 503 })
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error(`[ai/chat] Groq error ${resp.status}:`, errText.substring(0, 500))
      return NextResponse.json({ error: 'Errore nel servizio AI. Riprova tra qualche momento.' }, { status: 500 })
    }

    const result = await resp.json()
    const choice = result.choices?.[0]
    if (!choice) break

    const assistantMessage = choice.message
    conversationMessages.push(assistantMessage)

    if (choice.finish_reason === 'stop' || !assistantMessage.tool_calls?.length) {
      finalText = assistantMessage.content ?? ''
      break
    }

    if (choice.finish_reason === 'tool_calls') {
      for (const toolCall of assistantMessage.tool_calls) {
        let input: Record<string, unknown> = {}
        try {
          input = JSON.parse(toolCall.function.arguments ?? '{}')
        } catch {
          console.error('[ai/chat] Invalid tool arguments:', toolCall.function.arguments?.slice(0, 200))
        }
        const toolResult = await executeTool(toolCall.function.name, input, adminDb)
        conversationMessages.push({
          role:         'tool',
          tool_call_id: toolCall.id,
          content:      JSON.stringify(toolResult),
        })
      }
    }
  }

  // ── Salva in Supabase (best-effort) ───────────────────────────────────────
  let returnedSessionId = sessionId ?? null
  try {
    if (!returnedSessionId) {
      const firstMsg = typeof messages[0]?.content === 'string' ? messages[0].content : ''
      const { data: sess } = await adminDb.from('ai_sessioni').insert({
        utente_id: user.id,
        titolo:    firstMsg.substring(0, 60) || 'Nuova chat',
      }).select('id').single()
      returnedSessionId = sess?.id ?? null
    }
    if (returnedSessionId) {
      const lastUserMsg = messages[messages.length - 1]
      await adminDb.from('ai_messaggi').insert([
        { sessione_id: returnedSessionId, ruolo: 'user',      contenuto: typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '' },
        { sessione_id: returnedSessionId, ruolo: 'assistant', contenuto: finalText },
      ])
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ risposta: finalText, sessionId: returnedSessionId })
}
