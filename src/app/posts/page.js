'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, Plus, Image, Calendar, Send, X, Eye, Trash2 } from 'lucide-react'

export default function PostsPage() {
  const [posts, setPosts] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [postType, setPostType] = useState('UPDATE')
  const [postContent, setPostContent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [postsRes, businessesRes] = await Promise.all([
        fetch('/api/posts'),
        fetch('/api/businesses')
      ])
      const postsData = await postsRes.json()
      const businessesData = await businessesRes.json()
      setPosts(postsData.posts || [])
      setBusinesses(businessesData.businesses || [])
      if (businessesData.businesses?.length > 0) {
        setSelectedBusiness(businessesData.businesses[0].id)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const createPost = async () => {
    if (!postContent.trim() || !selectedBusiness) return
    setSending(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: selectedBusiness,
          topic_type: postType,
          summary: postContent
        })
      })
      if (res.ok) {
        const data = await res.json()
        setPosts([data.post, ...posts])
        setShowForm(false)
        setPostContent('')
      }
    } catch (e) {
      console.error(e)
    }
    setSending(false)
  }

  const deletePost = async (postId) => {
    if (!confirm('Czy na pewno chcesz usunac ten post?')) return
    try {
      await fetch('/api/posts/' + postId, { method: 'DELETE' })
      setPosts(posts.filter(p => p.id !== postId))
    } catch (e) {
      console.error(e)
    }
  }

  const getBusinessName = (businessId) => {
    const business = businesses.find(b => b.id === businessId)
    return business ? business.title : 'Nieznana wizytowka'
  }

  const getPostTypeLabel = (type) => {
    switch(type) {
      case 'UPDATE': return 'Aktualnosc'
      case 'OFFER': return 'Oferta'
      case 'EVENT': return 'Wydarzenie'
      default: return type
    }
  }

  const getPostTypeColor = (type) => {
    switch(type) {
      case 'UPDATE': return 'bg-blue-100 text-blue-700'
      case 'OFFER': return 'bg-emerald-100 text-emerald-700'
      case 'EVENT': return 'bg-purple-100 text-purple-700'
      default: return 'bg-slate-100 text-slate-700'
    }
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
            <a href="/" className="p-2 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={20} className="text-slate-600" />
            </a>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Posty</span>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <a href="/" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Dashboard</a>
          <a href="/reviews" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Opinie</a>
          <a href="/alerts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Alerty</a>
          <a href="/analiza" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Analiza</a>
          <a href="/benchmark" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Benchmark</a>
          <a href="/posts" className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">Posty</a>
          <a href="/settings" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Ustawienia</a>
          <a href="/admin" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Admin</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Twoje posty</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus size={18} />
            Nowy post
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Nowy post</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Wizytowka</label>
                <select
                  value={selectedBusiness}
                  onChange={(e) => setSelectedBusiness(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg"
                >
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Typ postu</label>
                <div className="flex gap-3">
                  {['UPDATE', 'OFFER', 'EVENT'].map(type => (
                    <button
                      key={type}
                      onClick={() => setPostType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${postType === type ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {getPostTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tresc</label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Napisz tresc postu..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={4}
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={createPost}
                  disabled={sending || !postContent.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={16} />
                  {sending ? 'Publikowanie...' : 'Opublikuj'}
                </button>
              </div>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <FileText size={48} className="text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Brak postow</h3>
            <p className="text-slate-500">Utworz swoj pierwszy post, aby dotrzec do klientow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPostTypeColor(post.topic_type)}`}>
                    {getPostTypeLabel(post.topic_type)}
                  </span>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-slate-700 mb-4">{post.summary}</p>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{getBusinessName(post.business_id)}</span>
                  <span>{new Date(post.created_at).toLocaleDateString('pl-PL')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
