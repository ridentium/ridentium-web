-- ── task_commenti ─────────────────────────────────────────────────────────────
-- Commenti sui task: ogni utente autenticato può commentare e cancellare i propri.
-- Admin e manager possono cancellare qualsiasi commento.

create table if not exists task_commenti (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references tasks(id) on delete cascade,
  utente_id   uuid        not null references auth.users(id) on delete cascade,
  utente_nome text        not null,
  testo       text        not null check (char_length(testo) between 1 and 2000),
  created_at  timestamptz not null default now()
);

-- Index per query per task
create index if not exists task_commenti_task_id_idx on task_commenti (task_id, created_at);

-- RLS
alter table task_commenti enable row level security;

-- Lettura: tutti gli utenti autenticati possono leggere i commenti
create policy "Utenti autenticati possono leggere i commenti"
  on task_commenti for select
  to authenticated
  using (true);

-- Inserimento: solo il proprio utente_id
create policy "Utenti possono inserire i propri commenti"
  on task_commenti for insert
  to authenticated
  with check (auth.uid() = utente_id);

-- Cancellazione: proprio commento O admin/manager
create policy "Utenti possono cancellare i propri commenti, admin qualsiasi"
  on task_commenti for delete
  to authenticated
  using (
    auth.uid() = utente_id
    or exists (
      select 1 from profili
      where id = auth.uid() and ruolo in ('admin', 'manager')
    )
  );
