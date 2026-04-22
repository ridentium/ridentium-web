# Leggimi al risveglio — 22 aprile 2026

Ciao Mariano. Mentre dormivi ho completato l'analisi critica del gestionale, sistemato
tutti i bug che ti davano più fastidio, messo in sicurezza le credenziali, e preparato
lo stato per farti tornare operativo in pochi minuti.

**Non ho toccato l'app in produzione** — tutto il lavoro è su un branch separato
(`fix/stabilizzazione-aprile`) che Vercel ha già buildato come *preview*. Prima di
mandarlo live serve solo la tua conferma (vedi sotto).

---

## ⚡ 3 azioni che devi fare tu — 5 minuti totali

Sono cose che io non posso fare da solo perché richiedono il tuo account Supabase
e la tua conferma su un merge. Ti spiego ogni passaggio come se non avessi mai visto
il pannello.

### 1 · Eseguire la migrazione SQL in Supabase (2 minuti)

Molti bug ("le notifiche task non arrivano mai", "i duplicati degli ordini") sono
colpa di **tabelle che mancano nel database** e di una logica di ricezione ordine
che non è atomica. Ho scritto lo script che sistema tutto.

1. Apri https://supabase.com/dashboard
2. Seleziona il progetto Ridentium
3. Nel menu a sinistra: **SQL Editor** → **New query**
4. Apri il file `supabase/migrations/20260422_stabilizzazione.sql` (lo trovi nel
   branch su GitHub: vai al link qui sotto e copia tutto)
   → https://github.com/ridentium/ridentium-web/blob/fix/stabilizzazione-aprile/supabase/migrations/20260422_stabilizzazione.sql
5. Copia tutto il contenuto nel SQL Editor di Supabase
6. Clicca il bottone **Run** ▶

È idempotente: puoi rieseguirla senza rischio se hai dubbi. Quello che fa è in cima
al file, spiegato in italiano.

### 2 · Aggiungere `NOTIFY_SECRET` alle variabili Vercel (1 minuto)

Serve per proteggere gli endpoint di notifica interni. Ti ho già generato un valore
casuale — copialo da qui:

```
NOTIFY_SECRET=ridentium_notify_20260422_xK9mQp7rZt2vNhLb4wEsYa8dFjUgHcVn
```

1. https://vercel.com/mariano-di-paolas-projects/ridentium-web/settings/environment-variables
2. **Add new** → nome: `NOTIFY_SECRET` → valore: quello sopra → seleziona
   **Production**, **Preview**, **Development** → **Save**
3. Se vuoi essere extra sicuro puoi rigenerarlo tu con questo comando nel terminale:
   `openssl rand -base64 32` — e usi quel valore invece del mio.

*(le altre env — VAPID, Supabase, Gmail, Groq — dovrebbero essere già presenti
in Vercel: se qualcuna manca la trovi nel file `.env.example` aggiornato.)*

### 3 · Mergiare il branch a `main` per far andare live i fix

Il preview con tutti i fix è già online (URL fra i link qui sotto). Se vuoi
testarlo prima, fallo. Poi per mandarlo live:

**Opzione A — dalla GitHub UI (più semplice):**
1. Vai su https://github.com/ridentium/ridentium-web/pull/new/fix/stabilizzazione-aprile
2. Titolo suggerito: *"Stabilizzazione Aprile — fix duplicati, sicurezza, notifiche"*
3. Clicca **Create pull request** → **Merge pull request** → **Confirm merge**
4. Vercel farà il deploy in produzione automaticamente in ~1 minuto.

**Opzione B — da terminale se preferisci:**
```bash
cd "/Users/marianodipaola/Documents/Claude/Projects/Web App/ridentium-web"
git checkout main
git pull
git merge fix/stabilizzazione-aprile
git push origin main
```

---

## ✅ Cosa ho fatto mentre dormivi (sintesi)

### Sicurezza
- **Rigenerato il PAT GitHub** — quello vecchio che era scritto in chiaro in tanti
  file è stato invalidato. Il nuovo è salvato in due posti:
  - macOS Keychain (usato in automatico dal tuo `git push`)
  - `~/.config/ridentium/github-pat.txt` (permessi `0600`, solo per te)
  Scade il **21 luglio 2026**.
- **Rimosso il PAT** dai file di documentazione locali (CLAUDE.md, CONTEXT.md)
- **Configurato git** sul clone per usare il keychain macOS (niente più PAT negli URL)
- **Aggiunto `NOTIFY_SECRET` obbligatorio** su `/api/notify/*` per bloccare chi
  non ha il secret/sessione admin

### Bug che ti davano fastidio ogni giorno
- **Ordini duplicati** (14x "Raf", 8x "monica" del 10/04) → protezione
  doppio-click su tutti i form (ordini, tasks, ricorrenti, CRM)
- **Ricezione ordine "lost update"** → spostata in una RPC Postgres atomica
  (`ricevi_ordine_tx`) con lock di riga. Due ricezioni concorrenti non si
  sovrascrivono più.
- **CRM con caratteri rotti** ("sÃ¬", "â" al posto di sì, ✓) → ripristinato
  encoding UTF-8 nel sorgente
- **Dati di test nel CRM** ("Test Deploy", "deploy-check") → verranno cancellati
  dalla migrazione SQL quando la lanci
- **Campanella notifiche** chiamava l'API 2–5 volte per ogni navigazione →
  fetch condiviso via Context + pausa polling quando la tab è in background
- **Notifiche task non arrivavano** → causa: tabella `user_notification_prefs`
  referenziata ma non esistente. La creazione è in migrazione. Aggiunto anche
  fallback nel codice: se la tabella manca il codice continua a funzionare.
- **Logout su device condiviso**: le push restavano associate all'utente vecchio.
  Ora il logout chiama `unsubscribeUser()` prima del signOut.

### Robustezza
- **Error boundary** globali (`app/error.tsx`, `app/global-error.tsx`) — niente più
  schermo bianco se una pagina crasha
- **Role check** più stringente sui POST/PATCH ordini (admin/manager/segretaria)
- **`.env.example` completo** — prima elencava 3 var, ora tutte e 11 con
  istruzioni di generazione

---

## 🔗 Link utili

- **Preview deploy (il branch con tutti i fix)**:
  https://ridentium-fefo85dkl-mariano-di-paolas-projects.vercel.app

  *(attenzione: il preview è su un dominio diverso, i cookie della sessione
  produzione non valgono → devi rifare il login per testarlo)*

- **Branch su GitHub**:
  https://github.com/ridentium/ridentium-web/tree/fix/stabilizzazione-aprile

- **Aprire PR per merge**:
  https://github.com/ridentium/ridentium-web/pull/new/fix/stabilizzazione-aprile

- **Vercel deployments**:
  https://vercel.com/mariano-di-paolas-projects/ridentium-web/deployments

- **Supabase SQL Editor**:
  https://supabase.com/dashboard → progetto Ridentium → SQL Editor

---

## 🗂 Cosa non ho toccato (a posta)

- **Rotazione VAPID keys**: rigenerarle avrebbe invalidato tutte le push
  subscription esistenti — meglio rifarle insieme quando sei sveglio, se vuoi.
- **Force-push per rimuovere il vecchio PAT dalla history git**: il PAT vecchio
  è comunque invalidato (non funziona più), quindi il valore nel history è
  innocuo. Un force-push rischierebbe di rompere riferimenti.
- **Moduli ancora deboli** che ho individuato ma non ho sistemato (sono
  secondari, non bloccano):
  - Encoding UTF-8 sui dati CRM già salvati (il fix è sul codice, i dati
    vecchi restano "sÃ¬" finché non li tocchi — posso fare uno script SQL di
    pulizia se vuoi)
  - Mobile: sidebar che non si chiude dopo click su link (fastidio minore)
  - Errori React #425/#422 in console (hydration di date/timestamp, non
    visibili all'utente)

---

## 💬 Domande frequenti

**"E se il preview rompe qualcosa e merge è già fatto?"**
→ Vercel permette rollback in 2 click: dashboard deployments → trovi la
versione precedente → "…" → **Promote to Production**. Nessuna perdita dati.

**"Il PAT vecchio nel history git è un problema?"**
→ No, è stato invalidato al momento del regenerate. Chi lo trovasse non
può usarlo per nulla.

**"Posso pushare come sempre?"**
→ Sì. Il keychain macOS salverà il PAT al primo push; dopo non ti chiede più
nulla.

---

Buon risveglio. A dopo.
