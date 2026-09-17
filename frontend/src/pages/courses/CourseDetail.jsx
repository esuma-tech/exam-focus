import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store'
import { ErrorBox, Loading, SubjectDot } from '../../components/ui'

export default function CourseDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`/courses/${id}`)
      .then(setCourse)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!user || !['learner', 'parent'].includes(user.role)) return
    api('/enrollments/my')
      .then((rows) => setEnrolled(rows.some((r) => r.course.id === Number(id))))
      .catch(() => {})
  }, [user, id])

  const enroll = async () => {
    if (!user) return navigate('/login')
    setBusy(true)
    setError('')
    try {
      await api(`/enrollments/${id}`, { method: 'POST' })
      if (['learner', 'parent'].includes(user.role)) navigate(`/learn/courses/${id}`)
      else setEnrolled(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />
  if (!course) return <div className="mx-auto max-w-3xl px-4 py-20"><ErrorBox error={error || 'Course not found'} /></div>

  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0)

  return (
    <div>
      <section className="bg-navy-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/30">{course.grade}</span>
              <span className="chip bg-white/10 text-slate-200">{course.subject}</span>
              <span className="chip bg-white/10 text-slate-200 capitalize">{course.difficulty}</span>
            </div>
            <h1 className="mt-5 text-4xl font-black">{course.title}</h1>
            <p className="mt-3 text-lg text-slate-300">{course.subtitle}</p>
            <p className="mt-6 leading-relaxed text-slate-400">{course.description}</p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="font-bold text-gold-300">{course.modules.length}</span> modules
              </span>
              <span className="flex items-center gap-2 text-slate-300">
                <span className="font-bold text-gold-300">{lessonCount}</span> lessons
              </span>
              <span className="flex items-center gap-2 text-slate-300">
                <span className="font-bold text-gold-300">{course.enrollment_count}</span> enrolled
              </span>
              {course.instructor && (
                <span className="text-slate-300">Instructor: <span className="font-semibold text-white">{course.instructor.full_name}</span></span>
              )}
            </div>
          </div>

          <div className="card !bg-white p-7 text-slate-800 lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-navy-900">
                {course.price_etb > 0 ? course.price_etb.toLocaleString() : 'Free'}
              </span>
              {course.price_etb > 0 && <span className="pb-1 text-sm font-semibold text-slate-500">ETB / month</span>}
            </div>
            <ErrorBox error={error} />
            <div className="mt-6">
              {user && enrolled ? (
                <button className="btn-primary w-full !py-3" onClick={() => navigate(`/learn/courses/${id}`)}>
                  Continue learning →
                </button>
              ) : user && ['admin', 'instructor'].includes(user.role) ? (
                <p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-500">
                  You are signed in as {user.role}.
                </p>
              ) : (
                <button className="btn-primary w-full !py-3" onClick={enroll} disabled={busy}>
                  {busy ? 'Enrolling…' : user ? 'Enroll now' : 'Sign in to enroll'}
                </button>
              )}
            </div>
            <ul className="mt-6 space-y-3 text-sm text-slate-600">
              {[
                'Live teacher-led classes',
                'Notes & downloadable resources',
                'Graded quizzes with instant feedback',
                'Discussion forum access',
                'Certificate on completion',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-black text-navy-900">Course content</h2>
        <div className="mt-6 space-y-4">
          {course.modules.map((mod, i) => (
            <div key={mod.id} className="card overflow-hidden">
              <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-800 text-sm font-black text-white">{i + 1}</span>
                <div>
                  <h3 className="font-bold text-navy-900">{mod.title}</h3>
                  <p className="text-xs text-slate-500">{mod.lessons.length} lesson{mod.lessons.length !== 1 && 's'}</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {mod.lessons.map((l) => (
                  <li key={l.id} className="flex items-center justify-between px-5 py-3.5">
                    <span className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <SubjectDot subject={course.subject} />
                      {l.title}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{l.duration_min ? `${l.duration_min} min` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}