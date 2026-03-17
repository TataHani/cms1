'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, Bell, Mail, Star, Save, Plus, Trash2 } from 'lucide-react'

export default function AlertSettingsPage() {
  const [businesses, setBusinesses] = useState([])
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [businessesRes, settingsRes] = await Promise.all([
        fetch('/api/businesses'),
        fetch('/api/alert-settings')
      ])
      const businessesData = await businessesRes.json()
      const settingsData = await settingsRes.json()
      setBusinesses(businessesData.businesses || [])
      setSettings(settingsData.settings || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const addSetting = () => {
    setSettings([...settings, {
      id: 'new_' + Date.now(),
      business_id: '',
      email_enabled: true,
      email_address: '',
      min_stars: 1,
      max_stars: 3,
      is_new: true
    }])
  }

  const updateSetting = (index, field, value) => {
    const updated = [...settings]
    updated[index] = { ...updated[index], [field]: value }
    setSettings(updated)
  }

  const removeSetting = async (index) => {
    const setting = settings[index]
    if (!setting.is_new && setting.id) {
      try {
        await fetch('/api/alert-settings/' + setting.id, { method: 'DELETE' })
      } catch (e) {
        console.error(e)
      }
    }
    setSettings(settings.filter((_, i) => i !== index))
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/alert-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })
      if (res.ok) {
        setMessage('Zapisano ustawienia!')
        await loadData()
      } else {
        setMessage('Blad zapisu')
      }
    } catch (e) {
      setMessage('Blad polaczenia')
    }
    setSaving(false)
  }

  const getBusinessName = (businessId) => {
    if (!businessId) return 'Wszystkie wizytowki'
    const business = businesses.find(b => b.id === businessId)
    return business ? business.title : 'Nieznana'
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
            <a href="/alerts" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} className="text-slate-600" />
            </a>
            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Bell size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Ustawienia alertow</span>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <a href="/" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Dashboard</a>
          <a href="/reviews" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Opinie</a>
          <a href="/alerts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Alerty</a>
          <a href="/analiza" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Analiza</a>
          <a href="/alerts/settings" className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">Ustawienia alertow</a>
          <a href="/settings" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Ustawienia</a>
          <a href="/admin" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Admin</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Reguly alertow</h2>
            <p className="text-slate-500 mt-1">Skonfiguruj kiedy chcesz otrzymywac powiadomienia email</p>
          </div>
          <button onClick={addSetting} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90">
            <Plus size={18} />
            Dodaj regule
          </button>
        </div>

        {settings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Bell size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Brak regul alertow</h3>
            <p className="text-slate-500 mb-4">Dodaj regule, aby otrzymywac powiadomienia email o nowych opiniach.</p>
            <button onClick={addSetting} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium">
              <Plus size={18} />
              Dodaj pierwsza regule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {settings.map((setting, index) => (
              <div key={setting.id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-medium text-slate-900">Regula #{index + 1}</h3>
                  <button onClick={() => removeSetting(index)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Wizytowka</label>
                    <select value={setting.business_id || ''} onChange={(e) => updateSetting(index, 'business_id', e.target.value || null)} className="w-full px-4 py-2 border border-slate-200 rounded-lg">
                      <option value="">Wszystkie wizytowki</option>
                      {businesses.map(b => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email na powiadomienia</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="email" value={setting.email_address || ''} onChange={(e) => updateSetting(index, 'email_address', e.target.value)} placeholder="twoj@email.pl" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Minimalna ocena</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => updateSetting(index, 'min_stars', star)} className={`p-2 rounded-lg ${setting.min_stars === star ? 'bg-amber-100' : 'hover:bg-slate-100'}`}>
                          <Star size={20} className={setting.min_stars <= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Maksymalna ocena</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => updateSetting(index, 'max_stars', star)} className={`p-2 rounded-lg ${setting.max_stars === star ? 'bg-amber-100' : 'hover:bg-slate-100'}`}>
                          <Star size={20} className={setting.max_stars >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <strong>Podglad:</strong> Otrzymasz email na <strong>{setting.email_address || '(brak emaila)'}</strong> gdy przyjdzie opinia z ocena od <strong>{setting.min_stars}★</strong> do <strong>{setting.max_stars}★</strong> dla <strong>{getBusinessName(setting.business_id)}</strong>
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-4">
              {message && (
                <p className={`text-sm ${message.includes('Blad') ? 'text-rose-600' : 'text-emerald-600'}`}>{message}</p>
              )}
              <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 ml-auto">
                <Save size={18} />
                {saving ? 'Zapisywanie...' : 'Zapisz ustawienia'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
