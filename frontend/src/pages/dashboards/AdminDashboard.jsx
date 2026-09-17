import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { Loading, ProgressBar } from '../../components/ui'

function Stat({ label, value, sub, icon, accent = 'text-navy-900' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`mt-2 text-3xl font-black ${accent}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function Bars({ data, valueKey = 'events', color = 'from-navy-700 to-navy-400', format }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]))
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.label} className="group relative flex flex-1 flex-col items-center justify-end">
          <div
            className={`w-full rounded-t bg-gradient-to-t ${color} transition group-hover:opacity-80`}
            style={{ height: `${(d[valueKey] / max) * 100}%`, minHeight: 2 }}
          />
          <span className="pointer-events-none absolute -top-7 hidden whitespace-nowrap rounded bg-navy-950 px-2 py-1 text-[10px] font-bold text-white group-hover:block">
            {d.label.slice(5)}: {format ? format(d[valueKey]) : d[valueKey]}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [activity, setActivity] = useState([])
  const [revenue, setRevenue] = useState([])
  const [instructor, setInstructor] = useState(null)
  const [quizPerf, setQuizPerf] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/analytics/overview'),
      api('/analytics/activity?days=14'),
      api('/analytics/revenue?days=30'),
      api('/analytics/instructor'),
      api('/analytics/quiz-performance'),
    ])
      .then(([o, a, r, i, q]) => {
        setOverview(o)
        setActivity(a)
        setRevenue(r)
        setInstructor(i)
        setQuizPerf(q)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!overview) return <p className="p-10 text-center text-slate-500">Unable to load analytics.</p>

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">Admin Analytics</h1>
          <p className="mt-1 text-slate-500">Platform-wide reporting and business intelligence.</p>
        </div>
        <Link to="/admin/users" className="btn-navy">Manage users</Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total users" value={overview.total_users} sub={`${overview.total_learners} learners · ${overview.total_instructors} teachers`} icon="👥" />
        <Stat label="Courses" value={overview.total_courses} sub={`${overview.published_courses} published`} icon="📚" accent="text-navy-700" />
        <Stat label="Enrollments" value={overview.total_enrollments} sub={`${overview.active_enrollments} active`} icon="✍️" accent="text-emerald-600" />
        <Stat label="Estimated revenue" value={`${overview.revenue_etb.toLocaleString()} ETB`} sub="based on enrollments" icon="💰" accent="text-gold-500" />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Stat label="Quizzes" value={overview.total_quizzes} sub={`${overview.quiz_attempts} attempts`} icon="📝" />
        <Stat label="Avg. quiz score" value={`${overview.avg_quiz_percent}%`} sub="across all attempts" icon="🎯" accent="text-navy-700" />
        <Stat label="Forum posts" value={overview.forum_posts} sub="student & teacher discussions" icon="💬" accent="text-emerald-600" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-black text-navy-900">User activity</h2>
          <p className="mb-4 text-xs text-slate-500">Platform events over the last 14 days.</p>
          <Bars data={activity} />
        </div>
        <div className="card p-6">
          <h2 className="font-black text-navy-900">Revenue trend</h2>
          <p className="mb-4 text-xs text-slate-500">Estimated monthly revenue (ETB) over 30 days.</p>
          <Bars data={revenue} valueKey="amount_etb" color="from-gold-500 to-gold-300" format={(v) => `${v} ETB`} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-black text-navy-900">Course enrollment</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-head">Course</th>
                  <th className="table-head">Enrolled</th>
                  <th className="table-head">Avg progress</th>
                  <th className="table-head">Avg quiz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instructor?.courses?.map((c) => (
                  <tr key={c.course_id} className="hover:bg-slate-50">
                    <td className="table-cell font-semibold text-navy-900">{c.course_title}</td>
                    <td className="table-cell">{c.enrollments}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20"><ProgressBar percent={c.avg_progress} /></div>
                        <span className="text-xs font-bold text-slate-500">{c.avg_progress}%</span>
                      </div>
                    </td>
                    <td className="table-cell">{c.avg_quiz_score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-black text-navy-900">Quiz performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-head">Quiz</th>
                  <th className="table-head">Attempts</th>
                  <th className="table-head">Avg</th>
                  <th className="table-head">Pass rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quizPerf.map((q) => (
                  <tr key={q.quiz_id} className="hover:bg-slate-50">
                    <td className="table-cell font-semibold text-navy-900">{q.quiz_title}</td>
                    <td className="table-cell">{q.attempts}</td>
                    <td className="table-cell">{q.avg_percent}%</td>
                    <td className="table-cell">
                      <span className={`chip ${q.pass_rate >= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-gold-100 text-gold-700'}`}>
                        {q.pass_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
                {quizPerf.length === 0 && (
                  <tr><td className="table-cell text-slate-400" colSpan={4}>No quiz attempts yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}