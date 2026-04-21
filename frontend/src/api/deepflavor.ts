import client from './client'
import type { SensoryQuestion } from './sensory'

export interface PanelistRecord {
  id: number
  panelist_id: string
  session_date: string
  demographics_complete: boolean
  started_at: string | null
}

export interface SessionData {
  panelist: PanelistRecord
  samples_per_panelist: number
  all_samples: string[]
  completed_samples: string[]
  demographic_questions: SensoryQuestion[]
  live_questions: SensoryQuestion[]
}

export interface ResponsePayload {
  question_id: number | null
  question_type: string
  attribute: string | null
  wording: string | null
  response: string
}

export const startSession = (panelist_id: string) =>
  client.post('/deepflavor/session/start', { panelist_id }).then<SessionData>((r) => r.data)

export const submitDemographics = (panelist_id: string, responses: ResponsePayload[]) =>
  client.post('/deepflavor/demographics', { panelist_id, responses }).then((r) => r.data)

export const submitSampleResponse = (
  panelist_id: string,
  sample_number: string,
  responses: ResponsePayload[],
) =>
  client
    .post('/deepflavor/sample_response', { panelist_id, sample_number, responses })
    .then((r) => r.data)

export const uploadVideo = (
  blob: Blob,
  panelist_id: string,
  sample_number: string,
  attribute: string,
  question_id: number,
): Promise<void> => {
  const date = new Date()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  const form = new FormData()
  form.append('file', blob, 'video.webm')
  form.append('panelist_id', panelist_id)
  form.append('sample_number', sample_number)
  form.append('attribute', attribute)
  form.append('date', `${mm}${dd}${yyyy}`)
  form.append('question_id', String(question_id))
  return client.post('/deepflavor/upload_video', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(() => undefined)
}
