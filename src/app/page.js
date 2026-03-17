'use client'
import { useEffect, useState } from 'react'
import { Building2, Star, MessageSquare, LogIn, RefreshCw } from 'lucide-react'

export default function Home() {
  const [user, setUser] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setUser(data.user || null)
        if (data.user) {
          loadBusinesses()
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  const loadBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses')
      const data = await res.json()
      setBusinesses(data.businesses || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Ladowanie...</div>
      </div>
    )
  }

if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Przekierowanie...</div>
      </div>
    )
  }

  const totalReviews = businesses.reduce((sum, b) => sum + (b.total_reviews || 0), 0)
  const avgRating = businesses.length > 0 
    ? (businesses.reduce((sum, b) => sum + (parseFloat(b.average_rating) || 0), 0) / businesses.length).toFixed(1)
    : '-'

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
    <nav className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <a href="/" className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">Dashboard</a>
          <a href="/reviews" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Opinie</a>
          <a href="/alerts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Alerty</a>
          <a href="/benchmark" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Benchmark</a>
    <a href="/posts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Posty</a>
    <a href="/settings" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Ustawienia</a>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Building2 className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{businesses.length}</p>
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
                <p className="text-2xl font-bold text-slate-900">{avgRating}</p>
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
                <p className="text-2xl font-bold text-slate-900">{totalReviews}</p>
                <p className="text-slate-500">Opinii</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Twoje wizytowki</h3>
          <a href="/api/business/connect" className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:opacity-90">
            <RefreshCw size={16} />
            Synchronizuj
          </a>
        </div>

        {businesses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Brak polaczonych wizytowek</h3>
            <p className="text-slate-500 mb-6">Polacz swoje wizytowki Google, aby rozpoczac zarzadzanie.</p>
            <a href="/api/business/connect" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-opacity">Polacz wizytowke</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((business) => (
              <div key={business.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-xl flex items-center justify-center">
                    <Building2 className="text-emerald-600" />
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                    <Star size={14} className="text-amber-500 fill-amber-500" />
                    <span className="text-sm font-medium text-amber-700">{business.average_rating}</span>
                  </div>
                </div>
                <h4 className="font-semibold text-slate-900 mb-1">{business.title}</h4>
                <p className="text-sm text-slate-500 mb-3">{business.category}</p>
                <p className="text-sm text-slate-600 mb-4">{business.address}</p>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-sm text-slate-500">{business.total_reviews} opinii</span>
                  <a href={'/business/' + business.id} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">Szczegoly</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
