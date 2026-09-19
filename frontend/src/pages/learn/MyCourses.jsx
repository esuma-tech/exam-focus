import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { EmptyState, Loading, ProgressBar, SubjectDot } from '../../components/ui'

export default function MyCourses() {
  const [enrollments, setEnrollments] = useState([])
  const [liveByCourse, setLiveByCourse] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api('/enrollments/my'),
      api('/live?upcoming=true').catch(() => []),
    ])
      .then(([enr, lv]) => {
        setEnrollments(enr)
        const map = {}
        for (const l of lv) {
          if (l.course_id) (map[l.course_id] = map[l.course_id] || []).push(l)
        }
        setLiveByCourse(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-black text-navy-900">My Courses</h1>
        <Link to="/courses" className="btn-primary">Add course</Link>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          icon="🎓"
          title="No courses yet"
          hint="Enroll in a course to start learning with live classes, quizzes and notes."
          action={<Link to="/courses" className="btn-primary mt-2">Browse catalog</Link>}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => {
            const lives = liveByCourse[e.course.id] || []
            const hasLiveOrUpcoming = lives.some((l) => l.status === 'live' || l.status === 'scheduled')
            const liveNow = lives.find((l) => l.status === 'live')
            return (
              <div key={e.id} className="card card-hover flex flex-col overflow-hidden">
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950">
                  <span className="text-3xl font-black text-gold-300">{Math.round(e.progress_percent)}%</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-bold text-navy-900">{e.course.title}</h3>
                  <p className="mt-1 flex items-center text-xs text-slate-500">
                    <SubjectDot subject={e.course.subject} />{e.course.subject} · {e.course.grade}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar percent={e.progress_percent} />
                    <span className="text-xs font-bold text-slate-500">{Math.round(e.progress_percent)}%</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/learn/courses/${e.course.id}?view=video`} className="btn-navy !py-2 text-center text-xs">🎬 Video class</Link>
                    <Link to={`/learn/courses/${e.course.id}?view=read`} className="btn-outline !py-2 text-center text-xs">📖 Read lesson</Link>
                  </div>
                  {hasLiveOrUpcoming &&
                    (liveNow ? (
                      <a href={liveNow.meeting_url} target="_blank" rel="noreferrer" className="btn-primary mt-2 !py-2 text-center text-xs">
                        🔴 Join live now
                      </a>
                    ) : (
                      <Link to={`/learn/courses/${e.course.id}`} className="btn-outline mt-2 !py-2 text-center text-xs">
                        🗓 Live class
                      </Link>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}