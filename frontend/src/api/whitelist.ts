import client from './client'

export const getWhitelist = () =>
  client.get('/email_whitelist').then((r) => r.data as string[])

export const addToWhitelist = (email: string) =>
  client.post('/email_whitelist', { email }).then((r) => r.data)

export const removeFromWhitelist = (email: string) =>
  client.delete(`/email_whitelist/${email}`).then((r) => r.data)
