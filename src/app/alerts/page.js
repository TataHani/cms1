'use client'
import { useEffect, useState } from 'react'
import { Bell, ArrowLeft, Star, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      const res = await fetch('/api/alerts')
      const data = await res.json()
      setAlerts(data.alerts || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const markAsRead = async (alertId) => {
    try {
      await fetch('/api/alerts/' + alertId + '/read', { method: 'POST' })
      setAlerts(alerts.map(a => a.id === alertId ? {...a, is_read: true} : a))
    } catch (e) {
      console.error(e)
    }
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

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
            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Bell size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Alerty</span>
            {unreadCount > 0 && (
              <span className="px-2 py-1 bg-rose-100 text-rose-700 text-sm rounded-full font-medium">
                {unreadCount} nowe
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Powiadomienia</h2>

        {alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Bell size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Brak alertow</h3>
            <p className="text-slate-500">Nie masz zadnych nowych powiadomien.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`bg-white rounded-xl border p-4 flex items-start gap-4 ${alert.is_read ? 'border-slate-200' : 'border-emerald-300 bg-emerald-50'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  alert.alert_type === 'NEW_REVIEW' ? 'bg-emerald-100' :
                  alert.alert_type === 'EDITED_REVIEW' ? 'bg-amber-100' :
                  'bg-rose-100'
                }`}>
                  {alert.alert_type === 'NEW_REVIEW' && <Star size={18} className="text-emerald-600" />}
                  {alert.alert_type === 'EDITED_REVIEW' && <AlertCircle size={18} className="text-amber-600" />}
                  {alert.alert_type === 'NEGATIVE_REVIEW' && <AlertCircle size={18} className="text-rose-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900">{alert.title}</h4>
                      <p className="text-sm text-slate-600">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(alert.created_at).toLocaleString('pl-PL')}
                      </p>
                    </div>
                    {!alert.is_read && (
                      <button 
                        onClick={() => markAsRead(alert.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg"
                        title="Oznacz jako przeczytane"
                      >
                        <CheckCircle size={18} className="text-emerald-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
