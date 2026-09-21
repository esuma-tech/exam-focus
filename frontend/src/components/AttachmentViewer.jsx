import { useEffect, useMemo, useState } from 'react'
import * as mammoth from 'mammoth'
import DocViewer from './DocViewer'

function fileKind(url) {
  const name = (url || '').split(/[?#]/)[0].toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx') || name.endsWith('.doc')) return 'word'
  if (name.endsWith('.txt')) return 'text'
  return 'unsupported'
}

function blockKeys() {
  const onKey = (e) => {
    const k = e.key?.toLowerCase()
    // Ctrl/Cmd+P (print), S (save), U (view source), C/X (copy) are blocked
    // while a protected document is open.
    if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u', 'c', 'x'].includes(k)) e.preventDefault()
  }
  const onCtx = (e) => e.preventDefault()
  const onDrop = (e) => e.preventDefault()
  window.addEventListener('keydown', onKey)
  window.addEventListener('contextmenu', onCtx)
  window.addEventListener('dragover', onDrop)
  window.addEventListener('drop', onDrop)
  return () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('contextmenu', onCtx)
    window.removeEventListener('dragover', onDrop)
    window.removeEventListener('drop', onDrop)
  }
}

function WordViewer({ url, title, watermark }) {
  const [html, setHtml] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setHtml('')
    setError('')
    setBusy(true)
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Could not load the document')
        const buffer = await res.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
        if (!cancelled) setHtml(result.value || '')
      } catch (e) {
        if (!cancelled) setError(e?.message || 'This Word document could not be opened')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  useEffect(() => blockKeys(), [])

  const watermarkBg = useMemo(() => {
    if (!watermark) return ''
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='260'>` +
      `<text x='170' y='130' fill='#1e3a8a' fill-opacity='0.10' font-size='19' font-weight='700' ` +
      `text-anchor='middle' font-family='system-ui, sans-serif' transform='rotate(-22 170 130)'>${watermark}</text></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }, [watermark])

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{`@media print { .ef-no-print { display: none !important; } }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-bold text-navy-900">📄 {title} · restricted</span>
        <span className="text-xs font-semibold text-slate-400">Word document</span>
      </div>
      <div className="ef-no-print relative max-h-[70vh] overflow-auto p-3">
        {busy ? (
          <p className="p-8 text-center text-sm font-semibold text-slate-500">Loading document…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-600">{error}</p>
        ) : (
          <div className="mx-auto w-fit max-w-full bg-white shadow ring-1 ring-black/5" style={{ backgroundImage: watermarkBg, backgroundRepeat: 'repeat' }}>
            <div
              className="ef-word-doc px-8 py-6 text-slate-700 [&_a]:pointer-events-none [&_a]:no-underline sm:px-12"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
      <p className="ef-no-print border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-400">
        🔒 Content is protected — downloading and screenshots are disabled.
      </p>
    </div>
  )
}

function UnsupportedView({ title }) {
  useEffect(() => blockKeys(), [])
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-bold text-navy-900">📄 {title} · restricted</span>
      </div>
      <p className="p-8 text-center text-sm text-slate-500">
        This file type cannot be previewed on the platform. It stays visible to enrolled students only.
      </p>
      <p className="border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-400">
        🔒 Content is protected and is not available for download.
      </p>
    </div>
  )
}

export default function AttachmentViewer({ url, title, watermark }) {
  const kind = fileKind(url)
  if (kind === 'pdf') return <DocViewer url={url} title={title} watermark={watermark} />
  if (kind === 'word') return <WordViewer url={url} title={title} watermark={watermark} />
  return <UnsupportedView title={title} />
}