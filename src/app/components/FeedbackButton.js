'use client'
import { useState, useEffect } from 'react'
import { MessageSquarePlus, X, Upload, Image as ImageIcon } from 'lucide-react'

export default function FeedbackButton() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotName, setScreenshotName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => setLoggedIn(!!d.user))
      .catch(() => {})
  }, [])

  const readFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setResult({ type: 'err', text: 'Dozwolone sa tylko obrazy' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setResult({ type: 'err', text: 'Obraz za duzy (max 5MB)' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setScreenshot(reader.result)
      setScreenshotName(file.name || 'screenshot.png')
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        readFile(item.getAsFile())
        e.preventDefault()
        break
      }
    }
  }

  const submit = async () => {
    if (!message.trim()) {
      setResult({ type: 'err', text: 'Wpisz tresc zgloszenia' })
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, screenshot, screenshotName })
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ type: 'ok', text: 'Dziekujemy! Zgloszenie wyslane.' })
        setMessage('')
        setScreenshot(null)
        setScreenshotName('')
        setTimeout(() => { setOpen(false); setResult(null) }, 1500)
      } else {
        setResult({ type: 'err', text: data.error || 'Nie udalo sie wyslac' })
      }
    } catch (e) {
      setResult({ type: 'err', text: 'Blad polaczenia' })
    }
    setSending(false)
  }

  if (!loggedIn) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-3 rounded-full shadow-lg hover:opacity-90"
      >
        <MessageSquarePlus size={20} />
        <span className="text-sm font-medium hidden sm:inline">Zglos uwage</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
            onPaste={handlePaste}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Zglos uwage</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <label className="block text-sm font-medium text-slate-700 mb-1">Rodzaj</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="bug">Blad</option>
              <option value="remark">Uwaga</option>
              <option value="idea">Sugestia</option>
            </select>

            <label className="block text-sm font-medium text-slate-700 mb-1">Tresc</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Opisz problem lub pomysl... (mozesz wkleic zrzut ekranu przez Ctrl+V)"
              className="w-full mb-3 p-3 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="mb-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                <Upload size={16} />
                Dodaj zrzut ekranu
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => readFile(e.target.files[0])}
                />
              </label>
              {screenshot && (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <ImageIcon size={16} className="text-emerald-600" />
                  <span className="truncate flex-1">{screenshotName}</span>
                  <button
                    onClick={() => { setScreenshot(null); setScreenshotName('') }}
                    className="text-rose-500 hover:underline"
                  >
                    usun
                  </button>
                </div>
              )}
            </div>

            {result && (
              <p className={`text-sm mb-3 ${result.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {result.text}
              </p>
            )}

            <button
              onClick={submit}
              disabled={sending}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Wysylanie...' : 'Wyslij zgloszenie'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
