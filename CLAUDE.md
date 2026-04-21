# CLAUDE.md — Ridentium Web App

> Questo file viene letto automaticamente da Claude Code ad ogni sessione.
> Contiene tutto il contesto necessario per lavorare sul progetto.

---

## Panoramica progetto

**Ridentium** è un gestionale interno per uno studio dentistico.
Utenti: staff dello studio (admin + vari ruoli staff).
Accesso: solo via login — nessuna area pubblica.

---

## Stack tecnologico

| Tecnologia | Uso |
|---|---|
| Next.js 14 (App Router) | Framework principale |
| TypeScript | Linguaggio |
| Supabase | Auth + Database (PostgreSQL) |
| Tailwind CSS | Stile, tema custom |
| Vercel | Deploy (CI/CD automatico su push a main) |
| lucide-react | Icone |
| web-push | Push notifications server-side |

---

## Repository e deploy

- **GitHub**: `https://github.com/ridentium/ridentium-web`
- **Branch principale**: `main` — ogni push triggera deploy Vercel automatico
- **Produzione**: `https://ridentium-web.vercel.app`
- **Vercel dashboard**: `https://vercel.com/mariano-di-paolas-projects/ridentium-web`

---

## Ruoli utente

| Ruolo | Accesso |
|---|---|
| `admin` | Completo — tutte le sezioni + impostazioni |
| `staff` | Limitato — proprie sezioni |
| `aso` | Limitato |
| `segretaria` | Limitato |
| `manager` | Limitato |

Il ruolo è nella tabella `profili.ruolo` in Supabase.
La sidebar e le route si adattano automaticamente al ruolo.

---

## Struttura cartelle chiave

```
app/
  (auth)/
    login/                      ← pagina di login
  (dashboard)/
    admin/                      ← tutte le pagine admin
      page.tsx                  ← dashboard admin
      registro/page.tsx
      fornitori/page.tsx
      ricorrenti/page.tsx
      impostazioni/page.tsx
      magazzino/page.tsx
      staff/page.tsx
      tasks/page.tsx
      sop/page.tsx
      crm/page.tsx
      notifiche/page.tsx
    staff/                      ← pagine staff
      page.tsx
      ricorrenti/page.tsx
      magazzino/page.tsx
      tasks/page.tsx
      sop/page.tsx
      notifiche/page.tsx
  api/
    subscribe/route.ts          ← salva/elimina push subscription
    notifiche/
      route.ts                  ← GET lista notifiche utente
      leggi/route.ts            ← POST segna letta/tutte
      invia/route.ts            ← POST invia messaggio (solo admin)
    crm/contatti/route.ts       ← gestione lead CRM
    notify/                     ← vecchi endpoint notify
  layout.tsx                    ← root layout (font, metadata, SW)
  page.tsx                      ← redirect a /admin o /staff

components/
  Layout/
    AdminShell.tsx              ← shell principale con sidebar, header mobile, PushInit
    Sidebar.tsx                 ← navigazione laterale responsive
  Notifiche/
    NotificheBell.tsx           ← campanellino con drawer laterale (react portal)
    NotificheView.tsx           ← pagina archivio + filtri + form invio admin
  Push/
    PushInit.tsx                ← auto-registra SW e subscribe push su mount
  AI/
    ChatWidget.tsx              ← widget AI integrato
  Impostazioni/
    ImpostazioniAdmin.tsx
    PermessiAdmin.tsx
  Registro/, Ricorrenti/, Magazzino/, Tasks/, Fornitori/, Crm/
    ... componenti per ogni sezione

lib/
  notifiche.ts                  ← createNotifica() — crea notifica + invia push
  push.ts                       ← client-side: registerSW, subscribeUser, unsubscribeUser
  supabase/
    client.ts                   ← client browser (SSR)
    server.ts                   ← client server (cookies)
    admin.ts                    ← admin client (service_role, bypassa RLS)

public/
  sw.js                         ← Service Worker v6 (cache, push, iOS fix)
  manifest.json                 ← PWA manifest
  icons/                        ← icon-192.png, icon-512.png
```

---

## Database Supabase — tabelle principali

### `profili`
Estende `auth.users`. Una riga per utente.
```sql
id UUID (FK auth.users), nome TEXT, cognome TEXT, ruolo TEXT, email TEXT, ...
```

### `notifiche`
```sql
id UUID PK, user_id UUID (FK profili), tipo TEXT, titolo TEXT, corpo TEXT,
url TEXT, letta BOOLEAN DEFAULT false, created_at TIMESTAMPTZ, metadata JSONB
```
RLS: utente vede solo le proprie. Service_role può inserire.
Tipi validi: `magazzino` `task` `ricorrente` `messaggio` `crm`

### `push_subscriptions`
```sql
endpoint TEXT PK, p256dh TEXT, auth TEXT, user_id UUID (FK profili), ruolo TEXT, created_at TIMESTAMPTZ
```
Salvate automaticamente da `PushInit` → `POST /api/subscribe`.

### Altre tabelle
`registro`, `fornitori`, `ricorrenti`, `magazzino`, `tasks`, `sop`, `crm_contatti`, `profili`, `sezione_permessi`

---

## Sistema notifiche (feature completa)

### Come funziona
1. Il server chiama `createNotifica(opts)` da `lib/notifiche.ts`
2. La funzione risolve gli user_id dai ruoli → inserisce righe in `notifiche` → invia push via webpush
3. Il client (`NotificheBell`) fa polling ogni 60s su `GET /api/notifiche`
4. Il campanellino mostra il badge non letti e apre un drawer laterale

### createNotifica — utilizzo
```typescript
import { createNotifica } from '@/lib/notifiche'

await createNotifica({
  ruoli: ['admin'],           // oppure user_ids: ['uuid']
  tipo: 'crm',               // magazzino | task | ricorrente | messaggio | crm
  titolo: 'Nuovo lead CRM',
  corpo: 'Mario Rossi aggiunto',
  url: '/admin/crm',
  push: true,                // default true — invia push browser
})
```

### Push background (app chiusa)
- `PushInit` si monta in `AdminShell` → si esegue al primo load per ogni utente loggato
- Registra il Service Worker (`/sw.js`) e chiede il permesso notifiche
- Salva la subscription in `push_subscriptions` via `POST /api/subscribe`
- Il SW gestisce l'evento `push` e mostra la notifica anche ad app chiusa
- `pushsubscriptionchange` rinnova automaticamente la subscription nel DB
- **iOS**: richiede PWA installata (Condividi → Aggiungi a Home) — il banner in PushInit guida l'utente

---

## Variabili d'ambiente (Vercel + .env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://cnbghqlxarwdglxvmkti.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## Pattern e convenzioni

### Auth nelle API route
```typescript
// Utente corrente (usa session cookie)
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// Query bypassando RLS (server-side only)
const adminDb = createAdminClient()
const { data } = await adminDb.from('tabella').select('*')
```

### Stile / tema Tailwind
Colori custom definiti in `tailwind.config.ts`:
- `obsidian-*` — sfondi scuri (800 = sfondo principale)
- `cream-*` — testi chiari
- `gold-*` — accenti dorati (#C9A84C)
- `stone-*` — grigi neutri
- `alert` — rosso alert (#F87171)

### Componenti client
Tutti i componenti interattivi hanno `'use client'` in cima.
I server component fanno fetch diretto a Supabase via `createClient()`.

### Service Worker
`public/sw.js` v6 — **non intercettare mai le navigation request** (fix iOS Safari SSL).
Cache solo asset statici e immagini. API e auth sempre bypass.

---

## Feature completate (storico commit)

| Feature | Note |
|---|---|
| Auth login/logout | Supabase Auth, SSR cookies |
| Dashboard admin + staff | Sidebar responsive, ruoli separati |
| Registro trattamenti | CRUD con filtri |
| Magazzino | Gestione prodotti + soglie alert |
| Tasks | Assegnazione, scadenze, stati |
| Ricorrenti | Task automatici periodici |
| Fornitori | Anagrafica fornitori |
| SOP | Procedure operative standard |
| CRM | Gestione lead + trigger notifica su nuovo contatto |
| ChatWidget AI | Widget AI integrato nel layout |
| PWA + Service Worker | Installabile, offline per asset statici |
| Fix iOS Safari SSL | SW non intercetta navigation (v6) |
| Sistema notifiche completo | Bell + drawer + pagina archivio + filtri |
| Push background | webpush + VAPID, funziona ad app chiusa |
| PushInit auto-subscribe | Si attiva al login, gestisce permessi e iOS |

---

## Note importanti

- **Non modificare `public/sw.js`** senza testare su iOS Safari — il bypass navigation è critico
- **`createAdminClient()`** va usato solo server-side (API routes, Server Components)
- **`NotificheBell`** usa `createPortal` perché `AdminShell` ha `transform: translateX()` nella sidebar
- Il deploy è automatico: ogni push a `main` → Vercel builda in ~30s
- Supabase project ref: `cnbghqlxarwdglxvmkti`
