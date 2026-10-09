'use client'
import { useEffect, useState } from 'react'

const IDLE_MS = 15 * 60 * 1000
// The server only sees requests, so on user activity we ping it at most once a minute
// to keep its idle clock in sync with what the user actually does on the page
const PING_EVERY_MS = 60 * 1000

function useIdleLogout() {
  useEffect(() => {
    const logout = () => { window.location.href = '/api/auth/logout' }
    let timer = setTimeout(logout, IDLE_MS)
    let lastPing = Date.now()

    const onActivity = async () => {
      clearTimeout(timer)
      timer = setTimeout(logout, IDLE_MS)
      if (Date.now() - lastPing < PING_EVERY_MS) return
      lastPing = Date.now()
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (!data.user) logout()
      } catch {
        // network hiccup: the server still enforces the timeout on the next request
      }
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, onActivity))
    }
  }, [])
}

export default function NavBar({ activePage, printHidden = false }) {
  useIdleLogout()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => setIsAdmin(d.user?.role === 'admin'))
      .catch(() => {})

    fetch('/api/alerts/count')
      .then(r => r.json())
      .then(d => setUnreadCount(d.count || 0))
      .catch(() => {})
  }, [])

  const linkClass = (page) => {
    if (activePage !== page) {
      return 'px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600'
    }
    if (page === 'admin') return 'px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium'
    if (page === 'analiza') return 'px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium'
    return 'px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium'
  }

  return (
    <nav className={`bg-white border-b border-slate-200 px-6 py-2${printHidden ? ' print:hidden' : ''}`}>
      <div className="flex items-center gap-4 max-w-7xl mx-auto">
        <a href="/" className={linkClass('dashboard')}>Dashboard</a>
        <a href="/reviews" className={linkClass('reviews')}>Opinie</a>
        <a href="/alerts" className={`${linkClass('alerts')} flex items-center gap-1.5`}>
          Alerty
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 bg-rose-500 text-white text-xs rounded-full font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </a>
        <a href="/analiza" className={linkClass('analiza')}>Analiza</a>
        <a href="/benchmark" className={linkClass('benchmark')}>Benchmark</a>
        <a href="/posts" className={linkClass('posts')}>Posty</a>
        <a href="/settings" className={linkClass('settings')}>Ustawienia</a>
        {isAdmin && (
          <a href="/admin" className={linkClass('admin')}>Admin</a>
        )}
      </div>
    </nav>
  )
}
