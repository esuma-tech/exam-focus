import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { CourseCard, EmptyState, Loading } from '../../components/ui'

export default function CourseList() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api('/courses')
      .then(setCourses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const subjects = useMemo(() => [...new Set(courses.map((c) => c.subject).filter(Boolean))].sort(), [courses])
  const grades = useMemo(() => [...new Set(courses.map((c) => c.grade).filter(Boolean))].sort(), [courses])

  const filtered = courses.filter(
    (c) =>
      (!subject || c.subject === subject) &&
      (!grade || c.grade === grade) &&
      (!search || `${c.title} ${c.subtitle} ${c.description}`.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-navy-900">Course Catalog</h1>
        <p className="mt-2 text-slate-500">Grade 9–12 courses mapped to the Ethiopian national curriculum.</p>
      </div>

      <div className="card mb-8 flex flex-col gap-4 p-5 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="label">Search</label>
          <input className="input" placeholder="Search courses…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-full md:w-48">
          <label className="label">Subject</label>
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="w-full md:w-44">
          <label className="label">Grade</label>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">All grades</option>
            {grades.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No courses found" hint="Try adjusting your filters or search terms." />
      ) : (
        <>
          <p className="mb-4 text-sm font-semibold text-slate-500">{filtered.length} course{filtered.length !== 1 && 's'}</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </>
      )}
    </div>
  )
}