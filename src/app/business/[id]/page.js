'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Building2, Star, MessageSquare, Phone, Globe, MapPin, ArrowLeft, Reply, CheckCircle, Send } from 'lucide-react'
import NavBar from '../../components/NavBar'

export default function BusinessDetailPage() {
  const params = useParams()
  const businessId = params.id

  const [business, setBusiness] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [onlyUnanswered, setOnlyUnanswered] = useState(false)

  useEffect(() => {
    loadData()
  }, [businessId])

  const loadData = async () => {
    try {
      const [businessesRes, reviewsRes] = await Promise.all([
        fetch('/api/businesses'),
        fetch('/api/reviews')
      ])
      const businessesData = await businessesRes.json()
      const reviewsData = await reviewsRes.json()

      const foundBusiness = (businessesData.businesses || []).find(b => b.id === businessId)
      setBusiness(foundBusiness)

      const bizReviews = (reviewsData.reviews || []).filter(r => r.business_id === businessId)
      setReviews(bizReviews)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Ladowanie...</div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md">
          <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Wizytowka nie znaleziona</h2>
          <p className="text-slate-500 mb-4">Wizytowka o tym ID nie istnieje lub nie masz do niej dostepu.</p>
          <a href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">Wroc do dashboardu</a>
        </div>
      </div>
    )
  }

  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews).toFixed(1)
    : '-'
  const unanswered = reviews.filter(r => !r.has_reply).length

  const distribution = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviews.filter(r => r.star_rating === stars).length,
    percent: totalReviews > 0
      ? Math.round((reviews.filter(r => r.star_rating === stars).length / totalReviews) * 100)
      : 0
  }))

  const filteredReviews = reviews
    .filter(r => !onlyUnanswered || !r.has_reply)
    .sort((a, b) => new Date(b.create_time) - new Date(a.create_time))

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} className="text-slate-600" />
            </a>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">{business.title}</span>
          </div>
        </div>
      </header>

      <NavBar activePage="" />

      <main className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{business.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {business.address && (
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <span>{business.address}</span>
              </div>
            )}
            {business.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={16} className="flex-shrink-0 text-slate-400" />
                <a href={'tel:' + business.phone} className="hover:text-emerald-600">{business.phone}</a>
              </div>
            )}
            {business.website && (
              <div className="flex items-center gap-2 text-slate-600">
                <Globe size={16} className="flex-shrink-0 text-slate-400" />
                <a href={business.website} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 truncate">{business.website}</a>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{totalReviews}</p>
                <p className="text-slate-500">Opinii</p>
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
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                <Reply className="text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{unanswered}</p>
                <p className="text-slate-500">Bez odpowiedzi</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Dystrybucja ocen</h3>
          <div className="space-y-2">
            {distribution.map(({ stars, count, percent }) => (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16">
                  <span className="font-medium text-slate-700">{stars}</span>
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                </div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all"
                    style={{ width: percent + '%' }}
                  />
                </div>
                <span className="text-sm text-slate-500 w-24 text-right">{count} ({percent}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Opinie</h3>
          <button
            onClick={() => setOnlyUnanswered(!onlyUnanswered)}
            className={'px-4 py-2 rounded-lg text-sm font-medium border transition-colors ' + (onlyUnanswered ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}
          >
            {onlyUnanswered ? '✕ Bez odpowiedzi' : 'Bez odpowiedzi'}
          </button>
        </div>

        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl border border-slate-200 p-6">
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
                  <div className="flex items-center justify-end gap-2 mt-3">
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
              ) : (
                <button
                  onClick={() => setReplyingTo(review.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90"
                >
                  <Reply size={16} />
                  Odpowiedz
                </button>
              )}
            </div>
          ))}

          {filteredReviews.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <MessageSquare size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">{onlyUnanswered ? 'Wszystkie opinie maja odpowiedz!' : 'Brak opinii dla tej wizytowki'}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
