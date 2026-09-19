import { useEffect, useState } from 'react'
import { downloadPdf } from '../../api'
import { EmptyState, ErrorBox, Loading } from '../../components/ui'

export default function AdminStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [courseTitle, setCourseTitle] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    api('/students')
      .then((list) => setStudents(list || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const openStudent = async (id) => {
    setSelectedId(id)
    setDetail(null)
    setDetailLoading(true)
    setNote('')
    try {
      const d = await api(`/students/${id}`)
      setDetail(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const issue = async (kind) => {
    setBusy(kind)
    setError('')
    try {
      const body = kind === 'certificate' ? { course_title: courseTitle } : {}
      const res = kind === 'certificate'
        ? await api(`/students/${selectedId}/certificate`, { method: 'POST', body })
        : await api(`/students/${selectedId}/id-card`, { method: 'POST' })
      setNote(`✓ ${kind === 'certificate' ? 'Certificate' : 'ID card'} issued${res.id ? '' : ''}.`)
      openStudent(selectedId)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const download = async (kind) => {
    setBusy(kind)
    setError('')
    try {
      await downloadPdf(`/students/${selectedId}/${kind}`, `${kind}-${selectedId}.pdf`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }

  const filtered = students.filter((s) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      s.full_name.toLowerCase().includes(q) ||
      (s.student_id || '').toLowerCase().includes(q) ||
      s.grade.toLowerCase().includes(q)
    )
  })

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">Students 👨‍🎓</h1>
          <p className="mt-1 text-slate-500">Select a student to review quiz results and issue certificates or ID cards.</p>
        </div>
        <input className="input sm:w-72" placeholder="Search name, ID or grade…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <ErrorBox error={error} />
      {note && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{note}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {filtered.length === 0 ? (
            <EmptyState icon="🔍" title="No students found" hint="Try a different search." />
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openStudent(s.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                    selectedId === s.id ? 'border-navy-700 bg-navy-50' : 'border-slate-100 bg-white hover:border-navy-200'
                  }`}
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-navy-800 text-sm font-black text-gold-300">
                    {s.full_name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy-900">{s.full_name}</span>
                    <span className="block text-xs text-slate-500">ID {s.student_id ?? '—'} · {s.grade || '—'}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-400">{s.avg_quiz_score}%</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selectedId ? (
            <div className="card p-10 text-center text-slate-400">Select a student to see their progress and issue documents.</div>
          ) : detailLoading ? (
            <Loading label="Loading student…" />
          ) : detail ? (
            <div className="space-y-6">
              <div className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-navy-900">{detail.full_name}</h2>
                    <p className="text-sm text-slate-500">ID {detail.student_id ?? '—'} · {detail.grade || 'No grade'} · {detail.email}</p>
                    <p className="mt-1 text-xs text-slate-400">{detail.enrollments} course(s) · avg quiz {detail.avg_quiz_score}%</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-outline !py-2 text-sm" disabled={!!busy} onClick={() => download('certificate')}>
                      {busy === 'certificate' ? '…' : '📜 Certificate PDF'}
                    </button>
                    <button className="btn-outline !py-2 text-sm" disabled={!!busy} onClick={() => download('id_card')}>
                      {busy === 'id_card' ? '…' : '🎫 ID card PDF'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="font-black text-navy-900">Issue documents</h3>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="min-w-64 flex-1">
                    <label className="label">Certificate course title</label>
                    <input className="input" placeholder="e.g. Mathematics Grade 12" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
                  </div>
                  <button className="btn-navy !py-2.5 text-sm" disabled={!!busy || !courseTitle.trim()} onClick={() => issue('certificate')}>
                    {busy === 'certificate' ? 'Issuing…' : '📜 Issue certificate'}
                  </button>
                  <button className="btn-outline !py-2.5 text-sm" disabled={!!busy} onClick={() => issue('id_card')}>
                    {busy === 'id_card' ? 'Issuing…' : '🎫 Issue ID card'}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.certificates.map((c) => (
                    <span key={c.id} className="chip bg-slate-100 text-slate-600">
                      {c.kind === 'certificate' ? '📜' : '🎫'} {c.kind} · {new Date(c.created_at).toLocaleDateString()}{c.course_title ? ` · ${c.course_title}` : ''}
                    </span>
                  ))}
                  {detail.certificates.length === 0 && <span className="text-xs text-slate-400">Nothing issued yet.</span>}
                </div>
              </div>

              <div className="card overflow-hidden">
                <h3 className="px-6 pt-6 font-black text-navy-900">Quiz results</h3>
                <div className="overflow-x-auto">
                  {detail.quiz_results.length === 0 ? (
                    <p className="p-6 text-sm text-slate-400">No quiz attempts yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                          <th className="table-head">Quiz</th>
                          <th className="table-head">Course</th>
                          <th className="table-head">Score</th>
                          <th className="table-head">Result</th>
                          <th className="table-head">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.quiz_results.map((r) => (
                          <tr key={r.attempt_id} className="hover:bg-slate-50">
                            <td className="table-cell font-semibold text-navy-900">{r.quiz_title}</td>
                            <td className="table-cell text-slate-500">{r.course_title}</td>
                            <td className="table-cell font-bold text-navy-900">{Math.round(r.percent)}% <span className="text-xs font-normal text-slate-400">({r.score}/{r.max_score})</span></td>
                            <td className="table-cell">
                              <span className={`chip ${r.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.passed ? 'Passed' : 'Failed'}</span>
                            </td>
                            <td className="table-cell text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}