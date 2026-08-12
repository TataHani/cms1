-- ===========================================================================
-- UKRYWANIE WIZYTOWEK (admin moze "usunac" wizytowke z aplikacji)
-- ===========================================================================
-- Dlaczego flaga, a nie DELETE:
-- 1. Wszystkie klucze obce do businesses maja ON DELETE CASCADE, wiec twarde
--    usuniecie wizytowki kasuje tez jej opinie, alerty, uprawnienia userow,
--    konkurencje i ustawienia alertow. Nieodwracalne.
-- 2. Wizytowka usunieta z bazy WROCILABY przy nastepnym "Polacz konto",
--    bo connect pobiera liste lokalizacji z Google od nowa.
--
-- Flaga hidden przezywa synchronizacje: upsert w business/connect nie podaje
-- kolumny hidden, wiec ON CONFLICT DO UPDATE jej nie nadpisuje.
--
-- Bezpieczne do odpalenia w calosci. Nie usuwa zadnych danych.
-- ===========================================================================

alter table businesses
  add column if not exists hidden boolean not null default false;

-- Podglad: ktore wizytowki sa ukryte (po odpaleniu bedzie pusto)
select id, title, hidden from businesses where hidden = true;

-- Przywrocenie ukrytej wizytowki (gdyby ktos ukryl przez pomylke):
-- update businesses set hidden = false where id = 'TU_ID_WIZYTOWKI';
