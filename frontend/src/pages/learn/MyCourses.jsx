import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { EmptyState, Loading, ProgressBar, SubjectDot } from '../../components/ui'

export default function MyCourses() {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/enrollments/my')
      .then(setEnrollments)
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
          {enrollments.map((e) => (
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
                <Link to={`/learn/courses/${e.course.id}`} className="btn-navy mt-5 w-full !py-2">
                  {e.progress_percent >= 100 ? 'Review course' : 'Continue learning'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}