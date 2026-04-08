# RIDENTIUM — Guida al Deploy

Segui questi passaggi nell'ordine esatto. Richiede circa 20–30 minuti la prima volta.

---

## STEP 1 — Crea il progetto Supabase (database + auth)

1. Vai su [supabase.com](https://supabase.com) → **Start for free**
2. Accedi con GitHub o Google
3. Clicca **New project**
   - Nome: `ridentium`
   - Password DB: generane una forte e salvala
   - Regione: **West EU (Ireland)**
4. Attendi ~2 minuti che il progetto si avvii

### Esegui lo schema SQL

1. Nel pannello Supabase → **SQL Editor**
2. Clicca **New query**
3. Copia e incolla tutto il contenuto di `supabase/schema.sql`
4. Clicca **Run** ▶

### Copia le credenziali

Vai su **Project Settings → API**:
- Copia `Project URL` → è il tuo `NEXT_PUBLIC_SUPABASE_URL`
- Copia `anon public` key → è il tuo `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copia `service_role` key → è il tuo `SUPABASE_SERVICE_ROLE_KEY`

---

## STEP 2 — Crea il tuo account admin

1. In Supabase → **Authentication → Users → Add user**
2. Inserisci la tua email e una password sicura
3. Vai su **Table Editor → profili**
4. Trova la riga con la tua email
5. Modifica il campo `ruolo` da `aso` a **`admin`**
6. Modifica `nome` → `Mariano` e `cognome` → `Di Paola`

---

## STEP 3 — Deploy su Vercel

### Prima volta (dal terminale)

Assicurati di avere Node.js installato. Poi:

```bash
# Naviga nella cartella del progetto
cd ridentium-web

# Installa le dipendenze
npm install

# Installa Vercel CLI
npm install -g vercel

# Fai il deploy
vercel
```

Durante il setup Vercel ti chiederà:
- **Set up and deploy?** → Y
- **Which scope?** → il tuo account personale
- **Link to existing project?** → N
- **Project name?** → `ridentium-hq` (o quello che preferisci)
- **Directory?** → `.` (premi Invio)
- **Override settings?** → N

### Aggiungi le variabili d'ambiente

Dopo il primo deploy:
1. Vai su [vercel.com](https://vercel.com) → il tuo progetto
2. **Settings → Environment Variables**
3. Aggiungi le tre variabili:

| Nome | Valore |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | il Project URL copiato prima |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la anon key copiata prima |
| `SUPABASE_SERVICE_ROLE_KEY` | la service role key copiata prima |

4. Seleziona **Production, Preview, Development** per tutte
5. **Save**

### Re-deploy con le variabili

```bash
vercel --prod
```

L'app sarà live su `ridentium-hq.vercel.app` (o il nome che hai scelto).

---

## STEP 4 — Come aggiungere lo staff

1. Accedi con il tuo account admin su `ridentium-hq.vercel.app`
2. Vai su **Staff → Aggiungi membro**
3. Inserisci email, nome e password temporanea per Raffaella (o altri)
4. Assegna il ruolo
5. Manda a Raffaella il link e le credenziali temporanee

---

## Come aggiornare il sito in futuro

Ogni volta che Claude modifica il codice:

```bash
cd ridentium-web
vercel --prod
```

Il sito si aggiorna in ~60 secondi.

---

## Struttura del progetto

```
ridentium-web/
├── app/
│   ├── (auth)/login/        ← Pagina di login
│   ├── (dashboard)/
│   │   ├── admin/           ← Area Mariano (admin)
│   │   │   ├── page.tsx     ← Panoramica + KPI
│   │   │   ├── magazzino/   ← Gestione magazzino completa
│   │   │   ├── tasks/       ← Gestione task tutto lo staff
│   │   │   ├── sop/         ← Creazione e modifica SOP
│   │   │   └── staff/       ← Gestione utenti staff
│   │   └── staff/           ← Area staff (Raffaella, ecc.)
│   │       ├── page.tsx     ← Home con task + alert
│   │       ├── magazzino/   ← Consulta + richiedi riordino
│   │       ├── tasks/       ← Solo i propri task
│   │       └── sop/         ← Legge protocolli
├── components/
│   ├── Layout/              ← Sidebar, Header, StaffManager
│   ├── Magazzino/           ← Tabelle admin e staff
│   ├── Tasks/               ← Liste task admin e staff
│   └── SOP/                 ← Viewer e editor SOP
├── lib/supabase/            ← Client Supabase (server + browser)
├── types/                   ← TypeScript types
├── supabase/schema.sql      ← Schema database completo
└── DEPLOY.md                ← Questo file
```

---

## Note di sicurezza

- Il sito è `noindex, nofollow` — non appare nei motori di ricerca
- L'autenticazione è gestita da Supabase (sicurezza enterprise-grade)
- Row Level Security garantisce che ogni utente veda solo i dati autorizzati
- Solo l'admin può modificare magazzino, task e SOP
