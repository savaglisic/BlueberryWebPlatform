import client from './client'

export type QuestionType = 'rating_9' | 'slider_100' | 'text' | 'multiple_choice' | 'select_all' | 'instruction' | 'demographic'

export interface SensoryQuestion {
  id: number
  order_index: number
  question_type: QuestionType
  attribute: string | null
  wording: string | null
  options: string[]
  capture_video: boolean
  demographic_key: string | null
  enabled: boolean
}

export interface SensoryResult {
  id: number
  session_date: string | null
  panelist_id: string
  sample_number: string | null
  question_id: number | null
  question_type: string | null
  attribute: string | null
  wording: string | null
  response: string | null
  recorded_at: string
}

export interface SensorySample {
  id: number
  order_index: number
  sample_number: string
  real_identifier: string | null
}

export interface SensorySetup {
  id: number
  samples_per_panelist: number
  samples: SensorySample[]
}

export const listQuestions = () =>
  client.get('/sensory_questions').then<SensoryQuestion[]>((r) => r.data)

export const getSensorySetup = () =>
  client.get('/sensory_setup').then<SensorySetup>((r) => r.data)

export const updateSensorySetup = (data: Partial<SensorySetup>) =>
  client.put('/sensory_setup', data).then<SensorySetup>((r) => r.data)

export const addQuestion = (data: Partial<SensoryQuestion>) =>
  client.post('/sensory_questions', data).then<SensoryQuestion>((r) => r.data)

export const updateQuestion = (id: number, data: Partial<SensoryQuestion>) =>
  client.put(`/sensory_questions/${id}`, data).then<SensoryQuestion>((r) => r.data)

export const deleteQuestion = (id: number) =>
  client.delete(`/sensory_questions/${id}`).then((r) => r.data)

export const reorderQuestions = (order: { id: number; order_index: number }[]) =>
  client.put('/sensory_questions/reorder', order).then((r) => r.data)

export interface SensoryResultsPage {
  results: SensoryResult[]
  total: number
  page: number
  per_page: number
}

export const getSensoryResultDates = () =>
  client.get('/sensory_result_dates').then<string[]>((r) => r.data)

export const getSensoryResults = (date: string, page: number, perPage = 50) =>
  client
    .get('/sensory_results', { params: { date, page, per_page: perPage } })
    .then<SensoryResultsPage>((r) => r.data)

export interface SensoryQuestionSetSummary {
  id: number
  name: string
  question_count: number
  created_at: string
}

export const listQuestionSets = () =>
  client.get('/sensory_question_sets').then<SensoryQuestionSetSummary[]>((r) => r.data)

export const createQuestionSet = (name: string) =>
  client.post('/sensory_question_sets', { name }).then<SensoryQuestionSetSummary>((r) => r.data)

export const deleteQuestionSet = (id: number) =>
  client.delete(`/sensory_question_sets/${id}`).then((r) => r.data)

export const loadQuestionSet = (id: number) =>
  client.post(`/sensory_question_sets/${id}/load`).then<SensoryQuestion[]>((r) => r.data)
