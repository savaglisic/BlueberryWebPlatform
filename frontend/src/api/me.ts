import client from './client'

export interface MeInfo {
  email: string
  isAdmin: boolean
}

let cached: MeInfo | null = null

export async function getMe(): Promise<MeInfo> {
  if (cached) return cached
  const { data } = await client.get<MeInfo>('/me')
  cached = data
  return data
}
