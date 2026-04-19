import axios from 'axios'

const client = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } })

export type OverviewStats = {
  barcodes_created: number
  data_collected: number
  ph_collected: number
  fruitfirm_collected: number
}

export type ProjectRow = {
  project: string
  barcodes_created: number
  ph: number
  mass: number
  brix: number
  tta: number
  fruitfirm: number
}

export const getMostRecentDate = (): Promise<{ date: string | null }> =>
  client.get('/overview/most_recent_date').then((r) => r.data)

export const getOverviewStats = (params: { start?: string; end?: string }): Promise<OverviewStats> =>
  client.get('/overview/stats', { params }).then((r) => r.data)

export const getOverviewProjects = (params: { start?: string; end?: string }): Promise<ProjectRow[]> =>
  client.get('/overview/projects', { params }).then((r) => r.data)
