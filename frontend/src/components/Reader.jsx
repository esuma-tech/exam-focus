import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store'

const THEMES = {
  light: { bg: 'bg-white', text: 'text-slate-700', title: 'text-navy-900', chip: 'bg-white', border: 'border-slate-200' },
  sepia: { bg: 'bg-[#f8f0e3]', text: 'text-[#4a3b2a]', title: 'text-[#2f2417]', chip: 'bg-[#fbf5ea]', border: 'border-[#e4d7c0]' },
  dark: { bg: 'bg-navy-950', text: 'text-slate-300', title: 'text-white', chip: 'bg-navy-900', border: 'border-navy-800' },
}

function blockKeys() {
  const onKey = (e) => {
    const k = e.key?.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(k)) e.preventDefault()
  }
  const onCtx = (e) => e.preventDefault()
  window.addEventListener('keydown', onKey)
  window.addEventListener('contextmenu', onCtx)
  return () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('contextmenu', onCtx)
  }
}

function watermarkBg(name) {
  const label = (name || '').split('@')[0] || 'Exam Focus'
  const parts = []
  for (let i = 0; i < 3; i++) parts.push(i === 0 ? label : name || '')
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300'>` +
    parts
      .map(
        (p, i) =>
          `<text x='210' y='${105 + i * 90}' fill='#1e3a8a' fill-opacity='0.07' font-size='22' font-weight='700' ` +
          `text-anchor='middle' font-family='system-ui, sans-serif' transform='rotate(-24 210 ${105 + i * 90})'>${p}</text>`
      )
      .join('')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function stripHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.textContent || '').trim()
}

function readingTime(words) {
  if (!words) return 0
  return Math.max(1, Math.ceil(words / 200))
}

export default function Reader({ lesson, completed, onComplete, onNext }) {
  const [size, setSize] = useState(18)
  const [theme, setTheme] = useState('light')
  const { user } = useAuth()

  const t = THEMES[theme]
  useEffect(() => blockKeys(), [])
  const words = useMemo(() => stripHtml(lesson.content).split(/\s+/).filter(Boolean).length, [lesson.content])
  const mins = readingTime(words)
  const watermark = user?.full_name ? watermarkBg(`${user.full_name} · ${user.email || ''}`) : null

  const btn = (active, on, labelLight, labelDark) => (
    <button
      onClick={on}
      className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
        active ? 'border-gold-400 bg-gold-400 text-navy-950' : 'border-slate-200 text-slate-500 hover:border-navy-300 hover:text-navy-900'
      }`}
    >
      {labelLight} {labelDark}
    </button>
  )

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="text-xs font-semibold text-slate-500">
          Reading mode · <span className="capitalize">{theme}</span> theme · ~{mins} min read · {words} words
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setSize((s) => Math.max(14, s - 1))} className="h-8 w-8 rounded-lg border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50" title="Smaller text">A−</button>
            <span className="w-7 text-center text-xs font-bold text-slate-500">{size}px</span>
            <button onClick={() => setSize((s) => Math.min(26, s + 1))} className="h-8 w-8 rounded-lg border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50" title="Larger text">A+</button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setTheme('light')} className={`h-8 w-8 rounded-lg border text-sm ${theme === 'light' ? 'border-gold-400 bg-gold-100' : 'border-slate-200'}`} title="Light theme">☀️</button>
            <button onClick={() => setTheme('sepia')} className={`h-8 w-8 rounded-lg border text-sm ${theme === 'sepia' ? 'border-gold-400 bg-gold-100' : 'border-slate-200'}`} title="Sepia theme">📖</button>
            <button onClick={() => setTheme('dark')} className={`h-8 w-8 rounded-lg border text-sm bg-navy-950 ${theme === 'dark' ? 'border-gold-400' : 'border-slate-200'}`} title="Dark theme">🌙</button>
          </div>
        </div>
      </div>

      <div className={`${t.bg} ${t.text} select-none px-6 py-8 sm:px-10 sm:py-10`} onContextMenu={(e) => e.preventDefault()} style={{ backgroundImage: watermark, backgroundRepeat: 'repeat' }}>
        <h2 className={`text-3xl font-black ${t.title}`}>{lesson.title}</h2>
        <p className="mt-1 text-sm font-medium text-slate-400">{lesson.duration_min ? `${lesson.duration_min} min class` : 'Lesson'}</p>
        <hr className={`my-6 ${theme === 'dark' ? 'border-navy-800' : 'border-slate-200'}`} />
        <div
          className={`leading-relaxed ${theme === 'dark' ? 'prose-invert prose-slate' : 'prose-slate'} prose max-w-none [&_a]:pointer-events-none [&_a]:no-underline`}
          style={{ fontSize: `${size}px`, lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: lesson.content }}
        />
        <p className="mt-6 text-[11px] font-medium text-slate-400">🔒 Reading protected · downloads disabled</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
        {completed.has(lesson.id) ? (
          <span className="chip bg-emerald-100 text-emerald-700">✓ Completed</span>
        ) : (
          <button className="btn-navy" onClick={onComplete}>Mark as complete</button>
        )}
        <button className="btn-primary" onClick={onNext}>Next lesson →</button>
      </div>
    </article>
  )
}