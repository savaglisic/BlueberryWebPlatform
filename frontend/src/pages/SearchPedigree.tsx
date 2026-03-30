import { useState } from 'react'
import {
  TextInput, Button, Title, Stack, Group, Paper, Text, Tabs,
  Table, Loader, Center, Alert, Badge,
} from '@mantine/core'
import { IconSearch, IconAlertCircle } from '@tabler/icons-react'
import { searchGenotype } from '../api/genotypes'

const CATEGORY_LABELS: Record<string, string> = {
  ranks: 'Rankings',
  yields: 'Yield',
  scores: 'Flavor Scores',
  fruit_quality: 'Fruit Quality',
}

export function SearchPedigree() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Record<string, Record<string, unknown>[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await searchGenotype(query.trim())
      setResults(data)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
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
        <Group>
          <TextInput
            placeholder="Enter genotype name..."
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1 }}
          />
          <Button onClick={handleSearch} loading={loading}>Search</Button>
        </Group>
      </Paper>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">{error}</Alert>
      )}

      {loading && <Center p="xl"><Loader /></Center>}

      {results && !loading && (
        <>
          <Group>
            <Text size="sm" c="dimmed">
              {totalResults} result{totalResults !== 1 ? 's' : ''} for <strong>{query}</strong>
            </Text>
            {nonEmptyCategories.map(([cat, rows]) => (
              <Badge key={cat} variant="light" size="sm">
                {CATEGORY_LABELS[cat] ?? cat}: {rows.length}
              </Badge>
            ))}
          </Group>

          {totalResults === 0 ? (
            <Paper withBorder p="xl" radius="md">
              <Center><Text c="dimmed">No results found for "{query}"</Text></Center>
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
                const columns = rows.length > 0 ? Object.keys(rows[0]) : []
                return (
                  <Tabs.Panel key={cat} value={cat} pt="md">
                    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                      <Table striped highlightOnHover withTableBorder stickyHeader>
                        <Table.Thead>
                          <Table.Tr>
                            {columns.map((col) => <Table.Th key={col}>{col}</Table.Th>)}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.map((row, i) => (
                            <Table.Tr key={i}>
                              {columns.map((col) => (
                                <Table.Td key={col} fz="xs">
                                  {row[col] !== null && row[col] !== undefined
                                    ? String(row[col])
                                    : <Text c="dimmed" fz="xs">—</Text>}
                                </Table.Td>
                              ))}
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
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
