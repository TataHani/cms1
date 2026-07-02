import { Building2 } from 'lucide-react'

export const metadata = {
  title: 'Warunki korzystania - GMB Manager',
  description: 'Warunki korzystania z aplikacji GMB Manager',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Warunki korzystania</h1>
            <p className="text-slate-500 text-sm">GMB Manager</p>
          </div>
        </div>

        <p className="text-slate-500 text-sm mb-8">Ostatnia aktualizacja: 2 lipca 2026</p>

        <div className="space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Postanowienia ogólne</h2>
            <p>
              Niniejsze warunki określają zasady korzystania z aplikacji GMB Manager. Dostawcą
              aplikacji jest Plichta Spółka z o.o. Sp. K. z siedzibą przy ul. Gdańskiej 13C,
              84-200 Wejherowo, wpisana do Krajowego Rejestru Sądowego pod nr KRS 0000389120,
              NIP 5882381336, REGON 221248080. Rozpoczęcie korzystania z aplikacji oznacza
              akceptację niniejszych warunków.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Czym jest GMB Manager</h2>
            <p>
              GMB Manager to wewnętrzne narzędzie do zarządzania wizytówkami Google Business
              Profile. Umożliwia pobieranie opinii z wizytówek, odpowiadanie na nie oraz analizę
              statystyk ocen. Aplikacja łączy się z kontem Google użytkownika za jego zgodą,
              wyłącznie w celu obsługi wizytówek, do których użytkownik ma uprawnienia.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Dostęp i konto</h2>
            <p>
              Korzystanie z aplikacji wymaga konta założonego przez dostawcę lub autoryzowanego
              administratora. Użytkownik odpowiada za zachowanie poufności danych logowania oraz
              za działania wykonane w ramach swojego konta. O każdym podejrzeniu nieuprawnionego
              dostępu należy niezwłocznie poinformować administratora.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Połączenie z kontem Google</h2>
            <p>
              Aby korzystać z funkcji obsługi wizytówek, użytkownik łączy swoje konto Google z
              aplikacją, wyrażając zgodę na dostęp w zakresie zarządzania wizytówkami Google
              Business Profile. Zgodę można w każdej chwili cofnąć w ustawieniach aplikacji lub
              pod adresem
              {' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-emerald-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                myaccount.google.com/permissions
              </a>
              . Zasady przetwarzania danych opisuje
              {' '}
              <a href="/privacy" className="text-emerald-600 underline">
                Polityka prywatności
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Zasady korzystania</h2>
            <p>
              Użytkownik zobowiązuje się korzystać z aplikacji zgodnie z jej przeznaczeniem oraz
              obowiązującym prawem. Zabronione jest w szczególności podejmowanie działań
              zakłócających działanie aplikacji, próby nieuprawnionego dostępu do danych innych
              użytkowników oraz wykorzystywanie aplikacji do publikowania treści niezgodnych z
              prawem lub z zasadami Google dotyczącymi opinii.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Dostępność aplikacji</h2>
            <p>
              Dostawca dokłada starań, aby aplikacja działała nieprzerwanie, jednak nie
              gwarantuje jej ciągłej dostępności. Aplikacja może być czasowo niedostępna z
              powodu prac serwisowych, aktualizacji lub przyczyn niezależnych od dostawcy, w tym
              zmian w interfejsach Google API.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Odpowiedzialność</h2>
            <p>
              Aplikacja udostępniana jest w takim stanie, w jakim się znajduje. W zakresie
              dozwolonym przez prawo dostawca nie ponosi odpowiedzialności za szkody wynikające z
              korzystania z aplikacji, w tym za skutki błędnych lub opóźnionych danych pobranych
              z Google Business Profile. Za treść odpowiedzi publikowanych na opinie odpowiada
              użytkownik.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Zmiany warunków</h2>
            <p>
              Dostawca może aktualizować niniejsze warunki. O istotnych zmianach użytkownicy będą
              informowani, a dalsze korzystanie z aplikacji po wejściu zmian w życie oznacza ich
              akceptację. Aktualna wersja jest zawsze dostępna pod tym adresem.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Kontakt</h2>
            <p>
              W sprawach dotyczących korzystania z aplikacji prosimy o kontakt:
              {' '}
              <a href="mailto:inspektor@plichta.com.pl" className="text-emerald-600 underline">
                inspektor@plichta.com.pl
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
