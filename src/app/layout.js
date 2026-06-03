import './globals.css'
import FeedbackButton from './components/FeedbackButton'

export const metadata = {
  title: 'GMB Manager',
  description: 'Zarządzanie wizytówkami Google',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>
        {children}
        <FeedbackButton />
      </body>
    </html>
  )
}
