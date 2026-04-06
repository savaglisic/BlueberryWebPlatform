import { useEffect, useMemo, useState } from 'react'
import {
  Title, Stack, Group, Button, Paper, Text, TextInput, NumberInput,
  Modal, Select, Textarea, Switch, Badge, ActionIcon,
  Table, Tooltip, ScrollArea, Loader, Center, ThemeIcon, Tabs, Pagination,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus, IconTrash, IconEdit, IconArrowUp, IconArrowDown,
  IconVideo, IconVideoOff, IconFlask, IconTable, IconDownload,
} from '@tabler/icons-react'
import type { SensoryQuestion, QuestionType, SensorySample, SensoryResult } from '../api/sensory'
import { listQuestions, getSensorySetup, updateSensorySetup, addQuestion, updateQuestion, deleteQuestion, reorderQuestions, getSensoryResultDates, getSensoryResults } from '../api/sensory'

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating_9: 'Rating 1–9 (Dislike → Like)',
  slider_100: 'Slider 0–100 (Low → High)',
  text: 'Long-form Text Response',
  multiple_choice: 'Custom Multiple Choice',
  instruction: 'Panelist Instruction',
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

interface QuestionBankItem {
  key: string
  label: string
  question_type: Exclude<QuestionType, 'demographic'>
  attribute: string
  wording: string
  options: string[]
  capture_video: boolean
}

const QUESTION_BANK: QuestionBankItem[] = [
  {
    key: 'appearance_liking',
    label: 'Appearance liking',
    question_type: 'rating_9',
    attribute: 'Appearance liking',
    wording: 'Do not try the sample yet. Please rate its appearance.',
    options: [],
    capture_video: false,
  },
  {
    key: 'overall_liking',
    label: 'Overall liking',
    question_type: 'rating_9',
    attribute: 'Overall liking',
    wording: 'Taste the sample. How much do you like the sample overall?',
    options: [],
    capture_video: true,
  },
  {
    key: 'flavor_liking',
    label: 'Flavor liking',
    question_type: 'rating_9',
    attribute: 'Flavor liking',
    wording: 'How much do you like its flavor?',
    options: [],
    capture_video: false,
  },
  {
    key: 'texture_liking',
    label: 'Texture liking',
    question_type: 'rating_9',
    attribute: 'Texture liking',
    wording: 'How much do you like its texture?',
    options: [],
    capture_video: false,
  },
  {
    key: 'texture_classification',
    label: 'Texture classification',
    question_type: 'multiple_choice',
    attribute: 'Texture classification',
    wording: 'How would you classify the texture of this sample?',
    options: [
      'Mealy',
      'Soft',
      'Standard',
      'Firm',
      'Crispy',
    ],
    capture_video: false,
  },
  {
    key: 'intensity_instruction',
    label: 'Instruction: intensity section',
    question_type: 'instruction',
    attribute: '',
    wording: 'The next questions ask you to rate the intensity of specific characteristics of the sample.',
    options: [],
    capture_video: false,
  },
  {
    key: 'flavor_intensity',
    label: 'Flavor intensity',
    question_type: 'slider_100',
    attribute: 'Flavor intensity',
    wording: 'Please rate flavor intensity from 0 (low) to 100 (high).',
    options: [],
    capture_video: false,
  },
  {
    key: 'sweetness',
    label: 'Sweetness',
    question_type: 'slider_100',
    attribute: 'Sweetness',
    wording: 'Please rate sweetness from 0 (low) to 100 (high).',
    options: [],
    capture_video: false,
  },
  {
    key: 'sourness',
    label: 'Sourness',
    question_type: 'slider_100',
    attribute: 'Sourness',
    wording: 'Please rate sourness from 0 (low) to 100 (high).',
    options: [],
    capture_video: false,
  },
  {
    key: 'juiciness',
    label: 'Juiciness',
    question_type: 'slider_100',
    attribute: 'Juiciness',
    wording: 'Please rate juiciness from 0 (low) to 100 (high).',
    options: [],
    capture_video: false,
  },
  {
    key: 'firmness',
    label: 'Firmness',
    question_type: 'slider_100',
    attribute: 'Firmness',
    wording: 'Please rate firmness from 0 (low) to 100 (high).',
    options: [],
    capture_video: false,
  },
  {
    key: 'positive_comments',
    label: 'Positive comments',
    question_type: 'text',
    attribute: 'Positive comments',
    wording: 'Any positive feedback?',
    options: [],
    capture_video: false,
  },
  {
    key: 'negative_comments',
    label: 'Negative comments',
    question_type: 'text',
    attribute: 'Negative comments',
    wording: 'Any negative feedback?',
    options: [],
    capture_video: false,
  },
  {
    key: 'willingness_to_pay',
    label: 'Willingness to pay',
    question_type: 'multiple_choice',
    attribute: 'Willingness to pay',
    wording: 'Given that a clamshell of blueberries costs about $3.69, would you pay a premium price for this sample? If yes, how much more?',
    options: ['No', 'Yes ($1.00 more)', 'Yes ($1.50 more)', 'Yes ($2.00 more)'],
    capture_video: false,
  },
]

// ── Add / Edit question modal ──────────────────────────────────────────────────

function QuestionFormModal({ existing, onClose }: { existing?: SensoryQuestion; onClose: () => void }) {
  const qc = useQueryClient()
  const [type, setType] = useState<QuestionType>(existing?.question_type ?? 'rating_9')
  const [attribute, setAttribute] = useState(existing?.attribute ?? '')
  const [wording, setWording] = useState(existing?.wording ?? '')
  const [captureVideo, setCaptureVideo] = useState(existing?.capture_video ?? false)
  const [options, setOptions] = useState<string[]>(existing?.options?.length ? existing.options : [''])
  const [bankSelection, setBankSelection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isInstruction = type === 'instruction'

  const applyBankItem = (itemKey: string | null) => {
    setBankSelection(itemKey)
    const item = QUESTION_BANK.find((entry) => entry.key === itemKey)
    if (!item) return
    setType(item.question_type)
    setAttribute(item.attribute)
    setWording(item.wording)
    setCaptureVideo(item.capture_video)
    setOptions(item.question_type === 'multiple_choice' ? item.options : [''])
  }

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
        capture_video: isInstruction ? false : captureVideo,
        options: type === 'multiple_choice' ? options.filter((o) => o.trim()) : [],
      }
      if (existing) {
        await updateQuestion(existing.id, payload)
      } else {
        await addQuestion(payload)
      }
      await qc.invalidateQueries({ queryKey: ['sensory-questions'] })
      onClose()
    } catch {
      notifications.show({ message: 'Failed to save question', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack>
      {!existing && (
        <Select
          label="Question bank"
          placeholder="Load a prebuilt question"
          description="Use a curated starting point, then edit if needed."
          data={QUESTION_BANK.map((item) => ({ value: item.key, label: item.label }))}
          value={bankSelection}
          onChange={applyBankItem}
          searchable
          clearable
        />
      )}

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
        placeholder={isInstruction
          ? 'e.g. Please cleanse your palate before proceeding.'
          : 'e.g. How much do you like the sweetness of this sample?'}
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
              <ActionIcon color="red" variant="subtle" size="sm"
                onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}
          <Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />}
            onClick={() => setOptions([...options, ''])} w="fit-content">
            Add option
          </Button>
        </Stack>
      )}

      {!isInstruction && (
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

// ── Main page ──────────────────────────────────────────────────────────────────

export function SensoryPanels() {
  const qc = useQueryClient()
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [editQuestion, setEditQuestion] = useState<SensoryQuestion | null>(null)
  const [draftSampleCount, setDraftSampleCount] = useState(5)
  const [draftSamples, setDraftSamples] = useState<Array<Partial<SensorySample>>>([])
  const [isSavingSetup, setIsSavingSetup] = useState(false)

  const { data: setup, isLoading: isSetupLoading } = useQuery({
    queryKey: ['sensory-setup'],
    queryFn: getSensorySetup,
  })

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['sensory-questions'],
    queryFn: listQuestions,
  })

  const demographicQuestions = questions.filter((q) => q.question_type === 'demographic')
  const experimentalQuestions = questions.filter((q) => q.question_type !== 'demographic')

  useEffect(() => {
    if (!setup) return
    setDraftSampleCount(setup.samples_per_panelist)
    setDraftSamples(setup.samples.map((sample) => ({
      id: sample.id,
      order_index: sample.order_index,
      sample_number: sample.sample_number,
      real_identifier: sample.real_identifier ?? '',
    })))
  }, [setup])

  const savedSamplesSignature = useMemo(
    () => JSON.stringify((setup?.samples ?? []).map((sample) => ({
      sample_number: sample.sample_number,
      real_identifier: sample.real_identifier ?? '',
    }))),
    [setup],
  )

  const draftSamplesSignature = useMemo(
    () => JSON.stringify(draftSamples.map((sample) => ({
      sample_number: sample.sample_number ?? '',
      real_identifier: sample.real_identifier ?? '',
    }))),
    [draftSamples],
  )

  const hasSetupChanges = !!setup && (
    setup.samples_per_panelist !== draftSampleCount
    || savedSamplesSignature !== draftSamplesSignature
  )

  const duplicateSampleNumbers = useMemo(() => {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const s of draftSamples) {
      const num = (s.sample_number ?? '').trim()
      if (!num) continue
      if (seen.has(num)) dupes.add(num)
      else seen.add(num)
    }
    return dupes
  }, [draftSamples])

  const saveSetup = async (next: { samples_per_panelist: number; samples: SensorySample[] }) => {
    setIsSavingSetup(true)
    try {
      await updateSensorySetup(next)
      await qc.invalidateQueries({ queryKey: ['sensory-setup'] })
      notifications.show({ message: 'Sample setup saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Setup update failed', color: 'red' })
    } finally {
      setIsSavingSetup(false)
    }
  }

  const handleToggle = async (q: SensoryQuestion) => {
    try {
      await updateQuestion(q.id, { enabled: !q.enabled })
      qc.invalidateQueries({ queryKey: ['sensory-questions'] })
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    }
  }

  const handleToggleVideo = async (q: SensoryQuestion) => {
    try {
      await updateQuestion(q.id, { capture_video: !q.capture_video })
      qc.invalidateQueries({ queryKey: ['sensory-questions'] })
    } catch {
      notifications.show({ message: 'Update failed', color: 'red' })
    }
  }

  const handleDelete = (q: SensoryQuestion) => {
    modals.openConfirmModal({
      title: 'Delete question',
      children: <Text size="sm">Delete "{q.attribute || q.wording}"? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteQuestion(q.id)
          qc.invalidateQueries({ queryKey: ['sensory-questions'] })
        } catch {
          notifications.show({ message: 'Delete failed', color: 'red' })
        }
      },
    })
  }

  const handleMove = async (list: SensoryQuestion[], idx: number, dir: 1 | -1) => {
    const toIdx = idx + dir
    if (toIdx < 0 || toIdx >= list.length) return
    const reordered = [...list]
    ;[reordered[idx], reordered[toIdx]] = [reordered[toIdx], reordered[idx]]
    const demoMax = demographicQuestions.length
    const globalPayload = reordered.map((q, i) => ({ id: q.id, order_index: demoMax + i }))
    await reorderQuestions(globalPayload)
    qc.invalidateQueries({ queryKey: ['sensory-questions'] })
  }

  const handleUpdateSampleCount = (value: number | string) => {
    const nextValue = Number(value)
    if (!Number.isFinite(nextValue) || nextValue < 1) return
    setDraftSampleCount(nextValue)
  }

  const handleUpdateSampleRow = (index: number, patch: Partial<SensorySample>) => {
    setDraftSamples((current) => current.map((sample, sampleIndex) =>
      sampleIndex === index ? { ...sample, ...patch } : sample,
    ))
  }

  const handleAddSampleRow = () => {
    setDraftSamples((current) => [
      ...current,
      { sample_number: String(current.length + 1), real_identifier: '' },
    ])
  }

  const handleDeleteSampleRow = (index: number) => {
    setDraftSamples((current) => current.filter((_, sampleIndex) => sampleIndex !== index))
  }

  const handleResetSetup = () => {
    if (!setup) return
    setDraftSampleCount(setup.samples_per_panelist)
    setDraftSamples(setup.samples.map((sample) => ({
      id: sample.id,
      order_index: sample.order_index,
      sample_number: sample.sample_number,
      real_identifier: sample.real_identifier ?? '',
    })))
  }

  const handleSaveSetup = async () => {
    await saveSetup({
      samples_per_panelist: draftSampleCount,
      samples: draftSamples as SensorySample[],
    })
  }

  if (isLoading || isSetupLoading || !setup) return <Center p="xl"><Loader /></Center>

  return (
    <Stack>
      <Title order={3}>Sensory Panel</Title>

      <Tabs defaultValue="questions">
        <Tabs.List mb="md">
          <Tabs.Tab value="questions" leftSection={<IconFlask size={14} />}>Questions</Tabs.Tab>
          <Tabs.Tab value="results" leftSection={<IconTable size={14} />}>Results</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="results">
          <ResultsTab />
        </Tabs.Panel>

        <Tabs.Panel value="questions">
      <Text size="sm" c="dimmed">
        Define the live question set used right now. Results are stored separately and keep their own snapshot of each question, so you can change this list at any time without affecting past data.
      </Text>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={600} size="sm">Live Sample Setup</Text>
              <Text size="xs" c="dimmed">Store the current masked sample numbers and the current per-panelist sample count without tying them to a named panel.</Text>
            </Stack>
            <Group gap="xs">
              <Button size="sm" leftSection={<IconPlus size={14} />} onClick={handleAddSampleRow}>
                Add sample
              </Button>
              <Button variant="default" onClick={handleResetSetup} disabled={!hasSetupChanges || isSavingSetup}>
                Reset
              </Button>
              <Button color="indigo" onClick={handleSaveSetup} loading={isSavingSetup} disabled={!hasSetupChanges || duplicateSampleNumbers.size > 0}>
                Save
              </Button>
            </Group>
          </Group>

          <NumberInput
            label="Samples per panelist"
            description="Current target number of masked samples each panelist should receive."
            min={1}
            value={draftSampleCount}
            onChange={handleUpdateSampleCount}
            w={240}
          />

          {draftSamples.length === 0 ? (
            <Text size="sm" c="dimmed">No masked sample numbers defined yet.</Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={48}>#</Table.Th>
                  <Table.Th>Masked sample number</Table.Th>
                  <Table.Th>Real mapping (optional)</Table.Th>
                  <Table.Th w={52} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {draftSamples.map((sample, index) => (
                  <Table.Tr key={sample.id ?? `${sample.sample_number}-${index}`}>
                    <Table.Td>
                      <Text size="xs" c="dimmed" fw={600}>{index + 1}</Text>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        key={`masked-${sample.id ?? index}-${sample.sample_number}`}
                        placeholder="e.g. 101"
                        onBlur={(e) => handleUpdateSampleRow(index, { sample_number: e.currentTarget.value })}
                        defaultValue={sample.sample_number}
                        error={duplicateSampleNumbers.has((sample.sample_number ?? '').trim()) ? 'Duplicate' : undefined}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        key={`real-${sample.id ?? index}-${sample.real_identifier ?? ''}`}
                        placeholder="e.g. genotype, barcode, internal id"
                        onBlur={(e) => handleUpdateSampleRow(index, { real_identifier: e.currentTarget.value })}
                        defaultValue={sample.real_identifier ?? ''}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDeleteSampleRow(index)}>
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

      {/* Demographics */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Stack gap={2}>
            <Text fw={600} size="sm">Panelist Background & Demographics</Text>
            <Text size="xs" c="dimmed">Collected once per panelist before tasting. These default on automatically when new demographic questions are added.</Text>
          </Stack>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Question</Table.Th>
                <Table.Th w={140}>Format</Table.Th>
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
                    <Switch size="xs" checked={q.enabled} onChange={() => handleToggle(q)} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      {/* Experimental questions */}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600} size="sm">Live Sample Questions</Text>
              <Text size="xs" c="dimmed">Asked per sample during tasting. This is the active question list; use arrows to reorder.</Text>
            </Stack>
            <Button size="sm" leftSection={<IconPlus size={14} />} color="indigo" onClick={openAdd}>
              Add question
            </Button>
          </Group>

          {experimentalQuestions.length === 0 ? (
            <Center py="lg">
              <Stack align="center" gap="xs">
                <ThemeIcon size="xl" variant="light" color="indigo"><IconFlask size={24} /></ThemeIcon>
                <Text size="sm" c="dimmed">No questions yet. Add one to get started.</Text>
              </Stack>
            </Center>
          ) : (
            <ScrollArea>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={32}>#</Table.Th>
                    <Table.Th w={240}>Type</Table.Th>
                    <Table.Th w={150}>Attribute</Table.Th>
                    <Table.Th>Wording</Table.Th>
                    <Table.Th w={52}>Video</Table.Th>
                    <Table.Th w={72}>Enabled</Table.Th>
                    <Table.Th w={110} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {experimentalQuestions.map((q, i) => (
                    <Table.Tr key={q.id} style={{ opacity: q.enabled ? 1 : 0.45 }}>
                      <Table.Td>
                        <Text size="xs" c="dimmed" fw={600}>{i + 1}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={QUESTION_TYPE_COLORS[q.question_type]} variant="light">
                          {QUESTION_TYPE_LABELS[q.question_type]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{q.attribute ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td style={{ maxWidth: 320 }}>
                        <Text size="xs" c="dimmed" lineClamp={2}>{q.wording}</Text>
                      </Table.Td>
                      <Table.Td>
                        {q.question_type !== 'instruction' && (
                          <Tooltip label={q.capture_video ? 'Video on' : 'Video off'}>
                            <ActionIcon size="sm" variant="subtle"
                              color={q.capture_video ? 'indigo' : 'gray'}
                              onClick={() => handleToggleVideo(q)}>
                              {q.capture_video ? <IconVideo size={14} /> : <IconVideoOff size={14} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Switch size="xs" checked={q.enabled} onChange={() => handleToggle(q)} />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={2} wrap="nowrap">
                          <ActionIcon size="sm" variant="subtle" disabled={i === 0}
                            onClick={() => handleMove(experimentalQuestions, i, -1)}>
                            <IconArrowUp size={13} />
                          </ActionIcon>
                          <ActionIcon size="sm" variant="subtle" disabled={i === experimentalQuestions.length - 1}
                            onClick={() => handleMove(experimentalQuestions, i, 1)}>
                            <IconArrowDown size={13} />
                          </ActionIcon>
                          <ActionIcon size="sm" variant="subtle"
                            onClick={() => setEditQuestion(q)}>
                            <IconEdit size={13} />
                          </ActionIcon>
                          <ActionIcon size="sm" variant="subtle" color="red"
                            onClick={() => handleDelete(q)}>
                            <IconTrash size={13} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </Paper>

      <Modal opened={addOpen} onClose={closeAdd} title="Add question" size="lg">
        <QuestionFormModal onClose={closeAdd} />
      </Modal>

      <Modal opened={!!editQuestion} onClose={() => setEditQuestion(null)}
        title={`Edit — ${editQuestion?.attribute || 'Question'}`} size="lg">
        {editQuestion && (
          <QuestionFormModal existing={editQuestion} onClose={() => setEditQuestion(null)} />
        )}
      </Modal>

        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

const PER_PAGE = 50

function pivotResults(results: SensoryResult[]) {
  const experimentalResults = results.filter((r) => r.question_type !== 'demographic' && r.sample_number)
  const demographicResults = results.filter((r) => r.question_type === 'demographic')

  const attributes = Array.from(new Set(experimentalResults.map((r) => r.attribute ?? r.wording ?? ''))).filter(Boolean)
  const demoAttributes = Array.from(new Set(demographicResults.map((r) => r.attribute ?? r.wording ?? ''))).filter(Boolean)

  const panelistDemoMap: Record<string, Record<string, string>> = {}
  for (const r of demographicResults) {
    const col = r.attribute ?? r.wording ?? ''
    if (!panelistDemoMap[r.panelist_id]) panelistDemoMap[r.panelist_id] = {}
    panelistDemoMap[r.panelist_id][col] = r.response ?? ''
  }

  const byPanelistSample: Record<string, { panelist_id: string; sample_number: string; cols: Record<string, string> }> = {}
  for (const r of experimentalResults) {
    const key = `${r.panelist_id}||${r.sample_number}`
    if (!byPanelistSample[key]) byPanelistSample[key] = { panelist_id: r.panelist_id, sample_number: r.sample_number!, cols: {} }
    byPanelistSample[key].cols[r.attribute ?? r.wording ?? ''] = r.response ?? ''
  }

  return {
    rows: Object.values(byPanelistSample),
    allCols: [...demoAttributes, ...attributes],
    demoAttributes,
    attributes,
    panelistDemoMap,
  }
}

function ResultsTab() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState(false)

  const { data: dates = [], isLoading: datesLoading } = useQuery({
    queryKey: ['sensory-result-dates'],
    queryFn: getSensoryResultDates,
  })

  const { data: pageData, isLoading: resultsLoading } = useQuery({
    queryKey: ['sensory-results', selectedDate, page],
    queryFn: () => getSensoryResults(selectedDate!, page, PER_PAGE),
    enabled: !!selectedDate,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0])
  }, [dates, selectedDate])

  // Reset to page 1 when date changes
  useEffect(() => { setPage(1) }, [selectedDate])

  const handleDownloadCsv = async () => {
    if (!selectedDate) return
    setDownloading(true)
    try {
      // Fetch all pages for the selected date
      const first = await getSensoryResults(selectedDate, 1, 10000)
      const allResults = first.results
      const { rows, allCols, demoAttributes, attributes, panelistDemoMap } = pivotResults(allResults)
      const headers = ['panelist_id', 'sample_number', ...demoAttributes, ...attributes]
      const csvRows = rows.map((row) =>
        headers.map((h) => {
          if (h === 'panelist_id') return row.panelist_id
          if (h === 'sample_number') return row.sample_number
          const val = row.cols[h] ?? panelistDemoMap[row.panelist_id]?.[h] ?? ''
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
        }).join(',')
      )
      const csv = [headers.join(','), ...csvRows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `panel_results_${selectedDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      // Suppress allCols warning
      void allCols
    } finally {
      setDownloading(false)
    }
  }

  if (datesLoading) return <Center p="xl"><Loader /></Center>

  if (dates.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Center><Text c="dimmed">No panel results yet.</Text></Center>
      </Paper>
    )
  }

  const results = pageData?.results ?? []
  const totalPairs = pageData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalPairs / PER_PAGE))
  const { rows, allCols, panelistDemoMap } = pivotResults(results)

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Select
          label="Panel date"
          data={dates.map((d) => ({ value: d, label: d }))}
          value={selectedDate}
          onChange={setSelectedDate}
          style={{ minWidth: 200 }}
        />
        <Button
          leftSection={<IconDownload size={14} />}
          variant="default"
          disabled={!totalPairs}
          loading={downloading}
          onClick={handleDownloadCsv}
        >
          Download CSV
        </Button>
      </Group>

      {resultsLoading && !pageData ? (
        <Center p="xl"><Loader /></Center>
      ) : rows.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Center><Text c="dimmed">No responses for this date.</Text></Center>
        </Paper>
      ) : (
        <Stack gap="sm">
          <Paper withBorder radius="md" style={{ overflow: 'hidden', opacity: resultsLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <ScrollArea>
              <Table striped highlightOnHover withColumnBorders style={{ whiteSpace: 'nowrap' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Panelist</Table.Th>
                    <Table.Th>Sample</Table.Th>
                    {allCols.map((col) => (
                      <Table.Th key={col}>{col}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => (
                    <Table.Tr key={`${row.panelist_id}||${row.sample_number}`}>
                      <Table.Td>{row.panelist_id}</Table.Td>
                      <Table.Td>{row.sample_number}</Table.Td>
                      {allCols.map((col) => (
                        <Table.Td key={col}>
                          {row.cols[col] ?? panelistDemoMap[row.panelist_id]?.[col] ?? '—'}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>

          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {totalPairs} panelist–sample pairs · page {page} of {totalPages}
            </Text>
            <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
