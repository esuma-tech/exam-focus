import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearTokens, setTokens } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ef_token')
    if (!token) {
      setLoading(false)
      return
    }
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => clearTokens())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    setTokens(data)
    setUser(data.user)
    return data.user
  }

  const register = async (payload) => {
    const data = await api('/auth/register', { method: 'POST', body: payload })
    return data
  }

  const logout = () => {
    clearTokens()
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}