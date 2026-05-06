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
**Status: ✅ COMPLETATA — PR #45 (2026-05-06)**
**Priorità: P0**

| Endpoint | Limite | Finestra |
|----------|--------|----------|
| `/api/crm/contatti` | 5 req/IP | 1 ora |
| `/api/ai/chat` | 30 req/user | 1 ora |

Soluzione: `lib/rate-limit.ts` in-memory sliding window (documentato: per-instance Vercel, sufficiente per studio single-tenant). CORS headers 429 per CRM (cross-origin). Upgrade path Upstash/KV documentato.

---

### Fase 2D — Note sui ricorrenti
**Status: ✅ COMPLETATA — PR #48 (2026-05-06)**
**Priorità: P2**

- Migration `20260506_nota_ricorrenti.sql`: `CREATE OR REPLACE FUNCTION` con `p_nota TEXT DEFAULT NULL` (non distruttiva)
- API route `/api/ricorrenti/[id]/completamento`: accetta `nota` dal body JSON
- `TasksRicorrentiWidget`: NotePopup ora attivo anche per ricorrenti

⚠️ **Richiede applicazione migration in Supabase prima del deploy.**

---

### Fase 2E — UX operativa
**Status: 🔄 IN CORSO**
**Priorità: P2**

| Item | Descrizione | Status |
|------|-------------|--------|
| CRM badge "da X giorni in questo stato" | Mostrare da quanto il contatto è nello stato corrente | ✅ PR #46 |
| Adempimenti: chi ha completato e quando | Nome + data ultima esecuzione nel pannello dettaglio | ✅ PR #47 |
| Refresh manuale widget dashboard | Bottone per aggiornare ogni widget senza ricaricare | 🔜 |
| Feedback creazione staff | Migliorare feedback dopo invito nuovo membro | 🔜 |
| Pagina offline PWA | HTML statico mostrato dal SW quando offline | 🔜 |
| Breadcrumb/back link su schermate profonde | Navigazione mobile | 🔜 |

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
| #45 | Fase 2C: rate limiting in-memory (lib/rate-limit.ts, CRM 5/h per IP, AI 30/h per user) |
| #46 | Fase 2E: CRM badge "aggiornato X gg fa" nel kanban |
| #47 | Fase 2E: Adempimenti pannello dettaglio mostra chi ha completato l'ultima esecuzione |
| #48 | Fase 2D: nota facoltativa al completamento ricorrente (migration + API + widget) |
