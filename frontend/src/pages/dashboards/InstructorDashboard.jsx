import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store'
import { Loading, ProgressBar } from '../../components/ui'

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

function Sparkline({ data }) {
  const max = Math.max(1, ...data.map((d) => d.events))
  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t bg-gradient-to-t from-navy-700 to-navy-400 transition group-hover:from-gold-500 group-hover:to-gold-300"
            style={{ height: `${(d.events / max) * 100}%`, minHeight: 2 }}
            title={`${d.label}: ${d.events} events`}
          />
        </div>
      ))}
    </div>
  )
}

export default function InstructorDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/analytics/instructor')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!data) return <p className="p-10 text-center text-slate-500">Unable to load analytics.</p>

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">Instructor Dashboard</h1>
          <p className="mt-1 text-slate-500">Welcome, {user.full_name}. Here's how your courses are performing.</p>
        </div>
        <Link to="/instructor/courses/new" className="btn-primary">+ New course</Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Courses" value={data.total_courses} icon="📘" />
        <Stat label="Total enrollments" value={data.total_enrollments} icon="👥" accent="text-navy-700" />
        <Stat label="Estimated revenue" value={`${data.total_revenue_etb.toLocaleString()} ETB`} icon="💰" accent="text-gold-500" />
        <Stat label="Active courses" value={data.courses.filter((c) => c.active > 0).length} icon="⚡" accent="text-emerald-600" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-black text-navy-900">Platform activity (14 days)</h2>
          <p className="mb-4 text-xs text-slate-500">Logins, enrollments, lesson completions and quiz submissions.</p>
          <Sparkline data={data.activity || []} />
        </div>

        <div className="card p-6">
          <h2 className="font-black text-navy-900">Course performance</h2>
          <div className="mt-4 space-y-4">
            {data.courses.length === 0 && <p className="text-sm text-slate-500">No courses yet.</p>}
            {data.courses.map((c) => (
              <div key={c.course_id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/instructor/courses/${c.course_id}`} className="truncate text-sm font-bold text-navy-900 hover:underline">
                    {c.course_title}
                  </Link>
                  <span className="chip flex-none bg-navy-100 text-navy-700">{c.enrollments} 👥</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar percent={c.avg_progress} />
                  <span className="w-12 text-right text-xs font-bold text-slate-500">{c.avg_progress}%</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Avg quiz score: <span className="font-bold text-slate-600">{c.avg_quiz_score}%</span></p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}