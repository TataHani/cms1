import { Building2 } from 'lucide-react'

export const metadata = {
  title: 'Polityka prywatności - GMB Manager',
  description: 'Polityka prywatności aplikacji GMB Manager',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Polityka prywatności</h1>
            <p className="text-slate-500 text-sm">GMB Manager</p>
          </div>
        </div>

        <p className="text-slate-500 text-sm mb-8">Ostatnia aktualizacja: 3 czerwca 2026</p>

        <div className="space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Administrator danych</h2>
            <p>
              Administratorem danych osobowych przetwarzanych w aplikacji GMB Manager jest
              Plichta Spółka z o.o. Sp. K. z siedzibą przy ul. Gdańskiej 13C, 84-200 Wejherowo,
              wpisana do Krajowego Rejestru Sądowego pod nr KRS 0000389120, NIP 5882381336,
              REGON 221248080. Administrator wyznaczył Inspektora Ochrony Danych, Pawła
              Modrzejewskiego, z którym można kontaktować się pod adresem:
              {' '}
              <a href="mailto:inspektor@plichta.com.pl" className="text-emerald-600 underline">
                inspektor@plichta.com.pl
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Czym jest GMB Manager</h2>
            <p>
              GMB Manager to wewnętrzne narzędzie do zarządzania wizytówkami Google Business
              Profile. Umożliwia pobieranie opinii z wizytówek, odpowiadanie na nie oraz
              analizę statystyk ocen. Aplikacja łączy się z kontem Google użytkownika za jego
              zgodą, wyłącznie w celu obsługi wizytówek, do których użytkownik ma uprawnienia.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Jakie dane przetwarzamy</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Dane konta w aplikacji: adres email, imię, hasło (przechowywane w postaci zaszyfrowanej).</li>
              <li>Dane konta Google po autoryzacji: identyfikator Google, adres email, imię, zdjęcie profilowe oraz tokeny dostępu niezbędne do połączenia z Google Business Profile.</li>
              <li>Dane wizytówek Google Business Profile: nazwa, adres, telefon, strona www, kategoria.</li>
              <li>Opinie klientów pobrane z wizytówek: treść opinii, ocena w gwiazdkach, nazwa wyświetlana autora, data oraz treść odpowiedzi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">4. W jakim celu i na jakiej podstawie</h2>
            <p>
              Dane przetwarzamy w celu świadczenia funkcji aplikacji: wyświetlania opinii,
              umożliwienia odpowiadania na nie, wysyłania alertów o nowych opiniach oraz
              prezentacji statystyk. Podstawą przetwarzania jest zgoda użytkownika oraz
              prawnie uzasadniony interes administratora w zarządzaniu reputacją swoich
              wizytówek.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Wykorzystanie danych z Google API (Limited Use)</h2>
            <p>
              Korzystanie przez GMB Manager z informacji otrzymanych z interfejsów Google API
              odbywa się zgodnie z
              {' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-emerald-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , w tym z wymaganiami dotyczącymi ograniczonego użycia (Limited Use). Dane
              pobierane z Google Business Profile wykorzystujemy wyłącznie do dostarczania i
              ulepszania funkcji widocznych dla użytkownika. Nie przekazujemy tych danych
              osobom trzecim, nie wykorzystujemy ich do celów reklamowych ani nie udostępniamy
              ich brokerom danych. Żaden człowiek nie odczytuje tych danych poza przypadkami
              wymaganymi do działania funkcji, ze względów bezpieczeństwa lub gdy wymaga tego
              prawo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Udostępnianie danych</h2>
            <p>
              Nie sprzedajemy danych. Dane mogą być przetwarzane przez zaufanych dostawców
              infrastruktury, z których korzysta aplikacja (hosting oraz baza danych), wyłącznie
              w zakresie niezbędnym do jej działania.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Przechowywanie i usuwanie danych</h2>
            <p>
              Dane przechowujemy tak długo, jak długo użytkownik korzysta z aplikacji. W każdej
              chwili można odłączyć konto Google w ustawieniach aplikacji, co usuwa zapisane
              tokeny dostępu. Aby usunąć konto i powiązane dane, prosimy o kontakt pod adresem
              inspektor@plichta.com.pl.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Cofnięcie dostępu Google</h2>
            <p>
              Dostęp aplikacji do konta Google można w każdej chwili cofnąć samodzielnie pod
              adresem
              {' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-emerald-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                myaccount.google.com/permissions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Kontakt</h2>
            <p>
              W sprawach dotyczących prywatności i danych osobowych prosimy o kontakt:
              inspektor@plichta.com.pl.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
