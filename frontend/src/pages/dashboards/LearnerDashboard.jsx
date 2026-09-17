import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store'
import { Loading, ProgressBar, SubjectDot } from '../../components/ui'

function Stat({ label, value, icon, accent = 'text-navy-900' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`mt-2 text-3xl font-black ${accent}`}>{value}</p>
    </div>
  )
}

export default function LearnerDashboard() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState([])
  const [live, setLive] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/enrollments/my').catch(() => []),
      api('/live?upcoming=true').catch(() => []),
      api('/analytics/learner').catch(() => null),
    ])
      .then(([enr, lv, sum]) => {
        setEnrollments(enr)
        setLive(lv)
        setSummary(sum)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  const avgProgress = summary?.avg_progress ?? 0
  const completed = summary?.completed ?? 0
  const avgScore = summary?.avg_score ?? 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">Welcome back, {user.full_name.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-slate-500">
            {user.grade ? `${user.grade} · ` : ''}Here's your learning at a glance.
          </p>
        </div>
        <Link to="/courses" className="btn-primary">Browse courses</Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Enrolled courses" value={enrollments.length} icon="📚" />
        <Stat label="Average progress" value={`${avgProgress}%`} icon="📈" accent="text-gold-500" />
        <Stat label="Completed" value={completed} icon="✅" accent="text-emerald-600" />
        <Stat label="Avg. quiz score" value={`${avgScore}%`} icon="🎯" />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-navy-900">Continue learning</h2>
            <Link to="/learn/courses" className="text-sm font-bold text-navy-700 hover:underline">View all</Link>
          </div>
          {enrollments.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">
              You haven't enrolled in any courses yet.{' '}
              <Link to="/courses" className="font-bold text-navy-700 hover:underline">Find a course →</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {enrollments.slice(0, 4).map((e) => (
                <div key={e.id} className="card card-hover flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-navy-800 text-lg font-black text-gold-300">
                    {e.course.title.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy-900">{e.course.title}</p>
                    <p className="flex items-center text-xs text-slate-500">
                      <SubjectDot subject={e.course.subject} />{e.course.subject} · {e.course.grade}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <ProgressBar percent={e.progress_percent} />
                      <span className="w-10 text-right text-xs font-bold text-slate-600">{Math.round(e.progress_percent)}%</span>
                    </div>
                  </div>
                  <Link to={`/learn/courses/${e.course.id}`} className="btn-navy flex-none !py-2">Continue</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-xl font-black text-navy-900">Upcoming live classes</h2>
          {live.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">No upcoming live classes.</div>
          ) : (
            <div className="space-y-3">
              {live.slice(0, 4).map((l) => (
                <div key={l.id} className="card p-5">
                  <span className="chip bg-red-100 text-red-700">🔴 LIVE</span>
                  <p className="mt-2 font-bold text-navy-900">{l.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(l.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {l.duration_min} min
                  </p>
                  {l.meeting_url && (
                    <a href={l.meeting_url} target="_blank" rel="noreferrer" className="btn-navy mt-3 w-full !py-2 text-xs">
                      Join session
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}