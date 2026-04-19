import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Stack,
  Group,
  Title,
  Text,
  Paper,
  SegmentedControl,
  Table,
  Badge,
  Skeleton,
  ThemeIcon,
  SimpleGrid,
  Progress,
  Tooltip,
  Center,
  Divider,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconBarcode,
  IconDatabaseImport,
  IconDroplet,
  IconDeviceWatch,
  IconPlant2,
} from '@tabler/icons-react'
import { getMostRecentDate, getOverviewStats, getOverviewProjects } from '../api/overview'

type Mode = 'recent' | 'week' | 'season'

function formatDateLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function dateRangeForMode(mode: Mode, recentDate: string | null, pickedDate: Date | null): { start?: string; end?: string } {
  const today = new Date()
  if (mode === 'recent' && recentDate) {
    return { start: recentDate, end: isoDate(new Date(new Date(recentDate + 'T00:00:00').getTime() + 86400000)) }
  }
  if (mode === 'week') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    return { start: isoDate(d) }
  }
  if (mode === 'season') {
    if (pickedDate) {
      const next = new Date(pickedDate.getTime() + 86400000)
      return { start: isoDate(pickedDate), end: isoDate(next) }
    }
    return { start: `${today.getFullYear()}-01-01` }
  }
  return {}
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
  loading,
}: {
  label: string
  value: number | undefined
  icon: React.ReactNode
  color: string
  sub?: string
  loading: boolean
}) {
  return (
    <Paper withBorder p="lg" radius="md" style={{ borderLeft: `4px solid var(--mantine-color-${color}-6)` }}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
        <ThemeIcon variant="light" color={color} size="md" radius="md">
          {icon}
        </ThemeIcon>
      </Group>
      {loading ? (
        <Skeleton height={36} width={80} mt={4} />
      ) : (
        <Text fz={36} fw={700} lh={1}>
          {value?.toLocaleString() ?? '—'}
        </Text>
      )}
      {sub && (
        <Text size="xs" c="dimmed" mt={6}>
          {sub}
        </Text>
      )}
    </Paper>
  )
}

function CompletionBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <Tooltip label={`${value} / ${total} barcodes (${pct}%)`} withArrow>
      <div>
        <Progress value={pct} color={color} size="sm" radius="xl" />
      </div>
    </Tooltip>
  )
}

export function Overview() {
  const [mode, setMode] = useState<Mode>('recent')
  const [pickedDate, setPickedDate] = useState<Date | null>(null)

  const queryClient = useQueryClient()

  const { data: recentDateData } = useQuery({
    queryKey: ['overview-recent-date'],
    queryFn: getMostRecentDate,
    refetchInterval: 60_000,
    select: (data) => {
      const prev = queryClient.getQueryData<typeof data>(['overview-recent-date'])
      if (prev && prev.date !== data.date) {
        queryClient.invalidateQueries({ queryKey: ['overview-stats'] })
        queryClient.invalidateQueries({ queryKey: ['overview-projects'] })
      }
      return data
    },
  })

  const recentDate = recentDateData?.date ?? null
  const dateParams = dateRangeForMode(mode, recentDate, pickedDate)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['overview-stats', dateParams],
    queryFn: () => getOverviewStats(dateParams),
    enabled: mode !== 'recent' || !!recentDate,
    refetchInterval: 60_000,
  })

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['overview-projects', dateParams],
    queryFn: () => getOverviewProjects(dateParams),
    enabled: mode !== 'recent' || !!recentDate,
    refetchInterval: 60_000,
  })

  const today = isoDate(new Date())

  function relativeDay(iso: string) {
    const diffDays = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(iso + 'T00:00:00').getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays > 1) return `${diffDays} days ago`
    return null
  }

  const titleDate = (() => {
    if (mode === 'recent' && recentDate) return formatDateLabel(recentDate)
    if (mode === 'week') return 'Last 7 Days'
    if (mode === 'season' && pickedDate) return formatDateLabel(isoDate(pickedDate))
    if (mode === 'season') return `${new Date().getFullYear()} Season`
    return '—'
  })()

  const titleRelative = (() => {
    if (mode === 'recent' && recentDate) return relativeDay(recentDate)
    if (mode === 'season' && pickedDate) return relativeDay(isoDate(pickedDate))
    return null
  })()

  const subtitle = (() => {
    if (mode === 'recent') return 'Most recent day for which data was collected'
    if (mode === 'week') {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - 6)
      return `${isoDate(weekStart)} → ${today}`
    }
    if (mode === 'season' && pickedDate) return `Filtered to a specific date within the ${new Date().getFullYear()} season`
    if (mode === 'season') return `All data collected in the ${new Date().getFullYear()} season`
    return null
  })()


  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Group gap="xs" align="baseline">
            <Title order={2} fw={700}>
              Overview of {titleDate}
            </Title>
            {titleRelative && (
              <Text size="sm" c="dimmed" fw={500}>
                ({titleRelative})
              </Text>
            )}
          </Group>
          {subtitle && (
            <Text c="dimmed" size="sm" mt={2}>
              {subtitle}
            </Text>
          )}
        </div>
        <Group align="flex-end" gap="sm">
          <SegmentedControl
            value={mode}
            onChange={(v) => { setMode(v as Mode); setPickedDate(null) }}
            data={[
              { label: 'Most Recent', value: 'recent' },
              { label: 'Last 7 Days', value: 'week' },
              { label: 'Whole Season', value: 'season' },
            ]}
            size="sm"
          />
          {mode === 'season' && (
            <DatePickerInput
              placeholder="Filter to a date"
              value={pickedDate}
              onChange={(v) => setPickedDate(v ? new Date(v) : null)}
              size="sm"
              w={170}
              clearable
            />
          )}
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard
          label="Barcodes Created"
          value={stats?.barcodes_created}
          icon={<IconBarcode size={16} />}
          color="blue"
          sub="New Barcodes defined in Add Samples"
          loading={statsLoading}
        />
        <StatCard
          label="Data Collected (All Types)"
          value={stats?.data_collected}
          icon={<IconDatabaseImport size={16} />}
          color="teal"
          sub="Events where either the FruitFirm or a User Updated Data"
          loading={statsLoading}
        />
        <StatCard
          label="pH Collected"
          value={stats?.ph_collected}
          icon={<IconDroplet size={16} />}
          color="grape"
          sub="pH recording events"
          loading={statsLoading}
        />
        <StatCard
          label="FruitFirm Data"
          value={stats?.fruitfirm_collected}
          icon={<IconDeviceWatch size={16} />}
          color="orange"
          sub="Barcodes for which the FruitFirm has returned data"
          loading={statsLoading}
        />
      </SimpleGrid>

      <Paper withBorder radius="md" p="lg">
        <Group mb="md" gap="xs">
          <ThemeIcon variant="light" color="green" size="md" radius="md">
            <IconPlant2 size={16} />
          </ThemeIcon>
          <Title order={5}>By Project</Title>
          <Text size="xs" c="dimmed" ml={4}>
            — barcodes with each data type collected (unique barcodes)
          </Text>
        </Group>

        <Divider mb="md" />

        {projectsLoading ? (
          <Stack gap="xs">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={36} />
            ))}
          </Stack>
        ) : !projects || projects.length === 0 ? (
          <Center py="xl">
            <Text c="dimmed" size="sm">
              No data for this period
            </Text>
          </Center>
        ) : (
          <Table highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Project</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>
                  <Badge variant="light" color="blue" size="sm">
                    Created
                  </Badge>
                </Table.Th>
                <Table.Th>
                  <Badge variant="light" color="grape" size="sm">
                    pH
                  </Badge>
                </Table.Th>
                <Table.Th>
                  <Badge variant="light" color="cyan" size="sm">
                    Mass
                  </Badge>
                </Table.Th>
                <Table.Th>
                  <Badge variant="light" color="yellow" size="sm">
                    Brix
                  </Badge>
                </Table.Th>
                <Table.Th>
                  <Badge variant="light" color="red" size="sm">
                    TTA
                  </Badge>
                </Table.Th>
                <Table.Th>
                  <Badge variant="light" color="orange" size="sm">
                    FruitFirm
                  </Badge>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {projects.map((row) => (
                <Table.Tr key={row.project}>
                  <Table.Td fw={600}>{row.project}</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge variant="filled" color="blue" size="sm">
                      {row.barcodes_created}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" w={28} style={{ textAlign: 'right' }}>
                        {row.ph}
                      </Text>
                      <div style={{ flex: 1, minWidth: 60 }}>
                        <CompletionBar value={row.ph} total={row.barcodes_created} color="grape" />
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" w={28} style={{ textAlign: 'right' }}>
                        {row.mass}
                      </Text>
                      <div style={{ flex: 1, minWidth: 60 }}>
                        <CompletionBar value={row.mass} total={row.barcodes_created} color="cyan" />
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" w={28} style={{ textAlign: 'right' }}>
                        {row.brix}
                      </Text>
                      <div style={{ flex: 1, minWidth: 60 }}>
                        <CompletionBar value={row.brix} total={row.barcodes_created} color="yellow" />
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" w={28} style={{ textAlign: 'right' }}>
                        {row.tta}
                      </Text>
                      <div style={{ flex: 1, minWidth: 60 }}>
                        <CompletionBar value={row.tta} total={row.barcodes_created} color="red" />
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" w={28} style={{ textAlign: 'right' }}>
                        {row.fruitfirm}
                      </Text>
                      <div style={{ flex: 1, minWidth: 60 }}>
                        <CompletionBar value={row.fruitfirm} total={row.barcodes_created} color="orange" />
                      </div>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  )
}
