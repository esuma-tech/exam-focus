import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store'
import { ErrorBox } from '../components/ui'

const ROLES = [
  { value: 'learner', label: 'Student', hint: 'Enroll in courses, take quizzes, track progress' },
  { value: 'instructor', label: 'Teacher', hint: 'Build courses, run live classes, grade work' },
  { value: 'parent', label: 'Parent', hint: 'Follow your child’s progress and results' },
]

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', grade: '', role: 'learner' })
  const [studentIds, setStudentIds] = useState([''])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const pickRole = (role) => {
    setForm((f) => ({ ...f, role }))
    if (role === 'parent' && studentIds.length === 0) setStudentIds([''])
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (form.role === 'parent') {
      const clean = studentIds.map((s) => s.trim()).filter(Boolean)
      if (clean.length === 0) {
        setError('Enter your child\'s 6-digit student ID. Ask them to open their dashboard to find it.')
        return
      }
      const bad = clean.filter((s) => !/^\d{6}$/.test(s))
      if (bad.length > 0) {
        setError(`"${bad.join('", "')}" is not a valid 6-digit student ID.`)
        return
      }
      form.student_ids = clean
    }
    setBusy(true)
    try {
      const data = await register(form)
      setMessage(data.message || 'Your account was created and is waiting for administrator approval.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-navy-900">Create your account</h1>
        <p className="mt-2 text-slate-500">Join EXAM FOCUS — free to start. Your account is activated once an administrator approves it.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {message ? (
          <div className="card p-8 text-center lg:col-span-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h2 className="mt-4 text-2xl font-black text-navy-900">Account submitted</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-600">{message}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              You will be able to sign in as soon as an administrator approves your account.
            </p>
            <Link to="/login" className="btn-navy mt-6 inline-block">Go to log in</Link>
          </div>
        ) : (
        <form onSubmit={submit} className="card space-y-5 p-8 lg:col-span-3">
          <ErrorBox error={error} />
          <div>
            <label className="label">I am joining as</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => pickRole(r.value)}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    form.role === r.value ? 'border-gold-400 bg-gold-50' : 'border-slate-200 hover:border-navy-300'
                  }`}
                >
                  <span className="block text-sm font-bold text-navy-900">{r.label}</span>
                  <span className="mt-1 block text-[11px] leading-tight text-slate-500">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.full_name} onChange={set('full_name')} placeholder="Abebe Kebede" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={set('phone')} placeholder="+251 9..." />
            </div>
          </div>

          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="label">Grade {form.role === 'learner' ? '' : '(optional)'}</label>
              <select className="input" value={form.grade} onChange={set('grade')}>
                <option value="">Select grade</option>
                <option>Grade 9</option>
                <option>Grade 10</option>
                <option>Grade 11</option>
                <option>Grade 12</option>
              </select>
            </div>
          </div>

          {form.role === 'parent' && (
            <div>
              <label className="label">Your child's student ID (required)</label>
              <p className="mb-2 text-xs text-slate-500">
                Each student is given a unique 6-digit ID. Ask your child to open their dashboard and you'll find it there.
              </p>
              <div className="space-y-2">
                {studentIds.map((sid, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1 !text-lg tracking-[0.35em]"
                      placeholder="123456"
                      maxLength={6}
                      value={sid}
                      onChange={(e) => setStudentIds((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                    <button
                      type="button"
                      onClick={() => setStudentIds((arr) => arr.filter((_, j) => j !== i))}
                      className="h-11 w-11 flex-none rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStudentIds((arr) => [...arr, ''])}
                className="mt-2 text-sm font-bold text-navy-700 hover:underline"
              >
                + Add another student
              </button>
            </div>
          )}

          {form.role === 'learner' && (
            <div className="rounded-xl border border-mint-200 bg-mint-50 p-4 text-sm text-navy-800">
              🎓 A unique <strong>6-digit student ID</strong> is assigned to you when your account is created. You'll see it on
              your dashboard — share it with your parent so they can follow your progress.
            </div>
          )}

          <button className="btn-primary w-full !py-3" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Already registered? <Link to="/login" className="font-bold text-navy-700 hover:underline">Log in</Link>
          </p>
        </form>
        )}

        <div className="lg:col-span-2">
          <div className="card h-full bg-navy-900 p-8 text-white">
            <h3 className="text-xl font-black">What you get</h3>
            <ul className="mt-6 space-y-4 text-sm">
              {[
                'Live teacher-led classes on weekday evenings',
                'National-exam-style quizzes with instant feedback',
                'Downloadable notes and past-paper packs',
                'Discussion forums with teachers and classmates',
                'Progress tracking for students and parents',
                'Exam-intensive bootcamps before the national exam',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold-400 text-[10px] font-black text-navy-950">✓</span>
                  <span className="text-slate-200">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}