import client from './client'

export interface OptionConfig {
  id: number
  option_type: string
  option_text: string
}

export const getOptions = () =>
  client.get('/option_config').then((r) => r.data as OptionConfig[])

export const addOption = (option_type: string, option_text: string) =>
  client.post('/option_config', { option_type, option_text }).then((r) => r.data)

export const updateOption = (id: number, option_text: string) =>
  client.put(`/option_config/${id}`, { option_text }).then((r) => r.data)

export const deleteOption = (id: number) =>
  client.delete(`/option_config/${id}`).then((r) => r.data)
