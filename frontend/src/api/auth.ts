import client from './client'

export const login = (email: string, password: string) =>
  client.post('/login', { email, password }).then((r) => r.data)

export const updateUser = (email: string, user_name: string, password: string) =>
  client.put('/update_user', { email, user_name, password }).then((r) => r.data)

export const getUserGroup = (email: string) =>
  client.get('/get_user_group', { params: { email } }).then((r) => r.data)
