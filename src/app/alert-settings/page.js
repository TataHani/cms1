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
          <a href="/alert-settings" className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">Ustawienia alertow</a>
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
            <p className="text-slate-500 mb-4">Dodaj regule, aby otrzymywac powiadom
