import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store'
import AttachmentViewer from '../../components/AttachmentViewer'
import Forum from '../../components/Forum'
import Reader from '../../components/Reader'
import { Loading, ProgressBar } from '../../components/ui'

const TABS = ['Lessons', 'Quizzes', 'Discussion']

export default function CoursePlayer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const view = params.get('view') || ''
  const [course, setCourse] = useState(null)
  const [enrollment, setEnrollment] = useState(null)
  const [quizzes, setQuizzes] = useState([])
  const [live, setLive] = useState([])
  const [lesson, setLesson] = useState(null)
  const [mode, setMode] = useState('video') // video | read | doc
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
      api(`/live?course_id=${id}`).catch(() => []),
    ])
      .then(([c, , q, lv]) => {
        setCourse(c)
        setQuizzes(q)
        setLive(lv || [])
        const all = c.modules.flatMap((m) => m.lessons)
        let initial = all[0] || null
        if (view === 'video') initial = all.find((l) => l.video_url) || initial
        else if (view === 'read') initial = all.find((l) => l.attachment_url || l.content) || initial
        setLesson(initial)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, view])

  // When the lesson changes, pick a sensible material mode from the deep-link
  // intent (view=video / view=read) or the first available material.
  useEffect(() => {
    if (!lesson) return
    const available = []
    if (lesson.video_url) available.push('video')
    if (lesson.content) available.push('read')
    if (lesson.attachment_url) available.push('doc')
    const preferred = view === 'video' ? 'video' : view === 'read' ? 'read' : (lesson.video_url ? 'video' : 'read')
    setMode(available.includes(preferred) ? preferred : available[0] || 'video')
  }, [lesson?.id])

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

      <div className="mb-6 grid gap-3">
        {live.map((cl) => (
          <div key={cl.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {cl.status === 'live' ? (
                  <span className="chip bg-red-100 text-red-700">🔴 Live now</span>
                ) : (
                  <span className="chip bg-gold-100 text-yellow-800">🗓 Live class</span>
                )}
                <h3 className="font-black text-navy-900">{cl.title}</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {new Date(cl.scheduled_at).toLocaleString()} · {cl.duration_min} min
              </p>
            </div>
            {cl.status === 'live' ? (
              <a href={cl.meeting_url} target="_blank" rel="noreferrer" className="btn-primary flex-none">Go live</a>
            ) : (
              <span className="btn-outline cursor-not-allowed flex-none opacity-60">Join at start time</span>
            )}
          </div>
        ))}
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
            <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:w-auto">
              {lesson.video_url && (
                <button
                  onClick={() => setMode('video')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                    mode === 'video' ? 'bg-navy-800 text-white' : 'text-slate-500 hover:text-navy-900'
                  }`}
                >
                  🎬 Video class
                </button>
              )}
              {lesson.content && (
                <button
                  onClick={() => setMode('read')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                    mode === 'read' ? 'bg-navy-800 text-white' : 'text-slate-500 hover:text-navy-900'
                  }`}
                >
                  📖 Read lesson
                </button>
              )}
              {lesson.attachment_url && (
                <button
                  onClick={() => setMode('doc')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                    mode === 'doc' ? 'bg-navy-800 text-white' : 'text-slate-500 hover:text-navy-900'
                  }`}
                >
                  📄 Document
                </button>
              )}
            </div>
            {lesson ? (
              mode === 'video' && lesson.video_url ? (
                <article className="card p-8">
                  <h2 className="text-2xl font-black text-navy-900">{lesson.title}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">{lesson.duration_min ? `${lesson.duration_min} min` : ''}</p>
                  <div className="relative mt-5 select-none" onContextMenu={(e) => e.preventDefault()}>
                    <video
                      className="w-full rounded-xl bg-black"
                      controls
                      controlsList="nodownload noremoteplayback noplaybackrate"
                      disablePictureInPicture
                      onContextMenu={(e) => e.preventDefault()}
                      src={lesson.video_url}
                    />
                    {user?.email && (
                      <span className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
                        <span className="select-none rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white/75">
                          {user.full_name} · {user.email}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                    {completed.has(lesson.id) ? (
                      <span className="chip bg-emerald-100 text-emerald-700">✓ Completed</span>
                    ) : (
                      <button className="btn-navy" onClick={markComplete}>Mark as complete</button>
                    )}
                    <button className="btn-primary" onClick={gotoNext}>Next lesson →</button>
                  </div>
                </article>
              ) : mode === 'doc' && lesson.attachment_url ? (
                <article className="card p-8">
                  <h2 className="text-2xl font-black text-navy-900">{lesson.title}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">Lesson document</p>
                  <AttachmentViewer
                    url={lesson.attachment_url}
                    title={lesson.title}
                    watermark={`${user?.full_name || ''} · ${user?.email || ''}`}
                  />
                  <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
                    {completed.has(lesson.id) ? (
                      <span className="chip bg-emerald-100 text-emerald-700">✓ Completed</span>
                    ) : (
                      <button className="btn-navy" onClick={markComplete}>Mark as complete</button>
                    )}
                    <button className="btn-primary" onClick={gotoNext}>Next lesson →</button>
                  </div>
                </article>
              ) : mode === 'read' && lesson.content ? (
                <Reader lesson={lesson} completed={completed} onComplete={markComplete} onNext={gotoNext} />
              ) : (
                <p className="text-slate-500">No materials to show for this lesson.</p>
              )
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