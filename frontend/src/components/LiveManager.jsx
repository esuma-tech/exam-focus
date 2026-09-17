import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../store'
import { EmptyState, ErrorBox, Loading } from './ui'

const STATUS = {
  scheduled: { label: 'Scheduled', cls: 'bg-slate-100 text-slate-600' },
  live: { label: '🔴 Live now', cls: 'bg-red-100 text-red-700' },
  ended: { label: 'Ended', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-400' },
}

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LiveManager({ courseId, showCreate = true, className = '' }) {
  const { user } = useAuth()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [editing, setEditing] = useState(null)

  const isOwner = (c) => user?.role === 'admin' || c.instructor_id === user?.id

  const load = useCallback(() => {
    const qs = courseId ? `?course_id=${courseId}` : ''
    api(`/live${qs}`)
      .then((rows) => {
        if (courseId) return rows
        return rows.filter((c) => c.instructor_id === user?.id)
      })
      .then(setClasses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [courseId, user?.id])

  useEffect(load, [load])

  const copyKey = async (key) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(key)
      setTimeout(() => setCopied(''), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  const changeStatus = async (c, status) => {
    setError('')
    try {
      await api(`/live/${c.id}`, { method: 'PATCH', body: { status } })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const remove = async (c) => {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return
    setError('')
    try {
      await api(`/live/${c.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const saveEdit = async (c) => {
    setError('')
    try {
      await api(`/live/${c.id}`, {
        method: 'PATCH',
        body: {
          title: c.title,
          description: c.description,
          duration_min: Number(c.duration_min),
          scheduled_at: new Date(c.scheduled_at || Date.now()).toISOString(),
        },
      })
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-navy-900">Live classes</h2>
        {showCreate && <Scheduler courseId={courseId} onCreated={load} />}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon="📅" title="No live classes" hint="Schedule one so your students can join in real time." />
      ) : (
        <div className="mt-4 space-y-4">
          {classes.map((c) => {
            const st = STATUS[c.status] || STATUS.scheduled
            return (
              <div key={c.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${st.cls}`}>{st.label}</span>
                      <span className="chip bg-slate-100 text-slate-500 capitalize">{c.provider}</span>
                    </div>
                    <h3 className="mt-2 font-bold text-navy-900">{c.title}</h3>
                    {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {new Date(c.scheduled_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })} · {c.duration_min} min
                    </p>

                    {isOwner(c) && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-navy-50 p-3 sm:max-w-md">
                        <span className="text-xs font-bold text-navy-700">Student join key:</span>
                        <code className="rounded-lg bg-navy-800 px-3 py-1 text-sm font-black tracking-widest text-gold-300">
                          {c.invite_key}
                        </code>
                        <button onClick={() => copyKey(c.invite_key)} className="btn-outline !py-1 !px-2 text-xs">
                          {copied === c.invite_key ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {editing === c.id && (
                      <LiveEdit c={c} onCancel={() => setEditing(null)} onSave={saveEdit} />
                    )}
                  </div>

                  <div className="flex flex-none flex-wrap items-center gap-2">
                    {c.meeting_url && c.status === 'live' && (
                      <a href={c.meeting_url} target="_blank" rel="noreferrer" className="btn-primary !py-2">
                        Join class
                      </a>
                    )}
                    {c.recording_url && (
                      <a href={c.recording_url} target="_blank" rel="noreferrer" className="btn-outline !py-2">▶ Recording</a>
                    )}
                    {isOwner(c) && (
                      <>
                        {c.status === 'scheduled' && (
                          <button onClick={() => changeStatus(c, 'live')} className="btn-navy !py-2">Start</button>
                        )}
                        {c.status === 'live' && (
                          <button onClick={() => changeStatus(c, 'ended')} className="btn-primary !py-2">End</button>
                        )}
                        {c.status !== 'cancelled' && c.status !== 'ended' && (
                          <>
                            <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="btn-outline !py-2">
                              Edit
                            </button>
                            <button onClick={() => changeStatus(c, 'cancelled')} className="btn-ghost !py-2 !px-3 text-red-500">
                              Cancel
                            </button>
                          </>
                        )}
                        <button onClick={() => remove(c)} className="btn-ghost !py-2 !px-3 text-red-500">✕</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LiveEdit({ c, onCancel, onSave }) {
  const [form, setForm] = useState({
    title: c.title,
    description: c.description,
    duration_min: c.duration_min,
    scheduled_at: toLocalInput(c.scheduled_at),
  })
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-navy-200 bg-white p-4">
      <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input"
          type="datetime-local"
          value={form.scheduled_at}
          onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
        />
        <input
          className="input"
          type="number"
          value={form.duration_min}
          onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <button className="btn-navy" onClick={() => onSave({ ...c, ...form, title: form.title })}>Save changes</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function Scheduler({ courseId, onCreated }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', scheduled_at: '', duration_min: 60 })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setMsg('')
    try {
      const created = await api('/live', {
        method: 'POST',
        body: { ...form, duration_min: Number(form.duration_min), course_id: courseId, scheduled_at: new Date(form.scheduled_at).toISOString() },
      })
      setMsg(`Scheduled! Student join key: ${created.invite_key}`)
      setForm({ title: '', description: '', scheduled_at: '', duration_min: 60 })
      onCreated()
      setOpen(false)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        {msg && <span className="max-w-xs truncate text-xs font-semibold text-emerald-600">{msg}</span>}
        <button onClick={() => setOpen(true)} className="btn-outline !py-2">+ Schedule live class</button>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border border-navy-200 bg-slate-50 p-5">
      <h3 className="font-black text-navy-900">Schedule a live class</h3>
      <ErrorBox error={error} />
      <input className="input mt-3" placeholder="Class title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className="input mt-2" rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className="input" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        <input className="input" type="number" min="5" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-navy" onClick={submit}>Schedule & notify students</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}