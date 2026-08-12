-- ===========================================================================
-- NAPRAWA DUPLIKATOW OPINII + ZABEZPIECZENIE NA PRZYSZLOSC
-- ===========================================================================
-- !!! WYKONANE - NIE ODPALAC PONOWNIE (stan zweryfikowany 2026-08-12) !!!
-- KROK 1 (dedup) i KROK 2 (unique constraint) zostaly juz wykonane na bazie.
-- Weryfikacja 2026-08-12: 11771 wierszy = 11771 unikalnych, 0 duplikatow,
-- constraint reviews_google_review_id_key UNIQUE (google_review_id) istnieje.
-- Plik zostaje w repo jako dokumentacja naprawy. Bezpieczny do odpalenia
-- jest wylacznie KROK 0 (sam SELECT).
-- ===========================================================================
-- Przyczyna problemu: tabela reviews nie ma unikalnego ograniczenia na
-- google_review_id, wiec upsert z onConflict w cronie nie nadpisywal opinii
-- tylko dokladal duplikaty (1140 kopii zamiast 2 realnych opinii).
-- Napompowana tabela = ogromny egress przy kazdym odczycie frontu.
--
-- UWAGA: ten skrypt USUWA dane. Odpalamy go RAZEM, krok po kroku, na zywej
-- bazie. Nie wklejaj wszystkiego na raz. Po kazdym kroku sprawdzamy wynik.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- KROK 0 (bezpieczny): diagnostyka. Ile jest duplikatow i jaka skala.
-- Sam SELECT, niczego nie zmienia. Odpal najpierw to.
-- ---------------------------------------------------------------------------

-- Laczna liczba wierszy vs liczba unikalnych opinii (roznica = duplikaty)
select
  count(*)                              as wszystkie_wiersze,
  count(distinct google_review_id)      as unikalne_opinie,
  count(*) - count(distinct google_review_id) as duplikaty_do_usuniecia
from reviews;

-- Top 20 najbardziej zduplikowanych opinii (kontrola, czy to faktycznie ten bug)
select google_review_id, count(*) as kopie
from reviews
group by google_review_id
having count(*) > 1
order by kopie desc
limit 20;


-- ---------------------------------------------------------------------------
-- KROK 1 (zmienia dane): usuniecie duplikatow w transakcji.
-- Dla kazdego google_review_id zostawiamy JEDEN wiersz:
--   1. z odpowiedzia (has_reply) jesli istnieje - nie tracimy odpowiedzi,
--   2. potem najnowszy po update_time, potem po create_time.
-- Alerty wskazujace na usuwane duplikaty przepinamy na wiersz zachowany,
-- zeby nie osierocic powiadomien.
-- ---------------------------------------------------------------------------

begin;

with ranked as (
  select
    id,
    google_review_id,
    row_number() over (
      partition by google_review_id
      order by has_reply desc,
               update_time desc nulls last,
               create_time desc nulls last
    ) as rn
  from reviews
),
keep as (
  select google_review_id, id as keep_id from ranked where rn = 1
),
dups as (
  select id, google_review_id from ranked where rn > 1
)
update alerts a
set review_id = k.keep_id
from dups d
join keep k on k.google_review_id = d.google_review_id
where a.review_id = d.id;

-- usuniecie samych duplikatow (zachowane wiersze rn=1 zostaja)
with ranked as (
  select id,
    row_number() over (
      partition by google_review_id
      order by has_reply desc,
               update_time desc nulls last,
               create_time desc nulls last
    ) as rn
  from reviews
)
delete from reviews
where id in (select id from ranked where rn > 1);

-- Kontrola PRZED zatwierdzeniem: powinno byc 0 duplikatow.
-- Jesli liczba sie zgadza -> COMMIT. Jesli cos nie tak -> ROLLBACK.
select count(*) - count(distinct google_review_id) as duplikaty_po_czyszczeniu
from reviews;

-- commit;    -- odkomentuj i odpal gdy kontrola = 0
-- rollback;  -- albo to, jesli cokolwiek nie gra


-- ---------------------------------------------------------------------------
-- KROK 2 (po udanym COMMIT): unikalne ograniczenie.
-- Od teraz upsert onConflict w cronie dziala poprawnie - duplikaty fizycznie
-- nie moga juz powstac. To zamyka problem na stale.
-- ---------------------------------------------------------------------------

alter table reviews
  add constraint reviews_google_review_id_key unique (google_review_id);
