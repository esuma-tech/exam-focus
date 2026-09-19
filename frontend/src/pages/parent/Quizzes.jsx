import { useEffect, useState } from 'react'
import { downloadPdf } from '../../api'
import { EmptyState, ErrorBox, Loading } from '../../components/ui'

export default function ParentQuizzes() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dl, setDl] = useState('')

  useEffect(() => {
    api('/parents/quizzes')
      .then(setStudents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const download = async (kind, student, label) => {
    setDl(label)
    setError('')
    try {
      await downloadPdf(`/students/${student.id}/${kind}`, `${kind}-${student.id}.pdf`)
    } catch (err) {
      setError(err.message)
    } finally {
      setDl('')
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-navy-900">Quiz results 📝</h1>
        <p className="mt-1 text-slate-500">Every quiz your children attempt, and their certificates & ID cards.</p>
      </div>

      <ErrorBox error={error} />

      {students.length === 0 ? (
        <EmptyState
          icon="👨‍👩‍👧"
          title="No linked students yet"
          hint="Add your child using their 6-digit student ID from the My Students page."
        />
      ) : (
        <div className="space-y-8">
          {students.map((s) => (
            <div key={s.student.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                <div>
                  <p className="font-black text-navy-900">{s.student.full_name}</p>
                  <p className="text-xs text-slate-500">ID: {s.student.student_id ?? '—'} · {s.student.grade || 'No grade'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-outline !py-2 text-xs" disabled={!!dl} onClick={() => download('certificate', s.student, 'cert')}>
                    📜 Certificate PDF
                  </button>
                  <button className="btn-outline !py-2 text-xs" disabled={!!dl} onClick={() => download('id_card', s.student, 'id')}>
                    🎫 ID card PDF
                  </button>
                </div>
              </div>

              {s.attempts.length === 0 ? (
                <p className="px-6 py-6 text-sm text-slate-400">No quiz attempts yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400">
                        <th className="table-head">Quiz</th>
                        <th className="table-head">Course</th>
                        <th className="table-head">Score</th>
                        <th className="table-head">Result</th>
                        <th className="table-head">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.attempts.map((a) => (
                        <tr key={a.attempt_id} className="hover:bg-slate-50">
                          <td className="table-cell font-semibold text-navy-900">{a.quiz_title}</td>
                          <td className="table-cell text-slate-500">{a.course_title}</td>
                          <td className="table-cell">
                            <span className="font-bold text-navy-900">{Math.round(a.percent)}%</span>
                            <span className="text-xs text-slate-400"> ({a.score}/{a.max_score})</span>
                          </td>
                          <td className="table-cell">
                            <span className={`chip ${a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {a.passed ? 'Passed' : 'Retry'}
                            </span>
                          </td>
                          <td className="table-cell text-slate-500">
                            {new Date(a.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}