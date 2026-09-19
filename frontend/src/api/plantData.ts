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
  firm_category?: number
  size_category?: number
  notes?: string
  timestamp?: string
  fruitfirm_timestamp?: string
  updated_at?: string
  week?: number
}

export interface Filter {
  field: string
  operator: 'includes' | 'excludes'
  value: string
}

export const addPlantData = (data: { barcode: string; [key: string]: unknown }) =>
  client.post('/add_plant_data', data).then((r) => r.data)

export const checkBarcode = (barcode: string) =>
  client.post('/check_barcode', { barcode }).then((r) => r.data)

export const deletePlantData = (barcode: string) =>
  client.delete('/delete_plant_data', { data: { barcode } }).then((r) => r.data)

export const getPlantData = (
  page: number,
  per_page: number,
  filters: Filter[],
  yearPrefix?: string,
  dateFilter?: { field: 'timestamp' | 'updated_at'; date: string },
) =>
  client
    .get('/get_plant_data', {
      params: {
        page,
        per_page,
        filters: filters.length ? JSON.stringify(filters) : undefined,
        year_prefix: yearPrefix,
        date_filter_field: dateFilter?.field,
        date_filter_date: dateFilter?.date,
      },
    })
    .then((r) => r.data)

export const pivotFruitQuality = (page: number, pageSize: number, search: string) =>
  client.get('/pivot_fruit_quality', { params: { page, pageSize, search } }).then((r) => r.data)

const csvColumns: (keyof PlantRecord)[] = [
  'id', 'barcode', 'genotype', 'stage', 'site', 'block', 'project', 'post_harvest',
  'bush_plant_number', 'notes', 'mass', 'x_berry_mass', 'number_of_berries', 'ph',
  'brix', 'juicemass', 'tta', 'mladded', 'avg_firmness', 'avg_diameter',
  'sd_firmness', 'sd_diameter', 'box', 'firm_category', 'size_category', 'timestamp',
  'fruitfirm_timestamp', 'updated_at', 'week',
]

const csvCell = (value: unknown) => {
  if (value == null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// Assemble large exports in the browser. This keeps each Worker invocation
// comfortably below free-tier CPU/response limits.
export const downloadPlantDataCsv = async (yearPrefix?: string): Promise<Blob> => {
  const records: PlantRecord[] = []
  let afterId: number | undefined
  for (;;) {
    const result = await client
      .get<{ data: PlantRecord[]; next_cursor: number; done: boolean }>('/export_plant_data_page', {
        params: { after_id: afterId, limit: 250, year_prefix: yearPrefix },
      })
      .then((response) => response.data)
    records.push(...result.data)
    if (result.done) break
    afterId = result.next_cursor
  }
  const lines = [
    csvColumns.join(','),
    ...records.map((record) => csvColumns.map((column) => csvCell(record[column])).join(',')),
  ]
  return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
}

export const downloadYield = () =>
  client.get('/download_yield', { responseType: 'blob' }).then((r) => r.data)

export const bulkCheck = (barcodes: string[]): Promise<Record<string, PlantRecord>> =>
  client.post('/bulk_check', { barcodes }).then((r) => r.data)

export const bulkUpload = async (records: (Partial<PlantRecord> & { barcode: string })[]) => {
  const results: { barcode: string; action: string }[] = []
  for (let offset = 0; offset < records.length; offset += 20) {
    const response = await client.post('/bulk_upload', { records: records.slice(offset, offset + 20) })
    results.push(...response.data.results)
  }
  return { status: 'ok', results }
}
