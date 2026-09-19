import { createContext } from 'react'

export interface AuthUser {
  email: string
  user_group: string
}

export interface AuthContextType {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  logout: () => void
  isAdmin: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)
