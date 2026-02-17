'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, Shield, Users, Building2, Plus, Trash2, Check, X, UserPlus } from 'lucide-react'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [permissions, setPermissions] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPermissionModal, setShowPermissionModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/data')
      const data = await res.json()
      
      if (data.error === 'Not authorized') {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      
      setUsers(data.users || [])
      setBusinesses(data.businesses || [])
      setPermissions(data.permissions || [])
      setIsAdmin(true)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      await fetch('/api/admin/users/' + userId + '/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (e) {
      console.error(e)
    }
  }

  const addPermission = async (userId, businessId) => {
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, business_id: businessId })
      })
      const data = await res.json()
      if (data.permission) {
        setPermissions([...permissions, data.permission])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const removePermission = async (permissionId) => {
    try {
      await fetch('/api/admin/permissions/' + permissionId, { method: 'DELETE' })
      setPermissions(permissions.filter(p => p.id !== permissionId))
    } catch (e) {
      console.error(e)
    }
  }

  const getUserPermissions = (userId) => {
    return permissions.filter(p => p.user_id === userId)
  }

  const getBusinessName = (businessId) => {
    const business = businesses.find(b => b.id === businessId)
    return business ? business.title : 'Nieznana wizytowka'
  }

  const getAvailableBusinesses = (userId) => {
    const userPermissions = getUserPermissions(userId)
    const assignedIds = userPermissions.map(p => p.business_id)
    return businesses.filter(b => !assignedIds.includes(b.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Ladowanie...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md">
          <Shield size={48} className="text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Brak dostepu</h2>
          <p className="text-slate-500 mb-4">Nie masz uprawnien administratora.</p>
          <a href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">Wroc do strony glownej</a>
        </div>
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
            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-900">Panel Admina</span>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 py-2">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <a href="/" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Dashboard</a>
          <a href="/reviews" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Opinie</a>
          <a href="/alerts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Alerty</a>
          <a href="/benchmark" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Benchmark</a>
          <a href="/posts" className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium text-slate-600">Posty</a>
          <a href="/admin" className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-sm font-medium">Admin</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Użytkownicy */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-slate-600" />
                <h2 className="font-semibold text-slate-900">Uzytkownicy ({users.length})</h2>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {users.map(user => (
                <div key={user.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-semibold">
                        {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name || 'Brak nazwy'}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        user.role === 'admin' 
                          ? 'bg-rose-100 text-rose-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  
                  {/* Uprawnienia użytkownika */}
                  {user.role !== 'admin' && (
                    <div className="pl-13 ml-13">
                      <p className="text-xs text-slate-500 mb-2">Dostep do wizytowek:</p>
                      <div className="flex flex-wrap gap-2">
                        {getUserPermissions(user.id).map(perm => (
                          <span key={perm.id} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs">
                            {getBusinessName(perm.business_id)}
                            <button 
                              onClick={() => removePermission(perm.id)}
                              className="hover:text-rose-600"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                        {getAvailableBusinesses(user.id).length > 0 && (
                          <button
                            onClick={() => { setSelectedUser(user); setShowPermissionModal(true); }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200"
                          >
                            <Plus size={14} />
                            Dodaj
                          </button>
                        )}
                      </div>
                      {getUserPermissions(user.id).length === 0 && getAvailableBusinesses(user.id).length > 0 && (
                        <p className="text-xs text-slate-400 mt-1">Brak uprawnien - kliknij "Dodaj"</p>
                      )}
                    </div>
                  )}
                  {user.role === 'admin' && (
                    <p className="text-xs text-rose-500 ml-13">Admin ma dostep do wszystkich wizytowek</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Wizytówki */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-slate-600" />
                <h2 className="font-semibold text-slate-900">Wizytowki ({businesses.length})</h2>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {businesses.map(business => {
                const businessPerms = permissions.filter(p => p.business_id === business.id)
                return (
                  <div key={business.id} className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-cyan-100 rounded-lg flex items-center justify-center">
                        <Building2 size={18} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{business.title}</p>
                        <p className="text-sm text-slate-500">{business.category}</p>
                      </div>
                    </div>
                    <div className="ml-13">
                      <p className="text-xs text-slate-500 mb-1">
                        Uzytkownicy z dostepem: {businessPerms.length} + admini
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {businessPerms.map(perm => {
                          const permUser = users.find(u => u.id === perm.user_id)
                          return (
                            <span key={perm.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                              {permUser?.name || permUser?.email || 'Nieznany'}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Modal dodawania uprawnień */}
      {showPermissionModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">
                Dodaj dostep dla {selectedUser.name || selectedUser.email}
              </h3>
              <button onClick={() => setShowPermissionModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="space-y-2">
              {getAvailableBusinesses(selectedUser.id).map(business => (
                <button
                  key={business.id}
                  onClick={() => {
                    addPermission(selectedUser.id, business.id)
                    setShowPermissionModal(false)
                  }}
                  className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-left"
                >
                  <Building2 size={18} className="text-emerald-600" />
                  <div>
                    <p className="font-medium text-slate-900">{business.title}</p>
                    <p className="text-sm text-slate-500">{business.address}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
