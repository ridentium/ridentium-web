# BACKLOG — RIDENTIUM-WEB

> Documento di lavoro del Project Director.
> Aggiornato dopo ogni PR o sessione di lavoro significativa.
> Ultima revisione: 2026-05-06

---

## FASI DI SVILUPPO CORRENTI

### Fase 2A — Governance e documentazione
**Status: ✅ COMPLETATA**

- [x] Riscrittura CLAUDE.md con identità Project Director e regole operative
- [x] Creazione `docs/governance/BACKLOG.md` (questo file)
- [x] Creazione `docs/governance/AGENTS.md` con profili sub-agents
- [x] Definizione regole branch/push/deploy
- [x] Definizione formato report al Founder

---

### Fase 2B — Audit log su route critiche
**Status: ✅ COMPLETATA — PR #44 (2026-05-06)**
**Priorità: P0**

Coverage finale verificata su tutte le route che scrivono dati critici.

| Route | Metodo | Status | Note |
|-------|--------|--------|------|
| `/api/ricorrenti/[id]/completamento` | POST | ✅ coperta | Già presente (PR #31) |
| `/api/adempimenti` | POST | ✅ coperta | Aggiunta in PR #44 |
| `/api/adempimenti/[id]` | PATCH | ✅ coperta | Già presente |
| `/api/adempimenti/[id]/completa` | POST | ✅ coperta | Già presente |
| `/api/magazzino/riordini` | POST | ✅ coperta | Aggiunta in PR #44 |
| `/api/magazzino/evadisci` | POST | ✅ coperta | Già presente |
| `/api/tasks` | POST | ✅ coperta | Già presente |
| `/api/tasks/[id]` | PATCH | ✅ coperta | Già presente |
| `/api/impostazioni/permessi` | PATCH | ✅ coperta | Aggiunta in PR #44 — era il gap più critico |
| `/api/kpi` | PATCH | ✅ coperta | Aggiunta in PR #44 |

---

### Fase 2C — Rate limiting
**Status: 🔜 DA PIANIFICARE**
**Priorità: P0**

Valutare e implementare rate limiting su endpoint pubblici o costosi.

| Endpoint | Tipo | Rischio | Priorità |
|----------|------|---------|----------|
| `/api/crm/contatti` | Pubblico (form landing) | Spam, abuso | Alta |
| `/api/ai/chat` | Costoso (Groq API) | Costi incontrollati | Alta |

**Note:** Valutare se usare middleware Next.js con in-memory store oppure soluzione Vercel Edge (KV/Edge Config). Presentare opzioni al Founder prima di procedere se l'implementazione richiede servizi a pagamento.

---

### Fase 2D — Note sui ricorrenti
**Status: 🔜 DA PIANIFICARE**
**Priorità: P2**

La RPC `toggle_completamento_ricorrente` non accetta parametro `p_nota`.
Attualmente i ricorrenti si completano senza possibilità di aggiungere note.

**Cosa serve:**
1. Migrazione DB: aggiungere colonna `nota` alla struttura `completamenti` JSONB nella tabella `ricorrenti`
2. Aggiornare la RPC Postgres con parametro `p_nota`
3. Aggiornare route `/api/ricorrenti/[id]/completamento`
4. Ripristinare il NotePopup nel widget `TasksRicorrentiWidget`

**⚠️ Richiede approvazione Founder** — modificazione RPC e struttura dati esistente.

---

### Fase 2E — UX operativa
**Status: 🔜 DA PIANIFICARE**
**Priorità: P2**

Miglioramenti UX che non richiedono modifiche DB strutturali.

| Item | Descrizione | Complessità |
|------|-------------|-------------|
| Refresh manuale widget dashboard | Bottone per aggiornare ogni widget senza ricaricare la pagina | Bassa |
| CRM badge "da X giorni in questo stato" | Mostrare da quanto tempo un contatto è nello stato corrente | Bassa |
| Adempimenti: chi ha completato e quando | Visualizzare nome e data dell'ultima esecuzione | Media |
| Feedback creazione staff | Migliorare il feedback dopo invito nuovo membro staff | Bassa |
| Pagina offline PWA | Pagina HTML statica mostrata dal SW quando offline | Bassa |
| Breadcrumb/back link su schermate profonde | Facilitare navigazione su mobile | Media |

---

### Fase 2F — Refactoring AgendaView
**Status: 🔜 DA PIANIFICARE**
**Priorità: P3**

`AgendaView.tsx` è identificato come file fragile (>500 righe, logica multipla).
Separare in sotto-componenti senza cambiare comportamento utente.

**Regola:** Ogni step di refactoring deve essere verificato con `tsc --noEmit` e testato manualmente prima del commit successivo.

---

## BACKLOG APERTO (priorità P1-P2)

### Bug
- [ ] **Magazzino: soglia minima non editabile inline** — Per cambiare la soglia bisogna aprire il modal completo. Aggiungere double-click-to-edit. (P2)
- [ ] **Adempimenti: warning quando si cambia frequenza** — Se si passa da "mensile" ad "annuale", nessun avviso che la cronologia rimane quella vecchia. (P2)

### UX — funzionalità presenti ma migliorabili
- [ ] **Ordini: traccia chi ha ricevuto** — Manca `received_by` e `received_at`. Richiede colonna DB + API. (P1)
- [ ] **Staff non può vedere contatti fornitori** — Read-only sui contatti fornitore per il ruolo staff. (P1)
- [ ] **Registro attività: filtri avanzati** — Mancano filtri per data range, utente specifico, export CSV completo. (P2)
- [ ] **Form task: più campi nel quick-add** — Aggiungere priorità e assegnato_a nel quick-add agenda. (P2)
- [ ] **Preferenze notifiche per staff** — Staff non può disattivare notifiche non rilevanti. (P2)
- [ ] **Preferenze utente persistenti in DB** — Filtri e view mode attualmente in localStorage. (P3)

### Funzionalità mancanti (da costruire)
- [ ] **Pagination / infinite scroll** — Task, magazzino, ordini, ricorrenti caricano tutto. (P3)
- [ ] **Gestione attrezzature** — Nessuna traccia di strumenti e manutenzioni. (P2)
- [ ] **Import CSV ordini** — Inserimento multiplo prodotti. (P2)
- [ ] **Lina AI con contesto reale** — Chat AI non conosce i dati dello studio. (P3)

### Evoluzioni future (P4)
- [ ] **Calendario clinico / appuntamenti** — Agenda pazienti, timeslot, dentista, reminder
- [ ] **Preventivi e fatturazione** — Modulo fatture, scadenzario pazienti
- [ ] **CRM: history interazioni** — Timeline, tagging, tracking fonte, reminder automatici
- [ ] **Feedback/valutazioni pazienti** — NPS, 5 stelle
- [ ] **SMS a pazienti** — Twilio per reminder e follow-up
- [ ] **Dashboard personalizzabile** — Widget riordinabili/collassabili con salvataggio permanente

---

## PR COMPLETATE (storico)

| PR | Descrizione |
|----|-------------|
| #22 | 10 miglioramenti: BottomNav, export CSV, cron, filtri task, widget Oggi, storico magazzino, scheda fornitore, URL sync, quick-add, upload evidenza |
| #23 | Badge BottomNav, card mobile, evidenza visualizzata, widget Oggi interattivo, quick-add settimana, ricorrenti stato |
| #24 | Bug fix massicci: getPeriodoKey centralizzato, kanban filtri, URL params, test push, realtime commenti, profili inattivi, badge sidebar, prossimi 3 giorni |
| #25 | Agenda command center: tab Focus, EditModal drawer, FAB type picker, filtro persona |
| #26 | Bug fix: key={fabTipo}, update ottimistico EditModal, notify logging |
| #27 | Soft delete: tasks (deleted_at), ricorrenti (attiva=false+deleted_at) |
| #28 | CRM widget dashboard, storico magazzino persistente DB, ErrorBoundary |
| #29 | Bug critici: delete fisico→soft, impostazioni auth, bulkComplete via API, cron deleted_at |
| #30 | Bug medi: staff page filter, soloAlert hydration, tipi aggiornati, AgendaView URL sync |
| #31 | Architettura: ruolo CHECK constraint, RPC atomiche (FOR UPDATE), 3 indici SQL, refactoring ricorrenti |
| #32 | TypeScript: 36 errori → 0. Uint8Array, cookiesToSet, missing types |
| #33 | Zod v4: lib/validation.ts centralizzato, 5 route validate |
| #34 | UX: tab "I miei" TasksAdmin, duplica ordine, TasksStaff via API |
| #35 | Cleanup: calcolaStato() unificata, updateAdempimentoSchema, migrazione RLS notifiche |
| #36 | DB writes rimossi da widget: TasksRicorrentiWidget, ImpostazioniAdmin, SOPAdmin. Route: /api/kpi, /api/sop |
| #37 | Eliminazione completa DB writes client. 17 nuove route API. Bugfix storico magazzino |
| #38 | Cleanup: isPending fix, error check notifiche/leggi, double-click guard |
| #39 | Eliminazione logActivity client-side. logActivityServer su ordini, CRM. GET /api/magazzino |
| #40 | (storico — vedi git log) |
| #41 | Security: CRM API key fail-safe, staff server action auth guards, Promise.all agenda, delete lib/registro.ts |
| #42 | Magazzino: colonna e card mobile fornitore assegnato |
| #43 | Fase 1 bug fix: nota task come commento, useRef guard adempimenti, validazione WhatsApp, commento middleware |
| #44 | Fase 2B: audit log su 4 route scoperte (adempimenti POST, magazzino/riordini POST, impostazioni/permessi PATCH, kpi PATCH) |
