import { useState } from 'react'
import {
  Autocomplete, Button, Title, Stack, Group, Paper, Text, Tabs,
  Table, Loader, Center, Alert, Badge, ScrollArea,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { searchGenotype, listGenotypes } from '../api/genotypes'

const CATEGORY_LABELS: Record<string, string> = {
  ranks: 'Rankings',
  yields: 'Yield',
  scores: 'Flavor Scores',
  fruit_quality: 'Fruit Quality',
}

// Columns to hide entirely
const HIDDEN_COLS = new Set(['id'])

// Columns that should appear first (in this order), rest follow
const PRIORITY_COLS = ['location', 'season', 'genotype']

function orderColumns(cols: string[]): string[] {
  const visible = cols.filter((c) => !HIDDEN_COLS.has(c))
  const priority = PRIORITY_COLS.filter((c) => visible.includes(c))
  const rest = visible.filter((c) => !PRIORITY_COLS.includes(c))
  return [...priority, ...rest]
}

function sortRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    // Sort by location asc, then season desc (more recent first)
    const locA = String(a.location ?? '')
    const locB = String(b.location ?? '')
    if (locA !== locB) return locA.localeCompare(locB)
    const seaA = String(a.season ?? '')
    const seaB = String(b.season ?? '')
    return seaB.localeCompare(seaA)
  })
}

// Group rows by location for display
function groupByLocation(rows: Record<string, unknown>[]) {
  const groups: { location: string; rows: Record<string, unknown>[] }[] = []
  for (const row of rows) {
    const loc = String(row.location ?? '—')
    const existing = groups.find((g) => g.location === loc)
    if (existing) existing.rows.push(row)
    else groups.push({ location: loc, rows: [row] })
  }
  // Sort each group's rows by season desc
  for (const g of groups) {
    g.rows.sort((a, b) => String(b.season ?? '').localeCompare(String(a.season ?? '')))
  }
  // Sort groups by most recent season desc
  groups.sort((a, b) => {
    const latestA = String(a.rows[0]?.season ?? '')
    const latestB = String(b.rows[0]?.season ?? '')
    return latestB.localeCompare(latestA)
  })
  return groups
}

export function SearchPedigree() {
  const [inputValue, setInputValue] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [exactError, setExactError] = useState('')
  const [results, setResults] = useState<Record<string, Record<string, unknown>[]> | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [debounced] = useDebouncedValue(inputValue, 250)

  // Lazy-load autocomplete suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ['genotype-autocomplete', debounced],
    queryFn: () => listGenotypes(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  const handleSearch = async (value?: string) => {
    const q = (value ?? inputValue).trim()
    if (!q) return

    // Enforce exact match
    if (!suggestions.some((s) => s.toLowerCase() === q.toLowerCase())) {
      // Try a fresh exact check via the full list
      const fresh = await listGenotypes(q)
      const exact = fresh.find((s) => s.toLowerCase() === q.toLowerCase())
      if (!exact) {
        setExactError(`"${q}" is not a known genotype. Please select from the suggestions.`)
        setResults(null)
        return
      }
    }
    setExactError('')
    setCommittedQuery(q)
    setSearching(true)
    setSearchError('')
    try {
      const data = await searchGenotype(q)
      setResults(data)
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  const totalResults = results
    ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  const nonEmptyCategories = results
    ? Object.entries(results).filter(([, rows]) => rows.length > 0)
    : []

  return (
    <Stack>
      <Title order={3}>Search Pedigree Database</Title>

      <Paper withBorder p="md" radius="md">
        <Stack gap="xs">
          <Group align="flex-start">
            <Autocomplete
              placeholder="Type a genotype name..."
              leftSection={<IconSearch size={16} />}
              value={inputValue}
              onChange={(v) => { setInputValue(v); setExactError('') }}
              onOptionSubmit={(v) => { setInputValue(v); handleSearch(v) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              data={suggestions}
              style={{ flex: 1 }}
              error={exactError || undefined}
            />
            <Button onClick={() => handleSearch()} loading={searching}>Search</Button>
          </Group>
          <Text size="xs" c="dimmed">Start typing to see matching genotypes. You must select an exact match before searching.</Text>
        </Stack>
      </Paper>

      {searchError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">{searchError}</Alert>
      )}

      {searching && <Center p="xl"><Loader /></Center>}

      {results && !searching && (
        <>
          <Group>
            <Text size="sm" c="dimmed">
              {totalResults} result{totalResults !== 1 ? 's' : ''} for <strong>{committedQuery}</strong>
            </Text>
            {nonEmptyCategories.map(([cat, rows]) => (
              <Badge key={cat} variant="light" size="sm">
                {CATEGORY_LABELS[cat] ?? cat}: {rows.length}
              </Badge>
            ))}
          </Group>

          {totalResults === 0 ? (
            <Paper withBorder p="xl" radius="md">
              <Center><Text c="dimmed">No results found for "{committedQuery}"</Text></Center>
            </Paper>
          ) : (
            <Tabs defaultValue={nonEmptyCategories[0]?.[0]}>
              <Tabs.List>
                {nonEmptyCategories.map(([cat, rows]) => (
                  <Tabs.Tab key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] ?? cat}
                    <Badge size="xs" ml={6} variant="light">{rows.length}</Badge>
                  </Tabs.Tab>
                ))}
              </Tabs.List>

              {nonEmptyCategories.map(([cat, rows]) => {
                const allCols = rows.length > 0 ? Object.keys(rows[0]) : []
                const columns = orderColumns(allCols)
                const groups = groupByLocation(sortRows(rows))

                return (
                  <Tabs.Panel key={cat} value={cat} pt="md">
                    <Stack gap="sm">
                      {groups.map((group) => (
                        <Paper key={group.location} withBorder radius="md" style={{ overflow: 'hidden' }}>
                          <Group px="sm" py={6} bg="var(--mantine-color-default-hover)">
                            <Text fw={600} size="sm">{group.location}</Text>
                            <Badge size="xs" variant="light">{group.rows.length} record{group.rows.length !== 1 ? 's' : ''}</Badge>
                          </Group>
                          <ScrollArea>
                            <Table striped highlightOnHover withTableBorder>
                              <Table.Thead>
                                <Table.Tr>
                                  {columns.filter((c) => c !== 'location').map((col) => (
                                    <Table.Th key={col} style={{ whiteSpace: 'nowrap' }}>{col}</Table.Th>
                                  ))}
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {group.rows.map((row, i) => (
                                  <Table.Tr key={i}>
                                    {columns.filter((c) => c !== 'location').map((col) => (
                                      <Table.Td key={col} fz="xs" style={{ whiteSpace: 'nowrap' }}>
                                        {row[col] !== null && row[col] !== undefined
                                          ? String(row[col])
                                          : <Text c="dimmed" fz="xs">—</Text>}
                                      </Table.Td>
                                    ))}
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </ScrollArea>
                        </Paper>
                      ))}
                    </Stack>
                  </Tabs.Panel>
                )
              })}
            </Tabs>
          )}
        </>
      )}
    </Stack>
  )
}
