import client from './client'

export type TissueInputType = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'genotype'

export interface TissueQuestion {
  id: number
  field_key: string
  label: string
  help_text: string | null
  input_type: TissueInputType
  required: boolean
  enabled: boolean
  order_index: number
  min_value: number | null
  max_value: number | null
  placeholder: string | null
}

export interface TissueRecord {
  id: number
  barcode: string
  combined_name: string | null
  answers: Record<string, unknown>
  created_at: string
  updated_at: string
  status: 'incomplete' | 'complete'
  current_step: number
  history?: TissueHistoryEvent[]
}

export interface TissueHistoryEvent {
  id: number
  barcode: string
  action: 'created' | 'updated'
  changed_fields: string[]
  answers: Record<string, unknown>
  combined_name: string | null
  user_email: string | null
  recorded_at: string
}

export const getTissueQuestions = () =>
  client.get<TissueQuestion[]>('/tissue/questions').then((r) => r.data)

export const getAdminTissueQuestions = () =>
  client.get<TissueQuestion[]>('/tissue/admin/questions').then((r) => r.data)

export const getTissueRecord = (barcode: string) =>
  client.get<TissueRecord>(`/tissue/records/${encodeURIComponent(barcode)}`).then((r) => r.data)

export const saveTissueRecord = (barcode: string, answers: Record<string, unknown>) =>
  client.post<TissueRecord>('/tissue/records', { barcode, answers }).then((r) => r.data)

export const saveTissueDraft = (barcode: string, answers: Record<string, unknown>, current_step: number) =>
  client.put(`/tissue/records/${encodeURIComponent(barcode)}/draft`, { answers, current_step }).then((r) => r.data)

export const getTissueRecentValues = () =>
  client.get<Record<string, unknown[]>>('/tissue/recent-values').then((r) => r.data)

export const getTissueRecords = (page: number, perPage: number, search: string) =>
  client.get<{ data: TissueRecord[]; total: number; page: number; per_page: number }>('/tissue/admin/records', {
    params: { page, per_page: perPage, search: search || undefined },
  }).then((r) => r.data)

export const createTissueQuestion = (question: Partial<TissueQuestion>) =>
  client.post<TissueQuestion>('/tissue/admin/questions', question).then((r) => r.data)

export const updateTissueQuestion = (id: number, question: Partial<TissueQuestion>) =>
  client.put<TissueQuestion>(`/tissue/admin/questions/${id}`, question).then((r) => r.data)

export const deleteTissueQuestion = (id: number) =>
  client.delete(`/tissue/admin/questions/${id}`).then((r) => r.data)

export const deleteTissueRecord = (barcode: string) =>
  client.delete(`/tissue/admin/records/${encodeURIComponent(barcode)}`).then((r) => r.data)

export const downloadTissueCsv = () =>
  client.get('/tissue/admin/export', { responseType: 'blob' }).then((r) => r.data as Blob)
