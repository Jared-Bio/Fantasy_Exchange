import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('fe_auth_user')
    if (raw) {
      try { setUser(JSON.parse(raw)) } catch {}
    }
  }, [])

  useEffect(() => {
    if (user) localStorage.setItem('fe_auth_user', JSON.stringify(user))
    else localStorage.removeItem('fe_auth_user')
  }, [user])

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    login: async (username, password) => {
      // Simple client-side check for MVP
      if (!username || !password) throw new Error('Username and password required')
      setUser(prev => ({ ...(prev || {}), username, leagueId: prev?.leagueId || '', myRosterId: prev?.myRosterId || null }))
    },
    saveLeagueId: (leagueId) => setUser(prev => ({ ...(prev || {}), leagueId: (leagueId || '').trim() })),
    saveMyRosterId: (rosterId) => setUser(prev => ({ ...(prev || {}), myRosterId: rosterId })),
    logout: () => setUser(null)
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }


