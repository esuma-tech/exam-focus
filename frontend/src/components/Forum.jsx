import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../store'

export default function Forum({ courseId }) {
  const { user } = useAuth()
  const [forum, setForum] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', body: '' })
  const [replyTo, setReplyTo] = useState(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')

  const loadPosts = (forumId) => api(`/forums/${forumId}`).then(setPosts).catch(() => {})

  useEffect(() => {
    api(`/forums?course_id=${courseId}`)
      .then((forums) => {
        if (forums.length) {
          setForum(forums[0])
          return loadPosts(forums[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseId])

  const submitPost = async (e) => {
    e.preventDefault()
    setError('')
    if (!forum) return
    try {
      await api(`/forums/${forum.id}/posts`, { method: 'POST', body: form })
      setForm({ title: '', body: '' })
      loadPosts(forum.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const submitReply = async (postId) => {
    if (!reply.trim()) return
    try {
      await api(`/forums/posts/${postId}/comments`, { method: 'POST', body: { body: reply } })
      setReply('')
      setReplyTo(null)
      loadPosts(forum.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (postId) => {
    if (!confirm('Delete this post?')) return
    await api(`/forums/posts/${postId}`, { method: 'DELETE' }).catch(() => {})
    loadPosts(forum.id)
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading discussion…</p>
  if (!forum) return <p className="p-6 text-sm text-slate-500">No discussion forum for this course yet.</p>

  return (
    <div className="space-y-6">
      <form onSubmit={submitPost} className="card p-6">
        <h3 className="font-bold text-navy-900">Start a discussion</h3>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <input
          className="input mt-4"
          placeholder="Title (optional)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="input mt-3"
          rows={3}
          required
          placeholder="Ask a question or share something useful…"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
        <div className="mt-3 flex justify-end">
          <button className="btn-primary !py-2">Post</button>
        </div>
      </form>

      {posts.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No posts yet — be the first to start a discussion.</p>
      ) : (
        posts.map((p) => (
          <div key={p.id} className={`card p-6 ${p.is_announcement ? 'border-l-4 border-gold-400' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-sm font-bold text-navy-800">
                  {p.author.full_name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-bold text-navy-900">
                    {p.author.full_name}
                    <span className="ml-2 font-normal text-slate-400 capitalize">· {p.author.role}</span>
                  </p>
                  <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {p.is_announcement && <span className="chip bg-gold-100 text-gold-700">Announcement</span>}
                {p.is_pinned && <span className="chip bg-slate-100 text-slate-600">📌 Pinned</span>}
                {(user.role === 'admin' || user.id === p.author.id) && (
                  <button onClick={() => remove(p.id)} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                )}
              </div>
            </div>
            {p.title && <h4 className="mt-4 font-bold text-navy-900">{p.title}</h4>}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{p.body}</p>

            <div className="mt-4 space-y-3 border-l-2 border-slate-100 pl-4">
              {p.comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-semibold text-navy-800">{c.author.full_name}</span>
                  <span className="ml-2 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</span>
                  <p className="text-slate-600">{c.body}</p>
                </div>
              ))}
              {replyTo === p.id ? (
                <div className="flex gap-2">
                  <input className="input !py-2" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button className="btn-navy !py-2" onClick={() => submitReply(p.id)}>Reply</button>
                </div>
              ) : (
                <button onClick={() => { setReplyTo(p.id); setReply('') }} className="text-xs font-bold text-navy-600 hover:underline">
                  Reply
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}