'use client'
import { useEffect, useState } from 'react'
import { Building2, Star, MessageSquare, Bell, ArrowLeft, Reply, CheckCircle, Send, X, Sparkles } from 'lucide-react'
import NavBar from '../components/NavBar'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState('all')
  const [onlyUnanswered, setOnlyUnanswered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const [quickRange, setQuickRange] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 50

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('unanswered') === '1') setOnlyUnanswered(true)
    const rid = params.get('review')
    if (rid) setHighlightId(rid)
    loadData()
  }, [])

  // Zmiana filtra wraca na pierwsza strone
  useEffect(() => {
    setPage(0)
  }, [selectedBusiness, onlyUnanswered, quickRange, dateFrom, dateTo])

  // Po wejsciu z alertu (?review=ID) przewin do wskazanej opinii
  useEffect(() => {
    if (highlightId && reviews.length > 0) {
      const el = document.getElementById('review-' + highlightId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, reviews])

  const loadData = async () => {
    try {
      const [reviewsRes, businessesRes] = await Promise.all([
        fetch('/api/reviews'),
        fetch('/api/businesses')
      ])
      const reviewsData = await reviewsRes.json()
      const businessesData = await businessesRes.json()
      setReviews(reviewsData.reviews || [])
      setBusinesses(businessesData.businesses || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const sendReply = async (reviewId) => {
    if (!replyText.trim()) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/reviews/' + reviewId + '/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyText })
      })
      const data = await res.json()
      if (res.ok) {
        setReviews(reviews.map(r =>
          r.id === reviewId
            ? { ...r, has_reply: true, reply_comment: replyText }
            : r
        ))
        setReplyingTo(null)
        setReplyText('')
      } else {
        setSendError(data.error || 'Błąd wysyłania odpowiedzi')
      }
    } catch (e) {
      setSendError('Błąd połączenia')
    }
    setSending(false)
  }

  const generateSuggestion = async (reviewId) => {
    setSuggesting(true)
    setSendError(null)
    try {
      const res = await fetch('/api/reviews/' + reviewId + '/suggest', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setReplyText(data.suggestion)
        setReviews(reviews.map(r =>
          r.id === reviewId ? { ...r, suggested_reply: data.suggestion } : r
        ))
      } else {
        setSendError(data.error || 'Nie udalo sie wygenerowac propozycji')
      }
    } catch (e) {
      setSendError('Błąd połączenia')
    }
    setSuggesting(false)
  }

  // Cutoff dla "bez odpowiedzi" - historyczne opinie sprzed maja 2026 ignorujemy
  const UNANSWERED_CUTOFF = new Date('2026-05-01')
  const isUnansweredRelevant = (r) => !r.has_reply && new Date(r.create_time) >= UNANSWERED_CUTOFF

  const dateInRange = (r) => {
    if (quickRange === 'all') return true
    const t = new Date(r.create_time).getTime()
    const now = new Date()
    if (quickRange === 'today') {
      return t >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    }
    if (quickRange === '7d') return t >= now.getTime() - 7 * 24 * 60 * 60 * 1000
    if (quickRange === '30d') return t >= now.getTime() - 30 * 24 * 60 * 60 * 1000
    if (quickRange === 'custom') {
      const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity
      const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity
      return t >= from && t <= to
    }
    return true
  }

  const filteredReviews = reviews
    .filter(r => selectedBusiness === 'all' || r.business_id === selectedBusiness)
    .filter(r => !onlyUnanswered || isUnansweredRelevant(r))
    .filter(dateInRange)
    .sort((a, b) => new Date(b.create_time) - new Date(a.create_time))

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE))
  const pagedReviews = filteredReviews.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const getBusinessName = (businessId) => {
    const business = businesses.find(b => b.id === businessId)
    return business ? business.title : 'Nieznana wizytówka'
  }

  const newCount = reviews.filter(r => r.is_new).length
  const pendingCount = reviews.filter(isUnansweredRelevant).length

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
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Opinie</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/alerts" className="p-2 hover:bg-slate-100 rounded-lg relative">
              <Bell size={20} className="text-slate-600" />
            </a>
          </div>
        </div>
      </header>

      <NavBar activePage="reviews" />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Wszystkie opinie</h2>
            <p className="text-slate-500 mt-1">{newCount} nowych, {pendingCount} oczekuje na odpowiedz</p>
          </div>
          <select 
            value={selectedBusiness}
            onChange={(e) => setSelectedBusiness(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">Wszystkie wizytowki</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
          <button
            onClick={() => setOnlyUnanswered(!onlyUnanswered)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${onlyUnanswered ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {onlyUnanswered ? '✕ Bez odpowiedzi' : 'Bez odpowiedzi'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { k: 'all', label: 'Wszystkie' },
            { k: 'today', label: 'Dzis' },
            { k: '7d', label: '7 dni' },
            { k: '30d', label: '30 dni' },
          ].map(opt => (
            <button
              key={opt.k}
              onClick={() => setQuickRange(opt.k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${quickRange === opt.k ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {opt.label}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setQuickRange('custom') }}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
            />
            <span className="text-slate-400 text-sm">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setQuickRange('custom') }}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <span className="text-sm text-slate-400 ml-auto">{filteredReviews.length} opinii</span>
        </div>

        <div className="space-y-4">
          {pagedReviews.map((review) => (
            <div key={review.id} id={'review-' + review.id} className={`bg-white rounded-xl border p-6 ${highlightId === review.id ? 'border-emerald-400 ring-2 ring-emerald-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-semibold">
                    {review.reviewer_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{review.reviewer_name}</span>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(star => (
                          <Star 
                            key={star} 
                            size={14} 
                            className={star <= review.star_rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} 
                          />
                        ))}
                      </div>
                      {review.is_new && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">Nowa</span>
                      )}
                      {review.is_edited && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">Edytowana</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{getBusinessName(review.business_id)}</p>
                  </div>
                </div>
                <span className="text-sm text-slate-400">
                  {new Date(review.create_time).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

              <p className="text-slate-700 mb-4">{review.comment}</p>

              {review.has_reply ? (
                <div className="bg-slate-50 rounded-lg p-4 border-l-4 border-emerald-500">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">Twoja odpowiedz</span>
                    </div>
                    {review.reply_update_time && (
                      <span className="text-xs text-slate-400">
                        {new Date(review.reply_update_time).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm">{review.reply_comment}</p>
                </div>
              ) : replyingTo === review.id ? (
                <div className="bg-slate-50 rounded-lg p-4">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Napisz odpowiedz na opinie..."
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={3}
                  />
                  {sendError && (
                    <p className="text-sm text-rose-600 mt-2">{sendError}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <button
                      onClick={() => generateSuggestion(review.id)}
                      disabled={suggesting}
                      className="flex items-center gap-2 px-4 py-2 text-violet-600 hover:bg-violet-50 border border-violet-200 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      <Sparkles size={16} />
                      {suggesting ? 'Generuje...' : (replyText ? 'Generuj ponownie' : 'Zaproponuj AI')}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setReplyingTo(null); setReplyText(''); setSendError(null) }}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium"
                      >
                        Anuluj
                      </button>
                      <button
                        onClick={() => sendReply(review.id)}
                        disabled={sending || !replyText.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        <Send size={16} />
                        {sending ? 'Wysylanie...' : 'Wyslij'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setReplyingTo(review.id); setReplyText(review.suggested_reply || ''); setSendError(null) }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90"
                >
                  <Reply size={16} />
                  {review.suggested_reply ? 'Odpowiedz (propozycja gotowa)' : 'Odpowiedz'}
                </button>
              )}
            </div>
          ))}
        </div>

        {filteredReviews.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Brak opinii dla wybranych filtrow.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-slate-50"
            >
              Poprzednia
            </button>
            <span className="text-sm text-slate-600">Strona {page + 1} z {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-slate-50"
            >
              Nastepna
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
