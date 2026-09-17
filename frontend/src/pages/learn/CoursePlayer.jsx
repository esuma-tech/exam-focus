import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import Forum from '../../components/Forum'
import { Loading, ProgressBar } from '../../components/ui'

const TABS = ['Lessons', 'Quizzes', 'Discussion']

export default function CoursePlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  const [lesson, setLesson] = useState(null)
  const [tab, setTab] = useState('Lessons')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadEnrollment = () =>
    api('/enrollments/my').then((rows) => {
      const found = rows.find((r) => r.course.id === Number(id))
      setEnrollment(found || null)
      return found
    })

  useEffect(() => {
    Promise.all([
      api(`/courses/${id}`),
      loadEnrollment(),
      api(`/quizzes?course_id=${id}`).catch(() => []),
    ])
      .then(([c, , q]) => {
        setCourse(c)
        setQuizzes(q)
        const all = c.modules.flatMap((m) => m.lessons)
        setLesson(all[0] || null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const allLessons = useMemo(() => course?.modules.flatMap((m) => m.lessons) || [], [course])
  const completed = new Set(enrollment?.completed_lesson_ids || [])

  const markComplete = async () => {
    if (!lesson || !enrollment) return
    try {
      const updated = await api(`/enrollments/${id}/lessons/complete`, {
        method: 'POST',
        body: { lesson_id: lesson.id },
      })
      setEnrollment(updated)
    } catch (e) {
      setError(e.message)
    }
  }

  const gotoNext = async () => {
    await markComplete()
    const idx = allLessons.findIndex((l) => l.id === lesson?.id)
    if (idx >= 0 && idx < allLessons.length - 1) setLesson(allLessons[idx + 1])
  }

  if (loading) return <Loading />
  if (error && !course) return <div className="p-10 text-center text-red-600">{error}</div>
  if (!course) return null

  if (!enrollment) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-black text-navy-900">You're not enrolled</h1>
        <p className="mt-2 text-slate-500">Enroll in {course.title} to access lessons, quizzes and the forum.</p>
        <Link to={`/courses/${id}`} className="btn-primary mt-6">View course</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/learn/courses" className="text-sm font-bold text-navy-600 hover:underline">← My Courses</Link>
          <h1 className="mt-1 text-2xl font-black text-navy-900">{course.title}</h1>
          <p className="text-sm text-slate-500">{course.subject} · {course.grade}</p>
        </div>
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
            <span>Progress</span><span>{Math.round(enrollment.progress_percent)}%</span>
          </div>
          <ProgressBar percent={enrollment.progress_percent} />
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition ${
              tab === t ? 'border-gold-400 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'
            }`}
          >
            {t}
            {t === 'Quizzes' && quizzes.length > 0 && (
              <span className="ml-2 chip bg-slate-100 text-slate-600">{quizzes.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Lessons' && (
        <div className="grid gap-8 lg:grid-cols-3">
          <aside className="lg:col-span-1">
            <div className="card max-h-[75vh] overflow-y-auto p-4">
              {course.modules.map((m, mi) => (
                <div key={m.id} className="mb-4">
                  <p className="px-2 text-xs font-black uppercase tracking-wider text-slate-400">
                    Module {mi + 1}: {m.title}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <button
                          onClick={() => setLesson(l)}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                            lesson?.id === l.id ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-black ${
                            completed.has(l.id) ? 'bg-emerald-500 text-white' : lesson?.id === l.id ? 'bg-white/20' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {completed.has(l.id) ? '✓' : ''}
                          </span>
                          <span className="truncate">{l.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          <div className="lg:col-span-2">
            {lesson ? (
              <article className="card p-8">
                <h2 className="text-2xl font-black text-navy-900">{lesson.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">{lesson.duration_min ? `${lesson.duration_min} min` : ''}</p>
                {lesson.video_url && (
                  <video className="mt-5 w-full rounded-xl bg-black" controls src={lesson.video_url} />
                )}
                <div className="prose prose-slate mt-6 max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                {lesson.attachment_url && (
                  <a href={lesson.attachment_url} target="_blank" rel="noreferrer" className="btn-outline mt-6">
                    📎 Download resource
                  </a>
                )}
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                  {completed.has(lesson.id) ? (
                    <span className="chip bg-emerald-100 text-emerald-700">✓ Completed</span>
                  ) : (
                    <button className="btn-navy" onClick={markComplete}>Mark as complete</button>
                  )}
                  <button className="btn-primary" onClick={gotoNext}>Next lesson →</button>
                </div>
              </article>
            ) : (
              <p className="text-slate-500">No lessons in this course yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'Quizzes' && (
        <div className="space-y-4">
          {quizzes.length === 0 ? (
            <p className="text-slate-500">No quizzes have been published for this course yet.</p>
          ) : (
            quizzes.map((q) => (
              <div key={q.id} className="card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-bold text-navy-900">{q.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{q.description}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    {q.time_limit_min} min · Pass mark {q.pass_percent}% · {q.attempt_limit} attempts allowed
                  </p>
                </div>
                <button className="btn-navy flex-none" onClick={() => navigate(`/learn/courses/${id}/quiz/${q.id}`)}>
                  Take quiz
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Discussion' && <Forum courseId={Number(id)} />}
    </div>
  )
}