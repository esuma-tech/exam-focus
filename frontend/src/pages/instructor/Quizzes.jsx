import { useEffect, useState } from 'react'
import { api } from '../../api'
import { EmptyState, ErrorBox, Loading } from '../../components/ui'

const EMPTY_QUESTION = { prompt: '', question_type: 'multiple_choice', options: [], correct_answer: '', explanation: '', points: 1, position: 0 }

export default function InstructorQuizzes() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // draft object
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attemptsFor, setAttemptsFor] = useState(null)
  const [attempts, setAttempts] = useState([])

  const load = () => {
    setLoading(true)
    api('/quizzes/mine')
      .then((list) => { setQuizzes(list || []) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const startEdit = (q) => {
    setEditing({
      id: q.id,
      title: q.title,
      description: q.description,
      time_limit_min: q.time_limit_min,
      pass_percent: q.pass_percent,
      attempt_limit: q.attempt_limit,
      is_published: q.is_published,
      questions: q.questions.map((x) => ({
        ...x,
        options_text: Array.isArray(x.options) ? x.options.join(', ') : '',
        options: undefined,
      })),
    })
    setDirty(false)
    setAttemptsFor(null)
  }

  const set = (k, v) => { setEditing((d) => ({ ...d, [k]: v })); setDirty(true) }
  const setQ = (i, k, v) => {
    setEditing((d) => {
      const questions = d.questions.map((x, idx) => (idx === i ? { ...x, [k]: v } : x))
      return { ...d, questions }
    })
    setDirty(true)
  }

  const importPreset = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api('/quizzes/import', { method: 'POST', form })
      const start = editing.questions.length
      const added = res.questions.map((q, i) => ({ ...q, position: start + i }))
      setEditing((d) => ({ ...d, questions: [...d.questions, ...added] }))
      setDirty(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const save = async (draft) => {
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: draft.title,
        description: draft.description,
        time_limit_min: Number(draft.time_limit_min) || 15,
        pass_percent: Number(draft.pass_percent) || 0,
        attempt_limit: Number(draft.attempt_limit) || 1,
        is_published: !!draft.is_published,
        questions: draft.questions.map((q, i) => ({
          prompt: q.prompt,
          question_type: q.question_type,
          options: Array.isArray(q.options) ? q.options : q.options_text ? q.options_text.split(',').map((s) => s.trim()).filter(Boolean) : [],
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          points: Number(q.points) || 1,
          position: i,
        })),
      }
      const updated = await api(`/quizzes/${draft.id}`, { method: 'PUT', body: payload })
      setEditing(null)
      setDirty(false)
      load()
      setError(`${updated.title}: saved ✓`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const del = async (q) => {
    if (!window.confirm(`Delete the quiz "${q.title}"? Students' attempts will also be removed.`)) return
    setBusy(true)
    setError('')
    try {
      await api(`/quizzes/${q.id}`, { method: 'DELETE' })
      if (editing?.id === q.id) setEditing(null)
      load()
      setError('Quiz deleted.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const togglePublish = async (q) => {
    setBusy(true)
    setError('')
    try {
      await api(`/quizzes/${q.id}`, { method: 'PATCH', body: { is_published: !q.is_published } })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const showAttempts = async (q) => {
    setError('')
    setAttemptsFor(attemptsFor === q.id ? null : q.id)
    setAttempts([])
    try {
      if (attemptsFor !== q.id) {
        const rows = await api(`/quizzes/${q.id}/attempts`)
        setAttempts(rows || [])
      }
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-navy-900">Quiz manager 📝</h1>
        <p className="mt-1 text-slate-500">Create quizzes inside a course builder, then edit, publish or delete them here.</p>
      </div>

      <ErrorBox error={error} />

      {editing ? (
        <div className="card p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-navy-900">Edit quiz</h2>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
                <input type="checkbox" checked={editing.is_published} onChange={(e) => set('is_published', e.target.checked)} className="h-4 w-4 accent-navy-800" />
                Published
              </label>
              <button className="btn-outline !py-2 text-sm" onClick={() => { setEditing(null); setDirty(false) }}>Cancel</button>
              <button className="btn-navy !py-2 text-sm" onClick={() => save(editing)} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input className="input" value={editing.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input className="input" value={editing.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div>
              <label className="label">Time limit (min)</label>
              <input className="input" type="number" min={1} value={editing.time_limit_min} onChange={(e) => set('time_limit_min', e.target.value)} />
            </div>
            <div>
              <label className="label">Pass %</label>
              <input className="input" type="number" min={0} max={100} value={editing.pass_percent} onChange={(e) => set('pass_percent', e.target.value)} />
            </div>
            <div>
              <label className="label">Attempt limit</label>
              <input className="input" type="number" min={1} value={editing.attempt_limit} onChange={(e) => set('attempt_limit', e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="btn-outline cursor-pointer !py-2.5 text-sm">
                {busy ? 'Importing…' : '📄 Import PDF / Word'}
                <input type="file" accept=".pdf,.doc,.docx,.txt,.md" className="hidden" onChange={importPreset} disabled={busy} />
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h3 className="font-black text-navy-900">Questions ({editing.questions.length})</h3>
            <button className="btn-outline !py-2 text-sm" onClick={() => { set('questions', [...editing.questions, { ...EMPTY_QUESTION, position: editing.questions.length }]) }}>
              + Add question
            </button>
          </div>

          <div className="mt-4 space-y-6">
            {editing.questions.map((q, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <label className="label mb-0 flex-1">Q{i + 1}</label>
                  <button className="text-xs font-bold text-red-500 hover:underline" onClick={() => set('questions', editing.questions.filter((_, idx) => idx !== i))}>
                    Remove
                  </button>
                </div>
                <textarea className="input mt-2" rows={2} placeholder="Question prompt" value={q.prompt} onChange={(e) => setQ(i, 'prompt', e.target.value)} />
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Type</label>
                    <select className="input" value={q.question_type} onChange={(e) => setQ(i, 'question_type', e.target.value)}>
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="short_answer">Short answer</option>
                      <option value="true_false">True / false</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Points</label>
                    <input className="input" type="number" step="0.5" min={0} value={q.points} onChange={(e) => setQ(i, 'points', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Correct answer</label>
                    <input className="input" value={q.correct_answer} onChange={(e) => setQ(i, 'correct_answer', e.target.value)} />
                  </div>
                </div>
                {q.question_type === 'multiple_choice' && (
                  <div className="mt-3">
                    <label className="label">Options (comma separated)</label>
                    <input
                      className="input"
                      value={q.options_text ?? (Array.isArray(q.options) ? q.options.join(', ') : '')}
                      onChange={(e) => setQ(i, 'options_text', e.target.value)}
                      placeholder="A. Three, B. Seven, C. Nine, D. Eleven"
                    />
                  </div>
                )}
                <div className="mt-3">
                  <label className="label">Explanation</label>
                  <input className="input" value={q.explanation} onChange={(e) => setQ(i, 'explanation', e.target.value)} />
                </div>
              </div>
            ))}
            {editing.questions.length === 0 && (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">No questions yet — add one or import a PDF/Word document.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {quizzes.length === 0 ? (
            <EmptyState icon="📝" title="No quizzes yet" hint="Open a course builder and publish a quiz — it will appear here for editing." />
          ) : (
            <div className="space-y-3">
              {quizzes.map((q) => (
                <div key={q.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-navy-900">{q.title}</p>
                      <p className="text-xs text-slate-500">
                        {q.course_title} · {q.questions.length} questions · {q.attempts_count} attempts · {q.time_limit_min} min
                      </p>
                    </div>
                    <span className={`chip ${q.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {q.is_published ? 'Published' : 'Draft'}
                    </span>
                    <div className="flex gap-2">
                      <button className="btn-outline !py-2 text-xs" onClick={() => togglePublish(q)}>
                        {q.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="btn-outline !py-2 text-xs" onClick={() => startEdit(q)}>Edit</button>
                      <button className="btn !border-red-200 !py-2 text-xs !text-red-600 hover:!bg-red-50" onClick={() => del(q)}>Delete</button>
                    </div>
                  </div>
                  <button className="mt-3 text-xs font-bold text-navy-700 hover:underline" onClick={() => showAttempts(q)}>
                    {attemptsFor === q.id ? 'Hide student attempts ▲' : `View student attempts (${q.attempts_count}) ▼`}
                  </button>
                  {attemptsFor === q.id && (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                      {attempts.length === 0 ? (
                        <p className="p-4 text-sm text-slate-400">No attempts yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                              <th className="table-head">Student</th>
                              <th className="table-head">Score</th>
                              <th className="table-head">Result</th>
                              <th className="table-head">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attempts.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-50">
                                <td className="table-cell font-semibold text-navy-900">{a.student.full_name} <span className="text-xs font-normal text-slate-400">{a.student.student_id}</span></td>
                                <td className="table-cell">{Math.round(a.percent)}% ({a.score}/{a.max_score})</td>
                                <td className="table-cell">
                                  <span className={`chip ${a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{a.passed ? 'Passed' : 'Failed'}</span>
                                </td>
                                <td className="table-cell text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}