'use client'
import { useState } from 'react'
import { Building2, Mail, Send } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })

    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Building2 size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Reset hasla</h1>

        {sent ? (
          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Jesli podany email istnieje w systemie, wyslalismy na niego link do zresetowania hasla.
              Sprawdz skrzynke (rowniez folder spam).
            </p>
            <a href="/login" className="inline-block mt-6 text-emerald-600 hover:text-emerald-700 font-medium">
              Wroc do logowania
            </a>
          </div>
        ) : (
          <>
            <p className="text-slate-500 mb-8 text-center">Podaj swoj email, a wyslemy link do ustawienia nowego hasla</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="twoj@email.pl"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={20} />
                {loading ? 'Wysylanie...' : 'Wyslij link'}
              </button>
            </form>

            <p className="mt-6 text-center text-slate-500">
              <a href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">Wroc do logowania</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
