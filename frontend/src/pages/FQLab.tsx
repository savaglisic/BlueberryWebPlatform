import { useState } from 'react'
import {
  TextInput, NumberInput, Select, Button, Paper, Title, Stack, Group,
  Table, Badge, Alert, Text, Divider,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getOptions } from '../api/options'
import type { PlantRecord } from '../api/plantData'
import { checkBarcode, addPlantData } from '../api/plantData'

const PROPERTIES = ['ph', 'brix', 'tta', 'juicemass', 'mladded'] as const
type Property = typeof PROPERTIES[number]

const RANGES: Record<string, { type: string; min: number; max: number }> = {
  ph: { type: 'ph_range', min: 3.0, max: 4.0 },
  brix: { type: 'brix_range', min: 8, max: 14 },
  tta: { type: 'tta_range', min: 0.5, max: 1.5 },
}

export function FQLab() {
  const [barcode, setBarcode] = useState('')
  const [plant, setPlant] = useState<PlantRecord | null>(null)
  const [selectedProp, setSelectedProp] = useState<Property>('ph')
  const [inputValue, setInputValue] = useState<number | string>('')
  const [rangeError, setRangeError] = useState('')
  const [override, setOverride] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: optionConfigs = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })

  const getRangeForProp = (prop: string) => {
    const rangeDef = RANGES[prop]
    if (!rangeDef) return null
    const config = optionConfigs.find((o) => o.option_type === rangeDef.type)
    if (!config) return { min: rangeDef.min, max: rangeDef.max }
    const parts = config.option_text.split('-').map(Number)
    return parts.length === 2 ? { min: parts[0], max: parts[1] } : { min: rangeDef.min, max: rangeDef.max }
  }

  const handleLookup = async () => {
    if (!barcode.trim()) return
    setLoading(true)
    try {
      const data = await checkBarcode(barcode.trim())
      if (data.error) {
        notifications.show({ message: 'Barcode not found', color: 'red' })
        setPlant(null)
      } else {
        setPlant(data)
        setInputValue('')
        setRangeError('')
        setOverride(false)
      }
    } catch {
      notifications.show({ message: 'Lookup failed', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

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
      notifications.show({ message: `${selectedProp.toUpperCase()} updated`, color: 'green', icon: <IconCheck size={16} /> })
      setPlant((p) => p ? { ...p, [selectedProp]: inputValue as number } : p)
      setInputValue('')
      setRangeError('')
      setOverride(false)
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  const fieldColor = (val: unknown) => (val === null || val === undefined || val === '') ? 'red' : undefined

  return (
    <Stack>
      <Title order={3}>FQ Lab</Title>

      <Paper withBorder p="md" radius="md">
        <Stack>
          <Group align="flex-end">
            <TextInput
              label="Barcode"
              placeholder="Scan or enter barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              style={{ flex: 1 }}
            />
            <Button onClick={handleLookup} loading={loading}>Look up</Button>
          </Group>

          {plant && (
            <>
              <Divider label="Plant Record" labelPosition="left" />
              <Table withTableBorder withColumnBorders fz="sm">
                <Table.Tbody>
                  {Object.entries(plant)
                    .filter(([k]) => !['id', 'timestamp', 'fruitfirm_timestamp'].includes(k))
                    .map(([key, val]) => (
                      <Table.Tr key={key}>
                        <Table.Td fw={500} w={160}>{key}</Table.Td>
                        <Table.Td c={fieldColor(val)}>
                          {val !== null && val !== undefined && val !== '' ? String(val) : <Text c="red" size="sm">—</Text>}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>

              <Divider label="Update Value" labelPosition="left" />
              <Group align="flex-end">
                <Select
                  label="Property"
                  data={PROPERTIES.map((p) => ({ value: p, label: p.toUpperCase() }))}
                  value={selectedProp}
                  onChange={(v) => { setSelectedProp(v as Property); setRangeError(''); setOverride(false) }}
                  w={140}
                />
                <NumberInput
                  label="Value"
                  value={inputValue}
                  onChange={handleValueChange}
                  decimalScale={3}
                  style={{ flex: 1 }}
                  error={rangeError && !override ? rangeError : undefined}
                />
                <Button onClick={handleSubmit} loading={submitting} color={override ? 'orange' : 'indigo'}>
                  {override ? 'Override & Save' : 'Save'}
                </Button>
              </Group>

              {rangeError && override && (
                <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
                  Range warning confirmed — click Save again to submit.
                </Alert>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  )
}
