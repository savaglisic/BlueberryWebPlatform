export interface Env {
  DB: D1Database
  VIDEOS: R2Bucket
  ASSETS: Fetcher
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  TRUST_ACCESS_EMAIL_HEADER?: string
  DEV_USER_EMAIL?: string
}

export type JsonRecord = Record<string, unknown>
