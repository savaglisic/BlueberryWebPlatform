import client from './client'

export type QuestionType = 'rating_9' | 'slider_100' | 'text' | 'multiple_choice' | 'instruction' | 'demographic'

export interface SensoryPanel {
  id: number
  name: string
  panel_date: string | null
  samples_per_panelist: number
  created_at: string
  samples: SensoryPanelSample[]
  questions: SensoryPanelQuestion[]
}

export interface SensoryPanelSample {
  id: number
  panel_id: number
  sample_number: string
  true_identifier: string | null
}

export interface SensoryPanelQuestion {
  id: number
  panel_id: number
  order_index: number
  question_type: QuestionType
  attribute: string | null
  wording: string | null
  options: string[]
  capture_video: boolean
  demographic_key: string | null
  enabled: boolean
}

export interface DemographicQuestionDef {
  key: string
  wording: string
  type: string
  options: string[]
}

export const listPanels = () =>
  client.get('/sensory_panels').then<SensoryPanel[]>((r) => r.data)

export const createPanel = (data: { name: string; panel_date?: string | null; samples_per_panelist: number }) =>
  client.post('/sensory_panels', data).then<SensoryPanel>((r) => r.data)

export const getPanel = (id: number) =>
  client.get(`/sensory_panels/${id}`).then<SensoryPanel>((r) => r.data)

export const updatePanel = (id: number, data: Partial<Pick<SensoryPanel, 'name' | 'panel_date' | 'samples_per_panelist'>>) =>
  client.put(`/sensory_panels/${id}`, data).then<SensoryPanel>((r) => r.data)

export const deletePanel = (id: number) =>
  client.delete(`/sensory_panels/${id}`).then((r) => r.data)

export const replaceSamples = (panelId: number, samples: { sample_number: string; true_identifier?: string }[]) =>
  client.put(`/sensory_panels/${panelId}/samples`, samples).then((r) => r.data)

export const addQuestion = (panelId: number, data: Partial<SensoryPanelQuestion>) =>
  client.post(`/sensory_panels/${panelId}/questions`, data).then<SensoryPanelQuestion>((r) => r.data)

export const updateQuestion = (questionId: number, data: Partial<SensoryPanelQuestion>) =>
  client.put(`/sensory_panels/questions/${questionId}`, data).then<SensoryPanelQuestion>((r) => r.data)

export const deleteQuestion = (questionId: number) =>
  client.delete(`/sensory_panels/questions/${questionId}`).then((r) => r.data)

export const reorderQuestions = (panelId: number, order: { id: number; order_index: number }[]) =>
  client.put(`/sensory_panels/${panelId}/questions/reorder`, order).then((r) => r.data)

export const getDemographicQuestions = () =>
  client.get('/sensory_demographic_questions').then<DemographicQuestionDef[]>((r) => r.data)
