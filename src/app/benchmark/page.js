'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, Target, Star, TrendingUp, TrendingDown, Building2 } from 'lucide-react'

export default function BenchmarkPage() {
  const [businesses, setBusinesses] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [businessesRes, competitorsRes] = await Promise.all([
        fetch('/api/businesses'),
        fetch('/api/competitors')
      ])
      const businessesData = await businessesRes.json()
      const competitorsData = await competitorsRes.json()
      setBusinesses(businessesData.businesses || [])
      setCompetitors(competitorsData.competitors || [])
      if (businessesData.businesses?.length > 0) {
        setSelectedBusiness(businessesData.businesses[0])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const businessCompetitors = competitors.filter(c => c.business_id === selectedBusiness?.id)
  
  const avgCompetitorRating = businessCompetitors.length > 0
    ? (businessCompetitors.reduce((sum, c) => sum + parseFloat(c.average_rating || 0), 0) / businessCompetitors.length).toFixed(1)
    : 0

  const ratingDiff = selectedBusiness 
    ? (parseFloat(selectedBusiness.average_rating) - parseFloat(avgCompetitorRating)).toFixed(1)
    : 0

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
            <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
              <Target size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Benchmark</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Porownanie z konkurencja</h2>
          <select 
            value={selectedBusiness?.id || ''}
            onChange={(e) => setSelectedBusiness(businesses.find(b => b.id === e.target.value))}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-white"
          >
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        </div>

        {selectedBusiness && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Star className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Twoja ocena</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedBusiness.average_rating}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Target className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Srednia konkurencji</p>
                    <p className="text-2xl font-bold text-slate-900">{avgCompetitorRating}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${parseFloat(ratingDiff) >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                    {parseFloat(ratingDiff) >= 0 ? (
                      <TrendingUp className="text-emerald-600" />
                    ) : (
                      <TrendingDown className="text-rose-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Roznica</p>
                    <p className={`text-2xl font-bold ${parseFloat(ratingDiff) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {parseFloat(ratingDiff) >= 0 ? '+' : ''}{ratingDiff}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Ranking</h3>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="px-6 py-4 flex items-center gap-4 bg-emerald-50">
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-lg flex items-center justify-center">
                    <Building2 size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{selectedBusiness.title}</p>
                    <p className="text-sm text-slate-500">Twoja wizytowka</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star size={16} className="text-amber-400 fill-amber-400" />
                    <span className="font-semibold text-slate-900">{selectedBusiness.average_rating}</span>
                  </div>
                  <div className="text-sm text-slate-500">{selectedBusiness.total_reviews} opinii</div>
                </div>

                {businessCompetitors.map((competitor, index) => (
                  <div key={competitor.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm">{index + 2}</div>
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Building2 size={18} className="text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{competitor.name}</p>
                      <p className="text-sm text-slate-500">{competitor.address}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={16} className="text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-slate-900">{competitor.average_rating}</span>
                    </div>
                    <div className="text-sm text-slate-500">{competitor.total_reviews} opinii</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
