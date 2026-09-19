import { createContext } from 'react'

export interface UserInfo {
  email: string
  isAdmin: boolean
  loading: boolean
}

export const UserContext = createContext<UserInfo>({ email: '', isAdmin: false, loading: true })
