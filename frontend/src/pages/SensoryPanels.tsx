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
  IconDeviceFloppy, IconFolderOpen,
} from '@tabler/icons-react'
import type { SensoryQuestion, QuestionType, SensorySample, SensoryResult, SensoryQuestionSetSummary } from '../api/sensory'
import {
  listQuestions, getSensorySetup, updateSensorySetup, addQuestion, updateQuestion,
  deleteQuestion, reorderQuestions, getSensoryResultDates, getSensoryResults,
  listQuestionSets, createQuestionSet, deleteQuestionSet, loadQuestionSet,
} from '../api/sensory'

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating_9: 'Rating 1–9 (Dislike → Like)',
  slider_100: 'Slider 0–100 (Low → High)',
  text: 'Long-form Text Response',
  multiple_choice: 'Multiple Choice (pick one)',
  select_all: 'Select All That Apply',
  instruction: 'Panelist Instruction',
  demographic: 'Demographic',
}

const QUESTION_TYPE_COLORS: Record<QuestionType, string> = {
  rating_9: 'indigo',
  slider_100: 'cyan',
  text: 'gray',
  multiple_choice: 'violet',
  select_all: 'grape',
  instruction: 'orange',
  demographic: 'teal',
}

// ── Question banks ─────────────────────────────────────────────────────────────

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
    options: ['Mealy', 'Soft', 'Standard', 'Firm', 'Crispy'],
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

interface DemoBankItem {
  key: string
  label: string
  attribute: string
  question_type: 'text' | 'multiple_choice' | 'select_all'
  wording: string
  options: string[]
}

const DEMOGRAPHIC_BANK: DemoBankItem[] = [
  {
    key: 'gender',
    label: 'Gender',
    attribute: 'gender',
    question_type: 'multiple_choice',
    wording: 'Please indicate your gender.',
    options: ['Male', 'Female', 'I prefer not to say'],
  },
  {
    key: 'age',
    label: 'Age',
    attribute: 'age',
    question_type: 'text',
    wording: 'Please indicate your age.',
    options: [],
  },
  {
    key: 'ethnicity',
    label: 'Ethnicity',
    attribute: 'ethnicity',
    question_type: 'multiple_choice',
    wording: 'What is your ethnic background?',
    options: ['Hispanic', 'Non-Hispanic'],
  },
  {
    key: 'race',
    label: 'Race',
    attribute: 'race',
    question_type: 'multiple_choice',
    wording: 'Which of the following best describes you?',
    options: [
      'Asian/Pacific Islander',
      'Black or African American',
      'White or Caucasian',
      'Native American/Alaska Native/Aleutian',
      'Other',
    ],
  },
  {
    key: 'blueberry_frequency',
    label: 'Blueberry frequency',
    attribute: 'blueberry_frequency',
    question_type: 'multiple_choice',
    wording: 'How often do you eat fresh blueberries?',
    options: [
      'Once a day',
      '2–3 times a week',
      'Once a week',
      '2–3 times a month',
      'Once per month',
      'Twice per year',
      'Once per year',
      'Never or almost never',
    ],
  },
]

// ── Shared options editor ──────────────────────────────────────────────────────

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  return (
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
              onChange(next)
            }}
            size="sm"
          />
          <ActionIcon color="red" variant="subtle" size="sm"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />}
        onClick={() => onChange([...options, ''])} w="fit-content">
        Add option
      </Button>
    </Stack>
  )
}

// ── Add / Edit live sample question modal ──────────────────────────────────────

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
    setOptions(item.question_type === 'multiple_choice' || item.question_type === 'select_all' ? item.options : [''])
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
        options: (type === 'multiple_choice' || type === 'select_all') ? options.filter((o) => o.trim()) : [],
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

      {(type === 'multiple_choice' || type === 'select_all') && (
        <OptionsEditor options={options} onChange={setOptions} />
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

// ── Add / Edit demographic question modal ──────────────────────────────────────

function DemographicFormModal({ existing, onClose }: { existing?: SensoryQuestion; onClose: () => void }) {
  const qc = useQueryClient()
  const [demoType, setDemoType] = useState<'text' | 'multiple_choice' | 'select_all'>(
    existing
      ? existing.question_type === 'select_all'
        ? 'select_all'
        : existing.options.length > 0
          ? 'multiple_choice'
          : 'text'
      : 'multiple_choice',
  )
  const [attribute, setAttribute] = useState(existing?.attribute ?? existing?.demographic_key ?? '')
  const [wording, setWording] = useState(existing?.wording ?? '')
  const [options, setOptions] = useState<string[]>(existing?.options?.length ? existing.options : [''])
  const [bankSelection, setBankSelection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const applyBankItem = (itemKey: string | null) => {
    setBankSelection(itemKey)
    const item = DEMOGRAPHIC_BANK.find((entry) => entry.key === itemKey)
    if (!item) return
    setDemoType(item.question_type)
    setAttribute(item.attribute)
    setWording(item.wording)
    setOptions(item.question_type === 'multiple_choice' || item.question_type === 'select_all' ? item.options : [''])
  }

  const handleSave = async () => {
    if (!attribute.trim()) {
      notifications.show({ message: 'Attribute label is required', color: 'red' })
      return
    }
    if (!wording.trim()) {
      notifications.show({ message: 'Question wording is required', color: 'red' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        question_type: demoType as QuestionType,
        attribute: attribute.trim(),
        wording: wording.trim(),
        capture_video: false,
        options: (demoType === 'multiple_choice' || demoType === 'select_all') ? options.filter((o) => o.trim()) : [],
        // Always set a demographic_key so the question is identified as demographic
        demographic_key: existing?.demographic_key ?? (bankSelection || attribute.trim()),
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
          label="Demographic bank"
          placeholder="Load a standard demographic question"
          description="Use a standard question as a starting point, or define your own."
          data={DEMOGRAPHIC_BANK.map((item) => ({ value: item.key, label: item.label }))}
          value={bankSelection}
          onChange={applyBankItem}
          searchable
          clearable
        />
      )}

      <Select
        label="Format"
        data={[
          { value: 'text', label: 'Text input' },
          { value: 'multiple_choice', label: 'Multiple choice (pick one)' },
          { value: 'select_all', label: 'Select all that apply' },
        ]}
        value={demoType}
        onChange={(v) => setDemoType(v as 'text' | 'multiple_choice' | 'select_all')}
      />

      <TextInput
        label="Attribute label"
        placeholder="e.g. gender, age, dietary_restriction"
        description="Short identifier used in data exports"
        value={attribute}
        onChange={(e) => setAttribute(e.target.value)}
        required
      />

      <Textarea
        label="Question wording"
        placeholder="e.g. Please indicate your age."
        value={wording}
        onChange={(e) => setWording(e.target.value)}
        minRows={2}
        required
      />

      {(demoType === 'multiple_choice' || demoType === 'select_all') && (
        <OptionsEditor options={options} onChange={setOptions} />
      )}

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} color="teal">
          {existing ? 'Save Changes' : 'Add Question'}
        </Button>
      </Group>
    </Stack>
  )
}

// ── Question Sets panel ────────────────────────────────────────────────────────

function QuestionSetsPanel() {
  const qc = useQueryClient()
  const [saveOpen, { open: openSave, close: closeSave }] = useDisclosure(false)
  const [loadOpen, { open: openLoad, close: closeLoad }] = useDisclosure(false)
  const [newSetName, setNewSetName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ['sensory-question-sets'],
    queryFn: listQuestionSets,
  })

  const handleSave = async () => {
    if (!newSetName.trim()) {
      notifications.show({ message: 'Name is required', color: 'red' })
      return
    }
    setSaving(true)
    try {
      await createQuestionSet(newSetName.trim())
      await qc.invalidateQueries({ queryKey: ['sensory-question-sets'] })
      setNewSetName('')
      closeSave()
      notifications.show({ message: 'Question set saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save question set', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = async () => {
    const id = selectedSetId ? Number(selectedSetId) : null
    if (!id) return
    const set = sets.find((s) => s.id === id)
    modals.openConfirmModal({
      title: 'Load question set',
      children: (
        <Text size="sm">
          Loading <strong>{set?.name}</strong> will replace all current demographic and sample questions.
          This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Load', cancel: 'Cancel' },
      confirmProps: { color: 'indigo' },
      onConfirm: async () => {
        setLoadingId(id)
        try {
          await loadQuestionSet(id)
          await qc.invalidateQueries({ queryKey: ['sensory-questions'] })
          closeLoad()
          setSelectedSetId(null)
          notifications.show({ message: `Loaded "${set?.name}"`, color: 'green' })
        } catch {
          notifications.show({ message: 'Failed to load question set', color: 'red' })
        } finally {
          setLoadingId(null)
        }
      },
    })
  }

  const handleDelete = (set: SensoryQuestionSetSummary) => {
    modals.openConfirmModal({
      title: 'Delete question set',
      children: <Text size="sm">Delete "{set.name}"? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteQuestionSet(set.id)
          await qc.invalidateQueries({ queryKey: ['sensory-question-sets'] })
        } catch {
          notifications.show({ message: 'Delete failed', color: 'red' })
        }
      },
    })
  }

  return (
    <>
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={600} size="sm">Question Sets</Text>
              <Text size="xs" c="dimmed">
                Save the current demographic + sample questions as a named preset. Load a preset to replace the active question list entirely.
              </Text>
            </Stack>
            <Group gap="xs">
              <Button size="sm" variant="default" leftSection={<IconFolderOpen size={14} />}
                onClick={openLoad} disabled={sets.length === 0}>
                Load set
              </Button>
              <Button size="sm" color="indigo" leftSection={<IconDeviceFloppy size={14} />}
                onClick={openSave}>
                Save as set
              </Button>
            </Group>
          </Group>

          {isLoading ? (
            <Center py="sm"><Loader size="sm" /></Center>
          ) : sets.length === 0 ? (
            <Text size="sm" c="dimmed">No saved question sets yet.</Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th w={120}>Questions</Table.Th>
                  <Table.Th w={160}>Saved</Table.Th>
                  <Table.Th w={80} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sets.map((set) => (
                  <Table.Tr key={set.id}>
                    <Table.Td><Text size="sm" fw={500}>{set.name}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{set.question_count}</Text></Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(set.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          loading={loadingId === set.id}
                          onClick={() => {
                            setSelectedSetId(String(set.id))
                            modals.openConfirmModal({
                              title: 'Load question set',
                              children: (
                                <Text size="sm">
                                  Loading <strong>{set.name}</strong> will replace all current demographic and sample questions.
                                  This cannot be undone.
                                </Text>
                              ),
                              labels: { confirm: 'Load', cancel: 'Cancel' },
                              confirmProps: { color: 'indigo' },
                              onConfirm: async () => {
                                setLoadingId(set.id)
                                try {
                                  await loadQuestionSet(set.id)
                                  await qc.invalidateQueries({ queryKey: ['sensory-questions'] })
                                  notifications.show({ message: `Loaded "${set.name}"`, color: 'green' })
                                } catch {
                                  notifications.show({ message: 'Failed to load question set', color: 'red' })
                                } finally {
                                  setLoadingId(null)
                                }
                              },
                            })
                          }}
                        >
                          Load
                        </Button>
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(set)}>
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      {/* Save modal */}
      <Modal opened={saveOpen} onClose={closeSave} title="Save question set" size="sm">
        <Stack>
          <TextInput
            label="Name"
            placeholder="e.g. Standard Blueberry Panel 2026"
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            autoFocus
          />
          <Text size="xs" c="dimmed">
            Saves a snapshot of all current demographic and sample questions.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeSave}>Cancel</Button>
            <Button color="indigo" loading={saving} onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Load modal (kept for the top-level Load set button) */}
      <Modal opened={loadOpen} onClose={closeLoad} title="Load question set" size="sm">
        <Stack>
          <Select
            label="Select a saved set"
            data={sets.map((s) => ({ value: String(s.id), label: `${s.name} (${s.question_count} questions)` }))}
            value={selectedSetId}
            onChange={setSelectedSetId}
            placeholder="Choose a question set"
          />
          <Text size="xs" c="dimmed">
            This will replace all current demographic and sample questions with the saved snapshot.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeLoad}>Cancel</Button>
            <Button color="indigo" disabled={!selectedSetId} loading={loadingId !== null} onClick={handleLoad}>
              Load
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function SensoryPanels() {
  const qc = useQueryClient()
  const [addOpen, { open: openAdd, close: closeAdd }] = useDisclosure(false)
  const [addDemoOpen, { open: openAddDemo, close: closeAddDemo }] = useDisclosure(false)
  const [editQuestion, setEditQuestion] = useState<SensoryQuestion | null>(null)
  const [editDemoQuestion, setEditDemoQuestion] = useState<SensoryQuestion | null>(null)
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

  const demographicQuestions = questions.filter((q) => q.demographic_key !== null)
  const experimentalQuestions = questions.filter((q) => q.demographic_key === null)

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

  const handleMove = async (list: SensoryQuestion[], idx: number, dir: 1 | -1, isDemographic: boolean) => {
    const toIdx = idx + dir
    if (toIdx < 0 || toIdx >= list.length) return
    const reordered = [...list]
    ;[reordered[idx], reordered[toIdx]] = [reordered[toIdx], reordered[idx]]
    if (isDemographic) {
      // Demographics always come first; reindex from 0
      const payload = reordered.map((q, i) => ({ id: q.id, order_index: i }))
      await reorderQuestions(payload)
    } else {
      const demoMax = demographicQuestions.length
      const payload = reordered.map((q, i) => ({ id: q.id, order_index: demoMax + i }))
      await reorderQuestions(payload)
    }
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
          <Stack>
            <Text size="sm" c="dimmed">
              Define the live question set used right now. Results are stored separately and keep their own snapshot of each question, so you can change this list at any time without affecting past data.
            </Text>

            {/* Sample setup */}
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
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={600} size="sm">Panelist Background & Demographics</Text>
                    <Text size="xs" c="dimmed">Collected once per panelist before tasting.</Text>
                  </Stack>
                  <Button size="sm" leftSection={<IconPlus size={14} />} color="teal" onClick={openAddDemo}>
                    Add question
                  </Button>
                </Group>

                {demographicQuestions.length === 0 ? (
                  <Center py="lg">
                    <Stack align="center" gap="xs">
                      <ThemeIcon size="xl" variant="light" color="teal"><IconFlask size={24} /></ThemeIcon>
                      <Text size="sm" c="dimmed">No demographic questions yet. Add one to get started.</Text>
                    </Stack>
                  </Center>
                ) : (
                  <ScrollArea>
                    <Table withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th w={32}>#</Table.Th>
                          <Table.Th w={120}>Format</Table.Th>
                          <Table.Th w={130}>Attribute</Table.Th>
                          <Table.Th>Wording</Table.Th>
                          <Table.Th w={72}>Enabled</Table.Th>
                          <Table.Th w={110} />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {demographicQuestions.map((q, i) => (
                          <Table.Tr key={q.id} style={{ opacity: q.enabled ? 1 : 0.45 }}>
                            <Table.Td>
                              <Text size="xs" c="dimmed" fw={600}>{i + 1}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color={q.question_type === 'select_all' ? 'grape' : 'teal'}>
                                {q.question_type === 'select_all' ? 'Select all' : q.options.length > 0 ? 'Multiple choice' : 'Text input'}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={600}>{q.attribute ?? q.demographic_key ?? '—'}</Text>
                            </Table.Td>
                            <Table.Td style={{ maxWidth: 320 }}>
                              <Text size="xs" c="dimmed" lineClamp={2}>{q.wording}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Switch size="xs" checked={q.enabled} onChange={() => handleToggle(q)} />
                            </Table.Td>
                            <Table.Td>
                              <Group gap={2} wrap="nowrap">
                                <ActionIcon size="sm" variant="subtle" disabled={i === 0}
                                  onClick={() => handleMove(demographicQuestions, i, -1, true)}>
                                  <IconArrowUp size={13} />
                                </ActionIcon>
                                <ActionIcon size="sm" variant="subtle" disabled={i === demographicQuestions.length - 1}
                                  onClick={() => handleMove(demographicQuestions, i, 1, true)}>
                                  <IconArrowDown size={13} />
                                </ActionIcon>
                                <ActionIcon size="sm" variant="subtle"
                                  onClick={() => setEditDemoQuestion(q)}>
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
                                  onClick={() => handleMove(experimentalQuestions, i, -1, false)}>
                                  <IconArrowUp size={13} />
                                </ActionIcon>
                                <ActionIcon size="sm" variant="subtle" disabled={i === experimentalQuestions.length - 1}
                                  onClick={() => handleMove(experimentalQuestions, i, 1, false)}>
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

            {/* Question sets */}
            <QuestionSetsPanel />

            {/* Modals */}
            <Modal opened={addOpen} onClose={closeAdd} title="Add sample question" size="lg">
              <QuestionFormModal onClose={closeAdd} />
            </Modal>

            <Modal opened={!!editQuestion} onClose={() => setEditQuestion(null)}
              title={`Edit — ${editQuestion?.attribute || 'Question'}`} size="lg">
              {editQuestion && (
                <QuestionFormModal existing={editQuestion} onClose={() => setEditQuestion(null)} />
              )}
            </Modal>

            <Modal opened={addDemoOpen} onClose={closeAddDemo} title="Add demographic question" size="lg">
              <DemographicFormModal onClose={closeAddDemo} />
            </Modal>

            <Modal opened={!!editDemoQuestion} onClose={() => setEditDemoQuestion(null)}
              title={`Edit — ${editDemoQuestion?.attribute ?? editDemoQuestion?.demographic_key ?? 'Demographic question'}`} size="lg">
              {editDemoQuestion && (
                <DemographicFormModal existing={editDemoQuestion} onClose={() => setEditDemoQuestion(null)} />
              )}
            </Modal>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

const PER_PAGE = 50

const ET_LOCALE = 'en-US'
const ET_TZ = 'America/New_York'

function toET(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(ET_LOCALE, { timeZone: ET_TZ, month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

function pivotBerryResults(results: SensoryResult[]) {
  const experimental = results.filter((r) => r.sample_number != null)
  const attributes = Array.from(new Set(experimental.map((r) => r.attribute ?? r.wording ?? ''))).filter(Boolean)
  const byKey: Record<string, { panelist_id: string; sample_number: string; cols: Record<string, string>; submitted_at: string }> = {}
  for (const r of experimental) {
    const key = `${r.panelist_id}||${r.sample_number}`
    if (!byKey[key]) byKey[key] = { panelist_id: r.panelist_id, sample_number: r.sample_number!, cols: {}, submitted_at: r.recorded_at ?? '' }
    byKey[key].cols[r.attribute ?? r.wording ?? ''] = r.response ?? ''
    if (r.recorded_at && r.recorded_at > byKey[key].submitted_at) byKey[key].submitted_at = r.recorded_at
  }
  const rows = Object.values(byKey).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  return { rows, attributes }
}

function pivotDemoResults(results: SensoryResult[]) {
  const demographic = results.filter((r) => r.sample_number == null)
  const demoAttributes = Array.from(new Set(demographic.map((r) => r.attribute ?? r.wording ?? ''))).filter(Boolean)
  const byPanelist: Record<string, { panelist_id: string; cols: Record<string, string>; submitted_at: string }> = {}
  for (const r of demographic) {
    if (!byPanelist[r.panelist_id]) byPanelist[r.panelist_id] = { panelist_id: r.panelist_id, cols: {}, submitted_at: r.recorded_at ?? '' }
    byPanelist[r.panelist_id].cols[r.attribute ?? r.wording ?? ''] = r.response ?? ''
    if (r.recorded_at && r.recorded_at > byPanelist[r.panelist_id].submitted_at) byPanelist[r.panelist_id].submitted_at = r.recorded_at
  }
  const rows = Object.values(byPanelist).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  return { rows, demoAttributes }
}

function downloadCsv(filename: string, headers: string[], csvRows: string[][]) {
  const escape = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
  const lines = [headers.join(','), ...csvRows.map((r) => r.map(escape).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines], { type: 'text/csv' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function ResultsTab() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<string | null>('berry')
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState<'berry' | 'demo' | 'combined' | null>(null)

  const { data: dates = [], isLoading: datesLoading } = useQuery({
    queryKey: ['sensory-result-dates'],
    queryFn: getSensoryResultDates,
  })

  const { data: setup } = useQuery({
    queryKey: ['sensory-setup'],
    queryFn: getSensorySetup,
  })

  const sampleMap: Record<string, string> = {}
  for (const s of setup?.samples ?? []) {
    if (s.real_identifier) sampleMap[s.sample_number] = s.real_identifier
  }

  const { data: pageData, isLoading: resultsLoading } = useQuery({
    queryKey: ['sensory-results', selectedDate, page],
    queryFn: () => getSensoryResults(selectedDate!, page, PER_PAGE),
    enabled: !!selectedDate,
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0])
  }, [dates, selectedDate])

  useEffect(() => { setPage(1) }, [selectedDate, subTab])

  const fetchAll = async () => {
    if (!selectedDate) return []
    const first = await getSensoryResults(selectedDate, 1, 10000)
    return first.results
  }

  const handleDownloadBerry = async () => {
    setDownloading('berry')
    try {
      const all = await fetchAll()
      const { rows, attributes } = pivotBerryResults(all)
      const headers = ['submitted_at_et', 'panelist_id', 'sample_number', 'real_identifier', ...attributes]
      const csvRows = rows.map((row) => [
        toET(row.submitted_at), row.panelist_id, row.sample_number, sampleMap[row.sample_number] ?? '',
        ...attributes.map((a) => row.cols[a] ?? ''),
      ])
      downloadCsv(`berry_results_${selectedDate}.csv`, headers, csvRows)
    } finally { setDownloading(null) }
  }

  const handleDownloadDemo = async () => {
    setDownloading('demo')
    try {
      const all = await fetchAll()
      const { rows, demoAttributes } = pivotDemoResults(all)
      const headers = ['submitted_at_et', 'panelist_id', ...demoAttributes]
      const csvRows = rows.map((row) => [
        toET(row.submitted_at), row.panelist_id,
        ...demoAttributes.map((a) => row.cols[a] ?? ''),
      ])
      downloadCsv(`demographics_${selectedDate}.csv`, headers, csvRows)
    } finally { setDownloading(null) }
  }

  const handleDownloadCombined = async () => {
    setDownloading('combined')
    try {
      const all = await fetchAll()
      const { rows: berryRows, attributes } = pivotBerryResults(all)
      const { demoAttributes, rows: demoRows } = pivotDemoResults(all)
      const demoMap: Record<string, (typeof demoRows)[0]> = {}
      for (const r of demoRows) demoMap[r.panelist_id] = r
      const headers = ['submitted_at_et', 'panelist_id', 'sample_number', 'real_identifier', ...demoAttributes, ...attributes]
      const csvRows = berryRows.map((row) => [
        toET(row.submitted_at), row.panelist_id, row.sample_number, sampleMap[row.sample_number] ?? '',
        ...demoAttributes.map((a) => demoMap[row.panelist_id]?.cols[a] ?? ''),
        ...attributes.map((a) => row.cols[a] ?? ''),
      ])
      downloadCsv(`combined_results_${selectedDate}.csv`, headers, csvRows)
    } finally { setDownloading(null) }
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
  const { rows: berryRows, attributes } = pivotBerryResults(results)
  const { rows: demoRows, demoAttributes } = pivotDemoResults(results)

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
        <Group gap="xs">
          <Button size="xs" variant="default" leftSection={<IconDownload size={13} />}
            disabled={!totalPairs} loading={downloading === 'berry'} onClick={handleDownloadBerry}>
            Berry CSV
          </Button>
          <Button size="xs" variant="default" leftSection={<IconDownload size={13} />}
            disabled={!totalPairs} loading={downloading === 'demo'} onClick={handleDownloadDemo}>
            Demographics CSV
          </Button>
          <Button size="xs" variant="filled" leftSection={<IconDownload size={13} />}
            disabled={!totalPairs} loading={downloading === 'combined'} onClick={handleDownloadCombined}>
            Combined CSV
          </Button>
        </Group>
      </Group>

      <Tabs value={subTab} onChange={setSubTab}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="berry">Berry Results</Tabs.Tab>
          <Tabs.Tab value="demo">Demographics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="berry">
          {resultsLoading && !pageData ? (
            <Center p="xl"><Loader /></Center>
          ) : berryRows.length === 0 ? (
            <Paper withBorder p="xl" radius="md"><Center><Text c="dimmed">No berry responses for this date.</Text></Center></Paper>
          ) : (
            <Stack gap="sm">
              <Paper withBorder radius="md" style={{ overflow: 'hidden', opacity: resultsLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <ScrollArea>
                  <Table striped highlightOnHover withColumnBorders style={{ whiteSpace: 'nowrap' }}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Submitted (ET)</Table.Th>
                        <Table.Th>Panelist</Table.Th>
                        <Table.Th>Sample</Table.Th>
                        <Table.Th>Berry</Table.Th>
                        {attributes.map((col) => <Table.Th key={col}>{col}</Table.Th>)}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {berryRows.map((row) => (
                        <Table.Tr key={`${row.panelist_id}||${row.sample_number}`}>
                          <Table.Td style={{ color: 'var(--mantine-color-dimmed)', fontSize: '0.8rem' }}>{toET(row.submitted_at)}</Table.Td>
                          <Table.Td>{row.panelist_id}</Table.Td>
                          <Table.Td>{row.sample_number}</Table.Td>
                          <Table.Td c="dimmed">{sampleMap[row.sample_number] ?? '—'}</Table.Td>
                          {attributes.map((col) => <Table.Td key={col}>{row.cols[col] ?? '—'}</Table.Td>)}
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">{totalPairs} panelist–sample pairs · page {page} of {totalPages}</Text>
                <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
              </Group>
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="demo">
          {resultsLoading && !pageData ? (
            <Center p="xl"><Loader /></Center>
          ) : demoRows.length === 0 ? (
            <Paper withBorder p="xl" radius="md"><Center><Text c="dimmed">No demographic responses for this date.</Text></Center></Paper>
          ) : (
            <Paper withBorder radius="md" style={{ overflow: 'hidden', opacity: resultsLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <ScrollArea>
                <Table striped highlightOnHover withColumnBorders style={{ whiteSpace: 'nowrap' }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Submitted (ET)</Table.Th>
                      <Table.Th>Panelist</Table.Th>
                      {demoAttributes.map((col) => <Table.Th key={col}>{col}</Table.Th>)}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {demoRows.map((row) => (
                      <Table.Tr key={row.panelist_id}>
                        <Table.Td style={{ color: 'var(--mantine-color-dimmed)', fontSize: '0.8rem' }}>{toET(row.submitted_at)}</Table.Td>
                        <Table.Td>{row.panelist_id}</Table.Td>
                        {demoAttributes.map((col) => <Table.Td key={col}>{row.cols[col] ?? '—'}</Table.Td>)}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
