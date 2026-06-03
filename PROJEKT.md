# PROJEKT.md - CMS1 (GMB Manager)

Status na dzień: **2026-05-26** (sekcja "Stan prac w toku" zaktualizowana 2026-06-03)

## Stan prac w toku (2026-06-03)

Cel nadrzędny: doprowadzić apkę do produkcyjnej weryfikacji OAuth i działających maili.

1. **Weryfikacja produkcyjna OAuth (publish app)** - powód: apka jest w trybie Testing, przez co Google wygasza refresh_token co 7 dni i każdy user co tydzień traci dostęp. Scope `business.manage` jest **sensitive** (nie restricted), więc bez płatnego CASA, weryfikacja 3-5 dni roboczych. Wymaga własnej domeny + polityki prywatności + wideo demo.
2. **Subdomena `wizytowki.plichta.com.pl`** podpinana do apki na Vercel. Rekordy CNAME (`06112434f9a48ae4.vercel-dns-017.com.`) + TXT (`google-site-verification=...`) **zlecone do IT** (czekamy). Domena odseparowana od hostingu, przeżyje migrację na VPS.
3. **Strona `/privacy`** (`src/app/privacy/page.js`) wdrożona na produkcję (main) - wymóg weryfikacji Google. Dane Plichta + IOD inspektor@plichta.com.pl.
4. **Reset hasła** - ZROBIONE i wdrożone na produkcję 2026-06-03. Strony `/forgot-password` + `/reset-password`, endpointy, kolumny `reset_token` + `reset_token_expires` w `users`, mail przez SMTP. Przetestowane end-to-end (mail dochodzi, zmiana hasła działa). Token ważny 1h, jednorazowy.
5. **Maile przez firmowy SMTP zamiast Resend** - DZIAŁA od 2026-06-03. Firmowa skrzynka SMTP (dane w zmiennych `SMTP_HOST/PORT/USER/PASS/FROM` w Vercel env). Helper `src/lib/email.js` (`nodemailer`). Powód wyboru: brak vendor lock-in + przeżyje migrację na VPS. Resend nigdy nie był wdrożony.
6. **Subdomena CNAME działa**, brakuje rekordu **TXT `google-site-verification`** (IT pominęło, dodanie zlecone ponownie). Po dodaniu: Search Console "Verify" → OAuth consent screen → wideo demo → submit weryfikacji produkcyjnej.
7. **Alerty mailowe o opiniach** - ZROBIONE 2026-06-03. Cron `sync-reviews` przełączony z martwego Resend na helper `src/lib/email.js` (SMTP). Powiadomienia (in-app + mail) tylko dla opinii **1-2★** (negatywne), pozytywne nie generują szumu.
11. **Feedback w aplikacji** - ZROBIONE 2026-06-03. Pływający przycisk "Zgłoś uwagę" (`src/app/components/FeedbackButton.js`, w `layout.js`, widoczny po zalogowaniu) → modal: typ (błąd/uwaga/sugestia) + treść + zrzut ekranu (upload lub wklejenie Ctrl+V, max 5MB). Endpoint `/api/feedback` dokleja tożsamość zgłaszającego (z sesji) i wysyła mail przez SMTP na adres ze zmiennej `FEEDBACK_EMAIL` (Vercel env), zrzut jako załącznik. `sendEmail` w `src/lib/email.js` rozszerzony o opcjonalne `attachments`.

9. **UX alertów i synchronizacji** - ZROBIONE i wdrożone na produkcję 2026-06-03:
   - Dashboard "Synchronizuj" działa w tle (fetch) z komunikatem i spinnerem, zamiast wyrzucać usera na surowy JSON endpointu.
   - **Naprawiony bug lawiny alertów:** opinie bez treści były fałszywie wykrywane jako "edytowane" przy każdym biegu crona (porównanie `null` vs `''`), co generowało spam alertów `EDITED_REVIEW` co 5 min. Teraz `normalizeComment` (trim + null→''), alert tylko przy realnej zmianie treści. Stare fałszywe alerty wyczyszczone SQL-em.
   - Tabela `alerts` ma kolumnę **`review_id`** → w UI alertów przycisk "Zobacz opinie →" prowadzi do `/reviews?review=ID` z podświetleniem i przewinięciem. Alert edycji pokazuje "Bylo... Jest...".

10. **Wydajność list opinii** - ZROBIONE 2026-06-03. Strony `/reviews` i `/business/[id]` renderowaly wszystkie opinie naraz (Audi 1139) i zawieszaly Chrome. Teraz: sortowanie od najnowszej, **50 opinii/strone** + paginacja, filtr daty (szybkie zakresy Dzis/7d/30d/Wszystkie + wlasny zakres od-do). Domyslnie najnowsze 50.

8. **System auto-odpowiedzi na opinie** - kod wdrożony na produkcję (main) 2026-06-03, ale w fazie **UŚPIONEJ**: auto-publikacja NIE działa, dopóki nie zostanie dodany cron `auto-respond` w cron-job.org.
   - **Działa już:** powiadomienia 1-2★, UI z przyciskiem "Zaproponuj AI" (`/reviews`, `/business/[id]`) + prefill propozycji, endpoint `/api/reviews/[id]/suggest`.
   - **Reguły auto-publikacji:** 1-2★ → alert do osób z dostępem po 20h, auto-publikacja bezpiecznej formułki po 23h. 3-5★ → auto-publikacja po 22h. Liczone od `create_time` opinii. Cron `/api/cron/auto-respond` (maxDuration 300, chroniony `CRON_SECRET`).
   - **AI:** Claude **Sonnet 4.6** (`src/lib/ai.js`), fallback na sztywną formułkę gdy API padnie. Negatywne: przeprosiny + kontakt (telefon wizytówki), bez polemiki. Klucz `ANTHROPIC_API_KEY` dodany do Vercel 2026-06-03, działa. (Początkowo Haiku 4.5, podbity na Sonnet 2026-06-03 bo Haiku robił błędy polskiej odmiany. Prompt pisany poprawną polszczyzną z ogonkami + instrukcja formy grzecznościowej.)
   - **Język opinii:** Google sklejają oryginał + tłumaczenie w jednym polu `comment`. Parser `src/lib/reviewText.js` (`parseReviewComment`) rozdziela je (obsługuje format z `(Translated by Google)` i z `(Original)`). AI dostaje sam oryginał i odpowiada w jego języku, z zakazem znaku „–". UI pokazuje oryginał + tłumaczenie szarym drukiem pod spodem.
   - **Forma grzecznościowa:** model dostaje imię autora opinii (`reviewer_name`) i dobiera formę wg płci wynikającej z imienia (Pana/Pani z odmianą); gdy imię niejednoznaczne/zagraniczne/"Anonim", pisze neutralnie bez "Pan/Pani". Endpoint `suggest` pobiera `reviewer_name` w select.
   - **Kolumny w `reviews`:** `alert_sent_at`, `auto_replied_at`, `is_auto_reply`, `suggested_reply` (dodane).
   - **OTWARTE TODO przed włączeniem auto-publikacji:**
     - (a) **Dodać `ANTHROPIC_API_KEY`** do Vercel env (Marcin, jeszcze NIE zrobione) - bez tego "Zaproponuj AI" i auto-AI nie działają.
     - (b) Przetestować jakość propozycji AI w UI (przycisk "Zaproponuj AI").
     - (c) Zaktualizować stałą `CUTOFF` w `src/app/api/cron/auto-respond/route.js` na realny moment startu (inaczej pierwszy bieg crona zaleje stare opinie auto-odpowiedziami).
     - (d) Dodać zadanie crona `/api/cron/auto-respond` co 15 min z headerem `x-cron-secret` w cron-job.org → DOPIERO to uruchamia auto-publikację.

## Czym jest projekt

Webowy portal do zarządzania wizytówkami Google Business Profile. Pozwala spiąć kilka kont Google jednego użytkownika, pobierać opinie z wielu lokalizacji, odpowiadać na nie z poziomu apki, ustawiać alerty email i porównywać się z konkurencją.

Wewnętrzna nazwa: **GMB Manager** (`package.json: "gmb-manager"`).

## URL produkcyjny i repo

- **Produkcja:** https://cms1-rwp1.vercel.app/
- **GitHub:** https://github.com/TataHani/cms1 (branch `main`)
- **Lokalna ścieżka:** `C:\projekty\cms1`

## Logowanie do apki (Marcin)

- Hasło Marcina trzymane w menedżerze haseł (ustawione ręcznie przez podmianę SHA256 w tabeli `users` 2026-05-26)
- Jeżeli kiedyś zgubione → reset przez SQL update w Supabase (PROJEKT.md NIE jest miejscem na hasło)
- Rola: zależy od kolumny `role` w tabeli `users` (`admin` lub `user`)

## Stack

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 14.2.21 (App Router) |
| Język | JavaScript (czysty JS, brak TypeScript) |
| UI | React 18.2.0 + Tailwind 3.4.1 + lucide-react (ikony) |
| Baza | Supabase Cloud (Postgres) |
| Auth | Custom (cookie `user_id` + SHA256 hash w bazie) + Google OAuth |
| Integracje | Google Business Profile API (v1 i v4), Resend (email) |
| Hosting | Vercel Pro (od 2026-05-26, na 1 miesiąc) |

**Brak:** TypeScript, Zod, testów, ESLint, monorepo (Turborepo).

## Zmienne środowiskowe (.env)

Wymagane do działania:
- `NEXT_PUBLIC_SUPABASE_URL` - URL projektu Supabase
- `SUPABASE_SERVICE_KEY` - service role key (uwaga: nazwa **niezgodna** z globalnym standardem `SUPABASE_SERVICE_ROLE_KEY` z CLAUDE.md)
- `GOOGLE_CLIENT_ID` - OAuth Google
- `GOOGLE_CLIENT_SECRET` - OAuth Google
- `GOOGLE_REDIRECT_URI` - callback do logowania przez Google (np. `https://cms1-rwp1.vercel.app/api/auth/callback/google`)
- `CRON_SECRET` - sekret do autoryzacji crona sync-reviews

Opcjonalne:
- `GOOGLE_REDIRECT_URI_CONNECT` - oddzielny callback dla podpinania konta Google (fallback: podmiana `/callback/google` na `/callback/google-connect` w `GOOGLE_REDIRECT_URI`)
- `RESEND_API_KEY` - klucz Resend; bez niego maile alertów nie wychodzą

## Struktura kodu

```
src/app/
├── api/                          # 30+ endpointów
│   ├── auth/                     # login, register, logout, session, OAuth Google
│   ├── businesses/               # lista wizytówek
│   ├── business/connect/         # manualna synchronizacja wizytówek z Google
│   ├── reviews/                  # opinie + odpowiedzi + sync
│   ├── alerts/                   # alerty + count + per-id mark read
│   ├── alert-settings/           # konfiguracja alertów email
│   ├── posts/                    # posty na wizytówkę (zapisywane tylko w DB, NIE są wysyłane do Google)
│   ├── competitors/              # konkurencja (tabela competitors, brak importu z Google)
│   ├── analiza/                  # statystyki, dystrybucja ocen, ranking, trend
│   ├── admin/                    # dane admin + zmiana ról + uprawnienia
│   ├── cron/sync-reviews/        # cron pobierania opinii (chroniony CRON_SECRET)
│   ├── google-connections/       # zarządzanie połączonymi kontami Google
│   ├── debug-reviews/            # endpoint debug (HARDCODED "Ford Plichta Gdańsk")
│   └── reviews/debug/            # endpoint debug (martwy kod po `return` na linii 105)
├── components/NavBar.js
├── login, register, logout       # własny system + osobny OAuth Google
├── settings                      # konto, połączone konta Google
├── admin                         # zarządzanie userami, uprawnieniami
├── reviews                       # lista opinii + odpowiadanie
├── business/[id]                 # szczegóły wizytówki + statystyki + opinie
├── alerts                        # powiadomienia
├── alert-settings                # konfiguracja maili
├── alerts/settings               # DUPLIKAT alert-settings (taki sam kod)
├── posts                         # tworzenie/usuwanie postów (lokalnie w DB)
├── analiza                       # wykresy, statystyki
├── benchmark                     # porównanie z konkurencją
└── page.js                       # Dashboard
```

## Schemat bazy (zrekonstruowany z kodu - brak migracji w repo)

### `users`
- `id`, `email`, `name`, `avatar_url`
- `google_id`, `google_access_token`, `google_refresh_token`, `token_expires_at`
- `password_hash` (SHA256, bez salt - debt bezpieczeństwa)
- `role` ('user' lub 'admin')
- `created_at`, `updated_at`

### `google_connections`
- `id`, `user_id` (FK users), `google_id`, `google_email`, `google_name`, `google_avatar`
- `access_token`, `refresh_token`, `token_expires_at`
- `created_at`
- Unique: `(user_id, google_id)`

### `businesses` (wizytówki Google Business Profile)
- `id`, `user_id` (FK users), `google_connection_id` (FK google_connections)
- `google_account_id`, `google_location_id`, `location_name`
- `title`, `address`, `phone`, `website`, `category`
- `total_reviews`, `average_rating`, `last_synced_at`
- Unique: `(user_id, google_location_id)`

### `business_permissions`
- `id`, `user_id` (FK users), `business_id` (FK businesses)
- Daje userowi (nie-adminowi) dostęp do konkretnej wizytówki

### `reviews` (opinie z Google)
- `id`, `business_id` (FK businesses)
- `google_review_id` (unique)
- `reviewer_name`, `star_rating` (1-5), `comment`
- `has_reply`, `reply_comment`, `reply_update_time`
- `is_new`, `is_edited`, `create_time`, `update_time`
- Index: `(business_id, update_time DESC)` - dla inkrementalnego sync

### `alerts` (powiadomienia in-app)
- `id`, `user_id`, `business_id`
- `alert_type` ('NEW_REVIEW', 'EDITED_REVIEW', 'NEGATIVE_REVIEW')
- `title`, `message`, `is_read`, `created_at`

### `alert_settings` (konfiguracja maili)
- `id`, `user_id`, `business_id` (null = wszystkie)
- `email_enabled`, `email_address`
- `min_stars`, `max_stars` (zakres ocen wyzwalający alert)

### `posts`
- `id`, `business_id`
- `topic_type` ('UPDATE', 'OFFER', 'EVENT'), `summary`
- `state`, `published_at`, `created_at`
- **Uwaga:** posty są zapisywane TYLKO w DB, nie ma kodu publikującego je do Google Business Profile

### `competitors`
- `id`, `business_id`, `name`, `address`, `average_rating`, `total_reviews`
- **Uwaga:** wypełniane ręcznie/przez seed, brak endpointu importu z Google Places

## Co działa

- Logowanie email/hasło (custom auth, SHA256)
- OAuth Google (login + osobno podpięcie konta Google, oba scope `business.manage` + `plus.business.manage`)
- Pobieranie wizytówek z Google Business Profile API
- Pobieranie opinii z paginacją - **iteruje po wszystkich połączeniach Google użytkownika** (fix `c6d470d`)
- Odpowiadanie na opinie (Google API v4 + zapis do DB)
- Cron sync-reviews (chroniony `CRON_SECRET`, wysyła maile przez Resend, wywoływany z cron-job.org)
- Alerty in-app + per-business email
- Analiza: statystyki, dystrybucja, ranking, trend (12 miesięcy)
- Benchmark vs konkurencja (dane z `competitors` wypełniane ręcznie)
- Panel admina: role userów, granty uprawnień do wizytówek
- Posty: tworzenie i usuwanie lokalnie (NIE publikuje do Google)
- **Inkrementalny sync opinii** (od 2026-05-28) - sync pobiera tylko opinie nowsze niż max(update_time) z DB z marginesem 1h. Przerywa paginację Google API gdy strona zawiera opinie starsze. Pierwszy sync wizytówki ściąga wszystko (long-running), kolejne biegi są szybkie (~5-15s). Sortowanie Google API: `orderBy=updateTime desc`.
- maxDuration **800s** dla cron `sync-reviews` (Vercel Pro), **300s** dla `reviews/sync` (per-user). 800s jest buforem na pierwszy import nowych wizytówek.
- Strona szczegółów wizytówki `/business/[id]`: dane kontaktowe, statystyki, dystrybucja ocen 1-5, lista opinii z reply
- Filtr "Bez odpowiedzi" z cutoff od **2026-05-01** - historyczne opinie sprzed tej daty ignorowane (działa w `/reviews`, `/business/[id]`, `/analiza`)

## Stan deploya (2026-05-26)

Dziś zpushowane commity:
- `60ab380` fix: reviews endpoint dla właściciela wizytówki + paginacja sync opinii
- `c6d470d` fix: sync opinii iteruje po wszystkich połączeniach Google (nie tylko najnowszym)
- `1952d73` fix: dodany scope `plus.business.manage` w connect-google
- `486b117` fix: maxDuration 300s dla sync routes (timeout Vercela)
- `d4006c2` fix: limit 50000 rows w queries do reviews/alerts (default Supabase to 1000)
- `c94a6e2` feat: strona szczegółów wizytówki `/business/[id]` (323 linie)
- `b364540` feat: filtr "bez odpowiedzi" z cutoff **2026-05-01** (historyczne opinie ignorowane)
- `4b9b8c4` chore: uproszczony label przycisku "Bez odpowiedzi"

**Supabase Settings:** `Max Rows` podniesiony z 1000 do **50000** (Settings -> API -> Max Rows). Bez tego `.limit(50000)` w kodzie i tak był capowany na max_rows projektu.

## Stan synchronizacji per konto cms1 (2026-05-26)

| Konto cms1 | Połączenie Google | Wizytówki | Świeży sync |
|---|---|---|---|
| Marcin (login 1) | 1 | Ford Plichta Gdańsk | TAK (2 opinie) |
| Marcin (login 2) | 1 | 1x Audi | TAK (1139 opinii) |
| Koleżanka | 1 (token wygasł) | 11x VW | NIE (zamrożone na starym stanie) |
| Kolega (audi) | 1 | wizytówki Audi | TAK od 2026-05-28 (inkrementalny sync) |

**13+ wizytówek w bazie**. VW pozostanie zamrożone do momentu gdy koleżanka zrobi reconnect (login na jej konto cms1 -> /settings -> Odłącz/Połącz Google -> sync). Konkretne adresy email użytkowników w tabeli `google_connections` w Supabase, nie tutaj.

## Cron-job.org

Sync uruchamiany automatycznie przez zewnętrzny scheduler **cron-job.org** (wywołuje `/api/cron/sync-reviews` z headerem `x-cron-secret`).

- Częstotliwość: **co 5 minut**
- Cron odświeża tokeny i ściąga nowe opinie dla wszystkich połączeń ze świeżym refresh_token
- Po reconnect Google konta -> kolejny cron run zaktualizuje opinie
- Wygasłe refresh tokeny są pomijane (cron nie spamuje)

## Decyzje i kontekst

### Vercel Pro (decyzja 2026-05-26)
- Kupione na 1 miesiąc bo wcześniej Free Plan przekroczył quota
- Kalkulacja: Vercel Pro $20 + Supabase Pro $25 = $45/mo ~ 180 PLN/mo
- **Plan:** w tym samym miesiącu postawić własny VPS + Coolify (~25 PLN/mo) i zmigrować
- VPS opłaca się 7x taniej

### Supabase
- Projekt **Healthy** (2026-05-26)
- Komunikat "grace period ended 11 May, 2026" to ogólny banner Fair Use Policy, nie blokada
- Aktualnie poniżej limitów Free Tier
- Trzymamy w chmurze dopóki nie postawimy self-hosted

### Strategiczne
- Apka jest oddzielona od głównego monorepo firmowego - została zbudowana wcześniej niż reguły z globalnego CLAUDE.md
- Po migracji na VPS warto rozważyć przepisanie do strict TypeScript + Zod + abstrakcji Supabase (zgodnie z global CLAUDE.md)

## Znane problemy (security i tech debt)

1. **SHA256 bez salt** w `hashPassword()` - podatne na rainbow table attacks. Powinno być bcrypt (`bcryptjs`)
2. ~~**Brak forgot password**~~ - ROZWIĄZANE 2026-06-03 (self-service reset przez email, patrz "Stan prac w toku" pkt 4)
3. **RLS świadomie WYŁĄCZONY** (2026-05-26) - próby włączenia padały bo SDK `@supabase/supabase-js: 2.39.3` autoryzuje klienta jako **anon** mimo że w env jest service_role JWT. Policy `TO service_role` nie jest triggered. Apka jest **w praktyce bezpieczna** (cały backend używa service_role key, frontend nie łączy się bezpośrednio z Supabase, anon_key nie jest w kodzie), ale Supabase krzyczy w dashboardzie. **Do naprawy przy migracji na VPS** (od zera, ze świeżą konfiguracją + nowsze SDK)
4. **Service role key w nazwie `SUPABASE_SERVICE_KEY`** zamiast standardowego `SUPABASE_SERVICE_ROLE_KEY` - inconsistency z global CLAUDE.md
5. **Duplikat `alert-settings` i `alerts/settings`** - dwie identyczne strony (refactor jako TODO, nie pilne)
6. **Hardcoded "Ford Plichta Gdańsk"** w `api/debug-reviews/route.js` - debug endpoint do usunięcia
7. **Martwy kod w `api/reviews/debug/route.js`** od linii 107 (po `return Response.json({ debug })` na linii 105)
8. **Cookie `user_id` nie podpisane** (`httpOnly` tak, ale brak signed cookie / JWT) - ktoś kto wykradnie ciasteczko ma sesję
9. **Brak `.env.example`** w repo - nowy dev nie wie jakie zmienne potrzebne
10. **Brak `vercel.json`** z konfiguracją crona - cron wywoływany z zewnętrznego scheduler cron-job.org (działa)
11. **Tabela `posts` z kodu nie istnieje w bazie** - przy próbie tworzenia posta apka padnie. Albo dodać migrację, albo usunąć endpoint
12. **SDK Supabase 2.39.3 (styczeń 2024) jest stary** - nie obsługuje nowych API kluczy (`sb_secret_`/`sb_publishable_`), powoduje problem z RLS. Upgrade do 2.50+ jako część migracji
13b. **Maile w ogóle nie wychodzą** (potwierdzone 2026-06-03) - Resend nigdy nie został wdrożony (brak klucza API). Funkcja `sendEmail` w cronie po cichu pomija wysyłkę, gdy brak konfiguracji. Skutek: **alerty email o nowych opiniach NIE działają**, mimo że kod istnieje (sekcja "Co działa" była w tym punkcie nieaktualna). Rozwiązanie: firmowy SMTP (patrz "Stan prac w toku" pkt 5).
13. **OAuth consent screen w trybie Testing** (potwierdzone 2026-06-02) - reconnect Google daje 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` przy `ListAccounts` gdy użytkownik NIE jest na liście Test users. To NIE błąd klikania consent ani apki - Google odrzuca restricted scope `business.manage` dla nie-test-userów. **Fix:** Google Cloud Console -> APIs & Services -> OAuth consent screen -> Test users -> dodać email Google użytkownika -> użytkownik robi reconnect (settings -> Odłącz/Połącz Google). **Uwaga:** w trybie Testing Google unieważnia refresh_token po **7 dniach**, stąd cykliczne zamrażanie wizytówek (np. VW koleżanki). Trwałe rozwiązanie: opublikować apkę (Production) - wymaga weryfikacji Google dla restricted scope.

## Plan migracji na VPS (do końca miesiąca Vercel Pro, ~2026-06-26)

1. Hetzner CX22 (~25 PLN/mo) + Coolify
2. Repo TataHani/cms1 -> Coolify deploy z GitHub
3. Domena + SSL Let's Encrypt
4. Supabase **zostaje w chmurze** na początku (mniej ryzyka)
5. Po stabilizacji - opcjonalnie migracja Supabase na self-hosted na tym samym VPS

## Do zrobienia przy migracji (z punktów wyżej)

- **Upgrade `@supabase/supabase-js` do 2.50+** (problem z anon vs service_role w nowych instancjach)
- **Włączenie RLS** + policies dla wszystkich tabel (point 3 z listy problemów)
- **Bcrypt zamiast SHA256** dla haseł (point 1)
- **Forgot password flow** (point 2)
- **Dodać tabelę `posts`** lub usunąć endpoint (point 11)
- **Usunąć debug endpointy** `api/debug-reviews`, `api/reviews/debug` (point 6, 7)
- **Dodać `.env.example`** (point 9)
- **Refactor duplikatu** `alert-settings` (point 5)

## Polecenia

```bash
# Dev lokalny
cd C:\projekty\cms1
npm run dev          # localhost:3000

# Build
npm run build
npm start

# Sync opinii (manualnie przez przeglądarkę, wymaga zalogowania)
https://cms1-rwp1.vercel.app/api/reviews/sync

# Sync opinii (cron, wymaga CRON_SECRET w nagłówku)
curl -H "x-cron-secret: TWOJ_SECRET" https://cms1-rwp1.vercel.app/api/cron/sync-reviews
```

## Notatki o multi-user (KRYTYCZNE do zrozumienia)

Apka jest **multi-tenant** - każdy user cms1 podpina swoje konto Google. Sync per-user (`/api/reviews/sync`) ściąga opinie **tylko z połączeń tego usera**. Admin widzi wszystkie wizytówki, ale klikając ręczny sync ściąga tylko **swoje**.

Żeby zaktualizować wizytówki innego usera, trzeba:
- Albo: zalogować się jako ten user i odpalić sync
- Albo: poczekać na cron (cron-job.org -> `/api/cron/sync-reviews` iteruje po WSZYSTKICH połączeniach)

**Wygasłe tokeny:** Google unieważnia refresh_token po długiej bezczynności (~2-6 miesięcy). Cron nie naprawi - trzeba ręczny reconnect (settings -> odłącz/połącz Google + cofnij dostęp w https://myaccount.google.com/permissions żeby Google pokazał świeży consent).

## Historia ostatnich zmian (top commitów)

```
4b9b8c4 chore: simplify unanswered button label
b364540 feat: filter unanswered reviews by 2026-05-01 cutoff
c94a6e2 feat: add business detail page with stats, distribution and reviews
d4006c2 fix: raise row limit to 50000 in reviews and alerts queries
486b117 fix: increase maxDuration to 300s for sync routes
1952d73 fix: add plus.business.manage scope to connect-google OAuth flow
c6d470d fix: sync reviews for all google connections, not just the latest
60ab380 fix: reviews endpoint for business owners and sync pagination for all reviews
fb358e5 fix: show own businesses for regular users, guide to settings if no Google connection
b7f436d fix: hide sync/connect buttons from non-admin users
a2c7ed0 feat: save and display reply timestamp
75fe0a0 chore: remove debug-reply diagnostic endpoint
4fb708a fix: revert to v4 API for review replies (confirmed working), fix error handling
b9d5a45 fix: use mybusinessreviews.googleapis.com/v1 for reply endpoint (v4 deprecated)
```

Pełna historia: `git log --oneline` w katalogu projektu.
