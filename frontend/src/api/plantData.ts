import client from './client'

export interface PlantRecord {
  id: number
  barcode: string
  genotype?: string
  stage?: string
  site?: string
  block?: string
  project?: string
  post_harvest?: string
  bush_plant_number?: string
  mass?: number
  number_of_berries?: number
  x_berry_mass?: number
  box?: number
  ph?: number
  brix?: number
  juicemass?: number
  tta?: number
  mladded?: number
  avg_firmness?: number
  avg_diameter?: number
  sd_firmness?: number
  sd_diameter?: number
  notes?: string
  timestamp?: string
  fruitfirm_timestamp?: string
  week?: number
}

export interface Filter {
  field: string
  operator: 'includes' | 'excludes'
  value: string
}

export const addPlantData = (data: Partial<PlantRecord> & { barcode: string }) =>
  client.post('/add_plant_data', data).then((r) => r.data)

export const checkBarcode = (barcode: string) =>
  client.post('/check_barcode', { barcode }).then((r) => r.data)

export const deletePlantData = (barcode: string) =>
  client.delete('/delete_plant_data', { data: { barcode } }).then((r) => r.data)

export const getPlantData = (page: number, per_page: number, filters: Filter[]) =>
  client
    .get('/get_plant_data', {
      params: { page, per_page, filters: filters.length ? JSON.stringify(filters) : undefined },
    })
    .then((r) => r.data)

export const pivotFruitQuality = (page: number, pageSize: number, search: string) =>
  client.get('/pivot_fruit_quality', { params: { page, pageSize, search } }).then((r) => r.data)

export const downloadPlantDataCsv = () =>
  client.get('/download_plant_data_csv', { responseType: 'blob' }).then((r) => r.data)

export const downloadYield = () =>
  client.get('/download_yield', { responseType: 'blob' }).then((r) => r.data)
