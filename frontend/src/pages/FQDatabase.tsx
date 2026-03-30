import { useState, useCallback } from 'react'
import {
  Title, Stack, Group, Button, SegmentedControl, TextInput, Table,
  Pagination, Modal, Select, NumberInput, Text, ActionIcon, Badge,
  Paper, Tooltip, Loader, Center, Divider,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { IconDownload, IconTrash, IconEdit, IconPlus, IconX, IconSearch } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlantRecord, Filter } from '../api/plantData'
import { getPlantData, deletePlantData, addPlantData, pivotFruitQuality, downloadPlantDataCsv, downloadYield } from '../api/plantData'

const PAGE_SIZE = 20

const FILTERABLE_FIELDS = [
  'barcode', 'genotype', 'stage', 'site', 'block', 'project',
  'post_harvest', 'bush_plant_number', 'notes',
]

const DISPLAY_COLUMNS: { key: keyof PlantRecord; label: string }[] = [
  { key: 'barcode', label: 'Barcode' },
  { key: 'genotype', label: 'Genotype' },
  { key: 'stage', label: 'Stage' },
  { key: 'site', label: 'Site' },
  { key: 'block', label: 'Block' },
  { key: 'mass', label: 'Mass' },
  { key: 'number_of_berries', label: 'Berries' },
  { key: 'ph', label: 'pH' },
  { key: 'brix', label: 'Brix' },
  { key: 'tta', label: 'TTA' },
  { key: 'avg_firmness', label: 'Firmness' },
  { key: 'week', label: 'Week' },
  { key: 'timestamp', label: 'Timestamp' },
]

function QueryBuilder({ filters, onChange }: { filters: Filter[]; onChange: (f: Filter[]) => void }) {
  const add = () => onChange([...filters, { field: 'genotype', operator: 'includes', value: '' }])
  const remove = (i: number) => onChange(filters.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<Filter>) =>
    onChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  return (
    <Stack gap="xs">
      {filters.map((f, i) => (
        <Group key={i} gap="xs">
          <Select
            data={FILTERABLE_FIELDS}
            value={f.field}
            onChange={(v) => update(i, { field: v! })}
            w={150}
            size="xs"
          />
          <Select
            data={['includes', 'excludes']}
            value={f.operator}
            onChange={(v) => update(i, { operator: v as Filter['operator'] })}
            w={110}
            size="xs"
          />
          <TextInput
            value={f.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="value"
            size="xs"
            style={{ flex: 1 }}
          />
          <ActionIcon color="red" variant="subtle" onClick={() => remove(i)} size="sm">
            <IconX size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button leftSection={<IconPlus size={14} />} variant="subtle" size="xs" onClick={add} w="fit-content">
        Add filter
      </Button>
    </Stack>
  )
}

function EditModal({ plant, onClose }: { plant: PlantRecord; onClose: () => void }) {
  const [form, setForm] = useState<Partial<PlantRecord>>(plant)
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const numericFields = ['mass', 'number_of_berries', 'x_berry_mass', 'ph', 'brix', 'tta', 'juicemass', 'mladded', 'avg_firmness', 'avg_diameter']

  const handleSave = async () => {
    setSaving(true)
    try {
      await addPlantData({ ...form, barcode: plant.barcode } as any)
      qc.invalidateQueries({ queryKey: ['plant-data'] })
      notifications.show({ message: 'Record updated', color: 'green' })
      onClose()
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack>
      <Group grow>
        {numericFields.map((field) => (
          <NumberInput
            key={field}
            label={field}
            value={(form as any)[field] ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, [field]: v }))}
            decimalScale={3}
            size="xs"
          />
        ))}
      </Group>
      <TextInput label="notes" value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} size="xs" />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} color="green">Save</Button>
      </Group>
    </Stack>
  )
}

export function FQDatabase() {
  const [view, setView] = useState<'table' | 'yield'>('table')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilters, setActiveFilters] = useState<Filter[]>([])
  const [editPlant, setEditPlant] = useState<PlantRecord | null>(null)
  const [editOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [yieldSearch, setYieldSearch] = useState('')
  const qc = useQueryClient()

  const { data: tableData, isFetching: tableFetching } = useQuery({
    queryKey: ['plant-data', page, activeFilters],
    queryFn: () => getPlantData(page, PAGE_SIZE, activeFilters),
    enabled: view === 'table',
  })

  const { data: yieldData, isFetching: yieldFetching } = useQuery({
    queryKey: ['yield-pivot', page, yieldSearch],
    queryFn: () => pivotFruitQuality(page, PAGE_SIZE, yieldSearch),
    enabled: view === 'yield',
  })

  const handleDelete = (record: PlantRecord) => {
    modals.openConfirmModal({
      title: 'Delete record',
      children: <Text size="sm">Delete record for barcode <strong>{record.barcode}</strong> ({record.genotype})? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deletePlantData(record.barcode)
          qc.invalidateQueries({ queryKey: ['plant-data'] })
          notifications.show({ message: 'Record deleted', color: 'green' })
        } catch {
          notifications.show({ message: 'Delete failed', color: 'red' })
        }
      },
    })
  }

  const handleDownload = async (type: 'data' | 'yield') => {
    try {
      const blob = type === 'data' ? await downloadPlantDataCsv() : await downloadYield()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'data' ? 'plant_data.csv' : 'yield.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      notifications.show({ message: 'Download failed', color: 'red' })
    }
  }

  const applyFilters = () => { setActiveFilters(filters); setPage(1) }
  const clearFilters = () => { setFilters([]); setActiveFilters([]); setPage(1) }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>FQ Database</Title>
        <Group>
          <Button leftSection={<IconDownload size={16} />} variant="light" size="sm" onClick={() => handleDownload(view === 'yield' ? 'yield' : 'data')}>
            Export CSV
          </Button>
          <SegmentedControl
            value={view}
            onChange={(v) => { setView(v as any); setPage(1) }}
            data={[{ label: 'Records', value: 'table' }, { label: 'Yield Summary', value: 'yield' }]}
            size="sm"
          />
        </Group>
      </Group>

      {view === 'table' && (
        <Paper withBorder p="sm" radius="md">
          <Stack gap="xs">
            <Text fw={500} size="sm">Filters</Text>
            <QueryBuilder filters={filters} onChange={setFilters} />
            <Group>
              <Button size="xs" leftSection={<IconSearch size={14} />} onClick={applyFilters}>Apply</Button>
              {activeFilters.length > 0 && (
                <Button size="xs" variant="subtle" color="red" onClick={clearFilters}>Clear</Button>
              )}
            </Group>
            {activeFilters.length > 0 && (
              <Group gap="xs">
                {activeFilters.map((f, i) => (
                  <Badge key={i} variant="light" size="sm">{f.field} {f.operator} "{f.value}"</Badge>
                ))}
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {view === 'yield' && (
        <TextInput
          placeholder="Search genotype..."
          leftSection={<IconSearch size={16} />}
          value={yieldSearch}
          onChange={(e) => { setYieldSearch(e.target.value); setPage(1) }}
          w={300}
        />
      )}

      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        {(tableFetching || yieldFetching) && (
          <Center p="xl"><Loader size="sm" /></Center>
        )}

        {view === 'table' && tableData && !tableFetching && (
          <Table striped highlightOnHover withTableBorder stickyHeader>
            <Table.Thead>
              <Table.Tr>
                {DISPLAY_COLUMNS.map((col) => <Table.Th key={col.key}>{col.label}</Table.Th>)}
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tableData.data?.map((row: PlantRecord) => (
                <Table.Tr key={row.id}>
                  {DISPLAY_COLUMNS.map((col) => (
                    <Table.Td key={col.key} fz="xs">
                      {row[col.key] !== null && row[col.key] !== undefined
                        ? col.key === 'timestamp'
                          ? new Date(row.timestamp!).toLocaleString()
                          : String(row[col.key])
                        : <Text c="dimmed" fz="xs">—</Text>}
                    </Table.Td>
                  ))}
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon size="sm" variant="subtle" onClick={() => { setEditPlant(row); openEdit() }}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(row)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {view === 'yield' && yieldData && !yieldFetching && (
          <Table striped highlightOnHover withTableBorder stickyHeader>
            <Table.Thead>
              <Table.Tr>
                {yieldData.data?.[0] && Object.keys(yieldData.data[0]).map((col: string) => (
                  <Table.Th key={col}>{col}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {yieldData.data?.map((row: Record<string, unknown>, i: number) => (
                <Table.Tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <Table.Td key={j} fz="xs">
                      {typeof val === 'number' ? val.toFixed(2) : String(val ?? '—')}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Group justify="center">
        <Pagination
          total={view === 'table' ? Math.ceil((tableData?.total || 0) / PAGE_SIZE) : Math.ceil((yieldData?.total || 0) / PAGE_SIZE)}
          value={page}
          onChange={setPage}
          size="sm"
        />
      </Group>

      <Modal opened={editOpen} onClose={closeEdit} title={`Edit — ${editPlant?.barcode}`} size="lg">
        {editPlant && <EditModal plant={editPlant} onClose={closeEdit} />}
      </Modal>
    </Stack>
  )
}
