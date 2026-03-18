'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, Settings, Link, Unlink, User, Mail, Shield, Plus } from 'lucide-react'
import NavBar from '../components/NavBar'

export default function SettingsPage() {
  const [user, setUser] = useState(null)
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [userRes, connectionsRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/google-connections')
      ])
      const userData = await userRes.json()
      const connectionsData = await connectionsRes.json()
      setUser(userData.user)
      setConnections(connectionsData.connections || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const disconnectGoogle = async (connectionId) => {
    if (!confirm('Czy na pewno chcesz odlaczyc to konto Google? Wizytowki powiazane z tym kontem zostana usuniete.')) return
    
    try {
      await fetch('/api/google-connections/' + connectionId, { method: 'DELETE' })
      setConnections(connections.filter(c => c.id !== connectionId))
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Ladowanie...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} className="text-slate-600" />
            </a>
            <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Ustawienia</span>
          </div>
        </div>
      </header>

      <NavBar activePage="settings" />

      <main className="max-w-3xl mx-auto p-6">
        
        {/* Dane konta */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User size={20} className="text-slate-600" />
            <h2 className="font-semibold text-slate-900">Twoje konto</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-slate-400" />
                <span className="text-slate-600">Email</span>
              </div>
              <span className="font-medium text-slate-900">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-slate-400" />
                <span className="text-slate-600">Rola</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${user?.role === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                {user?.role === 'admin' ? 'Administrator' : 'Uzytkownik'}
              </span>
            </div>
          </div>
        </div>

        {/* Połączone konta Google */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link size={20} className="text-slate-600" />
              <h2 className="font-semibold text-slate-900">Polaczone konta Google</h2>
            </div>
            <a 
              href="/api/auth/connect-google"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              <Plus size={16} />
              Polacz konto
            </a>
          </div>

          {connections.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Link size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-500 mb-2">Brak polaczonych kont Google</p>
              <p className="text-sm text-slate-400">Polacz konto Google aby importowac wizytowki</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    {conn.google_avatar ? (
                      <img src={conn.google_avatar} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <User size={18} className="text-slate-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{conn.google_name || 'Konto Google'}</p>
                      <p className="text-sm text-slate-500">{conn.google_email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => disconnectGoogle(conn.id)}
                    className="flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm"
                  >
                    <Unlink size={16} />
                    Odlacz
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-700">
              <strong>Jak to dziala:</strong> Po polaczeniu konta Google, system automatycznie zaimportuje Twoje wizytowki z Google Business Profile.
            </p>
          </div>
        </div>

      </main>
    </div>
  )
}
