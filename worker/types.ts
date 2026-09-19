export interface Env {
  DB: D1Database
  VIDEOS: R2Bucket
  ASSETS: Fetcher
  DEV_USER_EMAIL?: string
}

export type JsonRecord = Record<string, unknown>
