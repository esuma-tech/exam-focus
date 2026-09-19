import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadPdf } from '../../api'
import { useAuth } from '../../store'
import { ErrorBox, EmptyState, Loading, ProgressBar, SubjectDot } from '../../components/ui'

export default function ParentDashboard() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sid, setSid] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState('')

  const downloadDoc = async (student, kind) => {
    setDownloadBusy(kind)
    try {
      await downloadPdf(`/students/${student.id}/${kind}`, `${kind}-${student.id}.pdf`)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloadBusy('')
    }
  }

  const load = () =>
    api('/parents/students')
      .then(setStudents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  const addStudent = async (e) => {
    e.preventDefault()
    setError('')
    const ids = sid.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    if (ids.length === 0) return
    setBusy(true)
    try {
      const rows = await api('/parents/students', { method: 'POST', body: { student_ids: ids } })
      setStudents(rows)
      setSid('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeStudent = async (studentId, name) => {
    if (!window.confirm(`Stop following ${name}? You can add them again with their student ID.`)) return
    setError('')
    try {
      const rows = await api(`/parents/students/${studentId}`, { method: 'DELETE' })
        .then(() => api('/parents/students'))
      setStudents(rows)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">Parent dashboard</h1>
          <p className="mt-1 text-slate-500">Hi {user.full_name.split(' ')[0]} — follow your children's progress and results.</p>
        </div>
      </div>

      <div className="mb-8 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h2 className="text-lg font-black text-navy-900">Follow a student</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ask your child for their 6-digit student ID (shown on their dashboard). You can add several students.
            </p>
            <form onSubmit={addStudent} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1 !text-lg tracking-[0.3em]"
                placeholder="123456"
                maxLength={20}
                value={sid}
                onChange={(e) => setSid(e.target.value)}
              />
              <button className="btn-primary" disabled={busy || !sid.trim()}>
                {busy ? 'Adding…' : 'Add student'}
              </button>
            </form>
            <p className="mt-2 text-xs text-slate-400">Tip: you can paste several IDs separated by comma or space.</p>
          </div>
        </div>
        <div className="card bg-navy-900 p-6 text-white">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold-300">How it works</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>• Your child's account gets a unique 6-digit ID</li>
            <li>• Connect by entering that ID here or at registration</li>
            <li>• See progress, quiz scores and completed lessons live</li>
          </ul>
        </div>
      </div>

      {error && <div className="mb-6"><ErrorBox error={error} /></div>}

      {students.length === 0 ? (
        <EmptyState
          icon="👨‍👩‍👧"
          title="No students linked yet"
          hint="Enter a student ID above to start following your child."
        />
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-black text-navy-900">Your students ({students.length})</h2>
          {students.map((s) => (
            <div key={s.student.id} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-800 text-lg font-black text-gold-300">
                    {s.student.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-navy-900">{s.student.full_name}</p>
                    <p className="text-xs text-slate-500">
                      Student ID <span className="font-black tracking-[0.25em] text-navy-700">{s.student.student_id}</span>
                      {s.student.grade ? ` · ${s.student.grade}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xl font-black text-gold-500">{Math.round(s.avg_progress)}%</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg progress</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-emerald-600">{Math.round(s.avg_quiz_score)}%</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg quiz score</p>
                  </div>
                  <button onClick={() => removeStudent(s.student.id, s.student.full_name)} className="btn-outline !px-3 !py-1.5 text-xs text-red-600 hover:!border-red-300">
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link to="/parent/quizzes" className="btn-navy !px-3 !py-2 text-xs">📝 Quizzes & progress</Link>
                <button onClick={() => downloadDoc(s.student, 'certificate')} className="btn-outline !px-3 !py-2 text-xs" disabled={!!downloadBusy}>
                  📜 Certificate
                </button>
                <button onClick={() => downloadDoc(s.student, 'id_card')} className="btn-outline !px-3 !py-2 text-xs" disabled={!!downloadBusy}>
                  🎫 ID card
                </button>
              </div>

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                {s.courses.length === 0 ? (
                  <p className="text-sm text-slate-500">Not yet enrolled in any courses.</p>
                ) : (
                  s.courses.map((c) => (
                    <div key={c.course_id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-sm font-bold text-navy-900">
                          <SubjectDot subject={c.subject} />{c.title}
                        </p>
                        <p className="text-xs font-bold text-slate-500">
                          Quiz avg: <span className="text-emerald-600">{Math.round(c.average_quiz_score)}%</span>
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar percent={c.progress_percent} />
                        <span className="w-10 text-right text-xs font-bold text-slate-600">{Math.round(c.progress_percent)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}