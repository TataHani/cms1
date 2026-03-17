'use client'
import { useEffect, useState } from 'react'
import { Star, Download, Printer, BarChart2, ArrowLeft } from 'lucide-react'

function TrendChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Za mało danych do wyświetlenia trendu (minimum 2 miesiące)
      </div>
    )
  }

  const width = 600
  const height = 200
  const pad = { top: 20, right: 20, bottom: 36, left: 36 }
  const cw = width - pad.left - pad.right
  const ch = height - pad.top - pad.bottom

  const ratings = data.map(d => parseFloat(d.avgRating))
  const minR = Math.max(0, Math.min(...ratings) - 0.3)
  const maxR = Math.min(5, Math.max(...ratings) + 0.3)
  const range = maxR - minR || 1

  const xStep = cw / (data.length - 1)
  const pts = data.map((d, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + ch - ((parseFloat(d.avgRating) - minR) / range) * ch
  }))

  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${pad.top + ch} L${pts[0].x},${pad.top + ch} Z`

  const formatMonth = (m) => {
    const [y, mo] = m.split('-')
    const names = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']
    return names[parseInt(mo) - 1] + ' ' + y.slice(2)
  }

  const gridValues = [minR, minR + range * 0.25, minR + range * 0.5, minR + range * 0.75, maxR]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {gridValues.map((val, i) => {
        const y = pad.top + ch - ((val - minR) / range) * ch
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {val.toFixed(1)}
            </text>
          </g>
        )
      })}
      <path d={areaPath} fill="#10b981" fillOpacity="0.08" />
      <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="white" strokeWidth="2" />
      ))}
      {data.map((d, i) => (
        <text
          key={i}
          x={pad.left + i * xStep}
          y={height - 6}
          textAnchor="middle"
          fontSize="10"
          fill="#94a3b8"
        >
          {formatMonth(d.month)}
        </text>
      ))}
    </svg>
  )
}

export default function AnalizaPage() {
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState('all')
  const [period, setPeriod] = useState('30')
  const [stats, setStats] = useState(null)
  const [distribution, setDistribution] = useState([])
  const [trend, setTrend] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [selectedBusiness, period])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analiza?business_id=${selectedBusiness}&period=${period}`)
      const data = await res.json()
      setBusinesses(data.businesses || [])
      setStats(data.stats || {})
      setDistribution(data.distribution || [])
      setTrend(data.trend || [])
      setRanking(data.ranking || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const exportCSV = () => {
    const rows = [
      ['Miesiąc', 'Średnia ocena', 'Liczba opinii'],
      ...trend.map(t => [t.month, t.avgRating, t.count]),
      [],
      ['Wizytówka', 'Średnia ocena', 'Liczba opinii', 'Bez odpowiedzi'],
      ...ranking.map(r => [r.title, r.avgRating, r.totalReviews, r.unanswered])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'raport-opinii.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxDistCount = Math.max(...distribution.map(d => d.count), 1)

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <header className="bg-white border-b border-slate-200 px-6 py-4 print:hidden">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} className="text-slate-600" />
            </a>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
              <BarChart2 size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Analiza</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download size={16} />
              Eksport CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer size={16} />
              Drukuj / PDF
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 py-2 print:hidden">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <a href="/" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Dashboard</a>
          <a href="/reviews" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Opinie</a>
          <a href="/alerts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Alerty</a>
          <a href="/analiza" className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Analiza</a>
          <a href="/benchmark" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Benchmark</a>
          <a href="/posts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Posty</a>
          <a href="/settings" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Ustawienia</a>
          <a href="/admin" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Admin</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <h2 className="text-2xl font-bold text-slate-900">Analiza opinii</h2>
          <div className="flex items-center gap-3">
            <select
              value={selectedBusiness}
              onChange={e => setSelectedBusiness(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm"
            >
              <option value="all">Wszystkie wizytówki</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm"
            >
              <option value="7">Ostatnie 7 dni</option>
              <option value="30">Ostatnie 30 dni</option>
              <option value="90">Ostatnie 90 dni</option>
              <option value="0">Wszystkie czasy</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Ładowanie...</div>
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500 mb-1">Łącznie opinii</p>
                <p className="text-3xl font-bold text-slate-900">{stats?.totalReviews ?? 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500 mb-1">Średnia ocena</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold text-slate-900">{stats?.avgRating ?? '-'}</p>
                  <Star size={20} className="text-amber-400 fill-amber-400" />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500 mb-1">Nowe opinie</p>
                <p className="text-3xl font-bold text-emerald-600">{stats?.newReviews ?? 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500 mb-1">Bez odpowiedzi</p>
                <p className="text-3xl font-bold text-rose-500">{stats?.unanswered ?? 0}</p>
              </div>
            </div>

            {/* Distribution + Ranking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-5">Rozkład ocen</h3>
                <div className="space-y-4">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const item = distribution.find(d => d.stars === stars)
                    const count = item?.count || 0
                    const pct = Math.round((count / maxDistCount) * 100)
                    return (
                      <div key={stars} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-10">
                          <span className="text-sm font-medium text-slate-700">{stars}</span>
                          <Star size={12} className="text-amber-400 fill-amber-400" />
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-3 bg-amber-400 rounded-full transition-all duration-500"
                            style={{ width: pct + '%' }}
                          />
                        </div>
                        <span className="text-sm text-slate-500 w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-5">Ranking wizytówek</h3>
                <div className="space-y-4">
                  {ranking.map((biz, i) => (
                    <div key={biz.id} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{biz.title}</p>
                        <p className="text-xs text-slate-400">{biz.totalReviews} opinii · {biz.unanswered} bez odpowiedzi</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star size={13} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm font-semibold text-slate-700">{biz.avgRating || '-'}</span>
                      </div>
                    </div>
                  ))}
                  {ranking.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">Brak danych</p>
                  )}
                </div>
              </div>
            </div>

            {/* Trend chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Trend średniej oceny</h3>
              <TrendChart data={trend} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
