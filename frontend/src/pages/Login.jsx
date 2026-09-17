import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store'
import { ErrorBox } from '../components/ui'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(params.get('expired') ? 'Your session expired. Please log in again.' : '')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate({ learner: '/learn', parent: '/learn', instructor: '/instructor', admin: '/admin' }[user.role] || '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-navy-900">Welcome back</h1>
          <p className="mt-2 text-slate-500">Log in to continue learning.</p>
        </div>
        <form onSubmit={submit} className="card space-y-5 p-8">
          <ErrorBox error={error} />
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn-navy w-full !py-3" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-slate-500">
            No account? <Link to="/register" className="font-bold text-navy-700 hover:underline">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  )
}