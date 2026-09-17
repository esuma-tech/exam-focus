import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { ErrorBox, Loading } from '../../components/ui'

export default function QuizTake() {
  const { courseId, quizId } = useParams()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(null)

  useEffect(() => {
    api(`/quizzes/${quizId}/take`)
      .then((q) => {
        setQuiz(q)
        setSecondsLeft(q.time_limit_min * 60)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [quizId])

  useEffect(() => {
    if (result || secondsLeft === null) return
    if (secondsLeft <= 0) {
      submit()
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, result])

  const setAnswer = (qid, value) => setAnswers((a) => ({ ...a, [qid]: value }))

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const payload = {
        answers: quiz.questions.map((q) => {
          const val = answers[q.id] ?? ''
          return q.question_type === 'multiple_choice'
            ? { question_id: q.id, answer: '', options: val ? [val] : [] }
            : { question_id: q.id, answer: String(val) }
        }),
      }
      const res = await api(`/quizzes/${quizId}/submit`, { method: 'POST', body: payload })
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />
  if (error && !quiz) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <ErrorBox error={error} />
        <Link to={`/learn/courses/${courseId}`} className="btn-outline mt-4">← Back to course</Link>
      </div>
    )
  }

  if (result) {
    const graded = result.answers || []
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className={`card overflow-hidden ${result.passed ? '' : ''}`}>
          <div className={`px-8 py-10 text-center text-white ${result.passed ? 'bg-emerald-600' : 'bg-navy-900'}`}>
            <p className="text-5xl font-black">{result.percent}%</p>
            <p className="mt-2 text-lg font-bold">{result.passed ? '🎉 Passed!' : 'Keep practicing'}</p>
            <p className="mt-1 text-sm opacity-80">
              {result.score} / {result.max_score} points · {quiz.title}
            </p>
          </div>
        </div>

        <h2 className="mt-10 mb-4 text-xl font-black text-navy-900">Answer review</h2>
        <div className="space-y-4">
          {graded.map((g, i) => (
            <div key={g.question_id} className={`card border-l-4 p-5 ${g.is_correct ? 'border-emerald-500' : 'border-red-500'}`}>
              <p className="font-semibold text-navy-900">{i + 1}. {g.prompt}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p className={g.is_correct ? 'text-emerald-700' : 'text-red-600'}>
                  <span className="font-bold">Your answer:</span> {g.submitted || '—'}
                </p>
                {!g.is_correct && (
                  <p className="text-emerald-700"><span className="font-bold">Correct:</span> {g.correct_answer}</p>
                )}
                {g.explanation && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-slate-600">{g.explanation}</p>}
              </div>
              <p className="mt-2 text-xs font-bold text-slate-400">+{g.points_earned} pts</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={`/learn/courses/${courseId}`} className="btn-navy">Back to course</Link>
          <button className="btn-outline" onClick={() => { setResult(null); setAnswers({}); setSecondsLeft(quiz.time_limit_min * 60) }}>
            Retake
          </button>
        </div>
      </div>
    )
  }

  const mm = String(Math.floor((secondsLeft || 0) / 60)).padStart(2, '0')
  const ss = String((secondsLeft || 0) % 60).padStart(2, '0')

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-900">{quiz.title}</h1>
          <p className="text-sm text-slate-500">{quiz.description}</p>
        </div>
        <div className={`rounded-xl px-4 py-2 text-center font-black ${secondsLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-navy-100 text-navy-800'}`}>
          <p className="text-xs font-bold uppercase">Time left</p>
          <p className="text-xl">{mm}:{ss}</p>
        </div>
      </div>

      <ErrorBox error={error} />

      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-5">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="card p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-navy-900">{i + 1}. {q.prompt}</p>
              <span className="chip flex-none bg-slate-100 text-slate-500">{q.points} pt</span>
            </div>

            {q.question_type === 'short_answer' ? (
              <input
                className="input mt-4"
                placeholder="Type your answer…"
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            ) : (
              <div className="mt-4 space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition ${
                      answers[q.id] === opt ? 'border-gold-400 bg-gold-50 text-navy-900' : 'border-slate-200 hover:border-navy-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswer(q.id, opt)}
                      className="h-4 w-4 accent-navy-800"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="sticky bottom-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <span className="text-sm text-slate-500">
            {Object.keys(answers).length} / {quiz.questions.length} answered
          </span>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit quiz'}
          </button>
        </div>
      </form>
    </div>
  )
}