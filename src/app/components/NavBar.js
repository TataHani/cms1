'use client'
import { useEffect, useState } from 'react'

export default function NavBar({ activePage, printHidden = false }) {
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
