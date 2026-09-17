import { Link } from 'react-router-dom'

export function FullSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-navy-200 border-t-navy-800" />
    </div>
  )
}

export function Badge({ children, color = 'bg-navy-100 text-navy-800' }) {
  return <span className={`chip ${color}`}>{children}</span>
}

export function SubjectDot({ subject }) {
  const palette = {
    Mathematics: 'bg-blue-500',
    English: 'bg-pink-500',
    Physics: 'bg-indigo-500',
    Chemistry: 'bg-emerald-500',
    Biology: 'bg-green-600',
    Geography: 'bg-orange-500',
    History: 'bg-amber-600',
    Economics: 'bg-teal-500',
    Aptitude: 'bg-violet-500',
  }
  return <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${palette[subject] || 'bg-gold-400'}`} />
}

export function CourseCard({ course }) {
  const diffColor = {
    beginner: 'bg-emerald-100 text-emerald-700',
    intermediate: 'bg-gold-100 text-gold-700',
    advanced: 'bg-red-100 text-red-700',
  }[course.difficulty] || 'bg-slate-100 text-slate-600'

  return (
    <Link
      to={`/courses/${course.id}`}
      className="card card-hover group overflow-hidden flex flex-col"
    >
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400 font-black text-navy-950 transition group-hover:scale-110 text-xl">
            {course.title.charAt(0)}
          </div>
        )}
        <span className="absolute left-3 top-3 chip bg-white/90 text-navy-900">{course.grade}</span>
        {course.price_etb > 0 && (
          <span className="absolute right-3 top-3 chip bg-gold-400 text-navy-950 font-bold">
            {course.price_etb.toLocaleString()} ETB
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <SubjectDot subject={course.subject} />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{course.subject}</span>
        </div>
        <h3 className="mb-1 text-lg font-bold text-navy-900 group-hover:text-navy-700">{course.title}</h3>
        <p className="mb-4 line-clamp-2 flex-1 text-sm text-slate-500">{course.subtitle || course.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="chip bg-slate-100 text-slate-600">{course.difficulty}</span>
          </div>
          <span className="text-xs font-semibold text-navy-700">{course.instructor || ''}</span>
        </div>
      </div>
    </Link>
  )
}

export function ProgressBar({ percent }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full transition-all ${percent >= 100 ? 'bg-emerald-500' : 'bg-gold-400'}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

export function EmptyState({ icon = '📚', title, hint, action }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-5xl">{icon}</div>
      <h3 className="text-lg font-bold text-navy-900">{title}</h3>
      <p className="max-w-md text-sm text-slate-500">{hint}</p>
      {action}
    </div>
  )
}

export function Loading({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-200 border-t-navy-800" />
      <p className="text-sm font-medium text-slate-500">{label || 'Loading…'}</p>
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
      {error}
    </div>
  )
}