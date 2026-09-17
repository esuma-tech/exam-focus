import { Link } from 'react-router-dom'

const VALUES = [
  {
    icon: '🎯',
    title: 'Exam-Focused',
    text: 'Every lesson, quiz and live class is built around the national exam.',
  },
  {
    icon: '🤝',
    title: 'Teacher-Led',
    text: 'Real, qualified teachers guide students live — never just recorded videos.',
  },
  {
    icon: '📶',
    title: 'Built for Ethiopia',
    text: 'Low-data friendly, downloadable notes and audio-first learning.',
  },
  {
    icon: '📊',
    title: 'Measurable Progress',
    text: 'Students, teachers and parents see results in real time.',
  },
]

export default function About() {
  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-mint-50 to-mint-100 text-navy-900">
        <div className="absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold-200/60 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-mint-200/70 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <p className="text-sm font-bold uppercase tracking-widest text-gold-600">About EXAM FOCUS</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            A platform built by a developer, led by a decorated teacher, for every Ethiopian student.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            EXAM FOCUS is an online teaching and learning platform serving Grade 9–12 students. It brings structured
            classes, live sessions and exam preparation into one place — affordable, accessible, and built to work
            even with limited data and devices.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-gold-600">The People</p>
            <h2 className="mt-3 text-3xl font-black text-navy-900 sm:text-4xl">Two people, one mission</h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-2">
            <div className="card card-hover p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-800 text-2xl">👨‍💻</div>
              <h3 className="mt-6 text-2xl font-black text-navy-900">Esayas Belay</h3>
              <p className="mt-1 text-sm font-bold uppercase tracking-wider text-gold-600">Developer & Owner of the Idea</p>
              <p className="mt-4 leading-relaxed text-slate-600">
                Esayas is the developer and owner of the EXAM FOCUS idea. He designed, built and continues to run the
                entire platform — the learning app, dashboards, live classes and the technology that keeps everything
                fast, secure and affordable for students across Ethiopia.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li>• Creator and technical lead of EXAM FOCUS</li>
                <li>• Built the full platform from the ground up</li>
                <li>• Always improving it with the students' interests first</li>
              </ul>
            </div>

            <div className="card card-hover p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-400 text-2xl">👨‍🏫</div>
              <h3 className="mt-6 text-2xl font-black text-navy-900">Mr. Haile</h3>
              <p className="mt-1 text-sm font-bold uppercase tracking-wider text-gold-600">Decorated Teacher & Academic Lead</p>
              <p className="mt-4 leading-relaxed text-slate-600">
                Mr. Haile is a decorated and experienced teacher who leads the academic side of EXAM FOCUS. He shapes
                the curriculum, sets the exam-style questions and teaches students directly — bringing years of
                classroom experience to every lesson.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                <li>• Decorated teacher behind the curriculum</li>
                <li>• Leads live classes and exam preparation</li>
                <li>• Prepares students for their national exams</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mint-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-gold-600">What we stand for</p>
            <h2 className="mt-3 text-3xl font-black text-navy-900">Built on real results</h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="card card-hover p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-100 text-xl">{v.icon}</div>
                <h3 className="mt-4 text-lg font-bold text-navy-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-gold-400 to-gold-500 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left">
          <div>
            <h2 className="text-3xl font-black text-navy-950">Ready to learn with us?</h2>
            <p className="mt-2 font-medium text-navy-900/80">Join EXAM FOCUS today — focused preparation, real results.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-navy !px-7 !py-3 text-base">Create free account</Link>
            <Link to="/courses" className="btn !bg-white !text-navy-900 hover:!bg-slate-100 !px-7 !py-3 text-base">Explore courses</Link>
          </div>
        </div>
      </section>
    </div>
  )
}