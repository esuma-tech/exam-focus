import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'

function homeFor(role) {
  return { learner: '/learn', instructor: '/instructor', admin: '/admin', parent: '/learn' }[role] || '/'
}

function NavLinks({ user, onNavigate }) {
  const link = (to, label) => (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-semibold transition ${
          isActive ? 'bg-mint-100 text-navy-900' : 'text-navy-700 hover:bg-mint-50 hover:text-navy-900'
        }`
      }
    >
      {label}
    </NavLink>
  )
  const home = homeFor(user?.role)
  return (
    <>
      {user?.role === 'learner' || user?.role === 'parent' ? (
        <>
          {link('/learn', 'Dashboard')}
          {link('/learn/courses', 'My Courses')}
          {link('/learn/live', 'Live Classes')}
        </>
      ) : user?.role === 'instructor' ? (
        <>
          {link('/instructor', 'Overview')}
          {link('/instructor/courses', 'My Courses')}
          {link('/instructor/live', 'Live Classes')}
          {link('/instructor/courses/new', 'Build Course')}
        </>
      ) : user?.role === 'admin' ? (
        <>
          {link('/admin', 'Analytics')}
          {link('/admin/users', 'Users')}
          {link('/instructor/courses', 'All Courses')}
        </>
      ) : null}
    </>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    api('/notifications/unread-count').then((d) => setUnread(d.count)).catch(() => {})
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-white text-navy-900 shadow-sm ring-1 ring-slate-200/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400 font-black text-navy-950">
              EF
            </span>
            <span className="text-lg font-black tracking-tight">
              EXAM <span className="text-gold-600">FOCUS</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLinks user={user} />
            {!user && (
              <>
                <Link to="/courses" className="rounded-lg px-3 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900">
                  Courses
                </Link>
                <Link to="/about" className="rounded-lg px-3 py-2 text-sm font-semibold text-navy-700 hover:text-navy-900">
                  About
                </Link>
              </>
            )}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <Link to="/notifications" className="relative rounded-lg p-2 text-navy-700 hover:text-navy-900">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
                      {unread}
                    </span>
                  )}
                </Link>
                <div className="w-px h-6 bg-slate-200" />
                <span className="text-sm font-semibold capitalize">{user.full_name}</span>
                <button onClick={handleLogout} className="btn !border-2 !border-gold-400 !text-navy-900 hover:!bg-gold-400 hover:!text-navy-950 !py-1.5 !px-4">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost !text-navy-700 hover:!bg-mint-100">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary !py-2">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-1">
              <NavLinks user={user} onNavigate={() => setOpen(false)} />
              {user ? (
                <button onClick={handleLogout} className="rounded-lg bg-gold-400 px-3 py-2 text-left text-sm font-bold text-navy-950">
                  Sign out
                </button>
              ) : (
                <>
                  <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-navy-700">Log in</Link>
                  <Link to="/courses" className="rounded-lg px-3 py-2 text-sm font-semibold text-navy-700">Courses</Link>
                  <Link to="/about" className="rounded-lg px-3 py-2 text-sm font-semibold text-navy-700">About</Link>
                  <Link to="/register" className="rounded-lg bg-gold-400 px-3 py-2 text-sm font-bold text-navy-950">Get Started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-navy-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400 font-black text-navy-950">EF</span>
              <span className="text-lg font-black text-white">EXAM <span className="text-gold-300">FOCUS</span></span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              Focused Preparation. Real Results. Online teaching & learning for Grade 9–12 students across Ethiopia.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/courses" className="hover:text-gold-300">All Courses</Link></li>
              <li><Link to="/about" className="hover:text-gold-300">About Us</Link></li>
              <li><Link to="/register" className="hover:text-gold-300">Become a Student</Link></li>
              <li><Link to="/register" className="hover:text-gold-300">Teach with Us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Programs</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/courses" className="hover:text-gold-300">Grade 12 Exam Prep</Link></li>
              <li><Link to="/courses" className="hover:text-gold-300">Grade 11 Courses</Link></li>
              <li><Link to="/courses" className="hover:text-gold-300">Grade 9–10 Foundation</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-white">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>Harar, Harari Region, Ethiopia</li>
              <li>Sir Haile  </li>
              <li>esuman82@gmail.com</li>
              <li>+251912755686</li>
              <li>+251948370287</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Idea owned by Sir Haile · Built & developed by Esayas Belay.
        </div>
      </footer>
    </div>
  )
}