# BACKLOG — RIDENTIUM-WEB

> Documento di lavoro del Project Director.
> Aggiornato dopo ogni PR o sessione di lavoro significativa.
> Ultima revisione: 2026-05-07

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
**Status: ✅ COMPLETATA**
**Priorità: P2**

| Item | Descrizione | Status |
|------|-------------|--------|
| CRM badge "da X giorni in questo stato" | Mostrare da quanto il contatto è nello stato corrente | ✅ PR #46 |
| Adempimenti: chi ha completato e quando | Nome + data ultima esecuzione nel pannello dettaglio | ✅ PR #47 |
| Feedback creazione staff | InviteModal con pannello successo + auto-close 1.8s | ✅ PR #49 |
| Pagina offline PWA | HTML statico brandizzato + SW v7 network-first fallback | ✅ PR #49 |
| Refresh manuale widget dashboard | DashboardRefreshButton con spinner e router.refresh() | ✅ PR #53 |
| Breadcrumb/back link su schermate profonde | PageHeader prop breadcrumb, mobile-only sm:hidden | ✅ PR #53 |

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
- [x] **Magazzino: soglia minima non editabile inline** — SogliaMinimaEditor click-to-edit + PATCH API. (P2) — PR #51
- [x] **Adempimenti: warning quando si cambia frequenza** — Warning ambra inline sotto select. (P2) — PR #55

### UX — funzionalità presenti ma migliorabili
- [x] **Ordini: traccia chi ha ricevuto** — Migration + RPC p_received_by + API + UI. (P1) — PR #54
- [x] **Staff non può vedere contatti fornitori** — Staff magazzino mostra colonna fornitore read-only. (P1) — PR #50
- [x] **Registro attività: filtri avanzati** — Già implementati. Backlog era sfasato rispetto al codice.
- [x] **Form task: più campi nel quick-add** — Quick-add agenda con priorità + assegnato (admin). (P2) — PR #52
- [x] **Preferenze notifiche per staff** — Fix ruoli NOTIF_TYPES + filtro per-utente su /api/notify broadcast. (P2) — PR #56
- [x] **Preferenze utente persistenti in DB** — useUserPref hook + DB sync; tasks_filter, tasks_view, dashboard_hidden. (P3) — PR #59

### Funzionalità mancanti (da costruire)
- [x] **Pagination / infinite scroll** — Limit server-side su tasks/magazzino + cursor load-more su ordini. (P3) — PR #60
- [x] **Gestione attrezzature** — Tabelle DB + API + UI completa con storico manutenzioni. (P2) — PR #57
- [x] **Import CSV ordini** — Parse CSV client-side nel modal nuovo ordine + template scaricabile. (P2) — PR #58
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
| #49 | Fase 2E: feedback creazione staff (pannello successo) + pagina offline PWA + SW v7 |
| #50 | Staff: visibilità contatti fornitori in magazzino (colonna read-only con tel/email) |
| #51 | Magazzino: soglia minima editabile inline (SogliaMinimaEditor) |
| #52 | Agenda quick-add task: campi priorità e assegnato_a |
| #53 | Dashboard: bottone refresh manuale + breadcrumb mobile su pagine secondarie |
| #54 | Ordini: traccia chi ha ricevuto (migration received_by + RPC + API + UI) |
| #55 | Adempimenti: warning inline quando si modifica la frequenza |
| #56 | Preferenze notifiche staff: fix NOTIF_TYPES ruoli + filtro per-utente su /api/notify broadcast |
| #57 | Gestione attrezzature: migration + API + AttrezzatureAdmin con storico manutenzioni |
| #58 | Import CSV prodotti nel modal nuovo ordine (client-side, template scaricabile) |
| #59 | Preferenze utente in DB: hook useUserPref, migration user_prefs, 3 chiavi migrate |
| #60 | Pagination: limit server-side tasks/magazzino, cursor load-more ordini, GET /api/ordini |
