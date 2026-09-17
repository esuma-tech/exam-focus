import { useEffect, useState } from 'react'
import { api } from '../../api'
import { EmptyState, ErrorBox, Loading } from '../../components/ui'

function JoinByKey({ onJoined }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const live = await api('/live/join', { method: 'POST', body: { code } })
      window.open(live.meeting_url, '_blank', 'noreferrer')
      setCode('')
      if (onJoined) onJoined()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card border-2 border-dashed border-navy-200 p-5">
      <h3 className="font-black text-navy-900">Join a class with a key</h3>
      <p className="mt-1 text-sm text-slate-500">Ask your teacher for the class key, then enter it to join.</p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-[180px] !tracking-widest !font-black !uppercase"
          value={code}
          maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />
        <button className="btn-navy" disabled={busy || !code.trim()}>{busy ? 'Joining…' : 'Join class'}</button>
      </form>
      {error && <div className="mt-3"><ErrorBox error={error} /></div>}
    </div>
  )
}

export default function LiveClasses() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    api('/live')
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <Loading />

  const now = new Date()
  const upcoming = classes.filter((c) => new Date(c.scheduled_at) >= now && c.status !== 'ended')
  const past = classes.filter((c) => new Date(c.scheduled_at) < now || c.status === 'ended')

  const Card = ({ c }) => (
    <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="chip bg-red-100 text-red-700">🔴 {c.status}</span>
          <span className="chip bg-slate-100 text-slate-600 capitalize">{c.provider}</span>
        </div>
        <h3 className="mt-2 font-bold text-navy-900">{c.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{c.description}</p>
        <p className="mt-2 text-xs font-semibold text-slate-400">
          {new Date(c.scheduled_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })} · {c.duration_min} min
        </p>
      </div>
      <div className="flex flex-none flex-col items-end gap-2">
        <div className="flex gap-2">
          {c.status !== 'ended' && c.status !== 'cancelled' && c.meeting_url && (
            <a href={c.meeting_url} target="_blank" rel="noreferrer" className="btn-navy">Join class</a>
          )}
          {c.recording_url && (
            <a href={c.recording_url} target="_blank" rel="noreferrer" className="btn-outline">▶ Recording</a>
          )}
        </div>
        {c.invite_key && (
          <span className="text-[11px] font-semibold text-slate-400">class key: <code className="font-black tracking-widest text-navy-700">{c.invite_key}</code></span>
        )}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-navy-900">Live Classes</h1>
      <p className="mt-1 text-slate-500">Your scheduled sessions across all enrolled courses.</p>

      <div className="mt-6"><JoinByKey onJoined={load} /></div>

      <h2 className="mt-10 mb-4 text-lg font-black text-navy-900">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState icon="📅" title="No upcoming classes" hint="Your teachers will schedule live sessions soon." />
      ) : (
        <div className="space-y-4">{upcoming.map((c) => <Card key={c.id} c={c} />)}</div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 text-lg font-black text-navy-900">Past sessions</h2>
          <div className="space-y-4 opacity-80">{past.map((c) => <Card key={c.id} c={c} />)}</div>
        </>
      )}
    </div>
  )
}