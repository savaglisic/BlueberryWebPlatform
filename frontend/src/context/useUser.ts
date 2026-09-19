import { useContext } from 'react'
import { UserContext } from './user'

export const useUser = () => useContext(UserContext)
