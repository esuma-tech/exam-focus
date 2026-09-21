import { useEffect, useState } from 'react'
import { api, downloadPdf, fetchBlob, roles } from '../../api'
import { ErrorBox, Loading } from '../../components/ui'

const ROLE_OPTIONS = ['learner', 'instructor', 'parent', 'admin']

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcast, setBroadcast] = useState({ title: '', body: '', kind: 'system', channel: 'in_app' })
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', grade: '', bio: '' })

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (search) params.set('search', search)
    api(`/users?${params}`)
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [role])

  const pending = users.filter((u) => !u.is_approved)
  const approved = users.filter((u) => u.is_approved)

  const changeRole = async (userId, newRole) => {
    try {
      await api(`/users/${userId}`, { method: 'PATCH', body: { role: newRole } })
      load()
    } catch (e) { setError(e.message) }
  }

  const toggleActive = async (u) => {
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: { is_active: !u.is_active } })
      load()
    } catch (e) { setError(e.message) }
  }

  const approveUser = async (u) => {
    try {
      await api(`/users/${u.id}/approve`, { method: 'POST' })
      setNotice(`${u.full_name} was approved and can now log in.`)
      setError('')
      load()
    } catch (e) { setError(e.message) }
  }

  const rejectUser = async (u) => {
    if (!confirm(`Reject ${u.full_name} (${u.email})? Their registration will be removed.`)) return
    try {
      await api(`/users/${u.id}/reject`, { method: 'POST' })
      setNotice(`${u.full_name}'s registration was rejected and removed.`)
      setError('')
      load()
    } catch (e) { setError(e.message) }
  }

  const openEdit = (u) => {
    setEditing(u)
    setEditForm({ full_name: u.full_name, email: u.email, phone: u.phone || '', grade: u.grade || '', bio: u.bio || '' })
    setError('')
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    try {
      await api(`/users/${editing.id}`, { method: 'PATCH', body: editForm })
      setNotice(`${editForm.full_name || editing.full_name} updated.`)
      setEditing(null)
      load()
    } catch (err) { setError(err.message) }
  }

  const resetPassword = async (u) => {
    const password = window.prompt(`Enter a new password for ${u.full_name} (at least 8 characters):`)
    if (!password) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: { password } })
      setNotice(`Password reset for ${u.full_name}.`)
      setError('')
    } catch (e) { setError(e.message) }
  }

  const removeUser = async (u) => {
    if (!confirm(`Delete ${u.full_name}? This cannot be undone.`)) return
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' })
      load()
    } catch (e) { setError(e.message) }
  }

  // Receipts are admin-only: fetch with the auth header, then show/save the blob.
  const openReceipt = async (u) => {
    try {
      const blob = await fetchBlob(`/users/${u.id}/receipt`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch (e) { setError(e.message) }
  }

  const downloadReceipt = async (u) => {
    try {
      const safe = u.full_name.replace(/\s+/g, '-').toLowerCase()
      await downloadPdf(`/users/${u.id}/receipt`, `receipt-${safe}`)
    } catch (e) { setError(e.message) }
  }

  const sendBroadcast = async () => {
    try {
      await api('/notifications/broadcast', { method: 'POST', body: { ...broadcast, user_id: 0 } })
      setNotice('Broadcast sent to all active users.')
      setShowBroadcast(false)
      setBroadcast({ title: '', body: '', kind: 'system', channel: 'in_app' })
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">User Management</h1>
          <p className="mt-1 text-slate-500">Approve new registrations, update accounts, reset passwords and manage permissions.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowBroadcast(!showBroadcast)}>📢 Broadcast announcement</button>
      </div>

      <ErrorBox error={error} />
      {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{notice}</div>}

      {showBroadcast && (
        <div className="card mb-6 p-6">
          <h3 className="font-bold text-navy-900">Send announcement to all users</h3>
          <input className="input mt-3" placeholder="Title" value={broadcast.title} onChange={(e) => setBroadcast({ ...broadcast, title: e.target.value })} />
          <textarea className="input mt-2" rows={3} placeholder="Message" value={broadcast.body} onChange={(e) => setBroadcast({ ...broadcast, body: e.target.value })} />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select className="input" value={broadcast.kind} onChange={(e) => setBroadcast({ ...broadcast, kind: e.target.value })}>
              <option value="system">System</option>
              <option value="course">Course</option>
              <option value="info">Info</option>
            </select>
            <select className="input" value={broadcast.channel} onChange={(e) => setBroadcast({ ...broadcast, channel: e.target.value })}>
              <option value="in_app">In-app</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="both">Email + SMS</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-navy" onClick={sendBroadcast}>Send</button>
            <button className="btn-ghost" onClick={() => setShowBroadcast(false)}>Cancel</button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card mb-6 border-2 border-gold-300 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black text-navy-900">
                Pending approval
                <span className="chip bg-gold-400 text-navy-950 font-bold">{pending.length}</span>
              </h3>
              <p className="mt-1 text-sm text-slate-500">These accounts cannot log in until you approve them.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pending.map((u) => (
              <div key={u.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">
                    {u.full_name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{u.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`chip ${roles[u.role]?.color} font-bold`}>{roles[u.role]?.label}</span>
                  {u.grade && <span className="chip bg-slate-100 text-slate-600">{u.grade}</span>}
                </div>
                {u.receipt_url ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => openReceipt(u)}
                      className="inline-flex items-center gap-1.5 truncate rounded-lg bg-gold-100 px-2.5 py-1.5 text-xs font-bold text-gold-800 hover:bg-gold-200"
                      title={u.receipt_url}
                    >
                      🧾 View receipt
                    </button>
                    <button
                      onClick={() => downloadReceipt(u)}
                      className="inline-flex items-center gap-1.5 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    >
                      ⬇ Download
                    </button>
                  </div>
                ) : u.role === 'learner' ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-500">
                    ⚠ Learner has no receipt attached
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <button className="btn-navy !py-1.5 !px-3 text-xs" onClick={() => approveUser(u)}>Approve</button>
                  <button className="btn-ghost !py-1.5 !px-3 text-xs !text-red-500" onClick={() => rejectUser(u)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-6 flex flex-col gap-4 p-5 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="label">Search by name or email</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <div className="w-full md:w-48">
          <label className="label">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="learner">Learner</option>
            <option value="instructor">Instructor</option>
            <option value="parent">Parent</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="btn-navy" onClick={load}>Apply</button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-head">User</th>
                  <th className="table-head">Contact</th>
                  <th className="table-head">Role</th>
                  <th className="table-head">Status</th>
                  <th className="table-head">Joined</th>
                  <th className="table-head text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approved.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-sm font-bold text-navy-800">
                          {u.full_name.charAt(0)}
                        </span>
                        <div>
                          <p className="font-semibold text-navy-900">{u.full_name}</p>
                          {u.grade && <p className="text-xs text-slate-400">{u.grade}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p>{u.email}</p>
                      <p className="text-xs text-slate-400">{u.phone || '—'}</p>
                    </td>
                    <td className="table-cell">
                      <select
                        className={`chip cursor-pointer border-0 ${roles[u.role]?.color} font-bold`}
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        disabled={u.role === 'admin'}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roles[r].label}</option>)}
                      </select>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={u.role === 'admin'}
                        className={`chip ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {u.is_active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="table-cell text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="table-cell text-right">
                      <button onClick={() => openEdit(u)} className="text-xs font-bold text-navy-700 hover:underline">Edit</button>
                      <span className="mx-1 text-slate-300">·</span>
                      <button onClick={() => resetPassword(u)} className="text-xs font-bold text-navy-700 hover:underline">Reset password</button>
                      <span className="mx-1 text-slate-300">·</span>
                      <button
                        onClick={() => removeUser(u)}
                        disabled={u.role === 'admin'}
                        className="text-xs font-bold text-red-500 hover:underline disabled:opacity-30"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {approved.length === 0 && (
                  <tr><td className="table-cell text-slate-400" colSpan={6}>No accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4" onClick={() => setEditing(null)}>
          <form className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-navy-900">Edit {editing.full_name}</h3>
              <button type="button" className="text-slate-400 hover:text-navy-900" onClick={() => setEditing(null)}>✕</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full name</label>
                <input className="input" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Grade</label>
                <select className="input" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}>
                  <option value="">None</option>
                  <option>Grade 9</option>
                  <option>Grade 10</option>
                  <option>Grade 11</option>
                  <option>Grade 12</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Bio</label>
                <textarea className="input" rows={2} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-navy">Save changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}