import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { CourseCard, Loading, SubjectDot } from '../components/ui'

const FEATURES = [
  {
    icon: '🎥',
    title: 'Live Teacher-Led Classes',
    text: 'Join scheduled live sessions with subject-qualified teachers, then rewatch recordings anytime.',
  },
  {
    icon: '📝',
    title: 'National-Exam-Style Quizzes',
    text: 'Instant automated grading with detailed explanations, timed assessments and attempt tracking.',
  },
  {
    icon: '📶',
    title: 'Low-Data Friendly',
    text: 'Built for Ethiopian connectivity: text notes, downloadable PDFs and audio-first content.',
  },
  {
    icon: '📊',
    title: 'Progress You Can See',
    text: 'Dashboards for students, teachers and parents track every lesson, quiz and improvement.',
  },
  {
    icon: '💬',
    title: 'Discussion Forums',
    text: 'Ask questions, help classmates and get answers from your teachers in course forums.',
  },
  {
    icon: '🏆',
    title: 'Exam-Intensive Bootcamps',
    text: 'Past-paper drilling, mock exams and revision bootcamps before the national exam.',
  },
]

const STEPS = [
  { n: '01', title: 'Create your account', text: 'Register free as a student or apply as a teacher. An administrator approves your account before you can log in.' },
  { n: '02', title: 'Enroll in your courses', text: 'Pick your grade and subjects — Mathematics, English, Physics, Biology and more.' },
  { n: '03', title: 'Learn & get graded', text: 'Attend live classes, take quizzes, track your progress and pass your exams.' },
]

export default function Landing() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/public')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const school = data?.school
  const stats = data?.stats || { courses: 0, learners: 0, instructors: 0 }
  const featured = data?.featured_courses || []

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-mint-50 to-mint-100 text-navy-900">
        <div className="absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-gold-200/60 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-mint-200/70 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="chip bg-gold-100 text-navy-800 ring-1 ring-gold-300">
              🇪🇹 Harar, Harari Region · Launching September 2026
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Focused Preparation.
              <span className="block bg-gradient-to-r from-gold-500 to-gold-600 bg-clip-text text-transparent">
                Real Results.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              {school?.about ||
                'EXAM FOCUS gives Grade 9–12 students affordable, structured, teacher-led online classes and exam preparation — built to work even with limited data and devices.'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary !px-7 !py-3 text-base">
                Start Learning Free
              </Link>
              <Link to="/courses" className="btn-outline !px-7 !py-3 text-base">
                Browse Courses
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-mint-200 pt-8">
              {[
                { label: 'Courses', value: stats.courses },
                { label: 'Students', value: `${stats.learners}+` },
                { label: 'Teachers', value: stats.instructors },
              ].map((s) => (
                <div key={s.label}>
                  <dt className="text-sm font-medium uppercase tracking-wider text-slate-500">{s.label}</dt>
                  <dd className="mt-1 text-3xl font-black text-gold-600">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="card shadow-xl ring-1 ring-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-gold-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-xs font-semibold text-slate-500">examfocus.edu.et/dashboard</span>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">National Exam Pass Rate</p>
                    <p className="text-3xl font-black text-navy-900">8.4%</p>
                  </div>
                  <span className="chip bg-red-100 text-red-600">2024/25 Cycle</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Mathematics', pct: 92 },
                    { name: 'English & Aptitude', pct: 78 },
                    { name: 'Physics', pct: 65 },
                    { name: 'Biology', pct: 84 },
                  ].map((row) => (
                    <div key={row.name}>
                      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                        <span><SubjectDot subject={row.name.split(' ')[0]} />{row.name}</span>
                        <span>{row.pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300" style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-mint-50 p-4 text-xs text-slate-600">
                  <span className="font-bold text-mint-700">Our goal:</span> make sure our students are always in the
                  passing percentage.
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-gold-400 px-6 py-4 text-navy-950 shadow-xl sm:block">
              <p className="text-2xl font-black">+47%</p>
              <p className="text-xs font-semibold">avg. score improvement</p>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <p className="text-sm font-bold uppercase tracking-widest text-gold-500">Our Mission</p>
            <h2 className="mt-3 text-3xl font-black text-navy-900">
              Every student deserves a real chance to pass.
            </h2>
          </div>
          <div className="lg:col-span-2 space-y-5 text-lg leading-relaxed text-slate-600">
            <p>
              {school?.mission ||
                'To give Grade 9–12 students affordable, structured, teacher-led online classes and exam preparation — delivered in a way that works even with limited data and devices.'}
            </p>
            <p>
              Ethiopia's Grade 12 national exam pass rate has stayed below 10% for years. Families are already paying
              for tutoring and extra classes — we make structured, exam-focused preparation accessible, affordable and
              delivered live by qualified teachers.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-gold-500">Why EXAM FOCUS</p>
            <h2 className="mt-3 text-3xl font-black text-navy-900 sm:text-4xl">
              A complete learning ecosystem
            </h2>
            <p className="mt-4 text-slate-600">
              Three connected portals — Learner, Instructor and Admin — on one secure, cross-platform foundation.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card card-hover p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-2xl">{f.icon}</div>
                <h3 className="mt-5 text-lg font-bold text-navy-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED COURSES */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-gold-500">Featured</p>
              <h2 className="mt-3 text-3xl font-black text-navy-900">Popular courses</h2>
            </div>
            <Link to="/courses" className="btn-outline">View all courses →</Link>
          </div>
          <div className="mt-10">
            {loading ? (
              <Loading />
            ) : featured.length === 0 ? (
              <p className="text-slate-500">Courses are being prepared. Please check back soon.</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative overflow-hidden bg-white py-20 text-navy-900">
        <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-gold-200/60 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-gold-600">How it works</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Start in three simple steps</h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-mint-100 bg-mint-50 p-8">
                <span className="text-4xl font-black text-gold-500/50">{s.n}</span>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-gold-400 to-gold-500 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left">
          <div>
            <h2 className="text-3xl font-black text-navy-950">Ready to pass your national exam?</h2>
            <p className="mt-2 font-medium text-navy-900/80">
              Join EXAM FOCUS today — focused preparation, real results.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-navy !px-7 !py-3 text-base">Create free account</Link>
            <Link to="/courses" className="btn !bg-white !text-navy-900 hover:!bg-slate-100 !px-7 !py-3 text-base">
              Explore courses
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}