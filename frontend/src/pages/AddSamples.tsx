import { useState, useEffect, useRef } from 'react'
import {
  TextInput, NumberInput, Textarea, Button, Paper, Title,
  Grid, Stack, Group, Alert, Text, Modal, ActionIcon,
} from '@mantine/core'
import { SelectWithAdd } from '../components/SelectWithAdd'
import { notifications } from '@mantine/notifications'
import { IconBarcode, IconRefresh, IconAlertCircle, IconInfoCircle, IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getOptions } from '../api/options'
import { addPlantData, checkBarcode } from '../api/plantData'
import { spellCheck } from '../api/genotypes'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

const currentYear = new Date().getFullYear()
const lastTwoDigits = currentYear.toString().slice(-2)

const EMPTY_FORM = {
  barcode: '',
  genotype: '',
  stage: '' as string | null,
  site: '' as string | null,
  block: '' as string | null,
  project: '' as string | null,
  post_harvest: '' as string | null,
  bush_plant_number: '',
  mass: '' as number | string,
  number_of_berries: '' as number | string,
  x_berry_mass: '' as number | string,
  notes: '',
}

export function AddSamples() {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [genotypeSuggestion, setGenotypeSuggestion] = useState('')
  const [barcodeExistsWarning, setBarcodeExistsWarning] = useState(false)
  const [yearWarning, setYearWarning] = useState(false)
  const [invalidBarcodeModal, setInvalidBarcodeModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const barcodeRef = useRef<HTMLInputElement>(null)
  const genotypeRef = useRef<HTMLInputElement>(null)
  const genotypeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevBarcodeRef = useRef('')

  const { data: optionConfigs = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })

  const optionsFor = (type: string) =>
    optionConfigs.filter((o) => o.option_type === type).map((o) => ({ value: o.option_text, label: o.option_text }))

  useEffect(() => { barcodeRef.current?.focus() }, [])

  useBarcodeScanner((scanned) => {
    // Only accept digits, truncate to 7
    const digits = scanned.replace(/\D/g, '').slice(0, 7)
    if (!digits) return
    setForm((_f) => ({ ...EMPTY_FORM, barcode: digits }))
    setBarcodeExistsWarning(false)
    setGenotypeSuggestion('')
    prevBarcodeRef.current = ''
    // Trigger the barcode effect manually since state update is async
    if (digits.length === 7) {
      setTimeout(() => genotypeRef.current?.focus(), 50)
      checkBarcodeInBackend(digits)
    }
  })

  // Barcode side effects: auto-advance, year warning, reset on change, recall
  useEffect(() => {
    const cur = form.barcode
    const prev = prevBarcodeRef.current

    // If barcode changed after previously being 7 digits, reset form
    if (prev.length === 7 && cur !== prev) {
      setForm((_f) => ({ ...EMPTY_FORM, barcode: cur }))
      setBarcodeExistsWarning(false)
      setGenotypeSuggestion('')
    }
    prevBarcodeRef.current = cur

    // Year prefix warning — flag if first 2 digits don't match current year
    setYearWarning(cur.length >= 2 && /^\d{2}/.test(cur) && cur.slice(0, 2) !== lastTwoDigits)

    // On hitting exactly 7 digits: focus genotype and check backend
    if (cur.length === 7) {
      genotypeRef.current?.focus()
      checkBarcodeInBackend(cur)
    }
  }, [form.barcode])

  const checkBarcodeInBackend = async (barcode: string) => {
    try {
      const data = await checkBarcode(barcode)
      if (!data.error) {
        setBarcodeExistsWarning(true)
        setForm((f) => ({
          ...f,
          genotype: data.genotype ?? f.genotype,
          stage: data.stage ?? f.stage,
          site: data.site ?? f.site,
          block: data.block ?? f.block,
          project: data.project ?? f.project,
          post_harvest: data.post_harvest ?? f.post_harvest,
          bush_plant_number: data.bush_plant_number ?? f.bush_plant_number,
          mass: data.mass ?? f.mass,
          number_of_berries: data.number_of_berries ?? f.number_of_berries,
          x_berry_mass: data.x_berry_mass ?? f.x_berry_mass,
          notes: data.notes ?? f.notes,
        }))
      } else {
        setBarcodeExistsWarning(false)
      }
    } catch {
      setBarcodeExistsWarning(false)
    }
  }

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (/^\d{0,7}$/.test(v)) {
      setForm((f) => ({ ...f, barcode: v }))
    }
  }

  const handleGenotypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((f) => ({ ...f, genotype: v }))
    setGenotypeSuggestion('')
    if (genotypeTimer.current) clearTimeout(genotypeTimer.current)
    if (v.length > 2) {
      genotypeTimer.current = setTimeout(async () => {
        try {
          const res = await spellCheck(v)
          if (res.match_type === 'exact') {
            // Check capitalization
            if (isNaN(Number(v)) && v[0] !== v[0].toUpperCase()) {
              const corrected = v.charAt(0).toUpperCase() + v.slice(1)
              setGenotypeSuggestion(`Did you mean to capitalize genotype ${corrected}?`)
            } else {
              setGenotypeSuggestion('')
            }
          } else if (res.match_type === 'partial') {
            setGenotypeSuggestion(`Did you mean: ${res.suggestions[0]}?`)
          } else {
            setGenotypeSuggestion('Are you sure? Not found in database.')
          }
        } catch { /* ignore */ }
      }, 500)
    }
  }

  const handleSubmit = async () => {
    if (form.barcode.length < 7) {
      setInvalidBarcodeModal(true)
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      // Convert empty strings to null
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') payload[k] = null
      })
      await addPlantData(payload as any)
      notifications.show({ message: 'Sample saved successfully', color: 'green' })
      setForm({ ...EMPTY_FORM })
      setBarcodeExistsWarning(false)
      setGenotypeSuggestion('')
      prevBarcodeRef.current = ''
      barcodeRef.current?.focus()
    } catch {
      notifications.show({ message: 'Failed to save sample', color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setForm({ ...EMPTY_FORM })
    setBarcodeExistsWarning(false)
    setYearWarning(false)
    setGenotypeSuggestion('')
    prevBarcodeRef.current = ''
    barcodeRef.current?.focus()
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Add Samples</Title>
        <Button leftSection={<IconRefresh size={16} />} variant="subtle" onClick={handleReset}>
          Reset
        </Button>
      </Group>

      {/* Barcode entry card — always visible */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Group gap="xs" align="center">
            <IconBarcode size={20} opacity={0.5} />
            <Text fw={600}>Scan or enter a barcode to begin</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Use a handheld scanner or type a 7-digit barcode. The rest of the form will appear once a valid barcode is entered.
          </Text>
          <Stack gap={4}>
            <TextInput
              placeholder="e.g. 2600123"
              ref={barcodeRef}
              value={form.barcode}
              onChange={handleBarcodeChange}
              inputMode="numeric"
              maxLength={7}
              rightSection={
                form.barcode ? (
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleReset}>
                    <IconX size={14} />
                  </ActionIcon>
                ) : null
              }
            />
            {barcodeExistsWarning && (
              <Alert icon={<IconAlertCircle size={14} />} color="red" variant="light" p="xs">
                WARNING: This barcode already exists in the database. Fields have been pre-filled — you are updating an existing record.
              </Alert>
            )}
            {yearWarning && (
              <Alert icon={<IconAlertCircle size={14} />} color="red" variant="filled" p="xs">
                ⚠ This barcode starts with "{form.barcode.slice(0, 2)}" — that indicates{' '}
                20{form.barcode.slice(0, 2)}, not the current year ({currentYear}). Are you sure this is correct?
              </Alert>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Rest of the form — only shown once a 7-digit barcode is entered */}
      {form.barcode.length === 7 && (
      <Paper withBorder p="md" radius="md">
        <Stack>

          {/* Genotype */}
          <Stack gap={4}>
            <TextInput
              label="Genotype"
              placeholder="e.g. FL 86-19"
              ref={genotypeRef}
              value={form.genotype}
              onChange={handleGenotypeChange}
              required
            />
            {genotypeSuggestion && (
              <Alert
                icon={<IconInfoCircle size={14} />}
                color={genotypeSuggestion.startsWith('Are you sure') ? 'red' : 'yellow'}
                variant="light"
                p="xs"
                style={{ cursor: genotypeSuggestion.includes('Did you mean:') ? 'pointer' : undefined }}
                onClick={() => {
                  const match = genotypeSuggestion.match(/Did you mean: (.+?)\?/)
                  if (match) {
                    setForm((f) => ({ ...f, genotype: match[1] }))
                    setGenotypeSuggestion('')
                  }
                }}
              >
                {genotypeSuggestion}
                {genotypeSuggestion.includes('Did you mean:') && (
                  <Text span size="xs" c="dimmed"> (click to apply)</Text>
                )}
              </Alert>
            )}
          </Stack>

          {/* Dropdowns */}
          <Grid>
            {([
              { field: 'stage', label: 'Stage', required: true },
              { field: 'site', label: 'Site', required: true },
              { field: 'block', label: 'Block', required: false },
              { field: 'project', label: 'Project', required: false },
              { field: 'post_harvest', label: 'Post Harvest', required: false },
            ] as const).map(({ field, label, required }) => (
              <Grid.Col span={{ base: 12, sm: 4 }} key={field}>
                <SelectWithAdd
                  label={label}
                  optionType={field}
                  data={optionsFor(field)}
                  value={form[field] || null}
                  onChange={(v) => setForm((f) => ({ ...f, [field]: v }))}
                  clearable
                  required={required}
                />
              </Grid.Col>
            ))}

            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                label="Bush / Plant #"
                value={form.bush_plant_number}
                onChange={(e) => setForm((f) => ({ ...f, bush_plant_number: e.target.value }))}
              />
            </Grid.Col>
          </Grid>

          {/* Yield fields */}
          <Grid>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <NumberInput
                label="Mass (g)"
                value={form.mass as number}
                onChange={(v) => setForm((f) => ({ ...f, mass: v }))}
                decimalScale={2}
                step={0.1}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <NumberInput
                label="Number of Berries"
                value={form.number_of_berries as number}
                onChange={(v) => setForm((f) => ({ ...f, number_of_berries: v }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <NumberInput
                label="Avg Berry Mass (g)"
                value={form.x_berry_mass as number}
                onChange={(v) => setForm((f) => ({ ...f, x_berry_mass: v }))}
                decimalScale={2}
                step={0.1}
              />
            </Grid.Col>
          </Grid>

          {/* Notes */}
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            minRows={3}
          />

          <Group justify="flex-end">
            <Button onClick={handleSubmit} loading={submitting} color="indigo" size="md">
              Submit
            </Button>
          </Group>
        </Stack>
      </Paper>
      )}

      {/* Invalid barcode modal */}
      <Modal
        opened={invalidBarcodeModal}
        onClose={() => setInvalidBarcodeModal(false)}
        title="Invalid Barcode"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm">
            A valid barcode must be exactly 7 digits and should begin with "{lastTwoDigits}" for {currentYear}.
          </Text>
          <Button onClick={() => setInvalidBarcodeModal(false)}>OK</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
