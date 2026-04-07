import { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/client'

interface UserInfo {
  email: string
  isAdmin: boolean
  loading: boolean
}

const UserContext = createContext<UserInfo>({ email: '', isAdmin: false, loading: true })

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo>({ email: '', isAdmin: false, loading: true })

  useEffect(() => {
    client.get('/me')
      .then((r) => setUser({ ...r.data, loading: false }))
      .catch(() => setUser({ email: '', isAdmin: false, loading: false }))
  }, [])

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export const useUser = () => useContext(UserContext)
