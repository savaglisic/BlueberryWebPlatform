import { useEffect, useState } from 'react'
import client from '../api/client'
import { UserContext, type UserInfo } from './user'

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo>({ email: '', isAdmin: false, loading: true })

  useEffect(() => {
    client.get('/me')
      .then((r) => setUser({ ...r.data, loading: false }))
      .catch(() => setUser({ email: '', isAdmin: false, loading: false }))
  }, [])

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}
