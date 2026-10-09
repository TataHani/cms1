-- ===========================================================================
-- SESJE LOGOWANIA (zamiast ciasteczka z samym user_id)
-- ===========================================================================
-- Dotad ciasteczko zawieralo goly user_id, wazne 30 dni. Kto znal ID
-- uzytkownika, mogl sie pod niego podszyc, a sesji nie dalo sie uniewaznic.
--
-- Teraz przegladarka dostaje losowy token, a w bazie trzymamy tylko jego hash.
-- Sesja wygasa 1h po zalogowaniu albo po 15 min bez aktywnosci
-- (limity w src/lib/session.js).
--
-- Typ user_id kopiowany z users.id, bo nie wiemy, czy to uuid czy bigint.
-- RLS wylaczony jak w pozostalych tabelach (PROJEKT.md, problem nr 3).
--
-- Bezpieczne do odpalenia w calosci. Nie usuwa zadnych danych.
-- ===========================================================================

do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.users'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.sessions (
      token_hash   text primary key,
      user_id      %s not null references public.users(id) on delete cascade,
      created_at   timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      expires_at   timestamptz not null
    )$f$, id_type);
end $$;

create index if not exists sessions_user_id_idx on public.sessions (user_id);

-- Podglad aktywnych sesji (po odpaleniu bedzie pusto):
select s.user_id, u.email, s.created_at, s.last_seen_at, s.expires_at
from public.sessions s join public.users u on u.id = s.user_id
order by s.last_seen_at desc;

-- Wylogowanie konkretnej osoby ze wszystkich urzadzen:
-- delete from public.sessions where user_id = (select id from public.users where email = 'TU_EMAIL');
