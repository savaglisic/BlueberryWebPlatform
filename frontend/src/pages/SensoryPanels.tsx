import { useState } from 'react'
import {
  Title, Stack, Group, Button, Paper, Text, TextInput, NumberInput,
  Modal, Select, Textarea, Switch, Badge, ActionIcon, Divider,
  Table, Tooltip, Collapse, Box, ScrollArea, Checkbox, Loader, Center,
  Menu, ThemeIcon,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  IconPlus, IconTrash, IconEdit, IconChevronDown, IconChevronUp,
  IconArrowUp, IconArrowDown, IconVideo, IconVideoOff, IconChevronRight,
  IconSettings, IconFlask,
} from '@tabler/icons-react'
import type { SensoryPanel, SensoryPanelQuestion, QuestionType } from '../api/sensory'
import {
  listPanels, createPanel, getPanel, updatePanel, deletePanel,
  replaceSamples, addQuestion, updateQuestion, deleteQuestion,
  reorderQuestions, getDemographicQuestions,
} from '../api/sensory'

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating_9: 'Rating 1–9 (Dislike → Like)',
  slider_100: 'Slider 0–100 (Low → High)',
  text: 'Long-form Text Response',
  multiple_choice: 'Custom Multiple Choice',
  instruction: 'Panelist Instruction (non-question)',
  demographic: 'Demographic',
}

const QUESTION_TYPE_COLORS: Record<QuestionType, string> = {
  rating_9: 'indigo',
  slider_100: 'cyan',
  text: 'gray',
  multiple_choice: 'violet',
  instruction: 'orange',
  demographic: 'teal',
}

// ── Add/Edit Question Modal ────────────────────────────────────────────────────

function QuestionFormModal({
  panelId,
  existing,
  onClose,
}: {
  panelId: number
  existing?: SensoryPanelQuestion
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [type, setType] = useState<QuestionType>(existing?.question_type ?? 'rating_9')
  const [attribute, setAttribute] = useState(existing?.attribute ?? '')
  const [wording, setWording] = useState(existing?.wording ?? '')
  const [captureVideo, setCaptureVideo] = useState(existing?.capture_video ?? false)
  const [options, setOptions] = useState<string[]>(existing?.options ?? [''])
  const [saving, setSaving] = useState(false)

  const isInstruction = type === 'instruction'
  const hasVideoCapture = type !== 'instruction'

  const handleSave = async () => {
    if (!isInstruction && !attribute.trim()) {
      notifications.show({ message: 'Attribute is required', color: 'red' })
      return
    }
    if (!wording.trim()) {
      notifications.show({ message: 'Question wording is required', color: 'red' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        question_type: type,
        attribute: isInstruction ? null : attribute.trim(),
        wording: wording.trim(),
        capture_video: hasVideoCapture ? captureVideo : false,
        options: type === 'multiple_choice' ? options.filter((o) => o.trim()) : [],
      }
      if (existing) {
        await updateQuestion(existing.id, payload)
      } else {
        await addQuestion(panelId, payload)
      }
      await qc.invalidateQueries({ queryKey: ['panel', panelId] })
      onClose()
    } catch {
      notifications.show({ message: 'Failed to save question', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack>
      <Select
        label="Question type"
        data={Object.entries(QUESTION_TYPE_LABELS)
          .filter(([k]) => k !== 'demographic')
          .map(([value, label]) => ({ value, label }))}
        value={type}
        onChange={(v) => setType(v as QuestionType)}
      />

      {!isInstruction && (
        <TextInput
          label="Attribute"
          placeholder="e.g. Sweetness, Overall Liking"
          description="Short label for this measurement"
          value={attribute}
          onChange={(e) => setAttribute(e.target.value)}
          required
        />
      )}

      <Textarea
        label={isInstruction ? 'Instruction text' : 'Question wording'}
        placeholder={isInstruction ? 'e.g. Please cleanse your palate before proceeding.' : 'e.g. How much do you like the sweetness of this sample?'}
        value={wording}
        onChange={(e) => setWording(e.target.value)}
        minRows={2}
        required
      />

      {type === 'multiple_choice' && (
        <Stack gap={4}>
          <Text size="sm" fw={500}>Answer options</Text>
          {options.map((opt, i) => (
            <Group key={i} gap="xs">
              <TextInput
                style={{ flex: 1 }}
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = e.target.value
                  setOptions(next)
                }}
                size="sm"
              />
              <ActionIcon color="red" variant="subtle" size="sm" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
          <Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />} onClick={() => setOptions([...options, ''])} w="fit-content">
            Add option
          </Button>
        </Stack>
      )}

      {hasVideoCapture && (
        <Switch
          label="Capture video for AI analysis"
          description="Record panelist reaction during this question"
          checked={captureVideo}
          onChange={(e) => setCaptureVideo(e.currentTarget.checked)}
        />
      )}

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} color="indigo">
          {existing ? 'Save Changes' : 'Add Question'}
        </Button>
      </Group>
    </Stack>
  )
}

// ── Question row ───────────────────────────────────────────────────────────────

function QuestionRow({
  q,
  index,
  total,
  panelId,
  onMoveUp,
  onMoveDown,
}: {
  q: SensoryPanelQuestion
  index: number
  total: number
  panelId: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const qc = useQueryClient()
  const [editOpen, { open: openEdit, close: closeEdit }] = useDisclosure(false)
  const isDemographic = q.question_type === 'demographic'

  const handleToggleEnabled = async () => {
    try {
      await updateQuestion(q.id, { enabled: !q.enabled })
      qc.invalidateQueries({ queryKey: ['panel', panelId] })
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    }
  }

  const handleToggleVideo = async () => {
    try {
      await updateQuestion(q.id, { capture_video: !q.capture_video })
      qc.invalidateQueries({ queryKey: ['panel', panelId] })
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    }
  }

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Delete question',
      children: <Text size="sm">Delete "{q.attribute || q.wording}"? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteQuestion(q.id)
          qc.invalidateQueries({ queryKey: ['panel', panelId] })
        } catch {
          notifications.show({ message: 'Delete failed', color: 'red' })
        }
      },
    })
  }

  return (
    <>
      <Table.Tr style={{ opacity: q.enabled ? 1 : 0.45 }}>
        <Table.Td w={32}>
          <Text size="xs" c="dimmed" fw={600}>{index + 1}</Text>
        </Table.Td>
        <Table.Td>
          <Badge size="xs" color={QUESTION_TYPE_COLORS[q.question_type]} variant="light">
            {isDemographic ? `Demographic` : QUESTION_TYPE_LABELS[q.question_type]}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={q.attribute ? 600 : undefined}>{q.attribute ?? '—'}</Text>
        </Table.Td>
        <Table.Td style={{ maxWidth: 340 }}>
          <Text size="xs" c="dimmed" lineClamp={2}>{q.wording}</Text>
        </Table.Td>
        <Table.Td>
          {q.question_type !== 'instruction' && (
            <Tooltip label={q.capture_video ? 'Video capture on' : 'Video capture off'}>
              <ActionIcon
                size="sm"
                variant="subtle"
                color={q.capture_video ? 'indigo' : 'gray'}
                onClick={!isDemographic ? handleToggleVideo : undefined}
                style={{ cursor: isDemographic ? 'default' : 'pointer' }}
              >
                {q.capture_video ? <IconVideo size={14} /> : <IconVideoOff size={14} />}
              </ActionIcon>
            </Tooltip>
          )}
        </Table.Td>
        <Table.Td>
          <Switch size="xs" checked={q.enabled} onChange={handleToggleEnabled} />
        </Table.Td>
        <Table.Td>
          <Group gap={2} wrap="nowrap">
            <ActionIcon size="sm" variant="subtle" disabled={index === 0} onClick={onMoveUp}>
              <IconArrowUp size={13} />
            </ActionIcon>
            <ActionIcon size="sm" variant="subtle" disabled={index === total - 1} onClick={onMoveDown}>
              <IconArrowDown size={13} />
            </ActionIcon>
            {!isDemographic && (
              <>
                <ActionIcon size="sm" variant="subtle" onClick={openEdit}><IconEdit size={13} /></ActionIcon>
                <ActionIcon size="sm" variant="subtle" color="red" onClick={handleDelete}><IconTrash size={13} /></ActionIcon>
              </>
            )}
          </Group>
        </Table.Td>
      </Table.Tr>

      <Modal opened={editOpen} onClose={closeEdit} title={`Edit — ${q.attribute || 'Question'}`} size="lg">
        <QuestionFormModal panelId={panelId} existing={q} onClose={closeEdit} />
      </Modal>
    </>
  )
}

// ── Panel editor (expanded view) ───────────────────────────────────────────────

function PanelEditor({ panelId, onBack }: { panelId: number; onBack: () => void }) {
  const qc = useQueryClient()
  const [addQOpen, { open: openAddQ, close: closeAddQ }] = useDisclosure(false)

  const { data: panel, isLoading } = useQuery({
    queryKey: ['panel', panelId],
    queryFn: () => getPanel(panelId),
  })

  // Sync panelDate when panel first loads
  const [panelDateSynced, setPanelDateSynced] = useState(false)
  if (panel && !panelDateSynced) {
    setPanelDate(panel.panel_date ? new Date(panel.panel_date + 'T00:00:00') : null)
    setPanelDateSynced(true)
  }

  // Sample state — managed locally then saved
  const [sampleRows, setSampleRows] = useState<{ sample_number: string; true_identifier: string }[] | null>(null)
  const [panelDate, setPanelDate] = useState<Date | null>(null)
  const displaySamples = sampleRows ?? panel?.samples.map((s) => ({ sample_number: s.sample_number, true_identifier: s.true_identifier ?? '' })) ?? []

  const saveSamples = useMutation({
    mutationFn: () => replaceSamples(panelId, displaySamples),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['panel', panelId] })
      setSampleRows(null)
      notifications.show({ message: 'Samples saved', color: 'green' })
    },
    onError: () => notifications.show({ message: 'Failed to save samples', color: 'red' }),
  })

  const handleMove = async (questions: SensoryPanelQuestion[], fromIdx: number, dir: 1 | -1) => {
    const toIdx = fromIdx + dir
    if (toIdx < 0 || toIdx >= questions.length) return
    const reordered = [...questions]
    ;[reordered[fromIdx], reordered[toIdx]] = [reordered[toIdx], reordered[fromIdx]]
    const payload = reordered.map((q, i) => ({ id: q.id, order_index: i }))
    await reorderQuestions(panelId, payload)
    qc.invalidateQueries({ queryKey: ['panel', panelId] })
  }

  const handlePanelNameSave = async (name: string) => {
    if (!name.trim()) return
    await updatePanel(panelId, { name: name.trim() })
    qc.invalidateQueries({ queryKey: ['panel', panelId] })
  }

  const handleSamplesPerPanelistSave = async (v: number) => {
    await updatePanel(panelId, { samples_per_panelist: v })
    qc.invalidateQueries({ queryKey: ['panel', panelId] })
  }

  if (isLoading || !panel) return <Center p="xl"><Loader /></Center>

  const demographicQuestions = panel.questions.filter((q) => q.question_type === 'demographic')
  const experimentalQuestions = panel.questions.filter((q) => q.question_type !== 'demographic')
  const samplesEdited = sampleRows !== null

  return (
    <Stack>
      <Group>
        <Button variant="subtle" leftSection={<IconChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />} onClick={onBack} size="sm">
          All Panels
        </Button>
        <Text fw={700} size="lg">{panel.name}</Text>
      </Group>

      {/* ── Panel settings ── */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600} size="sm">Panel Settings</Text>
          <Group align="flex-end" gap="md">
            <TextInput
              label="Panel name"
              defaultValue={panel.name}
              onBlur={(e) => handlePanelNameSave(e.target.value)}
              style={{ flex: 1 }}
            />
            <DatePickerInput
              label="Planned panel date"
              description="When will this session take place?"
              placeholder="Pick a date"
              value={panelDate}
              onChange={async (date) => {
                setPanelDate(date)
                await updatePanel(panel.id, { panel_date: date ? date.toISOString().slice(0, 10) : null })
                qc.invalidateQueries({ queryKey: ['panel', panelId] })
              }}
              clearable
              w={200}
            />
            <NumberInput
              label="Samples per panelist"
              description="How many samples each person will taste"
              defaultValue={panel.samples_per_panelist}
              min={1}
              max={20}
              w={200}
              onBlur={(e) => handleSamplesPerPanelistSave(Number(e.target.value))}
            />
          </Group>
        </Stack>
      </Paper>

      {/* ── Sample definitions ── */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={0}>
              <Text fw={600} size="sm">Sample Numbers</Text>
              <Text size="xs" c="dimmed">Define the labels shown to panelists and optionally the hidden true identifier (genotype/barcode).</Text>
            </Stack>
            <Group gap="xs">
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconPlus size={13} />}
                onClick={() => setSampleRows([...displaySamples, { sample_number: String(displaySamples.length + 1), true_identifier: '' }])}
              >
                Add row
              </Button>
              {samplesEdited && (
                <Button size="xs" color="indigo" onClick={() => saveSamples.mutate()} loading={saveSamples.isPending}>
                  Save samples
                </Button>
              )}
            </Group>
          </Group>

          {displaySamples.length === 0 ? (
            <Text size="sm" c="dimmed">No samples defined yet.</Text>
          ) : (
            <Table withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Sample # (shown to panelist)</Table.Th>
                  <Table.Th>True identifier <Text span size="xs" c="dimmed">(hidden from panelists)</Text></Table.Th>
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {displaySamples.map((s, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        value={s.sample_number}
                        onChange={(e) => {
                          const next = [...displaySamples]
                          next[i] = { ...next[i], sample_number: e.target.value }
                          setSampleRows(next)
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        placeholder="optional"
                        value={s.true_identifier}
                        onChange={(e) => {
                          const next = [...displaySamples]
                          next[i] = { ...next[i], true_identifier: e.target.value }
                          setSampleRows(next)
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setSampleRows(displaySamples.filter((_, idx) => idx !== i))}>
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      {/* ── Demographic questions ── */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Stack gap={0}>
            <Text fw={600} size="sm">Panelist Background & Demographics</Text>
            <Text size="xs" c="dimmed">Toggle which background questions are included. These are collected once per panelist before tasting.</Text>
          </Stack>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Question</Table.Th>
                <Table.Th>Format</Table.Th>
                <Table.Th w={80}>Enabled</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {demographicQuestions.map((q) => (
                <Table.Tr key={q.id} style={{ opacity: q.enabled ? 1 : 0.45 }}>
                  <Table.Td><Text size="sm">{q.wording}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light" color="teal">
                      {q.options.length > 0 ? 'Multiple choice' : 'Text input'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      size="xs"
                      checked={q.enabled}
                      onChange={async () => {
                        await updateQuestion(q.id, { enabled: !q.enabled })
                        qc.invalidateQueries({ queryKey: ['panel', panelId] })
                      }}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      {/* ── Experimental questions ── */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={0}>
              <Text fw={600} size="sm">Experimental Questions</Text>
              <Text size="xs" c="dimmed">These are asked per-sample. Drag to reorder or use the arrows.</Text>
            </Stack>
            <Button size="sm" leftSection={<IconPlus size={14} />} color="indigo" onClick={openAddQ}>
              Add question
            </Button>
          </Group>

          {experimentalQuestions.length === 0 ? (
            <Text size="sm" c="dimmed">No questions defined yet. Add one above.</Text>
          ) : (
            <ScrollArea>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={32}>#</Table.Th>
                    <Table.Th w={180}>Type</Table.Th>
                    <Table.Th w={160}>Attribute</Table.Th>
                    <Table.Th>Wording</Table.Th>
                    <Table.Th w={50}>Video</Table.Th>
                    <Table.Th w={70}>Enabled</Table.Th>
                    <Table.Th w={110}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {experimentalQuestions.map((q, i) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      index={i}
                      total={experimentalQuestions.length}
                      panelId={panelId}
                      onMoveUp={() => handleMove(experimentalQuestions, i, -1)}
                      onMoveDown={() => handleMove(experimentalQuestions, i, 1)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </Paper>

      <Modal opened={addQOpen} onClose={closeAddQ} title="Add question" size="lg">
        <QuestionFormModal panelId={panelId} onClose={closeAddQ} />
      </Modal>
    </Stack>
  )
}

// ── Panel list ─────────────────────────────────────────────────────────────────

function PanelList({ onSelect }: { onSelect: (id: number) => void }) {
  const qc = useQueryClient()
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false)
  const [newName, setNewName] = useState('')
  const [newPanelDate, setNewPanelDate] = useState<Date | null>(null)
  const [newSamplesPerPanelist, setNewSamplesPerPanelist] = useState<number>(5)
  const [creating, setCreating] = useState(false)

  const { data: panels = [], isLoading } = useQuery({
    queryKey: ['panels'],
    queryFn: listPanels,
  })

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const panel = await createPanel({ name: newName.trim(), panel_date: newPanelDate ? newPanelDate.toISOString().slice(0, 10) : null, samples_per_panelist: newSamplesPerPanelist })
      qc.invalidateQueries({ queryKey: ['panels'] })
      closeCreate()
      setNewName('')
      setNewPanelDate(null)
      setNewSamplesPerPanelist(5)
      onSelect(panel.id)
    } catch {
      notifications.show({ message: 'Failed to create panel', color: 'red' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = (panel: { id: number; name: string }) => {
    modals.openConfirmModal({
      title: 'Delete panel',
      children: <Text size="sm">Delete panel <strong>{panel.name}</strong> and all its questions and results? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deletePanel(panel.id)
          qc.invalidateQueries({ queryKey: ['panels'] })
          notifications.show({ message: 'Panel deleted', color: 'green' })
        } catch {
          notifications.show({ message: 'Delete failed', color: 'red' })
        }
      },
    })
  }

  if (isLoading) return <Center p="xl"><Loader /></Center>

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Sensory Panels</Title>
        <Button leftSection={<IconPlus size={16} />} color="indigo" onClick={openCreate}>
          New Panel
        </Button>
      </Group>

      {panels.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Center>
            <Stack align="center" gap="xs">
              <ThemeIcon size="xl" variant="light" color="indigo"><IconFlask size={24} /></ThemeIcon>
              <Text c="dimmed">No panels yet. Create one to get started.</Text>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Stack gap="sm">
          {panels.map((panel) => (
            <Paper key={panel.id} withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => onSelect(panel.id)}>
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text fw={600}>{panel.name}</Text>
                  <Text size="xs" c="dimmed">
                    {panel.panel_date ? `📅 ${new Date(panel.panel_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · ` : ''}
                    {panel.samples_per_panelist} sample{panel.samples_per_panelist !== 1 ? 's' : ''} per panelist
                  </Text>
                </Stack>
                <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                  <Button size="xs" variant="light" rightSection={<IconChevronRight size={13} />} onClick={() => onSelect(panel.id)}>
                    Configure
                  </Button>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(panel)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Modal opened={createOpen} onClose={closeCreate} title="New Sensory Panel" size="sm" centered>
        <Stack>
          <TextInput
            label="Panel name"
            placeholder="e.g. Spring 2026 Flavor Panel"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            required
            data-autofocus
          />
          <DatePickerInput
            label="Planned panel date"
            description="When will this tasting session take place? (leave blank if not yet scheduled)"
            placeholder="Pick a date"
            value={newPanelDate}
            onChange={setNewPanelDate}
            clearable
          />
          <NumberInput
            label="Samples per panelist"
            description="How many samples each panelist will taste in a session"
            value={newSamplesPerPanelist}
            onChange={(v) => setNewSamplesPerPanelist(Number(v))}
            min={1}
            max={20}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreate}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} color="indigo">Create</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ── Root export ────────────────────────────────────────────────────────────────

export function SensoryPanels() {
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null)

  if (selectedPanelId !== null) {
    return <PanelEditor panelId={selectedPanelId} onBack={() => setSelectedPanelId(null)} />
  }

  return <PanelList onSelect={setSelectedPanelId} />
}
