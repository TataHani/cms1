'use client'
import { useEffect, useState } from 'react'
import { Building2, Star, MessageSquare, LogIn } from 'lucide-react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setUser(data.user || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Ładowanie...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">GMB Manager</h1>
          <p className="text-slate-500 mb-8">Zarządzaj wizytówkami Google z jednego miejsca</p>
          <a href="/api/auth/login" className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity">
            <LogIn size={20} />
            Zaloguj sie przez Google
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">GMB Manager</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-600">{user.email}</span>
            <a href="/api/auth/logout" className="text-slate-500 hover:text-slate-700">Wyloguj</a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Building2 className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-slate-500">Wizytowek</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Star className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">-</p>
                <p className="text-slate-500">Srednia ocena</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-slate-500">Opinii</p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Brak polaczonych wizytowek</h3>
          <p className="text-slate-500 mb-6">Polacz swoje wizytowki Google, aby rozpoczac zarzadzanie.</p>
          <a href="/api/business/connect" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity">Polacz wizytowke</a>
        </div>
      </main>
    </div>
  )
}
