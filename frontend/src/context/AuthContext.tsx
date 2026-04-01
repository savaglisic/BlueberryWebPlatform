import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthUser {
  email: string
  user_group: string
}

interface AuthContextType {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('bw_user')
    // Default to admin until Zero Trust is wired up
    return stored ? JSON.parse(stored) : { email: '', user_group: 'admin' }
  })

  const setUser = (u: AuthUser | null) => {
    setUserState(u)
    if (u) localStorage.setItem('bw_user', JSON.stringify(u))
    else localStorage.removeItem('bw_user')
  }

  const logout = () => setUser(null)

  const isAdmin = user?.user_group === 'admin' || user?.email === 'savaglisic@ufl.edu'

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
