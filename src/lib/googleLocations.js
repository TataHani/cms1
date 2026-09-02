// Pobieranie listy wizytowek (lokalizacji) z Google Business Profile.
//
// Google zwraca domyslnie 10 lokalizacji na strone (max 100). Bez paginacji
// konto z wieksza liczba wizytowek gubi wszystko powyzej pierwszej strony -
// tak zginela jedenasta wizytowka VW (2026-09-02).
const READ_MASK = 'name,title,storefrontAddress,phoneNumbers,websiteUri'

export async function fetchAllLocations(accountName, accessToken) {
  const locations = []
  let pageToken = null

  do {
    const url = new URL(
      'https://mybusinessbusinessinformation.googleapis.com/v1/' + accountName + '/locations'
    )
    url.searchParams.set('readMask', READ_MASK)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || 'Google API nie zwrocilo listy wizytowek')
    }

    if (data.locations) locations.push(...data.locations)

    pageToken = data.nextPageToken || null
  } while (pageToken)

  return locations
}
