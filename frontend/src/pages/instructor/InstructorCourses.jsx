import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../store'
import { ErrorBox, Loading, SubjectDot } from '../../components/ui'

const STATUS = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600' },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Archived', cls: 'bg-red-100 text-red-600' },
}

export default function InstructorCourses() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    api('/courses?public=false')
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const mine = user.role === 'admin' ? courses : courses.filter((c) => c.instructor_id === user.id)
  const published = mine.filter((c) => c.status === 'published').length

  const togglePublish = async (c) => {
    try {
      await api(`/courses/${c.id}`, { method: 'PATCH', body: { status: c.status === 'published' ? 'draft' : 'published' } })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const removeCourse = async (c) => {
    if (!confirm(`Delete "${c.title}" permanently?`)) return
    try {
      await api(`/courses/${c.id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/instructor" className="text-sm font-bold text-navy-600 hover:underline">← Dashboard</Link>
          <h1 className="mt-1 text-3xl font-black text-navy-900">
            {user.role === 'admin' ? 'All courses' : 'My courses'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mine.length} course{mine.length === 1 ? '' : 's'} · {published} published · {mine.length - published} not published
          </p>
        </div>
        <Link to="/instructor/courses/new" className="btn-primary">+ New course</Link>
      </div>

      <ErrorBox error={error} />

      {mine.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl">📚</p>
          <h3 className="mt-3 text-lg font-bold text-navy-900">No courses yet</h3>
          <p className="mt-1 text-sm text-slate-500">Create your first course and start teaching.</p>
          <Link to="/instructor/courses/new" className="btn-navy mt-5">Build a course</Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {mine.map((c) => {
            const st = STATUS[c.status] || STATUS.draft
            return (
              <div key={c.id} className="card card-hover flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-100">
                      {c.thumbnail ? (
                        <img src={c.thumbnail} alt="" className="h-11 w-11 rounded-xl object-cover" />
                      ) : (
                        <span className="flex items-center text-sm font-black text-navy-900">
                          <SubjectDot subject={c.subject} />{c.subject.charAt(0)}
                        </span>
                      )}
                    </span>
                    <div>
                      <h3 className="font-black text-navy-900">{c.title}</h3>
                      <p className="text-xs font-semibold text-slate-500">{c.subject} · {c.grade}</p>
                    </div>
                  </div>
                  <span className={`chip ${st.cls}`}>{st.label}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.subtitle || c.description}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  {c.difficulty && (
                    <span className="chip bg-mint-100 text-mint-700 capitalize">{c.difficulty}</span>
                  )}
                  <span className="chip bg-gold-100 text-gold-700">
                    {c.price_etb > 0 ? `ETB ${c.price_etb}/mo` : 'Free'}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 pt-4">
                  <Link to={`/instructor/courses/${c.id}`} className="btn-navy !px-4 !py-2 text-xs">Edit course</Link>
                  <button
                    onClick={() => togglePublish(c)}
                    className={`btn !px-4 !py-2 text-xs ${c.status === 'published' ? 'btn-outline' : 'btn-primary'}`}
                  >
                    {c.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <Link to={`/courses/${c.id}`} className="btn-ghost !px-4 !py-2 text-xs">Preview</Link>
                  <button onClick={() => removeCourse(c)} className="btn-ghost !px-4 !py-2 text-xs !text-red-600">Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}