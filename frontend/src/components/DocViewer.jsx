import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

function drawWatermark(ctx, width, height, text) {
  if (!text) return
  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.fillStyle = '#1e3a8a'
  ctx.font = `bold ${Math.max(20, Math.round(width / 14))}px system-ui, sans-serif`
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 7)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

export default function DocViewer({ url, watermark = '', title = 'Document' }) {
  const canvasRef = useRef(null)
  const [doc, setDoc] = useState(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setPage(1)
    setPages(0)
    setError('')
    setBusy(true)
    pdfjsLib
      .getDocument({ url, isEvalSupported: false })
      .promise.then((d) => {
        if (cancelled) {
          d.destroy()
          return
        }
        setDoc(d)
        setPages(d.numPages)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Failed to open document')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
      doc?.destroy()
    }
  }, [url])

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    let cancelled = false
    setBusy(true)
    ;(async () => {
      try {
        const pdfPage = await doc.getPage(page)
        const viewport = pdfPage.getViewport({ scale })
        const canvas = canvasRef.current
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        const ctx = canvas.getContext('2d')
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        const task = pdfPage.render({ canvasContext: ctx, viewport })
        await task.promise
        if (!cancelled) drawWatermark(ctx, viewport.width, viewport.height, watermark)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to render page')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doc, page, scale])

  // Block the obvious "save this content" paths while the viewer is open.
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key?.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(k)) e.preventDefault()
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
  }, [])

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 select-none" onContextMenu={(e) => e.preventDefault()}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-bold text-navy-900">📄 {title} · restricted</span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            className="h-7 w-7 rounded-lg border border-slate-200 font-black text-slate-600 hover:bg-slate-50"
            onClick={() => setScale((s) => Math.max(0.6, +(s - 0.15).toFixed(2)))}
            title="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center font-semibold text-slate-500">{Math.round(scale * 100)}%</span>
          <button
            className="h-7 w-7 rounded-lg border border-slate-200 font-black text-slate-600 hover:bg-slate-50"
            onClick={() => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)))}
            title="Zoom in"
          >
            +
          </button>
          <span className="mx-1 text-slate-300">|</span>
          <button className="h-7 px-2.5 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span className="px-1 font-semibold text-slate-600">Page {page} of {pages}</span>
          <button className="h-7 px-2.5 rounded-lg border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
            Next →
          </button>
        </div>
      </div>
      <div className="overflow-auto p-3">
        {error ? (
          <p className="p-6 text-center text-sm text-red-600">{error}</p>
        ) : (
          <div className="relative mx-auto w-fit bg-white shadow ring-1 ring-black/5" style={{ touchAction: 'pan-x pan-y' }}>
            <canvas ref={canvasRef} className="block" />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70 text-sm font-semibold text-slate-500">Loading…</div>
            )}
          </div>
        )}
      </div>
      <p className="border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-400">
        🔒 Content is protected — downloading and screenshots are disabled.
      </p>
    </div>
  )
}