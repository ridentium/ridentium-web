# AGENTS.md — Profili Sub-Agents Interni

> Documento di riferimento per il Project Director.
> Descrive expertise, responsabilità e princìpi operativi di ogni sub-agent.
> Non sono programmi separati — sono prospettive specialistiche che il Project Director attiva internamente.

---

## 1. Software Architect

### Quando si attiva
- Scelte di architettura (server vs client component, dove mettere la logica)
- Debito tecnico strutturale
- Scalabilità e performance a lungo termine
- Refactoring che tocca più file o moduli
- Valutazione di nuove dipendenze

### Principi operativi
- **App Router first:** preferire Server Components per fetch dati, Client Components solo dove serve interattività
- **Separazione netta server/client:** nessun DB write dal client, nessuna service_role key lato browser
- **Zero nuove librerie** se il problema si risolve con ciò che esiste nello stack
- **File fragili da monitorare:** `AgendaView.tsx` (>500 righe), `MagazzinoAdmin.tsx`, `NotificheBell.tsx`
- **Massima coerenza:** nuovi pattern devono allinearsi a quelli esistenti, non introdurne di alternativi

### Metriche di salute
- Nessun file >400 righe con logica mista (UI + fetch + business logic)
- Separazione chiara: `lib/` per utility, `app/api/` per route, `components/` per UI
- Nessuna dipendenza circolare

---

## 2. Full-Stack Developer

### Quando si attiva
- Implementazione di nuovi componenti o pagine
- Nuove API route
- Bug fix su logica applicativa
- Gestione errori e edge case
- TypeScript e Zod

### Principi operativi
- **Validazione Zod obbligatoria** su ogni API route che accetta body in input — usare `lib/validation.ts`
- **`tsc --noEmit` exit 0** prima di ogni commit — zero deroghe
- **`logActivityServer`** su ogni endpoint che modifica dati critici (tasks, magazzino, ordini, CRM, staff)
- **Tipi espliciti:** nessun `any` non documentato, nessun `as unknown as X` non motivato
- **Error handling:** ogni `fetch` e ogni RPC Supabase deve gestire il caso di errore — no silent failures
- **`select('*')` da evitare** — elencare sempre i campi necessari

### Pattern da seguire
```typescript
// Route standard
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = mySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(zodError(parsed.error), { status: 400 })

  const adminDb = createAdminClient()
  // ... logica ...
  await logActivityServer({ ... })
  return NextResponse.json({ ok: true })
}
```

---

## 3. UX/Product

### Quando si attiva
- Qualsiasi modifica visibile all'utente
- Microcopy (label, placeholder, messaggi di errore, stati vuoti)
- Layout e responsive design
- Feedback visivi su azioni utente
- Accessibilità di base

### Principi operativi
- **Staff non tecnico:** ogni messaggio deve essere comprensibile da una segreteria senza formazione informatica
- **Feedback su ogni azione:** l'utente deve sempre sapere cosa è successo (loading, successo, errore)
- **Errori leggibili:** "Numero non valido" è meglio di "Invalid phone format"
- **Tema RIDENTIUM:** usare solo le classi Tailwind del tema (`obsidian-*`, `gold-*`, `cream-*`, `stone-*`)
- **Mobile first:** tutte le modifiche vanno verificate mentalmente su 375px di larghezza
- **Stati vuoti:** ogni lista o widget deve avere uno stato vuoto informativo

### Palette colori di riferimento
| Uso | Classe |
|-----|--------|
| Sfondo principale | `bg-obsidian-800` |
| Card/pannelli | `bg-obsidian-700` o `bg-obsidian-light/10` |
| Testo principale | `text-cream` |
| Testo secondario | `text-stone` |
| Accento dorato | `text-gold` / `bg-gold/10` / `border-gold/30` |
| Successo | `text-green-400` / `bg-green-500/10` |
| Warning | `text-amber-400` / `bg-amber-400/10` |
| Errore | `text-red-400` / `bg-red-400/10` |
| Info | `text-blue-400` / `bg-blue-500/10` |

---

## 4. Dental Operations

### Quando si attiva
- Logica di business dei workflow studio
- Decisioni su come modellare dati clinici o operativi
- Verifica che una funzionalità rifletta il lavoro reale dello studio
- Interpretazione di richieste del Founder legate all'operatività

### Contesto studio
- **Ruoli reali:** odontoiatra (Mariano, owner), segreteria (prenotazioni, CRM, fatture), ASO (assistente alla poltrona, magazzino, sterilizzazione), clinici (dentisti collaboratori)
- **Flussi critici:** gestione magazzino/riordini → gli ASO usano il gestionale quotidianamente; adempimenti normativi → scadenze che non si possono perdere; CRM → lead che arrivano dal sito
- **Sensibilità:** i dati sono di uno studio medico — privacy e GDPR sono prioritari, non opzionali

### Domande da porsi prima di implementare
- Questa funzione semplifica il lavoro di chi la usa ogni giorno?
- Il flusso rispecchia come funziona realmente uno studio dentistico?
- C'è un caso d'uso che il Founder non ha esplicitato ma è ovvio dal contesto?

---

## 5. Security/GDPR

### Quando si attiva
- Qualsiasi modifica a middleware, auth, API route
- Endpoint pubblici (senza sessione richiesta)
- Gestione dati personali o sanitari
- Logging e audit trail
- Rate limiting
- Permessi e autorizzazioni per ruolo

### Principi operativi
- **Fail-safe su variabili d'ambiente:** se una env var di sicurezza non è settata, l'endpoint deve bloccare tutto (non permettere accesso libero)
- **RLS sempre attiva:** non bypassare RLS senza motivo documentato
- **`createAdminClient()` solo server-side:** la service_role key bypassa RLS — non deve mai raggiungere il browser
- **Audit log obbligatorio:** ogni scrittura su dati critici (tasks, magazzino, ordini, staff, CRM) deve produrre una riga in `registro_attivita`
- **Sessioni e cookie:** usare sempre `createServerClient` con gestione corretta dei cookie Supabase

### Checklist minima per ogni nuova route
```
[ ] L'utente è autenticato? (getUser)
[ ] Ha il ruolo appropriato? (profili.ruolo)
[ ] Il body è validato con Zod?
[ ] Viene usato adminDb solo server-side?
[ ] C'è logActivityServer per le scritture?
[ ] I messaggi di errore non rivelano dati interni?
```

### Rate limiting — stato attuale
Non ancora implementato (Fase 2C). Endpoint a rischio: `/api/crm/contatti` (pubblico), `/api/ai/chat` (costoso).

---

## 6. QA/Test

### Quando si attiva
- Prima di ogni commit
- Dopo refactoring
- Quando si aggiunge logica complessa
- Per produrre la sezione "Cosa provo io" del report

### Principi operativi
- **`tsc --noEmit` obbligatorio** — exit 1 blocca il commit
- **Casi limite da considerare sempre:**
  - Utente non autenticato
  - Ruolo non autorizzato
  - Input vuoto o malformato
  - Race condition (doppio click, submit multiplo)
  - Rete lenta o assente
- **Regressioni:** ogni fix deve verificare che i flussi adiacenti continuino a funzionare

### Checklist pre-commit
```
[ ] tsc --noEmit → exit 0
[ ] Nessun console.log/error non intenzionale lasciato
[ ] I casi limite principali sono gestiti
[ ] Il flusso happy-path funziona su mobile (375px)
[ ] Il report include passi di test chiari per il Founder
```

---

## 7. Documentation

### Quando si attiva
- Dopo ogni PR significativa
- Quando si introduce un nuovo pattern non documentato in CLAUDE.md
- Quando il backlog cambia
- Quando si aggiungono tabelle DB o RPC

### Principi operativi
- **CLAUDE.md è la fonte di verità tecnica** — mantenerlo aggiornato dopo ogni PR rilevante
- **BACKLOG.md è il documento di lavoro** — aggiornare status fasi e item dopo ogni sessione
- **Changelog leggibile:** le note PR nel backlog devono essere comprensibili anche a distanza di mesi
- **Non ridondanza:** non duplicare informazioni tra CLAUDE.md e BACKLOG.md — CLAUDE.md contiene pattern e contesto stabile, BACKLOG.md contiene stato e todolist

### Aggiornamento CLAUDE.md — quando è necessario
| Evento | Cosa aggiornare |
|--------|----------------|
| Nuova tabella DB | Sezione "Database — Tabelle principali" |
| Nuovo pattern di codice rilevante | Sezione "Pattern di codice" |
| Nuova variabile d'ambiente | Sezione "Variabili d'ambiente" |
| Nuovo file/cartella strutturale | Sezione "Struttura cartelle chiave" |
| Nuova RPC Supabase | Sezione "Pattern di codice — RPC Supabase rilevanti" |
| Nuova nota critica di sicurezza | Sezione "Note critiche" |

---

*Ultima revisione: 2026-05-06 — Governance v1.0*
