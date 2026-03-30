import { useState, useEffect, useRef } from 'react'
import {
  TextInput, NumberInput, Select, Textarea, Button, Paper, Title,
  Grid, Stack, Group, Badge, Alert, Text, Divider, Modal, ActionIcon,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconScan, IconRefresh, IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getOptions } from '../api/options'
import { addPlantData, checkBarcode } from '../api/plantData'
import { spellCheck } from '../api/genotypes'

const EMPTY_FORM = {
  barcode: '', genotype: '', stage: '', site: '', block: '', project: '',
  post_harvest: '', bush_plant_number: '', notes: '',
  mass: '', number_of_berries: '', x_berry_mass: '', box: '',
  ph: '', brix: '', juicemass: '', tta: '', mladded: '',
}

export function AddSamples() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [genotypeSuggestion, setGenotypeSuggestion] = useState<string | null>(null)
  const [barcodeWarning, setBarcodeWarning] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const genotypeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: optionConfigs = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })

  const optionsFor = (type: string) =>
    optionConfigs.filter((o) => o.option_type === type).map((o) => ({ value: o.option_text, label: o.option_text }))

  useEffect(() => { barcodeRef.current?.focus() }, [])

  const handleBarcodeBlur = async () => {
    const b = form.barcode.trim()
    if (!b) return
    if (!/^\d{7}$/.test(b)) {
      setBarcodeWarning('Barcode should be 7 digits')
      return
    }
    setBarcodeWarning('')
    try {
      const data = await checkBarcode(b)
      if (data && !data.error) {
        notifications.show({ message: 'Existing record found — fields pre-filled', color: 'blue' })
        setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])) }))
      }
    } catch { /* new barcode */ }
  }

  const handleGenotypeChange = (val: string) => {
    setForm((f) => ({ ...f, genotype: val }))
    setGenotypeSuggestion(null)
    if (genotypeTimer.current) clearTimeout(genotypeTimer.current)
    if (val.length < 2) return
    genotypeTimer.current = setTimeout(async () => {
      try {
        const res = await spellCheck(val)
        if (res.match_type === 'partial') setGenotypeSuggestion(res.suggestions[0])
        else if (res.match_type === 'exact') setGenotypeSuggestion(null)
      } catch { /* ignore */ }
    }, 500)
  }

  const set = (field: string) => (val: string | number | null) =>
    setForm((f) => ({ ...f, [field]: val ?? '' }))

  const handleSubmit = async () => {
    if (!form.barcode) {
      notifications.show({ message: 'Barcode is required', color: 'red' })
      return
    }
    setSubmitting(true)
    try {
      await addPlantData({ ...form, barcode: form.barcode } as any)
      notifications.show({ message: 'Sample saved successfully', color: 'green', icon: <IconCheck size={16} /> })
      setForm(EMPTY_FORM)
      setGenotypeSuggestion(null)
      barcodeRef.current?.focus()
    } catch {
      notifications.show({ message: 'Failed to save sample', color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Add Samples</Title>
        <Button leftSection={<IconRefresh size={16} />} variant="subtle" onClick={() => { setForm(EMPTY_FORM); setGenotypeSuggestion(null) }}>
          Reset
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Stack>
          <Title order={5}>Identification</Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Barcode"
                placeholder="7-digit barcode"
                ref={barcodeRef}
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                onBlur={handleBarcodeBlur}
                error={barcodeWarning || undefined}
                rightSection={
                  <ActionIcon variant="subtle" onClick={() => setScannerOpen(true)}>
                    <IconScan size={16} />
                  </ActionIcon>
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap={4}>
                <TextInput
                  label="Genotype"
                  placeholder="e.g. FL 86-19"
                  value={form.genotype}
                  onChange={(e) => handleGenotypeChange(e.target.value)}
                />
                {genotypeSuggestion && (
                  <Alert icon={<IconAlertCircle size={14} />} color="yellow" variant="light" p="xs">
                    Did you mean{' '}
                    <Text span fw={600} style={{ cursor: 'pointer' }} onClick={() => { setForm((f) => ({ ...f, genotype: genotypeSuggestion })); setGenotypeSuggestion(null) }}>
                      {genotypeSuggestion}
                    </Text>
                    ?
                  </Alert>
                )}
              </Stack>
            </Grid.Col>

            {[
              { field: 'stage', label: 'Stage' },
              { field: 'site', label: 'Site' },
              { field: 'block', label: 'Block' },
              { field: 'project', label: 'Project' },
              { field: 'post_harvest', label: 'Post Harvest' },
            ].map(({ field, label }) => (
              <Grid.Col span={{ base: 12, sm: 4 }} key={field}>
                <Select
                  label={label}
                  data={optionsFor(field)}
                  value={form[field as keyof typeof form] as string}
                  onChange={set(field)}
                  clearable
                />
              </Grid.Col>
            ))}

            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput label="Bush / Plant #" value={form.bush_plant_number} onChange={(e) => set('bush_plant_number')(e.target.value)} />
            </Grid.Col>
          </Grid>

          <Divider label="Yield" labelPosition="left" />
          <Grid>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput label="Mass (g)" value={form.mass as any} onChange={set('mass')} decimalScale={2} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput label="# Berries" value={form.number_of_berries as any} onChange={set('number_of_berries')} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput label="Avg Berry Mass (g)" value={form.x_berry_mass as any} onChange={set('x_berry_mass')} decimalScale={2} />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput label="Box" value={form.box as any} onChange={set('box')} />
            </Grid.Col>
          </Grid>

          <Divider label="Fruit Quality" labelPosition="left" />
          <Grid>
            {[
              { field: 'ph', label: 'pH' },
              { field: 'brix', label: 'Brix' },
              { field: 'tta', label: 'TTA' },
              { field: 'juicemass', label: 'Juice Mass (g)' },
              { field: 'mladded', label: 'mL Added' },
            ].map(({ field, label }) => (
              <Grid.Col span={{ base: 6, sm: 4 }} key={field}>
                <NumberInput label={label} value={form[field as keyof typeof form] as any} onChange={set(field)} decimalScale={3} />
              </Grid.Col>
            ))}
          </Grid>

          <Divider label="Notes" labelPosition="left" />
          <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} rows={2} />

          <Group justify="flex-end">
            <Button onClick={handleSubmit} loading={submitting} color="green" size="md">
              Save Sample
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Modal opened={scannerOpen} onClose={() => setScannerOpen(false)} title="Scan Barcode" centered>
        <Text c="dimmed" size="sm">Barcode scanner coming soon.</Text>
      </Modal>
    </Stack>
  )
}
