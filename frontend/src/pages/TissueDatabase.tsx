import { useState } from 'react'
import {
  ActionIcon, Badge, Button, Center, Checkbox, Divider, Grid, Group, Loader, Modal,
  NumberInput, Pagination, Paper, ScrollArea, Select, Stack, Switch, Table, Tabs,
  Text, Textarea, TextInput, ThemeIcon, Title, Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconArrowDown, IconArrowUp, IconDatabase, IconDownload, IconEdit, IconPlus,
  IconHistory, IconSearch, IconSettings, IconTrash,
} from '@tabler/icons-react'
import type { TissueInputType, TissueQuestion, TissueRecord } from '../api/tissue'
import {
  createTissueQuestion, deleteTissueQuestion, deleteTissueRecord, downloadTissueCsv,
  getAdminTissueQuestions, getTissueRecord, getTissueRecords, saveTissueRecord, updateTissueQuestion,
} from '../api/tissue'
import { TissueFieldInput } from '../components/TissueFieldInput'
import { TissueHistory } from '../components/TissueHistory'

const PAGE_SIZE = 20
const TYPE_OPTIONS: { value: TissueInputType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long notes' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'genotype', label: 'Fruit Quality genotype' },
]

type QuestionDraft = {
  label: string
  help_text: string
  input_type: TissueInputType
  required: boolean
  enabled: boolean
  min_value: number | string
  max_value: number | string
  placeholder: string
}

const EMPTY_QUESTION: QuestionDraft = {
  label: '', help_text: '', input_type: 'text', required: false, enabled: true,
  min_value: '', max_value: '', placeholder: '',
}

function QuestionModal({ question, onClose }: { question: TissueQuestion | null; onClose: () => void }) {
  const [form, setForm] = useState<QuestionDraft>(() => question ? {
    label: question.label,
    help_text: question.help_text ?? '',
    input_type: question.input_type,
    required: question.required,
    enabled: question.enabled,
    min_value: question.min_value ?? '',
    max_value: question.max_value ?? '',
    placeholder: question.placeholder ?? '',
  } : EMPTY_QUESTION)
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()
  const set = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (!form.label.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      min_value: form.input_type === 'number' && form.min_value !== '' ? Number(form.min_value) : null,
      max_value: form.input_type === 'number' && form.max_value !== '' ? Number(form.max_value) : null,
    }
    try {
      if (question) await updateTissueQuestion(question.id, payload)
      else await createTissueQuestion(payload)
      await qc.invalidateQueries({ queryKey: ['tissue-admin-questions'] })
      await qc.invalidateQueries({ queryKey: ['tissue-questions'] })
      notifications.show({ message: question ? 'Question updated' : 'Question added to the lab workflow', color: 'green' })
      onClose()
    } catch { notifications.show({ message: 'Question could not be saved. Check that its name is unique.', color: 'red' }) }
    finally { setSaving(false) }
  }

  return (
    <Stack>
      <TextInput label="What should the employee be asked?" description="Use a short, familiar label." placeholder="e.g. Rooting Date" value={form.label} onChange={(e) => set('label', e.currentTarget.value)} required autoFocus />
      <Textarea label="Helpful instruction" description="Shown directly below the question in the lab." placeholder="Explain where to find the value or what to enter." value={form.help_text} onChange={(e) => set('help_text', e.currentTarget.value)} minRows={2} />
      <Select label="How should they answer?" data={TYPE_OPTIONS} value={form.input_type} onChange={(value) => set('input_type', value as TissueInputType)} allowDeselect={false} />
      {form.input_type === 'number' && (
        <Paper withBorder p="sm" radius="md">
          <Text fw={600} size="sm">Acceptable range</Text>
          <Text size="xs" c="dimmed" mb="sm">Employees see a warning outside this range, but can continue when an unusual result is valid.</Text>
          <Grid>
            <Grid.Col span={6}><NumberInput label="Minimum" value={form.min_value} onChange={(value) => set('min_value', value)} /></Grid.Col>
            <Grid.Col span={6}><NumberInput label="Maximum" value={form.max_value} onChange={(value) => set('max_value', value)} /></Grid.Col>
          </Grid>
        </Paper>
      )}
      {!['date', 'boolean'].includes(form.input_type) && <TextInput label="Example shown in the answer box" placeholder="e.g. 123" value={form.placeholder} onChange={(e) => set('placeholder', e.currentTarget.value)} />}
      <Group>
        <Checkbox label="Required before saving" checked={form.required} onChange={(e) => set('required', e.currentTarget.checked)} />
        <Switch label="Show in lab workflow" checked={form.enabled} onChange={(e) => set('enabled', e.currentTarget.checked)} />
      </Group>
      <Divider />
      <Group justify="flex-end"><Button variant="subtle" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} loading={saving} disabled={!form.label.trim()}>Save question</Button></Group>
    </Stack>
  )
}

function EditRecordModal({ record, questions, onClose }: { record: TissueRecord; questions: TissueQuestion[]; onClose: () => void }) {
  const [answers, setAnswers] = useState(record.answers)
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()
  const save = async () => {
    setSaving(true)
    try {
      await saveTissueRecord(record.barcode, answers)
      await qc.invalidateQueries({ queryKey: ['tissue-records'] })
      notifications.show({ message: 'Tissue record updated', color: 'green' })
      onClose()
    } catch { notifications.show({ message: 'Record could not be updated', color: 'red' }) }
    finally { setSaving(false) }
  }
  return (
    <Stack>
      <TextInput label="Barcode" value={record.barcode} disabled />
      <Grid>
        {questions.map((question) => (
          <Grid.Col key={question.id} span={{ base: 12, sm: question.input_type === 'textarea' ? 12 : 6 }}>
            <Text fw={500} size="sm" mb={4}>{question.label}{question.required ? ' *' : ''}</Text>
            <TissueFieldInput question={question} value={answers[question.field_key]} onChange={(value) => setAnswers((current) => ({ ...current, [question.field_key]: value }))} />
          </Grid.Col>
        ))}
      </Grid>
      <Group justify="flex-end"><Button variant="subtle" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} loading={saving}>Save changes</Button></Group>
    </Stack>
  )
}

export function TissueDatabase() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [editingQuestion, setEditingQuestion] = useState<TissueQuestion | null>(null)
  const [editingRecord, setEditingRecord] = useState<TissueRecord | null>(null)
  const [historyRecord, setHistoryRecord] = useState<TissueRecord | null>(null)
  const [questionOpen, questionModal] = useDisclosure(false)
  const [recordOpen, recordModal] = useDisclosure(false)
  const [historyOpen, historyModal] = useDisclosure(false)
  const [exporting, setExporting] = useState(false)
  const qc = useQueryClient()
  const { data: questions = [], isLoading: questionsLoading } = useQuery({ queryKey: ['tissue-admin-questions'], queryFn: getAdminTissueQuestions })
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['tissue-records', page, activeSearch], queryFn: () => getTissueRecords(page, PAGE_SIZE, activeSearch), placeholderData: (old) => old,
  })

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    const otherIndex = index + direction
    if (!questions[otherIndex]) return
    const current = questions[index]
    const other = questions[otherIndex]
    await Promise.all([
      updateTissueQuestion(current.id, { order_index: other.order_index }),
      updateTissueQuestion(other.id, { order_index: current.order_index }),
    ])
    await qc.invalidateQueries({ queryKey: ['tissue-admin-questions'] })
    await qc.invalidateQueries({ queryKey: ['tissue-questions'] })
  }

  const removeQuestion = (question: TissueQuestion) => modals.openConfirmModal({
    title: 'Remove this question?',
    children: <Text size="sm">Remove <strong>{question.label}</strong> from the setup? Existing tissue records will not be deleted.</Text>,
    labels: { confirm: 'Remove question', cancel: 'Cancel' }, confirmProps: { color: 'red' },
    onConfirm: async () => {
      await deleteTissueQuestion(question.id)
      await qc.invalidateQueries({ queryKey: ['tissue-admin-questions'] })
      await qc.invalidateQueries({ queryKey: ['tissue-questions'] })
    },
  })

  const removeRecord = (record: TissueRecord) => modals.openConfirmModal({
    title: 'Delete tissue record?',
    children: <Text size="sm">Permanently delete <strong>{record.combined_name || record.barcode}</strong>?</Text>,
    labels: { confirm: 'Delete record', cancel: 'Cancel' }, confirmProps: { color: 'red' },
    onConfirm: async () => { await deleteTissueRecord(record.barcode); await qc.invalidateQueries({ queryKey: ['tissue-records'] }) },
  })

  const showHistory = async (record: TissueRecord) => {
    try {
      setHistoryRecord(await getTissueRecord(record.barcode))
      historyModal.open()
    } catch { notifications.show({ message: 'History could not be loaded', color: 'red' }) }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const blob = await downloadTissueCsv()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tissue_samples.csv'; anchor.click()
      URL.revokeObjectURL(url)
    } catch { notifications.show({ message: 'Export failed', color: 'red' }) }
    finally { setExporting(false) }
  }

  const visibleQuestions = questions.filter((question) => question.enabled)

  return (
    <Stack>
      <div><Title order={3}>Tissue Admin Database</Title><Text size="sm" c="dimmed">Review plant histories and control exactly what the tissue lab asks.</Text></div>
      <Tabs defaultValue="records">
        <Tabs.List>
          <Tabs.Tab value="records" leftSection={<IconDatabase size={16} />}>Plant records</Tabs.Tab>
          <Tabs.Tab value="questions" leftSection={<IconSettings size={16} />}>Lab question setup</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="records" pt="md">
          <Stack>
            <Group justify="space-between">
              <Group gap="xs">
                <TextInput placeholder="Search barcode, name, or any answer" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setActiveSearch(search); setPage(1) } }} w={{ base: '100%', sm: 340 }} />
                <Button variant="light" onClick={() => { setActiveSearch(search); setPage(1) }}>Search</Button>
              </Group>
              <Button variant="light" leftSection={<IconDownload size={16} />} loading={exporting} onClick={() => void exportCsv()}>Export CSV</Button>
            </Group>
            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
              {recordsLoading ? <Center p="xl"><Loader size="sm" /></Center> : (
                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder stickyHeader>
                    <Table.Thead><Table.Tr><Table.Th>Barcode</Table.Th><Table.Th>Status</Table.Th><Table.Th>Combined Name</Table.Th>{visibleQuestions.map((q) => <Table.Th key={q.id} style={{ whiteSpace: 'nowrap' }}>{q.label}</Table.Th>)}<Table.Th>Last Modified</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {records?.data.map((record) => (
                        <Table.Tr key={record.id}>
                          <Table.Td><Text fw={600} size="sm">{record.barcode}</Text></Table.Td>
                          <Table.Td><Badge color={record.status === 'incomplete' ? 'orange' : 'green'} variant="light">{record.status === 'incomplete' ? `Incomplete • Q${record.current_step + 1}` : 'Complete'}</Badge></Table.Td>
                          <Table.Td><Badge variant="light" color="indigo" style={{ textTransform: 'none' }}>{record.combined_name || 'Incomplete identity'}</Badge></Table.Td>
                          {visibleQuestions.map((q) => <Table.Td key={q.id} fz="xs" style={{ whiteSpace: 'nowrap' }}>{record.answers[q.field_key] === true ? 'Yes' : record.answers[q.field_key] === false ? 'No' : String(record.answers[q.field_key] ?? '—')}</Table.Td>)}
                          <Table.Td fz="xs" style={{ whiteSpace: 'nowrap' }}>{new Date(record.updated_at).toLocaleString()}</Table.Td>
                          <Table.Td><Group gap={4} wrap="nowrap"><Tooltip label="Complete history"><ActionIcon variant="subtle" onClick={() => void showHistory(record)}><IconHistory size={15} /></ActionIcon></Tooltip><ActionIcon variant="subtle" onClick={() => { setEditingRecord(record); recordModal.open() }}><IconEdit size={15} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => removeRecord(record)}><IconTrash size={15} /></ActionIcon></Group></Table.Td>
                        </Table.Tr>
                      ))}
                      {!records?.data.length && <Table.Tr><Table.Td colSpan={visibleQuestions.length + 5}><Text ta="center" c="dimmed" py="lg">No tissue records found.</Text></Table.Td></Table.Tr>}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Paper>
            <Group justify="center"><Pagination total={Math.max(1, Math.ceil((records?.total ?? 0) / PAGE_SIZE))} value={page} onChange={setPage} /></Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="questions" pt="md">
          <Stack>
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <Group align="flex-start" wrap="nowrap"><ThemeIcon variant="light" size="lg"><IconSettings size={20} /></ThemeIcon><div><Text fw={700}>The starter workflow is already populated</Text><Text size="sm" c="dimmed">Reorder, edit, hide, or add questions without a code change. Numeric questions can show an acceptable range to employees.</Text></div></Group>
                <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditingQuestion(null); questionModal.open() }}>Add question</Button>
              </Group>
            </Paper>
            {questionsLoading ? <Center p="xl"><Loader size="sm" /></Center> : questions.map((question, index) => (
              <Paper key={question.id} withBorder p="sm" radius="md" opacity={question.enabled ? 1 : 0.6}>
                <Group justify="space-between" wrap="nowrap">
                  <Group wrap="nowrap">
                    <Stack gap={0}>
                      <Tooltip label="Move up"><ActionIcon size="sm" variant="subtle" disabled={index === 0} onClick={() => void moveQuestion(index, -1)}><IconArrowUp size={14} /></ActionIcon></Tooltip>
                      <Tooltip label="Move down"><ActionIcon size="sm" variant="subtle" disabled={index === questions.length - 1} onClick={() => void moveQuestion(index, 1)}><IconArrowDown size={14} /></ActionIcon></Tooltip>
                    </Stack>
                    <div>
                      <Group gap="xs"><Text fw={600}>{index + 1}. {question.label}</Text><Badge size="xs" color={question.required ? 'red' : 'gray'} variant="light">{question.required ? 'Required' : 'Optional'}</Badge>{!question.enabled && <Badge size="xs" color="gray">Hidden</Badge>}</Group>
                      <Text size="xs" c="dimmed">{TYPE_OPTIONS.find((type) => type.value === question.input_type)?.label}{question.input_type === 'number' && (question.min_value !== null || question.max_value !== null) ? ` • expected ${question.min_value ?? '∞'}–${question.max_value ?? '∞'}` : ''}{question.help_text ? ` • ${question.help_text}` : ''}</Text>
                    </div>
                  </Group>
                  <Group gap={4} wrap="nowrap"><ActionIcon variant="subtle" onClick={() => { setEditingQuestion(question); questionModal.open() }}><IconEdit size={16} /></ActionIcon><ActionIcon variant="subtle" color="red" onClick={() => removeQuestion(question)}><IconTrash size={16} /></ActionIcon></Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={questionOpen} onClose={questionModal.close} title={editingQuestion ? 'Edit lab question' : 'Add a lab question'} size="lg">
        <QuestionModal key={editingQuestion?.id ?? 'new'} question={editingQuestion} onClose={questionModal.close} />
      </Modal>
      <Modal opened={recordOpen} onClose={recordModal.close} title={`Edit — ${editingRecord?.combined_name || editingRecord?.barcode || ''}`} size="xl">
        {editingRecord && <EditRecordModal record={editingRecord} questions={visibleQuestions} onClose={recordModal.close} />}
      </Modal>
      <Modal opened={historyOpen} onClose={historyModal.close} title={`Complete history — ${historyRecord?.combined_name || historyRecord?.barcode || ''}`} size="lg">
        <TissueHistory history={historyRecord?.history ?? []} questions={questions} />
      </Modal>
    </Stack>
  )
}
