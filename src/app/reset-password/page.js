'use client'
import { useState, useEffect } from 'react'
import { Building2, Lock, Eye, EyeOff, Check } from 'lucide-react'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  // Token czytamy z adresu URL po stronie klienta, bez useSearchParams,
  // zeby nie wymagac dodatkowego Suspense przy buildzie.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Hasla nie sa takie same')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Nie udalo sie zresetowac hasla')
      setLoading(false)
      return
    }

    setDone(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Building2 size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Nowe haslo</h1>

        {done ? (
          <div className="mt-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-emerald-600" />
            </div>
            <p className="text-slate-600">Haslo zostalo zmienione. Mozesz sie teraz zalogowac.</p>
            <a href="/login" className="inline-block mt-6 text-emerald-600 hover:text-emerald-700 font-medium">
              Przejdz do logowania
            </a>
          </div>
        ) : !token ? (
          <p className="mt-6 text-center text-slate-600">
            Brak tokenu w adresie. Otworz link z maila resetujacego haslo.
          </p>
        ) : (
          <>
            <p className="text-slate-500 mb-8 text-center">Ustaw nowe haslo do swojego konta</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nowe haslo</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Minimum 6 znakow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Powtorz haslo</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Powtorz nowe haslo"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Zapisywanie...' : 'Zapisz nowe haslo'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
