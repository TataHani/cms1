# PROJEKT.md - CMS1 (GMB Manager)

Status na dzień: **2026-08-12** (sekcja "Stan prac w toku" zaktualizowana 2026-06-03)

## Podsumowanie sesji 2026-08-12

Skrót tego, co zmieniło się tego dnia. Szczegóły w sekcjach niżej.

| Obszar | Wynik |
|---|---|
| Blokada egressem + duplikaty opinii | **ZAMKNIĘTE**. Baza działa, 0 duplikatów, constraint chroni na stałe. Poprawka payloadu `/api/reviews` na produkcji. |
| Synchronizacja VW (10 wizytówek) i Ford | **ODMROŻONE** po reconnectach Google. Stały od czerwca na wygasłych tokenach. |
| Incydent kaskady przy reconnekcie VW | Opinie odbudowane z Google (5037 = stan zgodny z Google, stare 7785 zawierało "duchy"). Uprawnienia userów nadane ponownie ręcznie. |
| Usuwanie wizytówek z panelu admina | **NOWA FUNKCJA** (ukrywanie flagą `hidden`, odporne na resync). Testowa wizytówka usunięta. |
| Auto-odpowiedzi AI na opinie | **URUCHOMIONE**. Cron co 15 min, `CUTOFF` na moment startu, limit 10 publikacji na bieg. |
| SMTP i alerty mailowe | Działają (potwierdzone mailem resetu hasła). |
| Odzyskiwanie hasła bez działającego maila | Procedura przez token z bazy, opisana niżej. |

**Znalezione i NIE naprawione** (opisane w dokumentacji z lokalizacją w kodzie):
1. Przycisk "Odlacz" w /settings kasuje wizytówki kaskadowo razem z opiniami i uprawnieniami.
2. `/forgot-password` zawsze zwraca sukces, także gdy wysyłka maila padnie.

**Pułapki diagnostyczne udokumentowane tego dnia:** `businesses.last_synced_at` nie mówi nic o świeżości opinii; `google_connections.token_expires_at` dotyczy godzinnego access tokena i jest w UTC; niepusty `refresh_token` nie oznacza działającego połączenia.

## ROZWIĄZANE - blokada egressem i duplikaty opinii (zamknięte 2026-08-12)

**Historia problemu (2026-06-10):** Supabase zwracał 402 (Egress Exceeded), limit 5 GB liczony per ORGANIZACJA (CMS1 dzieli org z projektem Parking). Diagnoza: brak unikalnego ograniczenia na `reviews.google_review_id` powodował, że `upsert` z `onConflict` w cronie dokładał duplikaty zamiast nadpisywać (1140 kopii zamiast 2 opinii - Audi Centrum Gdańsk). Napompowana tabela + front pobierający wszystkie opinie naraz = wyczerpany transfer.

**Stan po weryfikacji 2026-08-12:**
- Baza działa, 402 nie występuje.
- `select count(*), count(distinct google_review_id) from reviews` → **11771 wierszy, 11771 unikalnych, 0 duplikatów**. Tabela czysta.
- Constraint **`reviews_google_review_id_key UNIQUE (google_review_id)` ISTNIEJE** w bazie (KROK 2 skryptu został odpalony). Duplikaty fizycznie nie mogą już powstać.
- Kod jest spójny z constraintem: `onConflict: 'google_review_id'` w `api/cron/sync-reviews/route.js:187` i `api/reviews/sync/route.js:168`.
- `src/app/api/reviews/route.js` - `select('*')` zmienione na listę konkretnych kolumn (mniejszy payload przy 11771 opiniach). Zacommitowane na branchu `fix/review-egress`.
- Redundancja do odnotowania: obok węższego constraintu istnieje też `reviews_business_id_google_review_id_key UNIQUE (business_id, google_review_id)`. Nieszkodliwy, nie ruszamy.

**Skrypt `sql/fix-review-duplicates.sql`** zostaje w repo jako dokumentacja naprawy. KROK 1 (dedup) i KROK 2 (constraint) są WYKONANE - nie odpalać ponownie.

## Weryfikacja działania aplikacji (2026-08-12)

| Sprawdzenie | Wynik |
|---|---|
| `https://cms1-rwp1.vercel.app/` | 200 |
| `/login`, `/privacy` | 200 |
| `/api/reviews` bez sesji | 401 (poprawnie, auth działa) |
| `https://wizytowki.plichta.com.pl/` | **200** - subdomena odpowiada |
| `npm run build` | przechodzi czysto (37 tras) |

**Uwaga o buildzie lokalnym:** w repo NIE ma pliku `.env.local`, więc `npm run build` pada na `Error: supabaseUrl is required` w fazie "Collecting page data". To nie błąd kodu - klienci Supabase tworzeni są na poziomie modułu w route handlerach. Do zbudowania lokalnie wystarczą atrapy zmiennych (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`), bo połączenie nawiązywane jest dopiero przy zapytaniu. Na Vercelu env są ustawione, build przechodzi.

## Stan prac w toku (2026-06-03)

Cel nadrzędny: doprowadzić apkę do produkcyjnej weryfikacji OAuth i działających maili.

1. **Publikacja OAuth (Testing → Production)** - ZROBIONE 2026-07-02. Apka przełączona na "In production" w Google Auth Platform. To rozwiązuje główny problem: w trybie Testing Google wygaszał refresh_token co 7 dni (cotygodniowe zamrażanie wizytówek). W produkcji tokeny są trwałe. **Weryfikacja Google świadomie ODPUSZCZONA** - to narzędzie wewnętrzne dla kilku osób, limit 100 userów i ekran ostrzegawczy "Google nie zweryfikowało tej aplikacji" (do kliknięcia Zaawansowane → Przejdź do) nie przeszkadzają. Weryfikacja wymagałaby demo video + logo, zysk zerowy przy 3 userach.
   - **WAŻNE - jednorazowy reconnect:** tokeny wydane w trybie Testing nadal wygasną po swoich 7 dniach. Trwały token Google wydaje dopiero przy autoryzacji zrobionej JUŻ w produkcji. Dotyczy Marcina, kolegi Audi, koleżanki VW. Po tym koniec cotygodniowego zamrażania.
   - **JAK ROBIĆ RECONNECT (poprawione 2026-08-12):** Settings → **"Polacz konto"** i wybrać TO SAMO konto Google. **NIE klikać "Odlacz".** Callback robi `upsert` z `onConflict: 'user_id,google_id'` (`api/auth/callback/google-connect/route.js:66`), więc tokeny nadpisują się w istniejącym wierszu, a wizytówki i opinie zostają nietknięte. Wcześniejsza wersja tej instrukcji ("Odłącz → Połącz") była DESTRUKCYJNA, patrz ostrzeżenie niżej.
   - **CZEGO publikacja NIE zmieniła (wyjaśnione 2026-08-12):** ekrany klikane przy podłączaniu konta ZOSTAJĄ i to jest poprawne zachowanie:
     - **Ekran z listą uprawnień** apka wymusza sama parametrem `prompt=consent` (`api/auth/connect-google/route.js:28`). Bez niego Google przy ponownej autoryzacji NIE wyda `refresh_token`, tylko godzinny access token, i synchronizacja umarłaby tego samego dnia. Ten ekran jest warunkiem działania, nie usterką.
     - **Ekran "Google nie zweryfikowało tej aplikacji"** (Zaawansowane → Przejdź do) zostaje, bo weryfikacja Google została świadomie odpuszczona.
     - Publikacja zmieniła **wyłącznie trwałość refresh tokena** (7 dni → długoterminowy). Sprawdzianem sukcesu nie jest brak ekranów, tylko to, czy po tygodniu synchronizacja nadal działa.
2. **Subdomena `wizytowki.plichta.com.pl`** - **DZIAŁA WSZĘDZIE, to podstawowy adres aplikacji** (zweryfikowane 2026-08-12). CNAME → `06112434f9a48ae4.vercel-dns-017.com` → 216.150.1.129 / 216.150.16.129. TXT `google-site-verification` na subdomenie ostatecznie NIEPOTRZEBNY - domena root `plichta.com.pl` jest już zweryfikowana w Search Console na koncie Marcina.
   - **SPLIT-HORIZON DNS ROZWIĄZANY:** problem z 2026-07-02 (wewnętrzna strefa `plichta.com.pl` na AD `pladsrv01`, 192.168.40.10/11, bez rekordu `wizytowki` → NXDOMAIN z sieci firmowej) już nie występuje. IT dodało rekord: firmowe serwery DNS rozwiązują subdomenę poprawnie, `/login` zwraca 200 z sieci firmowej.
   - **W komunikacji z użytkownikami używać `wizytowki.plichta.com.pl`**, nie adresu `cms1-rwp1.vercel.app`. Linki w mailach wysyłanych przez system (alert o negatywnej opinii z `sync-reviews`, ponaglenie 20h z `auto-respond`) przestawione na tę domenę 2026-08-12.
   - **UWAGA:** adres `cms1-rwp1.vercel.app` nadal działa i **musi zostać** w `GOOGLE_REDIRECT_URI` - jest wpisany w Google Cloud Console jako authorized redirect URI. Zmiana wymagałaby edycji konfiguracji OAuth po stronie Google, więc logowanie przez Google celowo zostaje na adresie Vercela.
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

8. **System auto-odpowiedzi na opinie** - **AKTYWNY od 2026-08-12**. Cron `auto-respond` dodany w cron-job.org (co 15 min), auto-publikacja do Google działa. Jakość propozycji AI zweryfikowana ręcznie na kilkunastu opiniach przed włączeniem (polska odmiana, forma grzecznościowa, brak polemiki przy negatywnych - wszystko OK). Kod wdrożony na produkcję 2026-06-03, uśpiony do 2026-08-12.
   - **Wyłączenie awaryjne:** wyłączyć zadanie `auto-respond` w cron-job.org. Publikacja staje natychmiast. Odpowiedzi już opublikowanych w Google to NIE cofa.
   - **Kto dostaje ponaglenie 1-2★ po 20h** (`getRecipients` w `api/cron/auto-respond/route.js:91`): właściciel wizytówki (`businesses.user_id`) + wszyscy z wpisem w `business_permissions` dla tej wizytówki + **wszyscy użytkownicy z rolą `admin`**. Zachowanie potwierdzone jako pożądane 2026-08-12 (Marcin jest jedynym adminem, więc "admini" = "Marcin").
     - **UWAGA na przyszłość:** nadanie komuś roli `admin` automatycznie zapisuje go na ponaglenia ze WSZYSTKICH wizytówek, także tych, z którymi nie ma nic wspólnego. Gdy pojawi się drugi admin, przełączyć na osobną zmienną env z adresem stałego odbiorcy zamiast odpytywania roli.
   - **Działa już:** powiadomienia 1-2★, UI z przyciskiem "Zaproponuj AI" (`/reviews`, `/business/[id]`) + prefill propozycji, endpoint `/api/reviews/[id]/suggest`.
   - **Reguły auto-publikacji (zmienione 2026-08-13):** 1-2★ → ponaglenie do osób z dostępem po **2h**, auto-publikacja bezpiecznej formułki po **20h**. 3-5★ → auto-publikacja po 22h. Liczone od `create_time` opinii. Cron `/api/cron/auto-respond` (maxDuration 300, chroniony `CRON_SECRET`). Stare wartości (20h/23h) oznaczały, że przez pierwszą dobę nikt nie dostawał żadnego sygnału o negatywnej opinii.
   - **AI:** Claude **Sonnet 4.6** (`src/lib/ai.js`), fallback na sztywną formułkę gdy API padnie. Negatywne: przeprosiny + kontakt (telefon wizytówki), bez polemiki. Klucz `ANTHROPIC_API_KEY` dodany do Vercel 2026-06-03, działa. (Początkowo Haiku 4.5, podbity na Sonnet 2026-06-03 bo Haiku robił błędy polskiej odmiany. Prompt pisany poprawną polszczyzną z ogonkami + instrukcja formy grzecznościowej.)
   - **Język opinii:** Google sklejają oryginał + tłumaczenie w jednym polu `comment`. Parser `src/lib/reviewText.js` (`parseReviewComment`) rozdziela je (obsługuje format z `(Translated by Google)` i z `(Original)`). AI dostaje sam oryginał i odpowiada w jego języku, z zakazem znaku „–". UI pokazuje oryginał + tłumaczenie szarym drukiem pod spodem.
   - **Forma grzecznościowa:** model dostaje imię autora opinii (`reviewer_name`) i dobiera formę wg płci wynikającej z imienia (Pana/Pani z odmianą); gdy imię niejednoznaczne/zagraniczne/"Anonim", pisze neutralnie bez "Pan/Pani". Endpoint `suggest` pobiera `reviewer_name` w select.
   - **Kolumny w `reviews`:** `alert_sent_at`, `auto_replied_at`, `is_auto_reply`, `suggested_reply` (dodane).
   - **OTWARTE TODO przed włączeniem auto-publikacji:**
     - (a) ~~Dodać `ANTHROPIC_API_KEY` do Vercel env~~ - ZROBIONE 2026-06-03, klucz działa.
     - (b) **Przetestować jakość propozycji AI w UI** (przycisk "Zaproponuj AI") - NADAL OTWARTE, zrobić przed krokiem (d).
     - (c) ~~Zaktualizować stałą `CUTOFF`~~ - ZROBIONE 2026-08-12, ustawiona na `2026-08-12T00:00:00Z`.
     - (d) ~~Dodać zadanie crona `/api/cron/auto-respond` co 15 min~~ - ZROBIONE 2026-08-12, system aktywny.

   - **ZABEZPIECZENIA auto-publikacji (dodane 2026-08-12):**
     - `CUTOFF = 2026-08-12T00:00:00Z` - system nie tyka opinii starszych niż moment uruchomienia. Stara wartość (2026-06-03) oznaczałaby, że pierwszy bieg crona opublikuje w Google odpowiedzi na całą zaległą historię od czerwca. Po reimporcie VW to setki opinii. **Publikacja w Google jest nieodwracalna.**
     - `MAX_PUBLISH_PER_RUN = 10` - limit publikacji na jeden bieg crona (przy limicie 1000 kandydatów w zapytaniu). Ogranicza skalę ewentualnej pomyłki. Cron co 15 min, więc normalny ruch (kilka opinii dziennie) i tak się mieści. Podnieść dopiero po okresie obserwacji.
     - Alerty i propozycje AI generują się normalnie dla wszystkich kandydatów - limit dotyczy WYŁĄCZNIE publikacji do Google.

## Usuwanie wizytówek z panelu admina (dodane 2026-08-12)

Panel admina ma przy każdej wizytówce ikonę kosza. Kliknięcie **ukrywa** wizytówkę (`businesses.hidden = true`), NIE kasuje jej z bazy.

**Dlaczego ukrycie, a nie DELETE:**
1. Wszystkie FK do `businesses` mają `ON DELETE CASCADE` - twardy delete skasowałby opinie, alerty, uprawnienia, konkurencję i ustawienia alertów.
2. Wizytówka usunięta z bazy **wróciłaby** przy następnym "Polacz konto", bo connect pobiera listę lokalizacji z Google od nowa. Flaga `hidden` przeżywa synchronizację, bo `upsert` w `business/connect` nie podaje tej kolumny, więc `ON CONFLICT DO UPDATE` jej nie nadpisuje.

**Migracja:** `sql/add-hidden-to-businesses.sql` (bezpieczna, nic nie usuwa). **Trzeba ją odpalić przed deployem**, inaczej wszystkie zapytania filtrujące po `hidden` zwrócą błąd.

**Endpoint:** `DELETE /api/admin/businesses/[id]` (tylko rola `admin`).

**Gdzie filtrowane** (ukryta wizytówka znika z list i z synchronizacji): `api/admin/data`, `api/businesses` (3 zapytania), `api/reviews` (+ odfiltrowanie ukrytych z uprawnień), `api/analiza`, `api/alerts` (GET dla admina i usera oraz DELETE), `api/posts`, `api/competitors`, `api/cron/sync-reviews`, `api/reviews/sync`.

**Przywrócenie:** `update businesses set hidden = false where id = 'ID';` (ID podaje okno potwierdzenia przy usuwaniu).

**Świadomie NIE filtrowane:** `api/business/[id]` (wejście po bezpośrednim URL), `api/cron/auto-respond` (uśpiony), `api/debug-reviews` i `api/reviews/debug` (endpointy debug do usunięcia).

## Czym jest projekt

Webowy portal do zarządzania wizytówkami Google Business Profile. Pozwala spiąć kilka kont Google jednego użytkownika, pobierać opinie z wielu lokalizacji, odpowiadać na nie z poziomu apki, ustawiać alerty email i porównywać się z konkurencją.

Wewnętrzna nazwa: **GMB Manager** (`package.json: "gmb-manager"`).

## URL produkcyjny i repo

- **Produkcja (adres dla użytkowników):** https://wizytowki.plichta.com.pl
- **Adres techniczny Vercela:** https://cms1-rwp1.vercel.app/ (działa, wymagany przez OAuth Google)
- **GitHub:** https://github.com/TataHani/cms1 (branch `main`)
- **Lokalna ścieżka:** `C:\projekty\cms1`

## Logowanie do apki (Marcin)

- Hasło Marcina trzymane w menedżerze haseł (zresetowane 2026-08-12 przez token z bazy, patrz niżej)
- Rola: zależy od kolumny `role` w tabeli `users` (`admin` lub `user`)

### Odzyskanie dostępu gdy mail resetu nie dociera (sprawdzone 2026-08-12)

Formularz `/forgot-password` **zapisuje token resetu do bazy ZANIM spróbuje wysłać maila** (`api/auth/forgot-password/route.js:29`), a błąd wysyłki jest połykany i endpoint zawsze zwraca `success: true` (linie 48-52). Skutek uboczny: token istnieje niezależnie od losu maila i wystarczy odczytać go z bazy.

1. Kliknąć wyślij na `/forgot-password` (komunikat o wysłaniu pojawi się niezależnie od stanu SMTP)
2. W Supabase SQL Editor:
```sql
select email, reset_token_expires,
       'https://cms1-rwp1.vercel.app/reset-password?token=' || reset_token as link
from users where reset_token is not null order by reset_token_expires desc;
```
3. Wejść na wygenerowany `link` i ustawić hasło. Token ważny 1h, jednorazowy.

Ta droga jest lepsza niż podmiana hashu SHA256 SQL-em, bo hasło nie trafia do historii zapytań Supabase.

**SMTP DZIAŁA** (potwierdzone 2026-08-12): reset hasła dla drugiego konta Marcina (tego z wizytówkami Forda) wysłał maila, link dotarł normalnie. Wcześniejsza hipoteza o martwym SMTP i niedziałających alertach o opiniach jest **nieprawdziwa**. Wysyłka alertów `1-2★` przez `src/lib/email.js` należy uznać za sprawną.

**Nierozstrzygnięte:** dla pierwszego konta Marcina mail resetu NIE dotarł, mimo działającego SMTP. Podejrzenie: nieaktualny lub błędny adres w `users.email` na tym koncie, ewentualnie filtr antyspamowy. Konsekwencja jest poważniejsza niż sam reset hasła - na to konto nie dotrze też ŻADEN alert o negatywnej opinii. Do sprawdzenia: `select id, email, role from users order by created_at;` i porównanie z realnie działającymi skrzynkami.

**BUG do naprawy:** `/forgot-password` nie odróżnia "mail wysłany" od "wysyłka padła" - użytkownik dostaje potwierdzenie w obu przypadkach. Komunikat na froncie może zostać neutralny (żeby nie zdradzać, czy email istnieje w bazie), ale błąd wysyłki powinien być widoczny jako wyraźna awaria, a nie `console.error` bez konsekwencji. Ta cicha awaria maskuje dokładnie ten przypadek opisany wyżej.

## Stack

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 14.2.21 (App Router) |
| Język | JavaScript (czysty JS, brak TypeScript) |
| UI | React 18.2.0 + Tailwind 3.4.1 + lucide-react (ikony) |
| Baza | Supabase Cloud (Postgres) |
| Auth | Custom (cookie `user_id` + SHA256 hash w bazie) + Google OAuth |
| Integracje | Google Business Profile API (v1 i v4), firmowy SMTP przez nodemailer (email), Anthropic API (auto-odpowiedzi) |
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

Email (firmowy SMTP, `src/lib/email.js`) - bez nich maile alertów, resetu hasła i feedbacku nie wychodzą:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `FEEDBACK_EMAIL` - adres odbiorcy zgłoszeń z przycisku "Zgłoś uwagę"

AI (auto-odpowiedzi i przycisk "Zaproponuj AI"):
- `ANTHROPIC_API_KEY` - ustawiony w Vercel od 2026-06-03

Opcjonalne:
- `GOOGLE_REDIRECT_URI_CONNECT` - oddzielny callback dla podpinania konta Google (fallback: podmiana `/callback/google` na `/callback/google-connect` w `GOOGLE_REDIRECT_URI`)
- ~~`RESEND_API_KEY`~~ - Resend NIGDY nie został wdrożony, zastąpiony firmowym SMTP

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
- Cron sync-reviews (chroniony `CRON_SECRET`, wysyła maile przez firmowy SMTP `src/lib/email.js`, wywoływany z cron-job.org)
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

## Stan synchronizacji per marka

### Stan końcowy 2026-08-12 (po odmrożeniu) - WSZYSTKO SYNCHRONIZUJE SIĘ

| Grupa | Wizytówek | Najnowsza opinia | Stan |
|---|---|---|---|
| Audi | 6 | 2026-08-11 | działa nieprzerwanie |
| Volkswagen | 10 | 2026-08-11 | **ODMROŻONE**, opinie odbudowywane po kaskadzie |
| Ford Gdańsk | 1 | 2026-08-05 | **ODMROŻONE** (632 → 656 opinii) |

Wszystkie trzy połączenia Google mają świeże tokeny odświeżane przez cron. Uprawnienia userów do wizytówek VW zostały nadane ponownie 2026-08-12 (skasowała je kaskada, patrz niżej).

**Testowa wizytówka** ukryta przez nowy przycisk w panelu admina, dlatego zapytania z `hidden = false` pokazują dla konta Marcina 1 wizytówkę zamiast 2.

### INCYDENT 2026-08-12: reconnect przez "Odlacz" skasował dane VW

Stan wyjściowy tego dnia: Audi 3356 opinii (działało), VW 7785 opinii (zamrożone od 2026-06-08), Ford 632 opinie (zamrożone od 2026-06-02). Przyczyną zamrożenia były refresh tokeny wydane jeszcze w trybie Testing, które Google unieważnia po 7 dniach.

Odmrożenie konta VW poszło **starą, destrukcyjną instrukcją** ("Odłącz Google → Połącz Google"), która obowiązywała w tym pliku do 2026-08-12. Efekt: `delete` na `businesses` pociągnął kaskadę i liczba opinii VW spadła z 7785 do 5037, po czym cron zaczął odbudowywać je od zera z Google.

**Co sync odbudował:** treści opinii, oceny, odpowiedzi opublikowane w Google.

**Licznik zatrzymał się na 5037 i to jest POPRAWNA liczba** (zweryfikowane wyrywkowo 2026-08-12 przez porównanie z Google dla VW Gdańsk Lubowidzka, VW Elbląg i VW Bydgoszcz - zgadza się co do sztuki). Różnica 7785 → 5037 to NIE utrata danych, tylko usunięcie "duchów": sync robi wyłącznie `upsert` i **nigdy nie kasuje opinii, które Google przestał zwracać** (spam, naruszenia regulaminu, opinie skasowane przez autorów). Przez lata takie rekordy osadzały się w bazie, bo nic ich nie sprzątało. Import od zera ściągnął wyłącznie stan faktyczny z Google.

**Konsekwencja dla pozostałych marek:** liczniki Audi (3356) i Forda (656) nadal zawierają swoje duchy, bo te wizytówki nie przeszły pełnego reimportu. Przy porównaniu z Google pokażą wartości zawyżone. To nie awaria, tylko brak mechanizmu sprzątania. Ewentualna naprawa: w sync oznaczać jako usunięte opinie, których nie ma w odpowiedzi Google dla danej wizytówki (uwaga: wymaga pełnego pobrania, więc kłóci się z inkrementalnym syncem).

**Czego NIE odbudował (Google o tym nie wie):**
- `business_permissions` - uprawnienia userów, nadane ponownie ręcznie 2026-08-12
- `alert_settings` - konfiguracja alertów per wizytówka
- `suggested_reply` i `is_auto_reply` - propozycje AI i znaczniki auto-odpowiedzi
- historia alertów

**Wniosek na przyszłość:** reconnect ZAWSZE przez samo "Polacz konto". Przycisk "Odlacz" jest destrukcyjny do czasu naprawy opisanej niżej.

**Odmrożenie:** właściciel konta loguje się do cms1 -> /settings -> **"Polacz konto"** i wybiera to samo konto Google (**bez klikania "Odlacz"**). Dopiero autoryzacja zrobiona w trybie produkcyjnym daje trwały token. Adresy email użytkowników w tabeli `google_connections` w Supabase, nie tutaj.

### NIEBEZPIECZNE: "Odlacz" kasuje opinie kaskadowo (odkryte 2026-08-12)

`api/google-connections/[id]/route.js:18-21` przy odłączaniu konta robi **`delete` na tabeli `businesses`**, a nie odpięcie. Wszystkie klucze obce wskazujące na `businesses` mają **`ON DELETE CASCADE`** (zweryfikowane w `pg_constraint`): `reviews`, `alerts`, `competitors`, `ranking_notes`, `business_permissions`, `alert_settings`.

Skutek jednego kliknięcia "Odlacz": znikają wizytówki tego połączenia **wraz z opiniami, alertami, uprawnieniami userów, konkurencją i ustawieniami alertów**. Dla konta VW to 7785 opinii, dla Forda 632. Ponowny sync odtworzy z Google same treści opinii, ale NIE odzyska: propozycji AI (`suggested_reply`), znaczników `is_auto_reply`, historii alertów, nadanych uprawnień ani ustawień alertów.

Dodatkowo wynik tego `delete` nie jest sprawdzany (brak obsługi `error`), więc awaria przechodzi bez śladu. Komunikat `confirm` w `settings/page.js:32` ostrzega tylko o "wizytówkach", nie wspominając o opiniach i uprawnieniach.

**Do naprawy (nie zrobione):** odłączanie powinno zerować `google_connection_id` albo oznaczać połączenie jako nieaktywne, zamiast kasować wizytówki. Do czasu naprawy: **nie używać przycisku "Odlacz"**, reconnect robić przez samo "Polacz konto".

Potwierdzenie przyczyny (2026-08-12): `token_expires_at` połączenia obsługującego 10 wizytówek VW to **2026-06-08 22:35**, a najnowsza opinia VW w bazie ma datę **2026-06-08**. Zbieżność co do dnia. Analogicznie połączenie Forda: token 2026-06-02. Kolumna `refresh_token` jest niepusta we wszystkich połączeniach, ale to nie znaczy, że token jest ważny - Google unieważnił go po stronie serwera, cron dostaje `invalid_grant` i po cichu pomija połączenie. **Niepusty `refresh_token` NIE jest dowodem działającej synchronizacji.**

**Lawina alertów przy odmrożeniu NIE grozi** (zweryfikowane w kodzie 2026-08-12): w `api/cron/sync-reviews/route.js:167` opinia dostaje `is_new` tylko gdy jej `createTime` jest młodszy niż 20 minut (`freshnessThreshold`). Zaległe opinie z okresu zamrożenia wpadną do bazy cicho, bez alertów in-app i bez maili. Wyjątek: `is_edited` (linia 168) nie ma progu świeżości, więc opinie zmienione w międzyczasie wygenerują alerty EDITED_REVIEW - ilość ograniczona, akceptowalne.

Martwe połączenie do sprzątnięcia: jedno konto Google w `google_connections` ma **0 przypisanych wizytówek** (token z 2026-06-02). Do usunięcia przez /settings albo zostawienia, nie szkodzi.

### Jak czytać `google_connections.token_expires_at`

Kolumna dotyczy **access tokena, który żyje 1 godzinę**, a NIE refresh tokena (daty ważności refresh tokena nie ma nigdzie w bazie, Google jej nie zwraca). Cron przy każdym biegu sprawdza, czy access token wygasł (`api/cron/sync-reviews/route.js:76`) i jeśli tak, wymienia refresh token na nowy access token, zapisując `teraz + expires_in` (linia 97). Przy cronie co 5 minut data jest przesuwana kilkanaście razy dziennie.

Jak interpretować:
- **data w przyszłości lub max godzinę wstecz** = połączenie zdrowe, cron właśnie pracował
- **data sprzed wielu dni** = refresh token martwy, Google odmawia wydania access tokena, cron robi `continue` i po cichu pomija połączenie

**Czas w bazie jest w UTC**, zegar w Polsce to +2h latem (CEST). Data `08:25` w Supabase to `10:25` czasu polskiego. Przy ocenie świeżości trzeba to doliczyć, inaczej zdrowe połączenie wygląda na wygasłe.

### PUŁAPKA DIAGNOSTYCZNA: `businesses.last_synced_at` kłamie

Pole `last_synced_at` jest ustawiane **wyłącznie** przy podpinaniu/odświeżaniu listy wizytówek (`api/business/connect/route.js:125` i `api/auth/callback/google-connect/route.js:110`). **Ani cron `sync-reviews`, ani `reviews/sync` go nie dotykają.** Oznacza "kiedy ostatnio pobrano listę wizytówek z Google", a NIE "kiedy ostatnio ściągnięto opinie".

Do oceny czy synchronizacja opinii żyje używaj:
```sql
select b.title, max(r.create_time) as najnowsza_opinia, count(r.id) as opinii
from businesses b left join reviews r on r.business_id = b.id
group by b.id, b.title order by najnowsza_opinia desc nulls last;
```

## Cron-job.org

Dwa zadania w zewnętrznym schedulerze **cron-job.org**, oba z headerem `x-cron-secret`:

| Zadanie | Endpoint | Częstotliwość | Od kiedy |
|---|---|---|---|
| Sync opinii | `/api/cron/sync-reviews` | co 5 min | 2026-05 |
| Auto-odpowiedzi | `/api/cron/auto-respond` | co 15 min | **2026-08-12** |

Wyłączenie zadania `auto-respond` w cron-job.org to awaryjny stop auto-publikacji.

### Sync opinii

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

---

## Sesja 2026-08-12

### Co zrobiliśmy

1. **Zamknięty temat egressu i duplikatów.** Baza wstała, weryfikacja: 11771 wierszy = 11771 unikalnych, 0 duplikatów. Constraint `reviews_google_review_id_key UNIQUE (google_review_id)` już był w bazie. Wdrożona poprawka `select('*')` → konkretne kolumny w `/api/reviews`.
2. **Odmrożone VW (10 wizytówek) i Ford.** Stały od czerwca na unieważnionych refresh tokenach. Po reconnektach wszystkie trzy połączenia Google synchronizują się.
3. **Incydent kaskady.** Reconnect konta VW poszedł starą instrukcją ("Odłącz → Połącz"), co skasowało wizytówki wraz z opiniami i uprawnieniami. Sync odbudował treści (5037 opinii = stan zgodny z Google; stare 7785 zawierało rekordy usunięte po stronie Google). Uprawnienia nadane ponownie ręcznie.
4. **Nowa funkcja: usuwanie wizytówek z panelu admina** przez flagę `hidden` (endpoint `DELETE /api/admin/businesses/[id]`, migracja `sql/add-hidden-to-businesses.sql`, filtry w 9 miejscach). Testowa wizytówka usunięta.
5. **Uruchomiony system auto-odpowiedzi AI.** `CUTOFF` przestawiony na moment startu, dodany limit `MAX_PUBLISH_PER_RUN = 10`, cron dodany w cron-job.org. Jakość propozycji zweryfikowana ręcznie na kilkunastu opiniach.
6. **Potwierdzone, że SMTP działa** (mail resetu hasła dotarł). Wcześniejsza hipoteza o martwych alertach była błędna.
7. **Odkryte, że split-horizon DNS jest rozwiązany** - firmowe serwery AD rozwiązują `wizytowki.plichta.com.pl`. Linki w mailach systemowych przestawione na tę domenę.

### Co zostało otwarte

- **Milena (zastępczyni osoby od VW) nie ma konta.** Ma się zarejestrować na `/register` i dać znać, wtedy nadać uprawnienia do wizytówek VW.
- ~~Mail informacyjny do zespołu~~ - **WYSŁANY 2026-08-12** do osób od Audi i VW oraz zastępczyni od VW. Treść: `C:\projekty\cms1\maile\2026-08-12-wizytowki-info.html` (folder `maile` w `.gitignore`). Prosi o obserwację przez tydzień: czy opinie się pojawiają, czy alerty o negatywnych docierają (także spam), czy auto-odpowiedzi brzmią sensownie.
- **Obserwacja auto-odpowiedzi przez pierwszą dobę** - pierwsze publikacje spodziewane wieczorem 12.08.
- **BUG: "Odlacz" kasuje wizytówki kaskadowo** wraz z opiniami, alertami, uprawnieniami. Do naprawy: zerować `google_connection_id` zamiast `delete`.
- **BUG: `/forgot-password` zawsze zwraca sukces**, także gdy wysyłka padnie.
- **Otwarta rejestracja** - konto może założyć każdy, kto zna adres (bez uprawnień nic nie widzi). Rozważyć ograniczenie do adresów firmowych.

### Parametry, ścieżki, komendy

```sql
-- czy synchronizacja zyje (NIE uzywac last_synced_at, patrz pulapka wyzej)
select b.title, max(r.create_time) as najnowsza_opinia, count(r.id) as opinii
from businesses b left join reviews r on r.business_id = b.id
group by b.id, b.title order by najnowsza_opinia desc nulls last;

-- co system opublikowal automatycznie
select b.title, r.star_rating, r.reviewer_name, r.reply_comment, r.auto_replied_at
from reviews r join businesses b on b.id = r.business_id
where r.is_auto_reply = true order by r.auto_replied_at desc;

-- nadanie uprawnien do wszystkich wizytowek VW naraz
insert into business_permissions (user_id, business_id)
select u.id, b.id from users u, businesses b
where u.email = 'ADRES' and b.title ilike '%volkswagen%' and b.hidden = false;
```

- Build lokalny wymaga atrap zmiennych (brak `.env.local`): `$env:NEXT_PUBLIC_SUPABASE_URL="https://dummy.supabase.co"` itd., inaczej pada na "Collecting page data".
- Okna czasowe auto-odpowiedzi (od 2026-08-13): `ALERT_AT_H = 2`, `NEG_PUBLISH_AT_H = 20`, `POS_PUBLISH_AT_H = 22` w `api/cron/auto-respond/route.js`.
- Awaryjny stop auto-publikacji: wyłączyć zadanie `auto-respond` w cron-job.org.

---

## Sesja 2026-08-13

### Zgłoszenie

Użytkownik od Audi: "opinia 1★ i automat nie odpowiedział w ciągu 3 godzin, maila z ostrzeżeniem też nie dostałem".

### Diagnoza (automat NIE zawiódł)

Opinia 1★ Audi Gdańsk Stadion, `create_time` 2026-08-12 13:08 UTC = **15:08 czasu polskiego**. O godzinie zgłoszenia miała 19h 55min. Przy ówczesnych progach (alert 20h, publikacja 23h) nic nie było spóźnione. Opinia dostała w międzyczasie ręczną odpowiedź (`has_reply = true`, `auto_replied_at = null`), więc cron słusznie ją pominął (filtruje `has_reply = false`).

Zawiodła **sygnalizacja** i **obietnica z maila do zespołu z 2026-08-12**, który mówił "dostajecie maila z ostrzeżeniem, macie wtedy około 3 godzin", nie wspominając, że pierwsze 20h system milczy.

### PUŁAPKA DIAGNOSTYCZNA: czasy w bazie są w UTC (potwierdzone 2026-08-13)

`select now()` w Supabase SQL Editor pokazało 09:03 przy 11:03 czasu polskiego. Sesja bazy działa w UTC, kolumna `reviews.create_time` nie ma strefy, a `sync-reviews:185` zapisuje surową wartość z Google API (RFC3339 w UTC, bez konwersji). **Do każdej daty z bazy doliczać +2h latem (CEST), +1h zimą.** Dotyczy `create_time`, `alert_sent_at`, `auto_replied_at`, `token_expires_at`.

### Znalezione wady konstrukcyjne alertu natychmiastowego

1. Mail o negatywnej opinii z `sync-reviews` szedł tylko na adresy z `alert_settings` i tylko właściciela połączenia Google. Osoby z dostępem przez `business_permissions` nie dostawały go nigdy. Dodatkowo tabela `alert_settings` została skasowana kaskadą 2026-08-12.
2. Warunek `is_new` wymagał, żeby opinia była młodsza niż 20 minut w momencie syncu. Gdy Google udostępniło ją w API później, alert nie powstawał w ogóle.

### Naprawione (branch `fix/alerty-i-podpis`, NIE wdrożone na produkcję)

| Zmiana | Plik |
|---|---|
| `ALERT_AT_H` 20 → 2, `NEG_PUBLISH_AT_H` 23 → 20 | `api/cron/auto-respond/route.js` |
| Treść ponaglenia liczy okno dynamicznie (`NEG_PUBLISH_AT_H - ALERT_AT_H`) zamiast sztywnego "3h" | `api/cron/auto-respond/route.js` |
| Alert 1-2★ wysyłany do `getRecipients` (właściciel + uprawnieni + admini) zamiast do `alert_settings` | `api/cron/sync-reviews/route.js` |
| Alert oparty na `isFirstSeen` (opinii nie było w bazie) zamiast progu 20 minut; bezpiecznik `ALERT_MAX_AGE_DAYS = 7` i `MAX_ALERT_EMAILS_PER_RUN = 30` | `api/cron/sync-reviews/route.js` |
| `getRecipients` wyniesione do wspólnego helpera (używane przez oba crony) | `src/lib/recipients.js` (nowy) |
| Podpis każdej odpowiedzi: "Z wyrazami szacunku," / "Zespół <marka>" | `src/lib/ai.js` + formułka awaryjna w `auto-respond` |

**Marka w podpisie:** `brandName()` w `src/lib/ai.js` mapuje nazwę wizytówki na markę (`Audi`, `Volkswagen` także z "VW", `Ford`), fallback na pełną nazwę wizytówki. Podpis brzmi "Zespół Audi", nie "Zespół Audi Gdańsk Stadion".

### Godziny w panelu pokazywały UTC (naprawione 2026-08-13)

Panel wyświetlał opinię wystawioną o 15:08 jako 13:08. PostgREST zwraca `create_time` bez oznaczenia strefy (`2026-08-12T13:08:14.392666`), a `new Date()` bierze taki string za czas lokalny przeglądarki.

Helper `src/lib/dates.js`: `parseDbDate` (dokleja `Z` gdy w wartości nie ma strefy) oraz `formatDateTime` / `formatDate` z wymuszoną strefą `Europe/Warsaw`. Użyty w `/reviews`, `/business/[id]` (data opinii i data odpowiedzi) oraz `/alerts` (`created_at`). Tą samą funkcją przeliczane są filtry zakresu dat i sortowanie, żeby wyświetlana godzina i filtr "Dziś" się nie rozjeżdżały.

**Nie ruszone:** `/posts` (`created_at` nadal przez goły `new Date`) - tabela `posts` i tak nie istnieje w bazie.

**Skutek uboczny do świadomej akceptacji:** strona `/alert-settings` nie ma już wpływu na maile o negatywnych opiniach. Wyłączenie alertów per wizytówka przestało działać, bo to właśnie ta zależność spowodowała ciszę. Jeśli kiedyś ktoś będzie chciał wypisać się z maili, trzeba dodać to jawnie w `getRecipients`.

### Otwarte

- **Deploy na produkcję** (merge `fix/alerty-i-podpis` → `main`). Build lokalny przechodzi czysto (37 tras).
- **Mail sprostowanie do zespołu** - poprzedni obiecywał sygnał w 3h, nowa konfiguracja daje ponaglenie po 2h i publikację po 20h.
- Nie sprawdzono, czy `alert_settings` ma jakiekolwiek wiersze (zapytanie nie zostało wykonane). Po zmianie nie ma to już znaczenia dla alertów.
- Ryzyko nowego okna publikacji: opinia wystawiona w piątek po południu dostanie automatyczną odpowiedź w sobotę. Przy 1-2★ publikowana jest bezpieczna formułka (przeprosiny + prośba o kontakt), bez polemiki.
