import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store'
import { ErrorBox, Loading, SubjectDot } from '../../components/ui'
import LiveManager from '../../components/LiveManager'

const SUBJECTS = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Geography', 'History', 'Economics', 'Aptitude']
const GRADES = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
const blankLesson = () => ({ title: '', summary: '', content: '', video_url: '', duration_min: 30 })
const blankModule = () => ({ title: '', description: '', lessons: [blankLesson()] })

export default function CourseBuilder() {
  const { id } = useParams()
  const isNew = id === 'new'
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', subtitle: '', description: '', subject: 'Mathematics', grade: 'Grade 12',
    price_etb: 0, difficulty: 'intermediate', status: 'draft', thumbnail: '', modules: [],
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (isNew) {
      setLoading(false)
      return
    }
    api(`/courses/${id}`)
      .then((c) => {
        setForm({
          title: c.title, subtitle: c.subtitle, description: c.description, subject: c.subject, grade: c.grade,
          price_etb: c.price_etb, difficulty: c.difficulty, status: c.status, thumbnail: c.thumbnail, modules: [],
        })
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const addModule = () => setForm((f) => ({ ...f, modules: [...f.modules, blankModule()] }))
  const removeModule = (mi) => setForm((f) => ({ ...f, modules: f.modules.filter((_, i) => i !== mi) }))
  const setModule = (mi, k, v) =>
    setForm((f) => ({ ...f, modules: f.modules.map((m, i) => (i === mi ? { ...m, [k]: v } : m)) }))
  const addLesson = (mi) => setForm((f) => ({ ...f, modules: f.modules.map((m, i) => (i === mi ? { ...m, lessons: [...m.lessons, blankLesson()] } : m)) }))
  const removeLesson = (mi, li) =>
    setForm((f) => ({ ...f, modules: f.modules.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m)) }))
  const setLesson = (mi, li, k, v) =>
    setForm((f) => ({
      ...f,
      modules: f.modules.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.map((l, j) => (j === li ? { ...l, [k]: v } : l)) } : m)),
    }))

  const saveMeta = async (e) => {
    e.preventDefault()
    setError('')
    setSaved('')
    setBusy(true)
    try {
      if (isNew) {
        const created = await api('/courses', { method: 'POST', body: { ...form, price_etb: Number(form.price_etb) } })
        setSaved('Course created as draft. Add modules below or from the edit page.')
        navigate(`/instructor/courses/${created.id}`)
      } else {
        await api(`/courses/${id}`, { method: 'PATCH', body: { ...form, price_etb: Number(form.price_etb) } })
        setSaved('Course details saved.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const addModules = async () => {
    if (!form.modules.length) return
    setBusy(true)
    setError('')
    try {
      for (const m of form.modules) {
        await api(`/courses/${id}/modules`, {
          method: 'POST',
          body: { ...m, lessons: m.lessons.map((l, li) => ({ ...l, duration_min: Number(l.duration_min), position: li })) },
        })
      }
      setSaved(`${form.modules.length} module(s) added.`)
      setForm((f) => ({ ...f, modules: [] }))
      const c = await api(`/courses/${id}`)
      setCourseData(c)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const [courseData, setCourseData] = useState(null)
  useEffect(() => {
    if (!isNew && id) api(`/courses/${id}`).then(setCourseData).catch(() => {})
  }, [id, isNew, saved])

  const publish = async () => {
    await api(`/courses/${id}`, { method: 'PATCH', body: { status: form.status === 'published' ? 'draft' : 'published' } })
    setForm((f) => ({ ...f, status: f.status === 'published' ? 'draft' : 'published' }))
  }

  const removeCourse = async () => {
    if (!confirm('Delete this course permanently?')) return
    await api(`/courses/${id}`, { method: 'DELETE' })
    navigate('/instructor')
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/instructor" className="text-sm font-bold text-navy-600 hover:underline">← Dashboard</Link>
          <h1 className="mt-1 text-3xl font-black text-navy-900">{isNew ? 'Create a course' : 'Edit course'}</h1>
        </div>
        {!isNew && (
          <div className="flex gap-2">
            <button onClick={publish} className={`btn ${form.status === 'published' ? 'btn-outline' : 'btn-primary'}`}>
              {form.status === 'published' ? 'Unpublish' : 'Publish course'}
            </button>
            <button onClick={removeCourse} className="btn-danger">Delete</button>
          </div>
        )}
      </div>

      <ErrorBox error={error} />
      {saved && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{saved}</div>}

      <form onSubmit={saveMeta} className="card space-y-5 p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Course title</label>
            <input className="input" required value={form.title} onChange={set('title')} placeholder="Grade 12 Mathematics" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Subtitle</label>
            <input className="input" value={form.subtitle} onChange={set('subtitle')} placeholder="National exam focused" />
          </div>
          <div>
            <label className="label">Subject</label>
            <select className="input" value={form.subject} onChange={set('subject')}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Grade</label>
            <select className="input" value={form.grade} onChange={set('grade')}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Price (ETB / month)</label>
            <input className="input" type="number" min="0" value={form.price_etb} onChange={set('price_etb')} />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={form.difficulty} onChange={set('difficulty')}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={4} value={form.description} onChange={set('description')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Thumbnail URL (optional)</label>
            <input className="input" value={form.thumbnail} onChange={set('thumbnail')} placeholder="https://…" />
          </div>
        </div>
        <button className="btn-navy" disabled={busy}>{isNew ? 'Create course' : 'Save details'}</button>
      </form>

      {!isNew && (
        <>
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-navy-900">Curriculum</h2>
              <button onClick={addModule} className="btn-outline">+ Add module</button>
            </div>

            {courseData?.modules?.map((m, mi) => (
              <div key={m.id} className="card mb-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 text-xs font-black text-white">{mi + 1}</span>
                  <h3 className="font-bold text-navy-900">{m.title}</h3>
                  <span className="chip bg-slate-100 text-slate-500">{m.lessons.length} lessons</span>
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 py-2 text-sm text-slate-600">
                      <SubjectDot subject={form.subject} />{l.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {form.modules.map((m, mi) => (
              <div key={mi} className="card mb-4 border-2 border-dashed border-navy-200 p-5">
                <div className="flex items-center gap-3">
                  <input className="input" placeholder="Module title" value={m.title} onChange={(e) => setModule(mi, 'title', e.target.value)} />
                  <button type="button" onClick={() => removeModule(mi)} className="btn-ghost !px-3 text-red-500">✕</button>
                </div>
                <input className="input mt-3" placeholder="Short module description" value={m.description} onChange={(e) => setModule(mi, 'description', e.target.value)} />
                <div className="mt-4 space-y-3">
                  {m.lessons.map((l, li) => (
                    <div key={li} className="rounded-xl bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        <input className="input" placeholder="Lesson title" value={l.title} onChange={(e) => setLesson(mi, li, 'title', e.target.value)} />
                        <button type="button" onClick={() => removeLesson(mi, li)} className="btn-ghost !px-3 text-red-500">✕</button>
                      </div>
                      <textarea className="input mt-2" rows={2} placeholder="Lesson summary" value={l.summary} onChange={(e) => setLesson(mi, li, 'summary', e.target.value)} />
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input className="input" placeholder="Video URL (optional)" value={l.video_url} onChange={(e) => setLesson(mi, li, 'video_url', e.target.value)} />
                        <input className="input" type="number" placeholder="Duration (min)" value={l.duration_min} onChange={(e) => setLesson(mi, li, 'duration_min', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addLesson(mi)} className="btn-ghost mt-3 text-navy-700">+ Add lesson</button>
              </div>
            ))}

            {form.modules.length > 0 && (
              <button onClick={addModules} className="btn-primary" disabled={busy}>Save {form.modules.length} module(s)</button>
            )}
          </div>

          <QuizCreator courseId={Number(id)} />
          <LiveManager courseId={Number(id)} className="mt-8" showCreate={!isNew} />
        </>
      )}
    </div>
  )
}

function QuizCreator({ courseId }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState([{ prompt: '', options: ['', '', '', ''], correct_answer: '' }])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      await api(`/quizzes?course_id=${courseId}`, {
        method: 'POST',
        body: {
          title,
          questions: questions.map((q, i) => ({ ...q, position: i, options: q.options.filter(Boolean) })),
        },
      })
      setMsg('Quiz published.')
      setTitle('')
      setQuestions([{ prompt: '', options: ['', '', '', ''], correct_answer: '' }])
      setOpen(false)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!open) {
    return (
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-black text-navy-900">Quizzes</h2>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm font-semibold text-emerald-600">{msg}</span>}
          <button onClick={() => setOpen(true)} className="btn-outline">+ Add quiz</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card mt-10 p-6">
      <h2 className="font-black text-navy-900">Create quiz</h2>
      <ErrorBox error={error} />
      <input className="input mt-4" placeholder="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} />
      {questions.map((q, qi) => (
        <div key={qi} className="mt-4 rounded-xl bg-slate-50 p-4">
          <input className="input" placeholder={`Question ${qi + 1}`} value={q.prompt} onChange={(e) => setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, prompt: e.target.value } : x)))} />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, oi) => (
              <input
                key={oi}
                className="input"
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={(e) => setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, options: x.options.map((o, j) => (j === oi ? e.target.value : o)) } : x)))}
              />
            ))}
          </div>
          <input className="input mt-2" placeholder="Correct answer (must match an option exactly)" value={q.correct_answer} onChange={(e) => setQuestions((qs) => qs.map((x, i) => (i === qi ? { ...x, correct_answer: e.target.value } : x)))} />
        </div>
      ))}
      <div className="mt-4 flex gap-2">
        <button className="btn-ghost" onClick={() => setQuestions((qs) => [...qs, { prompt: '', options: ['', '', '', ''], correct_answer: '' }])}>+ Question</button>
        <button className="btn-navy ml-auto" onClick={submit}>Publish quiz</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

