import { useEffect, useState } from 'react'
import { api } from '../api'
import { EmptyState, Loading } from '../components/ui'

const ICONS = { info: 'ℹ️', course: '📘', quiz: '📝', forum: '💬', billing: '💳', system: '🔔' }

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRead, setShowRead] = useState(false)

  const load = () => {
    setLoading(true)
    api(`/notifications?include_read=${showRead}`)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [showRead])

  const markRead = async (id) => {
    await api(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
    load()
  }

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {})
    load()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-navy-900">Notifications</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} className="h-4 w-4 accent-navy-800" />
            Show read
          </label>
          <button className="btn-outline !py-2" onClick={markAll}>Mark all read</button>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState icon="🔔" title="You're all caught up" hint="New quiz results, live classes and announcements will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div key={n.id} className={`card flex items-start gap-4 p-5 ${n.is_read ? 'opacity-60' : ''}`}>
              <span className="text-2xl">{ICONS[n.kind] || '🔔'}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-navy-900">{n.title}</h3>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-gold-400" />}
                </div>
                <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(n.created_at).toLocaleString()} · via {n.channel.replace('_', ' ')}
                </p>
              </div>
              {!n.is_read && (
                <button onClick={() => markRead(n.id)} className="text-xs font-bold text-navy-600 hover:underline">Mark read</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}