import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Paper,
  Badge,
  Table,
  Select,
  Progress,
  Modal,
  ScrollArea,
  Alert,
  Divider,
  Box,
  Tooltip,
  ThemeIcon,
  SimpleGrid,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconUpload,
  IconFile,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconArrowRight,
  IconPlus,
  IconEdit,
  IconInfoCircle,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import type { PlantRecord } from '../api/plantData'
import { bulkCheck, bulkUpload } from '../api/plantData'
import { getOptions } from '../api/options'

// ── Field definitions ─────────────────────────────────────────────────────────

const DB_FIELDS = [
  'barcode', 'genotype', 'stage', 'site', 'block', 'project',
  'post_harvest', 'bush_plant_number', 'notes', 'mass', 'x_berry_mass',
  'number_of_berries', 'ph', 'brix', 'juicemass', 'tta', 'mladded',
  'avg_firmness', 'avg_diameter', 'sd_firmness', 'sd_diameter', 'box',
] as const

type DbField = typeof DB_FIELDS[number]
const DROP_SENTINEL = '__drop__'

const NUMERIC_FIELDS = new Set<DbField>([
  'mass', 'x_berry_mass', 'number_of_berries', 'ph', 'brix',
  'juicemass', 'tta', 'mladded', 'avg_firmness', 'avg_diameter',
  'sd_firmness', 'sd_diameter', 'box',
])

// Predefined aliases (normalized key → db field)
const ALIASES: Record<string, DbField> = {
  fqcode: 'barcode', fq_code: 'barcode', 'fq code': 'barcode',
  sample: 'barcode', sampleid: 'barcode', sample_id: 'barcode',
  projectid: 'project', project_id: 'project',
  variety: 'genotype', cultivar: 'genotype',
  berrycount: 'number_of_berries', num_berries: 'number_of_berries',
  berry_count: 'number_of_berries', numofberries: 'number_of_berries',
  juicemass: 'juicemass', juice_mass: 'juicemass', juice: 'juicemass',
  mladded: 'mladded', ml_added: 'mladded',
  avgfirmness: 'avg_firmness', firmness: 'avg_firmness', average_firmness: 'avg_firmness',
  avgdiameter: 'avg_diameter', diameter: 'avg_diameter', average_diameter: 'avg_diameter',
  sdfirmness: 'sd_firmness', sddiameter: 'sd_diameter',
  xberrymass: 'x_berry_mass', x_berry: 'x_berry_mass', avgberrymass: 'x_berry_mass',
  average_berry_mass: 'x_berry_mass',
  postharvest: 'post_harvest', post_harvest_type: 'post_harvest',
  bushplant: 'bush_plant_number', bush_plant: 'bush_plant_number',
  plant_number: 'bush_plant_number', bush: 'bush_plant_number',
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-()]/g, '')
}

function jaccardSimilarity(a: string, b: string): number {
  const sa = new Set(a.split(''))
  const sb = new Set(b.split(''))
  const intersection = [...sa].filter(c => sb.has(c)).length
  const union = new Set([...sa, ...sb]).size
  return union === 0 ? 0 : intersection / union
}

function matchColumn(header: string): DbField | null {
  const norm = normalize(header)
  // Exact alias
  if (ALIASES[norm]) return ALIASES[norm]
  // Exact db field
  if (DB_FIELDS.includes(norm as DbField)) return norm as DbField
  // Fuzzy: best Jaccard similarity against db fields
  let best: DbField | null = null
  let bestScore = 0
  for (const field of DB_FIELDS) {
    const score = jaccardSimilarity(norm, normalize(field))
    if (score > bestScore) { bestScore = score; best = field }
  }
  return bestScore >= 0.6 ? best : null
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnMapping {
  fileHeader: string
  dbField: DbField | 'notes' | '__drop__' | null
  samples: string[]
}

interface ParsedRow {
  raw: Record<string, string>
  barcode: string | null
  valid: boolean
  invalidReason?: string
}

type RowAction =
  | { type: 'create'; barcode: string; data: Partial<PlantRecord>; notesAppend: string }
  | { type: 'modify'; barcode: string; data: Partial<PlantRecord>; notesAppend: string; existing: PlantRecord; changes: Record<string, { from: unknown; to: unknown }> }
  | { type: 'nochange'; barcode: string }
  | { type: 'skip'; barcode: string; reason: string; raw: Record<string, string> }

type Step = 'upload' | 'mapping' | 'preview' | 'done'

// ── Helpers ───────────────────────────────────────────────────────────────────

function coerce(value: string, field: DbField): string | number | null {
  if (value === '' || value === null || value === undefined) return null
  if (NUMERIC_FIELDS.has(field)) {
    const n = Number(value)
    return isNaN(n) ? null : n
  }
  return value.trim()
}

function buildRowData(
  raw: Record<string, string>,
  mappings: ColumnMapping[],
): { data: Partial<PlantRecord>; notesChunks: string[] } {
  const data: Partial<PlantRecord> = {}
  const notesChunks: string[] = []

  for (const m of mappings) {
    if (m.dbField === null || m.dbField === DROP_SENTINEL) continue
    const rawVal = raw[m.fileHeader] ?? ''

    if (m.dbField === 'notes' || m.dbField === 'barcode') {
      // handled separately
      continue
    }

    // Columns mapped to 'notes' (the catch-all)
    const fieldName = m.dbField
    const coerced = coerce(rawVal, fieldName as DbField)
    if (coerced !== null) {
      (data as Record<string, unknown>)[fieldName] = coerced
    }
  }

  // Columns explicitly mapped to notes
  for (const m of mappings) {
    if (m.dbField === DROP_SENTINEL) continue
    if (m.dbField === 'notes') {
      const rawVal = raw[m.fileHeader] ?? ''
      if (rawVal.trim()) notesChunks.push(`${m.fileHeader}: ${rawVal.trim()}`)
    }
  }

  return { data, notesChunks }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkUpload() {
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseProgress, setParseProgress] = useState(0)
  const [isParsing, setIsParsing] = useState(false)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [rowActions, setRowActions] = useState<RowAction[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const PREVIEW_PAGE_SIZE = 100
  const [checkProgress, setCheckProgress] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<{ created: number; updated: number; errors: string[] } | null>(null)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [stageOverride, setStageOverride] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: optionConfigs = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })
  const stageOptions = optionConfigs
    .filter((o) => o.option_type === 'stage')
    .map((o) => ({ value: o.option_text, label: o.option_text }))

  // ── File parsing ──────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setIsParsing(true)
    setParseProgress(10)
    setFileName(file.name)
    setMappingError(null)

    try {
      const buffer = await file.arrayBuffer()
      setParseProgress(30)

      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
      setParseProgress(60)

      if (raw.length < 2) throw new Error('File has no data rows.')

      const headers: string[] = (raw[0] as string[]).map(String)
      const dataRows = raw.slice(1)

      // Build column mappings
      const newMappings: ColumnMapping[] = headers.map((h) => {
        const dbField = matchColumn(h)
        // Unmapped → notes catch-all
        const samples = dataRows
          .slice(0, 3)
          .map((r) => String(r[headers.indexOf(h)] ?? ''))
          .filter(Boolean)
        return { fileHeader: h, dbField: dbField ?? 'notes', samples }
      })

      // Build parsed rows
      const rows: ParsedRow[] = dataRows
        .filter((r) => r.some((c) => String(c).replace(/\s/g, '') !== ''))
        .map((r) => {
          const raw: Record<string, string> = {}
          headers.forEach((h, i) => { raw[h] = String(r[i] ?? '') })

          const barcodeMapping = newMappings.find((m) => m.dbField === 'barcode')
          const barcodeRaw = barcodeMapping ? (raw[barcodeMapping.fileHeader] ?? '').trim() : ''
          const valid = /^\d{7}$/.test(barcodeRaw)

          return {
            raw,
            barcode: barcodeRaw || null,
            valid,
            invalidReason: !barcodeRaw
              ? 'Missing barcode'
              : !valid
              ? `Barcode "${barcodeRaw}" is not 7 numeric digits`
              : undefined,
          }
        })

      setParseProgress(90)
      setMappings(newMappings)
      setParsedRows(rows)
      setParseProgress(100)
      setTimeout(() => { setIsParsing(false); setStep('mapping') }, 300)
    } catch (err: unknown) {
      setIsParsing(false)
      setParseProgress(0)
      notifications.show({
        color: 'red',
        title: 'Parse error',
        message: err instanceof Error ? err.message : 'Failed to read file.',
      })
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  // ── Mapping → Preview ─────────────────────────────────────────────────────

  const proceedToPreview = useCallback(async () => {
    const barcodeCol = mappings.find((m) => m.dbField === 'barcode')
    if (!barcodeCol) {
      setMappingError('No column is mapped to "barcode". Please assign one.')
      return
    }
    const stageIsMapped = mappings.some((m) => m.dbField === 'stage')
    if (!stageIsMapped && !stageOverride) {
      setMappingError('Stage is required. Either map a column to "stage" or select a stage override below.')
      return
    }
    setMappingError(null)
    setIsChecking(true)
    setCheckProgress(0)

    const validRows = parsedRows.filter((r) => r.valid && r.barcode)
    const barcodes = validRows.map((r) => r.barcode!)

    try {
      const CHUNK = 500
      const existing: Record<string, PlantRecord> = {}
      for (let i = 0; i < barcodes.length; i += CHUNK) {
        const chunk = barcodes.slice(i, i + CHUNK)
        const result = await bulkCheck(chunk)
        Object.assign(existing, result)
        setCheckProgress(Math.round(((i + chunk.length) / barcodes.length) * 100))
        if (i + CHUNK < barcodes.length) {
          await new Promise((r) => setTimeout(r, 200))
        }
      }
      setCheckProgress(100)

      // Hoist loop-invariant lookups
      const stageIsMapped = mappings.some((m) => m.dbField === 'stage')
      const notesMapping = mappings.find((m) => m.dbField === 'notes' && m.fileHeader.toLowerCase() === 'notes')

      // Process rows in chunks so the main thread can breathe
      const ROW_CHUNK = 200
      const actions: RowAction[] = []
      for (let i = 0; i < parsedRows.length; i += ROW_CHUNK) {
        await new Promise((r) => setTimeout(r, 0))
        const slice = parsedRows.slice(i, i + ROW_CHUNK)
        for (const row of slice) {
          if (!row.valid) {
            actions.push({ type: 'skip', barcode: row.barcode ?? '?', reason: row.invalidReason!, raw: row.raw })
            continue
          }
          const barcode = row.barcode!
          const { data, notesChunks } = buildRowData(row.raw, mappings)
          if (!stageIsMapped && stageOverride) data.stage = stageOverride
          if (notesMapping) {
            const notesVal = row.raw[notesMapping.fileHeader]?.trim()
            if (notesVal) notesChunks.unshift(notesVal)
          }
          const notesAppend = notesChunks.join(' | ')
          if (existing[barcode]) {
            const ex = existing[barcode]
            const changes: Record<string, { from: unknown; to: unknown }> = {}
            for (const [k, v] of Object.entries(data)) {
              if (k === 'barcode') continue
              const prev = (ex as unknown as Record<string, unknown>)[k]
              if (prev !== v && !(prev == null && v == null)) changes[k] = { from: prev ?? null, to: v }
            }
            if (notesAppend && !ex.notes?.includes(notesAppend)) {
              const newNotes = [ex.notes, notesAppend].filter(Boolean).join(' | ')
              changes['notes'] = { from: ex.notes ?? null, to: newNotes }
            }
            if (Object.keys(changes).length === 0) {
              actions.push({ type: 'nochange', barcode })
            } else {
              actions.push({ type: 'modify', barcode, data, notesAppend, existing: ex, changes })
            }
          } else {
            actions.push({ type: 'create', barcode, data, notesAppend })
          }
        }
      }

      setRowActions(actions)
      setPreviewPage(0)
      setIsChecking(false)
      setStep('preview')
    } catch {
      setIsChecking(false)
      notifications.show({ color: 'red', title: 'Error', message: 'Failed to check existing barcodes.' })
    }
  }, [mappings, parsedRows])

  // ── Upload ────────────────────────────────────────────────────────────────

  const doUpload = useCallback(async () => {
    setConfirmOpen(false)
    setIsUploading(true)

    const records = rowActions
      .filter((a): a is Extract<RowAction, { type: 'create' | 'modify' }> =>
        a.type === 'create' || a.type === 'modify',
      )
      .map((a) => {
        const payload: Partial<PlantRecord> & { barcode: string } = { ...a.data, barcode: a.barcode }
        if (a.notesAppend) {
          const base = a.type === 'modify' ? a.existing.notes : undefined
          const alreadyPresent = base?.includes(a.notesAppend) ?? false
          if (!alreadyPresent) {
            payload.notes = [base, a.notesAppend].filter(Boolean).join(' | ') || undefined
          }
        }
        return payload
      })

    try {
      const UPLOAD_CHUNK = 500
      const COOLDOWN = 200
      let created = 0
      let updated = 0
      setUploadProgress(0)

      for (let i = 0; i < records.length; i += UPLOAD_CHUNK) {
        const chunk = records.slice(i, i + UPLOAD_CHUNK)
        const result = await bulkUpload(chunk)
        created += result.results.filter((r: { action: string }) => r.action === 'created').length
        updated += result.results.filter((r: { action: string }) => r.action === 'updated').length
        setUploadProgress(Math.round(((i + chunk.length) / records.length) * 100))
        if (i + UPLOAD_CHUNK < records.length) {
          await new Promise((r) => setTimeout(r, COOLDOWN))
        }
      }

      setUploadResults({ created, updated, errors: [] })
      setStep('done')
    } catch {
      notifications.show({ color: 'red', title: 'Upload failed', message: 'Server error during bulk upload.' })
    } finally {
      setIsUploading(false)
    }
  }, [rowActions])

  const reset = () => {
    setStep('upload')
    setFileName('')
    setMappings([])
    setParsedRows([])
    setRowActions([])
    setUploadResults(null)
    setParseProgress(0)
    setMappingError(null)
    setStageOverride(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Derived counts ────────────────────────────────────────────────────────

  const creates = rowActions.filter((a) => a.type === 'create').length
  const modifies = rowActions.filter((a) => a.type === 'modify').length
  const nochanges = rowActions.filter((a) => a.type === 'nochange').length
  const skips = rowActions.filter((a) => a.type === 'skip').length
  const sortedActions = [
    ...rowActions.filter((a) => a.type === 'skip'),
    ...rowActions.filter((a) => a.type === 'modify'),
    ...rowActions.filter((a) => a.type === 'create'),
    ...rowActions.filter((a) => a.type === 'nochange'),
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={2}>Bulk Upload</Title>
          <Text c="dimmed" size="sm">Import plant data from Excel or CSV. Barcodes must be exactly 7 numeric digits.</Text>
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <Paper
            withBorder
            p={60}
            style={{
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: isDragging ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-default-border)',
              background: isDragging ? 'var(--mantine-color-blue-light)' : undefined,
              cursor: 'pointer',
              transition: 'all 150ms ease',
              textAlign: 'center',
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            <Stack align="center" gap="md">
              <ThemeIcon size={64} radius="xl" variant="light" color="blue">
                <IconUpload size={32} />
              </ThemeIcon>
              <div>
                <Text fw={600} size="lg">Drop your file here, or click to browse</Text>
                <Text size="sm" c="dimmed">Supports .xlsx, .xls, .csv</Text>
              </div>
            </Stack>
            {isParsing && (
              <Box mt="lg">
                <Text size="sm" c="dimmed" mb={4}>{fileName}</Text>
                <Progress value={parseProgress} animated size="sm" />
              </Box>
            )}
          </Paper>
        )}

        {/* ── Step 2: Mapping ── */}
        {step === 'mapping' && (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <IconFile size={18} />
                <Text fw={500}>{fileName}</Text>
                <Text c="dimmed" size="sm">— {parsedRows.length} data rows detected</Text>
              </Group>
              <Button variant="subtle" size="xs" onClick={reset}>Start over</Button>
            </Group>

            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Review how each column in your file maps to a database field.
              Columns mapped to <strong>notes</strong> will be appended as free-form text.
              Unmapped columns are also sent to notes.
            </Alert>

            {!mappings.some((m) => m.dbField === 'stage') && (
              <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light" title="Stage not found in file">
                <Stack gap="xs">
                  <Text size="sm">
                    Your file has no column that maps to <strong>stage</strong>, which is required.
                    Select a stage to apply to all rows, or add a stage column to your file.
                  </Text>
                  <Select
                    placeholder="Select stage for all rows…"
                    data={stageOptions}
                    value={stageOverride}
                    onChange={setStageOverride}
                    clearable
                    size="sm"
                    style={{ maxWidth: 280 }}
                  />
                </Stack>
              </Alert>
            )}

            {mappingError && (
              <Alert icon={<IconAlertTriangle size={16} />} color="red">{mappingError}</Alert>
            )}

            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File column</Table.Th>
                    <Table.Th>Maps to</Table.Th>
                    <Table.Th>Sample values</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {mappings.map((m, i) => (
                    <Table.Tr key={m.fileHeader}>
                      <Table.Td>
                        <Text fw={500} size="sm">{m.fileHeader}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          value={m.dbField ?? ''}
                          data={[
                            { value: '__drop__', label: '✕ Drop (do not import)' },
                            { value: 'notes', label: '→ notes (free text)' },
                            ...DB_FIELDS.filter((f) => f !== 'notes').map((f) => ({ value: f, label: f })),
                          ]}
                          onChange={(val) => {
                            setMappings((prev) =>
                              prev.map((mm, j) =>
                                j === i ? { ...mm, dbField: (val as DbField | 'notes' | '__drop__') ?? null } : mm,
                              ),
                            )
                          }}
                          styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" truncate style={{ maxWidth: 220 }}>
                          {m.samples.join(', ') || '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>

            {isChecking && (
              <Box>
                <Text size="xs" c="dimmed" mb={4}>Checking barcodes… {checkProgress}%</Text>
                <Progress value={checkProgress} animated size="sm" />
              </Box>
            )}
            <Group justify="flex-end">
              <Button
                rightSection={<IconArrowRight size={16} />}
                loading={isChecking}
                onClick={proceedToPreview}
              >
                Check barcodes & preview
              </Button>
            </Group>
          </Stack>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && (
          <Stack gap="md">
            <Group justify="space-between">
              <Group gap="xs">
                <IconFile size={18} />
                <Text fw={500}>{fileName}</Text>
              </Group>
              <Button variant="subtle" size="xs" onClick={reset}>Start over</Button>
            </Group>

            <SimpleGrid cols={4}>
              <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                <ThemeIcon size="lg" color="green" variant="light" mb={4}><IconPlus size={18} /></ThemeIcon>
                <Text size="xl" fw={700}>{creates}</Text>
                <Text size="xs" c="dimmed">New records</Text>
              </Paper>
              <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                <ThemeIcon size="lg" color="orange" variant="light" mb={4}><IconEdit size={18} /></ThemeIcon>
                <Text size="xl" fw={700}>{modifies}</Text>
                <Text size="xs" c="dimmed">Modifications</Text>
              </Paper>
              <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                <ThemeIcon size="lg" color="gray" variant="light" mb={4}><IconCheck size={18} /></ThemeIcon>
                <Text size="xl" fw={700}>{nochanges}</Text>
                <Text size="xs" c="dimmed">Already up to date</Text>
              </Paper>
              <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                <ThemeIcon size="lg" color="red" variant="light" mb={4}><IconX size={18} /></ThemeIcon>
                <Text size="xl" fw={700}>{skips}</Text>
                <Text size="xs" c="dimmed">Skipped (invalid)</Text>
              </Paper>
            </SimpleGrid>

            <ScrollArea h={480}>
              <Stack gap="xs">
                {sortedActions.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE).map((action, i) => (
                  <Paper key={previewPage * PREVIEW_PAGE_SIZE + i} withBorder p="sm">
                    <Group gap="xs" mb={4}>
                      {action.type === 'create' && <Badge color="green" leftSection={<IconPlus size={10} />}>CREATE</Badge>}
                      {action.type === 'modify' && <Badge color="orange" leftSection={<IconEdit size={10} />}>MODIFY</Badge>}
                      {action.type === 'nochange' && <Badge color="gray" leftSection={<IconCheck size={10} />}>ALREADY EXISTS</Badge>}
                      {action.type === 'skip' && <Badge color="red" leftSection={<IconX size={10} />}>SKIP</Badge>}
                      <Text fw={600} size="sm" ff="monospace">{action.barcode}</Text>
                    </Group>

                    {action.type === 'skip' && (
                      <Stack gap={4}>
                        <Text size="xs" c="red">{action.reason}</Text>
                        {Object.keys(action.raw).length > 0 && (
                          <Group gap={4} wrap="wrap">
                            {Object.entries(action.raw)
                              .filter(([, v]) => v.replace(/\s/g, '') !== '')
                              .map(([k, v]) => (
                                <Badge key={k} size="xs" variant="outline" color="gray">
                                  {k}: {v}
                                </Badge>
                              ))}
                          </Group>
                        )}
                      </Stack>
                    )}

                    {action.type === 'nochange' && (
                      <Text size="xs" c="dimmed">Already in the database with identical values — will not be re-uploaded.</Text>
                    )}

                    {action.type === 'create' && (
                      <Group gap={6} wrap="wrap">
                        {Object.entries(action.data).map(([k, v]) =>
                          v != null ? (
                            <Tooltip key={k} label={k}>
                              <Badge size="xs" variant="outline" color="green">
                                {k}: {String(v)}
                              </Badge>
                            </Tooltip>
                          ) : null,
                        )}
                        {action.notesAppend && (
                          <Tooltip label="notes (from unmapped/notes columns)">
                            <Badge size="xs" variant="outline" color="gray">
                              notes: {action.notesAppend.slice(0, 60)}{action.notesAppend.length > 60 ? '…' : ''}
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                    )}

                    {action.type === 'modify' && (
                      Object.keys(action.changes).length === 0 && !action.notesAppend ? (
                        <Text size="xs" c="dimmed">No changes detected.</Text>
                      ) : (
                        <Group gap={6} wrap="wrap">
                          {Object.entries(action.changes).map(([k, { from, to }]) => (
                            <Tooltip
                              key={k}
                              label={`${k}: ${from ?? 'null'} → ${to ?? 'null'}`}
                              multiline
                              maw={300}
                            >
                              <Badge size="xs" variant="outline" color="orange">
                                {k}: {String(from ?? '∅')} → {String(to ?? '∅')}
                              </Badge>
                            </Tooltip>
                          ))}
                        </Group>
                      )
                    )}
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
            {sortedActions.length > PREVIEW_PAGE_SIZE && (
              <Group justify="center">
                <Button variant="subtle" size="xs" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>← Prev</Button>
                <Text size="sm" c="dimmed">
                  Rows {previewPage * PREVIEW_PAGE_SIZE + 1}–{Math.min((previewPage + 1) * PREVIEW_PAGE_SIZE, sortedActions.length)} of {sortedActions.length}
                </Text>
                <Button variant="subtle" size="xs" disabled={(previewPage + 1) * PREVIEW_PAGE_SIZE >= sortedActions.length} onClick={() => setPreviewPage(p => p + 1)}>Next →</Button>
              </Group>
            )}

            <Divider />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setStep('mapping')}>Back to mapping</Button>
              <Button
                color="blue"
                disabled={creates + modifies === 0}
                onClick={() => setConfirmOpen(true)}
                loading={isUploading}
              >
                Approve & upload ({creates + modifies} records)
              </Button>
            </Group>
          </Stack>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && uploadResults && (
          <Paper withBorder p="xl">
            <Stack align="center" gap="md">
              <ThemeIcon size={64} radius="xl" color="green" variant="light">
                <IconCheck size={32} />
              </ThemeIcon>
              <Title order={3}>Upload complete</Title>
              <SimpleGrid cols={2}>
                <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                  <Text size="xl" fw={700} c="green">{uploadResults.created}</Text>
                  <Text size="sm" c="dimmed">Records created</Text>
                </Paper>
                <Paper withBorder p="md" style={{ textAlign: 'center' }}>
                  <Text size="xl" fw={700} c="orange">{uploadResults.updated}</Text>
                  <Text size="sm" c="dimmed">Records updated</Text>
                </Paper>
              </SimpleGrid>
              <Button onClick={reset} variant="default">Upload another file</Button>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* ── Confirm modal ── */}
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm bulk upload"
        centered
      >
        <Stack gap="md">
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
            You are about to write <strong>{creates + modifies} records</strong> to the database:
            <br />• {creates} new records will be <strong>created</strong>
            <br />• {modifies} existing records will be <strong>modified</strong>
            <br />• {nochanges} records <strong>already up to date</strong> (skipped)
            <br />• {skips} invalid rows will be <strong>skipped</strong>
          </Alert>
          <Text size="sm">Are you sure you want to proceed? This action will be logged to the audit trail.</Text>
          {isUploading && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>Uploading… {uploadProgress}%</Text>
              <Progress value={uploadProgress} animated size="sm" />
            </Box>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)} disabled={isUploading}>Cancel</Button>
            <Button color="red" onClick={doUpload} loading={isUploading}>
              Yes, upload now
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}
