import './globals.css'

export const metadata = {
  title: 'GMB Manager',
  description: 'Zarządzanie wizytówkami Google',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}
