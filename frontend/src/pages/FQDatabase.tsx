import { useState } from 'react'
import {
  Title, Stack, Group, Button, SegmentedControl, TextInput, Table,
  Pagination, Modal, Select, NumberInput, Text, ActionIcon, Badge,
  Paper, Loader, Center, Popover, Checkbox, ScrollArea, Divider, Grid, Switch,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { IconDownload, IconTrash, IconEdit, IconPlus, IconX, IconSearch, IconColumns } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlantRecord, Filter } from '../api/plantData'
import { getPlantData, deletePlantData, addPlantData, pivotFruitQuality } from '../api/plantData'
import { getOptions } from '../api/options'
import { SelectWithAdd } from '../components/SelectWithAdd'

const PAGE_SIZE = 20

const FILTERABLE_FIELDS = [
  'barcode', 'genotype', 'stage', 'site', 'block', 'project',
  'post_harvest', 'bush_plant_number', 'notes',
]

const ALL_COLUMNS: { key: keyof PlantRecord; label: string; required?: boolean }[] = [
  { key: 'barcode', label: 'Barcode', required: true },
  { key: 'genotype', label: 'Genotype', required: true },
  { key: 'stage', label: 'Stage' },
  { key: 'site', label: 'Site' },
  { key: 'block', label: 'Block' },
  { key: 'project', label: 'Project' },
  { key: 'post_harvest', label: 'Post Harvest' },
  { key: 'bush_plant_number', label: 'Bush/Plant #' },
  { key: 'mass', label: 'Mass (g)' },
  { key: 'number_of_berries', label: '# Berries' },
  { key: 'x_berry_mass', label: 'Avg Berry Mass' },
  { key: 'box', label: 'Box' },
  { key: 'ph', label: 'pH' },
  { key: 'brix', label: 'Brix' },
  { key: 'tta', label: 'TTA' },
  { key: 'juicemass', label: 'Juice Mass' },
  { key: 'mladded', label: 'mL Added' },
  { key: 'avg_firmness', label: 'Avg Firmness' },
  { key: 'avg_diameter', label: 'Avg Diameter' },
  { key: 'sd_firmness', label: 'SD Firmness' },
  { key: 'sd_diameter', label: 'SD Diameter' },
  { key: 'notes', label: 'Notes' },
  { key: 'week', label: 'Week' },
  { key: 'timestamp', label: 'Timestamp', required: true },
  { key: 'fruitfirm_timestamp', label: 'FirmTimestamp' },
]

const DEFAULT_VISIBLE = new Set<keyof PlantRecord>([
  'barcode', 'genotype', 'stage', 'site', 'block', 'project', 'mass', 'ph', 'brix', 'tta', 'week', 'timestamp',
])

function loadVisibleCols(): Set<keyof PlantRecord> {
  try {
    const stored = localStorage.getItem('fqdb_columns')
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE)
}

function saveVisibleCols(cols: Set<keyof PlantRecord>) {
  localStorage.setItem('fqdb_columns', JSON.stringify([...cols]))
}

function QueryBuilder({ filters, onChange }: { filters: Filter[]; onChange: (f: Filter[]) => void }) {
  const add = () => onChange([...filters, { field: 'genotype', operator: 'includes', value: '' }])
  const remove = (i: number) => onChange(filters.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<Filter>) =>
    onChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))

  return (
    <Stack gap="xs">
      {filters.map((f, i) => (
        <Group key={i} gap="xs">
          <Select data={FILTERABLE_FIELDS} value={f.field} onChange={(v) => update(i, { field: v! })} w={150} size="xs" />
          <Select data={['includes', 'excludes']} value={f.operator} onChange={(v) => update(i, { operator: v as Filter['operator'] })} w={110} size="xs" />
          <TextInput value={f.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="value" size="xs" style={{ flex: 1 }} />
          <ActionIcon color="red" variant="subtle" onClick={() => remove(i)} size="sm"><IconX size={14} /></ActionIcon>
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
  const { data: optionConfigs = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })

  const optionsFor = (type: string) =>
    optionConfigs.filter((o) => o.option_type === type).map((o) => ({ value: o.option_text, label: o.option_text }))

  const setField = (field: string) => (v: unknown) => setForm((f) => ({ ...f, [field]: v }))

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
      {/* Identity */}
      <Text fw={600} size="sm">Identity</Text>
      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Barcode" value={form.barcode ?? ''} disabled />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput label="Genotype" value={form.genotype ?? ''} onChange={(e) => setField('genotype')(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={4}>
          <SelectWithAdd label="Stage" optionType="stage" data={optionsFor('stage')} value={form.stage ?? null} onChange={setField('stage')} clearable />
        </Grid.Col>
        <Grid.Col span={4}>
          <SelectWithAdd label="Site" optionType="site" data={optionsFor('site')} value={form.site ?? null} onChange={setField('site')} clearable />
        </Grid.Col>
        <Grid.Col span={4}>
          <SelectWithAdd label="Block" optionType="block" data={optionsFor('block')} value={form.block ?? null} onChange={setField('block')} clearable />
        </Grid.Col>
        <Grid.Col span={4}>
          <SelectWithAdd label="Project" optionType="project" data={optionsFor('project')} value={form.project ?? null} onChange={setField('project')} clearable />
        </Grid.Col>
        <Grid.Col span={4}>
          <SelectWithAdd label="Post Harvest" optionType="post_harvest" data={optionsFor('post_harvest')} value={form.post_harvest ?? null} onChange={setField('post_harvest')} clearable />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput label="Bush / Plant #" value={form.bush_plant_number ?? ''} onChange={(e) => setField('bush_plant_number')(e.target.value)} />
        </Grid.Col>
      </Grid>

      <Divider label="Yield" labelPosition="left" />
      <Grid>
        <Grid.Col span={4}>
          <NumberInput label="Mass (g)" value={form.mass ?? ''} onChange={setField('mass')} decimalScale={2} step={0.1} />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput label="# Berries" value={form.number_of_berries ?? ''} onChange={setField('number_of_berries')} />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput label="Avg Berry Mass (g)" value={form.x_berry_mass ?? ''} onChange={setField('x_berry_mass')} decimalScale={2} step={0.1} />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput label="Box" value={form.box ?? ''} onChange={setField('box')} />
        </Grid.Col>
      </Grid>

      <Divider label="Fruit Quality" labelPosition="left" />
      <Grid>
        <Grid.Col span={4}><NumberInput label="pH" value={form.ph ?? ''} onChange={setField('ph')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={4}><NumberInput label="Brix" value={form.brix ?? ''} onChange={setField('brix')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={4}><NumberInput label="TTA" value={form.tta ?? ''} onChange={setField('tta')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={4}><NumberInput label="Juice Mass (g)" value={form.juicemass ?? ''} onChange={setField('juicemass')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={4}><NumberInput label="mL Added" value={form.mladded ?? ''} onChange={setField('mladded')} decimalScale={3} step={0.1} /></Grid.Col>
      </Grid>

      <Divider label="Firmness" labelPosition="left" />
      <Grid>
        <Grid.Col span={3}><NumberInput label="Avg Firmness" value={form.avg_firmness ?? ''} onChange={setField('avg_firmness')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={3}><NumberInput label="Avg Diameter" value={form.avg_diameter ?? ''} onChange={setField('avg_diameter')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={3}><NumberInput label="SD Firmness" value={form.sd_firmness ?? ''} onChange={setField('sd_firmness')} decimalScale={3} step={0.1} /></Grid.Col>
        <Grid.Col span={3}><NumberInput label="SD Diameter" value={form.sd_diameter ?? ''} onChange={setField('sd_diameter')} decimalScale={3} step={0.1} /></Grid.Col>
      </Grid>

      <Divider label="Notes" labelPosition="left" />
      <TextInput value={form.notes ?? ''} onChange={(e) => setField('notes')(e.target.value)} />

      <Group justify="flex-end" mt="sm">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} color="indigo">Save Changes</Button>
      </Group>
    </Stack>
  )
}

function ColumnPicker({ visible, onChange }: { visible: Set<keyof PlantRecord>; onChange: (s: Set<keyof PlantRecord>) => void }) {
  const toggle = (key: keyof PlantRecord, required?: boolean) => {
    if (required) return
    const next = new Set(visible)
    next.has(key) ? next.delete(key) : next.add(key)
    onChange(next)
    saveVisibleCols(next)
  }

  return (
    <Popover width={220} position="bottom-end" shadow="md" withArrow>
      <Popover.Target>
        <Button leftSection={<IconColumns size={16} />} variant="light" size="sm">Columns</Button>
      </Popover.Target>
      <Popover.Dropdown>
        <ScrollArea h={320}>
          <Stack gap={6}>
            {ALL_COLUMNS.map(({ key, label, required }) => (
              <Checkbox
                key={key}
                label={label}
                checked={visible.has(key)}
                onChange={() => toggle(key, required)}
                disabled={required}
                size="xs"
              />
            ))}
          </Stack>
        </ScrollArea>
        <Divider my="xs" />
        <Group justify="space-between">
          <Button size="xs" variant="subtle" onClick={() => { const all = new Set(ALL_COLUMNS.map(c => c.key)); onChange(all); saveVisibleCols(all) }}>All</Button>
          <Button size="xs" variant="subtle" onClick={() => { onChange(new Set(DEFAULT_VISIBLE)); saveVisibleCols(new Set(DEFAULT_VISIBLE)) }}>Reset</Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  )
}

export function FQDatabase() {
  const currentYearPrefix = new Date().getFullYear().toString().slice(-2)

  const [view, setView] = useState<'table' | 'yield'>('table')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilters, setActiveFilters] = useState<Filter[]>([])
  const [currentYearOnly, setCurrentYearOnly] = useState(true)
  const [editPlant, setEditPlant] = useState<PlantRecord | null>(null)
  const [editOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const [yieldSearch, setYieldSearch] = useState('')
  const [visibleCols, setVisibleCols] = useState<Set<keyof PlantRecord>>(loadVisibleCols)
  const qc = useQueryClient()

  const activeYearPrefix = currentYearOnly ? currentYearPrefix : undefined

  const displayCols = ALL_COLUMNS.filter((c) => visibleCols.has(c.key))

  const { data: tableData, isFetching: tableFetching } = useQuery({
    queryKey: ['plant-data', page, activeFilters, activeYearPrefix],
    queryFn: () => getPlantData(page, PAGE_SIZE, activeFilters, activeYearPrefix),
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
      children: <Text size="sm">Delete barcode <strong>{record.barcode}</strong> ({record.genotype})? This cannot be undone.</Text>,
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

  // Stream download directly through the browser — no JS buffering, handles any dataset size
  const handleDownload = (type: 'data' | 'yield') => {
    let url: string
    if (type === 'data') {
      const params = new URLSearchParams()
      if (activeYearPrefix) params.set('year_prefix', activeYearPrefix)
      if (activeFilters.length) params.set('filters', JSON.stringify(activeFilters))
      const qs = params.toString()
      url = `/api/download_plant_data_csv${qs ? `?${qs}` : ''}`
    } else {
      url = '/api/download_yield'
    }
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'data' ? 'plant_data.csv' : 'yield.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const applyFilters = () => { setActiveFilters(filters); setPage(1) }
  const clearFilters = () => { setFilters([]); setActiveFilters([]); setPage(1) }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>FQ Database</Title>
        <Group>
          <Switch
            label={`20${currentYearPrefix} only`}
            checked={currentYearOnly}
            onChange={(e) => { setCurrentYearOnly(e.currentTarget.checked); setPage(1) }}
            size="sm"
          />
          <Button
            leftSection={<IconDownload size={16} />}
            variant="light"
            size="sm"
            onClick={() => handleDownload(view === 'yield' ? 'yield' : 'data')}
          >
            Export CSV
          </Button>
          {view === 'table' && <ColumnPicker visible={visibleCols} onChange={setVisibleCols} />}
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
              {activeFilters.length > 0 && <Button size="xs" variant="subtle" color="red" onClick={clearFilters}>Clear</Button>}
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
        {(tableFetching || yieldFetching) && <Center p="xl"><Loader size="sm" /></Center>}

        {view === 'table' && tableData && !tableFetching && (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  {displayCols.map((col) => <Table.Th key={col.key} style={{ whiteSpace: 'nowrap' }}>{col.label}</Table.Th>)}
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tableData.data?.map((row: PlantRecord) => (
                  <Table.Tr key={row.id}>
                    {displayCols.map((col) => (
                      <Table.Td key={col.key} fz="xs" style={{ whiteSpace: 'nowrap' }}>
                        {row[col.key] !== null && row[col.key] !== undefined
                          ? col.key === 'timestamp' || col.key === 'fruitfirm_timestamp'
                            ? new Date(row[col.key] as string).toLocaleString()
                            : String(row[col.key])
                          : <Text c="dimmed" fz="xs">—</Text>}
                      </Table.Td>
                    ))}
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" onClick={() => { setEditPlant(row); openEdit() }}><IconEdit size={14} /></ActionIcon>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(row)}><IconTrash size={14} /></ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {view === 'yield' && yieldData && !yieldFetching && (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  {yieldData.data?.[0] && Object.keys(yieldData.data[0]).map((col: string) => (
                    <Table.Th key={col} style={{ whiteSpace: 'nowrap' }}>{col}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {yieldData.data?.map((row: Record<string, unknown>, i: number) => (
                  <Table.Tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <Table.Td key={j} fz="xs">{typeof val === 'number' ? val.toFixed(2) : String(val ?? '—')}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      <Group justify="center">
        <Pagination
          total={view === 'table'
            ? Math.ceil((tableData?.total || 0) / PAGE_SIZE)
            : Math.ceil((yieldData?.total || 0) / PAGE_SIZE)}
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
