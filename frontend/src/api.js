// The API base is the deployed backend URL when VITE_API_URL is set at build
// time (Vercel/Netlify env var). When unset it stays relative (/api/v1) so the
// Vite dev proxy forwards requests to the local backend.
const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/v1`

function getToken() {
  return localStorage.getItem('ef_token') || ''
}

export function setTokens({ access_token, refresh_token }) {
  localStorage.setItem('ef_token', access_token)
  localStorage.setItem('ef_refresh', refresh_token || '')
}

export function clearTokens() {
  localStorage.removeItem('ef_token')
  localStorage.removeItem('ef_refresh')
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  else if (form) headers['Content-Type'] = 'multipart/form-data'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ? form : body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearTokens()
    if (!location.pathname.startsWith('/login')) location.href = '/login'
    throw new Error('Session expired')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d) => d.msg).join('; ')
      : data.detail || data.message || 'Request failed'
    throw new Error(detail)
  }
  return data
}

export function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  return api('/uploads', { method: 'POST', form })
}

export const roles = {
  admin: { label: 'Administrator', color: 'bg-red-100 text-red-700' },
  instructor: { label: 'Instructor', color: 'bg-navy-100 text-navy-800' },
  learner: { label: 'Learner', color: 'bg-emerald-100 text-emerald-700' },
  parent: { label: 'Parent', color: 'bg-purple-100 text-purple-700' },
}