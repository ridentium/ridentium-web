import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Usa Groq llama-3.3-70b-versatile — completamente gratuito
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

// ── Tool definitions (formato OpenAI) ─────────────────────────────────────────

const ALL_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_magazzino',
      description: 'Legge le scorte del magazzino. Usalo per rispondere su prodotti, quantità, scorte o cosa è sotto soglia.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Filtra per categoria (es. Impianti, Consumabili). Ometti per tutte.' },
          solo_alert: { type: 'boolean', description: 'Se true, restituisce solo prodotti sotto la soglia minima.' },
          cerca: { type: 'string', description: 'Testo per cercare prodotto per nome o azienda.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tasks',
      description: 'Legge i task del gestionale.',
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
      name: 'create_task',
      description: 'Crea un nuovo task. Usalo quando l\'utente vuole creare o assegnare un\'attività.',
      parameters: {
        type: 'object',
        required: ['titolo', 'priorita'],
        properties: {
          titolo: { type: 'string', description: 'Titolo del task.' },
          descrizione: { type: 'string', description: 'Descrizione dettagliata.' },
          priorita: { type: 'string', enum: ['bassa', 'media', 'alta'] },
          assegnato_a_id: { type: 'string', description: 'ID staff. Se omesso, assegna all\'utente corrente.' },
          scadenza: { type: 'string', description: 'Data scadenza YYYY-MM-DD.' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_riordine',
      description: 'Crea una richiesta di riordino per un prodotto del magazzino.',
      parameters: {
        type: 'object',
        required: ['magazzino_id', 'note'],
        properties: {
          magazzino_id: { type: 'string', description: 'ID del prodotto nel magazzino.' },
          note: { type: 'string', description: 'Note sul riordine (quantità, urgenza, ecc.).' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_ordine',
      description: 'Crea un ordine e lo invia al fornitore tramite il canale predefinito. Usalo quando l\'utente vuole ordinare prodotti sotto soglia o specifici articoli da un fornitore.',
      parameters: {
        type: 'object',
        required: ['fornitore_id', 'fornitore_nome', 'righe'],
        properties: {
          fornitore_id: { type: 'string', description: 'ID del fornitore.' },
          fornitore_nome: { type: 'string', description: 'Nome del fornitore.' },
          canale: { type: 'string', enum: ['whatsapp', 'email', 'eshop', 'telefono'], description: 'Canale di invio. Se omesso usa whatsapp.' },
          note: { type: 'string', description: 'Note aggiuntive per l\'ordine.' },
          righe: {
            type: 'array',
            description: 'Lista prodotti da ordinare.',
            items: {
              type: 'object',
              required: ['prodotto_nome', 'quantita_ordinata'],
              properties: {
                magazzino_id: { type: 'string', description: 'ID prodotto magazzino (se noto).' },
                prodotto_nome: { type: 'string', description: 'Nome del prodotto.' },
                quantita_ordinata: { type: 'number', description: 'Quantità da ordinare.' },
                unita: { type: 'string', description: 'Unità di misura (pz, conf, ecc.).' },
              },
            },
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_agenda',
      description: 'Legge l\'agenda unificata: task, azioni ricorrenti e adempimenti. Usalo per rispondere su cosa c\'è in programma, scadenze imminenti o carichi di lavoro del team.',
      parameters: {
        type: 'object',
        properties: {
          profilo_id: { type: 'string', description: 'Filtra per uno specifico membro dello staff (ID profilo). Ometti per tutti.' },
          giorni: { type: 'number', description: 'Numero di giorni futuri da considerare (default 30).' },
        },
      },
    },
  },
]

// Strumenti non disponibili ad aso/segretaria
const RESTRICTED_FOR_BASIC = ['create_riordine', 'create_ordine']

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, any>,
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  userRole: string,
) {
  try {
    switch (toolName) {

      case 'get_magazzino': {
        let q = db.from('magazzino')
          .select('id, prodotto, categoria, azienda, quantita, soglia_minima, unita, diametro, lunghezza')
          .order('categoria').order('prodotto')
        if (input.categoria) q = (q as any).eq('categoria', input.categoria)
        if (input.cerca) q = (q as any).ilike('prodotto', `%${input.cerca}%`)
        const { data } = await q
        let items = data ?? []
        if (input.solo_alert) items = items.filter((i: any) => i.quantita < i.soglia_minima)
        return { prodotti: items.slice(0, 50), totale: items.length, sotto_soglia: (data ?? []).filter((i: any) => i.quantita < i.soglia_minima).length }
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

      case 'create_task': {
        const isBasic = ['aso', 'segretaria'].includes(userRole)
        const assignTo = input.assegnato_a_id ?? userId
        if (isBasic && assignTo !== userId) {
          return { errore: 'Non hai i permessi per assegnare task ad altri utenti. Contatta un admin o manager.' }
        }
        const { data, error } = await db.from('tasks').insert({
          titolo: input.titolo,
          descrizione: input.descrizione ?? null,
          priorita: input.priorita ?? 'media',
          assegnato_a: assignTo,
          creato_da: userId,
          stato: 'da_fare',
          scadenza: input.scadenza ?? null,
        }).select('id, titolo, priorita, scadenza').single()
        if (error) return { errore: error.message }
        return { successo: true, task: data, messaggio: `Task "${input.titolo}" creato.` }
      }

      case 'create_riordine': {
        const { data: item } = await db.from('magazzino').select('prodotto, quantita, soglia_minima').eq('id', input.magazzino_id).single()
        const { error } = await db.from('riordini').insert({
          magazzino_id: input.magazzino_id, richiesto_da: userId,
          note: input.note, stato: 'aperta',
        })
        if (error) return { errore: error.message }
        return { successo: true, messaggio: `Richiesta di riordino per "${item?.prodotto ?? 'prodotto'}" inviata.` }
      }

      case 'create_ordine': {
        if (!input.righe?.length) return { errore: 'Nessun prodotto specificato.' }
        const { data: ordine, error: errOrdine } = await db.from('ordini').insert({
          fornitore_id: input.fornitore_id,
          fornitore_nome: input.fornitore_nome,
          canale: input.canale ?? 'whatsapp',
          stato: 'inviato',
          note: input.note ?? null,
          data_invio: new Date().toISOString(),
          created_by: userId,
        }).select('id').single()
        if (errOrdine || !ordine) return { errore: errOrdine?.message ?? 'Errore creazione ordine' }

        const righeInsert = input.righe.map((r: any) => ({
          ordine_id: ordine.id,
          magazzino_id: r.magazzino_id ?? null,
          prodotto_nome: r.prodotto_nome,
          quantita_ordinata: r.quantita_ordinata,
          unita: r.unita ?? null,
        }))
        const { error: errRighe } = await db.from('ordini_righe').insert(righeInsert)
        if (errRighe) {
          await db.from('ordini').delete().eq('id', ordine.id)
          return { errore: errRighe.message }
        }

        const prodottiStr = input.righe.slice(0, 3).map((r: any) => r.prodotto_nome).join(', ')
        return {
          successo: true,
          ordine_id: ordine.id,
          messaggio: `Ordine creato per ${input.fornitore_nome}: ${prodottiStr}${input.righe.length > 3 ? ` +${input.righe.length - 3} altri` : ''}. Vai in /admin/ordini per seguirlo.`,
        }
      }

      case 'get_agenda': {
        const giorni = input.giorni ?? 30
        const oggi = new Date()
        const fino = new Date(oggi.getTime() + giorni * 24 * 60 * 60 * 1000)
        const oggiStr = oggi.toISOString().split('T')[0]
        const finoStr = fino.toISOString().split('T')[0]

        // Task aperti con scadenza nel range
        let tasksQ = db.from('tasks')
          .select('id, titolo, stato, priorita, scadenza, assegnato_a, profili!tasks_assegnato_a_fkey(nome, cognome)')
          .in('stato', ['da_fare', 'in_corso'])
          .is('deleted_at', null)
          .lte('scadenza', finoStr)
          .gte('scadenza', oggiStr)
          .order('scadenza')
        if (input.profilo_id) tasksQ = (tasksQ as any).eq('assegnato_a', input.profilo_id)
        const { data: tasks } = await tasksQ

        // Adempimenti con scadenza nel range
        let ademQ = db.from('adempimenti')
          .select('id, titolo, categoria, prossima_scadenza, preavviso_giorni, responsabile_profilo_id, responsabile_profilo:profili!adempimenti_responsabile_profilo_id_fkey(nome, cognome)')
          .eq('attivo', true)
          .lte('prossima_scadenza', finoStr)
          .gte('prossima_scadenza', oggiStr)
          .order('prossima_scadenza')
        if (input.profilo_id) ademQ = (ademQ as any).eq('responsabile_profilo_id', input.profilo_id)
        const { data: adempimenti } = await ademQ

        return {
          periodo: `${oggiStr} → ${finoStr}`,
          tasks: (tasks ?? []).slice(0, 30),
          adempimenti: (adempimenti ?? []).slice(0, 30),
          totale_task: tasks?.length ?? 0,
          totale_adempimenti: adempimenti?.length ?? 0,
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

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'GROQ_API_KEY non configurata. Vai su Vercel → Settings → Environment Variables e aggiungila.',
    }, { status: 500 })
  }

  const { messages, sessionId } = await req.json()
  if (!messages?.length) return NextResponse.json({ error: 'Nessun messaggio' }, { status: 400 })

  const userRole: string = profilo.ruolo
  const userName = `${profilo.nome} ${profilo.cognome}`.trim()
  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const tools = ALL_TOOLS.filter(t =>
    !(['aso', 'segretaria'].includes(userRole) && RESTRICTED_FOR_BASIC.includes(t.function.name))
  )

  const systemMessage = {
    role: 'system' as const,
    content: `Sei Lina, l'assistente AI integrata nel gestionale RIDENTIUM di uno studio dentistico.
Stai parlando con ${userName} (ruolo: ${userRole}). Data odierna: ${today}

IDENTITÀ:
- Nome: Lina
- Tono: professionale, preciso e cordiale. Usa sempre l'italiano.

PERMESSI (ruolo: ${userRole}):
${['admin', 'manager'].includes(userRole)
  ? '- Accesso completo a tutte le funzioni del gestionale'
  : '- Puoi creare task solo per te stesso\n- Per operazioni avanzate, contatta un admin o manager'}

REGOLE:
1. Usa SEMPRE gli strumenti per ottenere dati reali — non inventare informazioni
2. Prima di creare qualcosa, conferma i dettagli con l'utente se non sono chiari
3. Rispondi sempre in italiano
4. Sii conciso ma completo

ID utente: ${user.id}`,
  }

  // Agentic loop
  const conversationMessages: any[] = [systemMessage, ...messages]
  let finalText = ''
  const MAX_ITERATIONS = 6

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const resp = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversationMessages,
        tools,
        tool_choice: 'auto',
        max_tokens: 2048,
        temperature: 0.3,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return NextResponse.json({ error: `Errore Groq (${resp.status}): ${errText.substring(0, 200)}` }, { status: 500 })
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
        const input = JSON.parse(toolCall.function.arguments ?? '{}')
        const toolResult = await executeTool(toolCall.function.name, input, adminDb, user.id, userRole)
        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        })
      }
    }
  }

  // Salva in Supabase (best-effort)
  let returnedSessionId = sessionId ?? null
  try {
    if (!returnedSessionId) {
      const firstMsg = typeof messages[0]?.content === 'string' ? messages[0].content : ''
      const { data: sess } = await adminDb.from('ai_sessioni').insert({
        utente_id: user.id,
        titolo: firstMsg.substring(0, 60) || 'Nuova chat',
      }).select('id').single()
      returnedSessionId = sess?.id ?? null
    }
    if (returnedSessionId) {
      const lastUserMsg = messages[messages.length - 1]
      await adminDb.from('ai_messaggi').insert([
        { sessione_id: returnedSessionId, ruolo: 'user', contenuto: typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '' },
        { sessione_id: returnedSessionId, ruolo: 'assistant', contenuto: finalText },
      ])
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ risposta: finalText, sessionId: returnedSessionId })
}
