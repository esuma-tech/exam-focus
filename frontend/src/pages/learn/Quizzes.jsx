import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, downloadPdf } from '../../api'
import { useAuth } from '../../store'
import { EmptyState, ErrorBox, Loading } from '../../components/ui'

export default function LearnerQuizzes() {
  const { user } = useAuth()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const [dlBusy, setDlBusy] = useState('')

  useEffect(() => {
    api('/quizzes/my')
      .then(setQuizzes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoBusy(true)
    setPhotoMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api('/users/me/avatar', { method: 'POST', form })
      setPhotoMsg(`Photo saved.${res.avatar ? ' Your ID card is ready to download from My ID card.' : ''}`)
    } catch (err) {
      setPhotoMsg(err.message)
    } finally {
      setPhotoBusy(false)
      e.target.value = ''
    }
  }

  const download = async (kind) => {
    setDlBusy(kind)
    setError('')
    try {
      await downloadPdf(`/students/${user.id}/${kind}`, `${kind}.pdf`)
    } catch (err) {
      setError(err.message)
    } finally {
      setDlBusy('')
    }
  }

  if (loading) return <Loading />

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-900">My quizzes 📝</h1>
          <p className="mt-1 text-slate-500">Take quizzes from your enrolled courses and track your scores.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline !py-2 text-sm" disabled={dlBusy === 'id_card'} onClick={() => download('id_card')}>
            {dlBusy === 'id_card' ? 'Generating…' : '🎫 My ID card'}
          </button>
          <button className="btn-outline !py-2 text-sm" disabled={dlBusy === 'certificate'} onClick={() => download('certificate')}>
            {dlBusy === 'certificate' ? 'Generating…' : '📜 My certificate'}
          </button>
        </div>
      </div>

      <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 !bg-mint-50 p-5">
        <div>
          <p className="font-bold text-navy-900">ID card photo</p>
          <p className="text-xs text-slate-500">Upload a clear photo so it appears on your student ID card.</p>
          {photoMsg && <p className="mt-1 text-xs font-semibold text-emerald-700">{photoMsg}</p>}
        </div>
        <label className="btn-navy cursor-pointer !py-2 text-sm">
          {photoBusy ? 'Uploading…' : '📷 Choose photo'}
          <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} disabled={photoBusy} />
        </label>
      </div>

      <ErrorBox error={error} />

      {quizzes.length === 0 ? (
        <EmptyState icon="📝" title="No quizzes yet" hint="Enroll in a course to unlock its quizzes." action={<Link to="/courses" className="btn-primary">Browse courses</Link>} />
      ) : (
        <div className="space-y-4">
          {quizzes.map((q) => (
            <div key={q.id} className="card flex flex-wrap items-center gap-4 p-5">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-navy-900">{q.title}</p>
                <p className="text-xs text-slate-500">{q.course_title} · {q.time_limit_min} min · pass {Math.round(q.pass_percent)}%</p>
                <p className="mt-1 text-xs text-slate-400">{q.attempts_taken} / {q.attempt_limit} attempts
                  {q.attempts_taken > 0 && <> · best {q.best_percent}%</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {q.attempts_taken > 0 && (
                  <span className={`chip ${q.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {q.passed ? '✅ Passed' : 'Not passed yet'}
                  </span>
                )}
                {q.can_take ? (
                  <Link to={`/learn/courses/${q.course_id}/quiz/${q.id}`} className="btn-navy">Take quiz</Link>
                ) : (
                  <span className="chip bg-slate-100 text-slate-500">🔒 Max attempts used</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}