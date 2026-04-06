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
  demographic_key: string | null
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
