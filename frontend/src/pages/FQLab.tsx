import { useState, useRef, useEffect } from 'react'
import {
  TextInput, NumberInput, Select, Button, Paper, Title, Stack, Group,
  Badge, Text, Divider, SimpleGrid, Box, ActionIcon, Alert,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconBarcode, IconX } from '@tabler/icons-react'

const currentYear = new Date().getFullYear()
const lastTwoDigits = currentYear.toString().slice(-2)
import { useQuery } from '@tanstack/react-query'
import { getOptions } from '../api/options'
import type { PlantRecord } from '../api/plantData'
import { checkBarcode, addPlantData } from '../api/plantData'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

const PROPERTIES = ['ph', 'brix', 'tta', 'juicemass', 'mladded'] as const
type Property = typeof PROPERTIES[number]

const PROPERTY_LABELS: Record<Property, string> = {
  ph: 'pH',
  brix: 'Brix',
  tta: 'TTA',
  juicemass: 'Juice Mass (g)',
  mladded: 'mL Added',
}

const RANGES: Record<string, { type: string; min: number; max: number }> = {
  ph: { type: 'ph_range', min: 3.0, max: 4.0 },
  brix: { type: 'brix_range', min: 8, max: 14 },
  tta: { type: 'tta_range', min: 0.5, max: 1.5 },
}

// Fields to show in the data grid, with display labels and priority
const PRIMARY_FIELDS: { key: keyof PlantRecord; label: string }[] = [
  { key: 'genotype', label: 'Genotype' },
  { key: 'site', label: 'Site' },
  { key: 'stage', label: 'Stage' },
]
const SECONDARY_FIELDS: { key: keyof PlantRecord; label: string }[] = [
  { key: 'block', label: 'Block' },
  { key: 'project', label: 'Project' },
  { key: 'post_harvest', label: 'Post Harvest' },
  { key: 'mass', label: 'Mass (g)' },
  { key: 'number_of_berries', label: '# Berries' },
  { key: 'x_berry_mass', label: 'Avg Berry Mass' },
  { key: 'ph', label: 'pH' },
  { key: 'brix', label: 'Brix' },
  { key: 'tta', label: 'TTA' },
  { key: 'juicemass', label: 'Juice Mass' },
  { key: 'mladded', label: 'mL Added' },
  { key: 'avg_firmness', label: 'Avg Firmness' },
  { key: 'avg_diameter', label: 'Avg Diameter' },
  { key: 'week', label: 'Week' },
]

function FieldCell({ label, value }: { label: string; value: unknown }) {
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <Box>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="sm" c={isEmpty ? 'red' : undefined} fw={isEmpty ? undefined : 500}>
        {isEmpty ? '—' : String(value)}
      </Text>
    </Box>
  )
}

export function FQLab() {
  const [barcode, setBarcode] = useState('')
  const [plant, setPlant] = useState<PlantRecord | null>(null)
  const [selectedProp, setSelectedProp] = useState<Property>(() => {
    return (sessionStorage.getItem('fqlab_prop') as Property) ?? 'ph'
  })
  const [inputValue, setInputValue] = useState<number | string>('')
  const [rangeError, setRangeError] = useState('')
  const [override, setOverride] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [yearWarning, setYearWarning] = useState(false)

  const barcodeRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef<HTMLInputElement>(null)

  const { data: optionConfigs = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })

  useEffect(() => { barcodeRef.current?.focus() }, [])

  // Pre-fill input when plant or selected property changes
  useEffect(() => {
    if (plant) {
      const existing = plant[selectedProp as keyof PlantRecord]
      setInputValue(existing !== null && existing !== undefined ? (existing as number) : '')
      setRangeError('')
      setOverride(false)
    }
  }, [plant, selectedProp])

  const getRangeForProp = (prop: string) => {
    const rangeDef = RANGES[prop]
    if (!rangeDef) return null
    const config = optionConfigs.find((o) => o.option_type === rangeDef.type)
    if (!config) return { min: rangeDef.min, max: rangeDef.max }
    const parts = config.option_text.split('-').map(Number)
    return parts.length === 2 ? { min: parts[0], max: parts[1] } : { min: rangeDef.min, max: rangeDef.max }
  }

  const doLookup = async (code: string) => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const data = await checkBarcode(code.trim())
      if (data.error) {
        notifications.show({
          message: "That barcode hasn't been added to the system yet.",
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        })
        setPlant(null)
      } else {
        setPlant(data)
        setInputValue('')
        setRangeError('')
        setOverride(false)
        setTimeout(() => valueRef.current?.focus(), 50)
      }
    } catch {
      notifications.show({
        message: "That barcode hasn't been added to the system yet.",
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      })
    } finally {
      setLoading(false)
    }
  }

  useBarcodeScanner((scanned) => {
    const digits = scanned.replace(/\D/g, '').slice(0, 7)
    if (!digits) return
    setBarcode(digits)
    setYearWarning(digits.length >= 2 && digits.slice(0, 2) !== lastTwoDigits)
    doLookup(digits)
  })

  const handleValueChange = (val: number | string) => {
    setInputValue(val)
    setOverride(false)
    setRangeError('')
    if (typeof val !== 'number') return
    const range = getRangeForProp(selectedProp)
    if (range && (val < range.min || val > range.max)) {
      setRangeError(`Value out of expected range (${range.min}–${range.max})`)
    }
  }

  const handleSubmit = async () => {
    if (!plant || inputValue === '') return
    if (rangeError && !override) {
      setOverride(true)
      return
    }
    setSubmitting(true)
    try {
      await addPlantData({ barcode: plant.barcode, [selectedProp]: inputValue })
      notifications.show({
        message: `${PROPERTY_LABELS[selectedProp]} updated for ${plant.genotype ?? plant.barcode}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      })
      setBarcode('')
      setPlant(null)
      setInputValue('')
      setRangeError('')
      setOverride(false)
      barcodeRef.current?.focus()
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack>
      <Title order={3}>FQ Lab</Title>

      {/* Barcode entry */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Group gap="xs" align="center">
            <IconBarcode size={20} opacity={0.5} />
            <Text fw={600}>Scan or enter a barcode to begin</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Use a handheld scanner or type a 7-digit barcode and press Enter. The sample record will load automatically.
          </Text>
          <Group align="flex-end">
            <TextInput
              ref={barcodeRef}
              placeholder="e.g. 2600123"
              value={barcode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 7)
                setBarcode(v)
                setYearWarning(v.length >= 2 && /^\d{2}/.test(v) && v.slice(0, 2) !== lastTwoDigits)
                if (v.length === 7) doLookup(v)
              }}
              onKeyDown={(e) => e.key === 'Enter' && doLookup(barcode)}
              inputMode="numeric"
              maxLength={7}
              style={{ flex: 1 }}
              rightSection={
                barcode ? (
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => { setBarcode(''); setPlant(null); setYearWarning(false); barcodeRef.current?.focus() }}>
                    <IconX size={14} />
                  </ActionIcon>
                ) : null
              }
            />
            <Button onClick={() => doLookup(barcode)} loading={loading} color="indigo">
              Look up
            </Button>
          </Group>
          {yearWarning && (
            <Alert icon={<IconAlertCircle size={14} />} color="red" variant="filled" p="xs">
              ⚠ This barcode starts with "{barcode.slice(0, 2)}" — that indicates 20{barcode.slice(0, 2)}, not the current year ({currentYear}). Are you sure this is correct?
            </Alert>
          )}
        </Stack>
      </Paper>

      {plant && (
        <>
          {/* Update control — prominent, above data */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              {/* Star: genotype */}
              <Group gap="sm" align="baseline">
                <Text size="xl" fw={800}>{plant.genotype ?? '—'}</Text>
                {plant.site && <Badge variant="light" color="indigo">{plant.site}</Badge>}
                {plant.stage && <Badge variant="light" color="green">{plant.stage}</Badge>}
              </Group>

              <Text size="sm" c="dimmed">
                Recording <strong>{PROPERTY_LABELS[selectedProp]}</strong> for barcode <strong>{plant.barcode}</strong>
              </Text>

              <Divider />

              <Stack gap={6}>
                <Group align="flex-end">
                  <Select
                    label="Measurement"
                    data={PROPERTIES.map((p) => ({ value: p, label: PROPERTY_LABELS[p] }))}
                    value={selectedProp}
                    onChange={(v) => {
                    const p = v as Property
                    setSelectedProp(p)
                    sessionStorage.setItem('fqlab_prop', p)
                    setRangeError('')
                    setOverride(false)
                  }}
                    w={180}
                  />
                  <NumberInput
                    ref={valueRef}
                    label={`${PROPERTY_LABELS[selectedProp]} value`}
                    placeholder="Enter reading"
                    value={inputValue}
                    onChange={handleValueChange}
                    decimalScale={3}
                    step={0.1}
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={handleSubmit}
                    loading={submitting}
                    color={override ? 'orange' : 'indigo'}
                    h={36}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {override ? 'Override & Save' : `Save ${PROPERTY_LABELS[selectedProp]}`}
                  </Button>
                </Group>
                {/* Fixed-height error area — never shifts layout */}
                <Box h={20}>
                  {rangeError && (
                    <Text size="xs" c={override ? 'orange' : 'red'}>
                      {override
                        ? 'Range warning acknowledged — click Save again to confirm.'
                        : `Out of expected range (${getRangeForProp(selectedProp)?.min}–${getRangeForProp(selectedProp)?.max})`}
                    </Text>
                  )}
                </Box>
              </Stack>
            </Stack>
          </Paper>

          {/* Sample data — two column grid */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Text fw={600} size="sm">Sample Data</Text>

              {/* Primary fields full-width prominent */}
              <SimpleGrid cols={3} spacing="md">
                {PRIMARY_FIELDS.map(({ key, label }) => (
                  <FieldCell key={key} label={label} value={plant[key]} />
                ))}
              </SimpleGrid>

              <Divider />

              {/* Secondary fields two-column compact */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                {SECONDARY_FIELDS.map(({ key, label }) => (
                  <FieldCell key={key} label={label} value={plant[key]} />
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  )
}
