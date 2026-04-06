import { useState, useCallback } from 'react'
import {
  Stack,
  Title,
  Text,
  Button,
  Group,
  Slider,
  Textarea,
  Box,
  SimpleGrid,
  Center,
  Loader,
  Alert,
  Progress,
  Badge,
  UnstyledButton,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconCheck, IconArrowRight, IconCup } from '@tabler/icons-react'
import type { SensoryQuestion } from '../api/sensory'
import {
  startSession,
  submitDemographics,
  submitSampleResponse,
  type SessionData,
  type ResponsePayload,
} from '../api/deepflavor'

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen =
  | 'welcome'
  | 'identify'
  | 'loading'
  | 'demographics'
  | 'sample_select'
  | 'sample_confirm'
  | 'questions'
  | 'sample_done'
  | 'complete'

// ─── Shared layout ───────────────────────────────────────────────────────────

function ScreenWrap({ children }: { children: React.ReactNode }) {
  return (
    <Center style={{ minHeight: 'calc(100vh - 120px)' }}>
      <Stack gap="xl" align="center" style={{ width: '100%', maxWidth: 680, padding: '0 1rem' }}>
        {children}
      </Stack>
    </Center>
  )
}

// ─── Question renderers ───────────────────────────────────────────────────────

const HEDONIC_LABELS: Record<number, string> = {
  1: 'Dislike\nExtremely',
  2: 'Dislike\nVery Much',
  3: 'Dislike\nModerately',
  4: 'Dislike\nSlightly',
  5: 'Neither\nLike nor\nDislike',
  6: 'Like\nSlightly',
  7: 'Like\nModerately',
  8: 'Like\nVery Much',
  9: 'Like\nExtremely',
}

function Rating9({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value ? parseInt(value) : null
  return (
    <Stack gap="xs" style={{ width: '100%' }}>
      <SimpleGrid cols={9} spacing={6}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <UnstyledButton
            key={n}
            onClick={() => onChange(String(n))}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 4,
              padding: '12px 4px 8px',
              borderRadius: 12,
              border: `2px solid ${selected === n ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-default-border)'}`,
              background: selected === n ? 'var(--mantine-color-blue-light)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Text fw={700} size="xl" c={selected === n ? 'blue' : undefined}>
              {n}
            </Text>
            <Text
              size="10px"
              ta="center"
              c="dimmed"
              lh={1.2}
              style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
            >
              {HEDONIC_LABELS[n]}
            </Text>
          </UnstyledButton>
        ))}
      </SimpleGrid>
      <Group justify="space-between" px={4}>
        <Text size="xs" c="dimmed">
          ← Dislike
        </Text>
        <Text size="xs" c="dimmed">
          Like →
        </Text>
      </Group>
    </Stack>
  )
}

function Slider100({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const numVal = value !== '' ? parseFloat(value) : 50
  return (
    <Stack gap="md" style={{ width: '100%' }}>
      <Center>
        <Text fw={900} style={{ fontSize: '5rem', lineHeight: 1 }} c="blue">
          {Math.round(numVal)}
        </Text>
      </Center>
      <Slider
        value={numVal}
        onChange={(v) => onChange(String(v))}
        min={0}
        max={100}
        step={1}
        size="xl"
        thumbSize={32}
        color="blue"
        label={(v) => String(v)}
        styles={{
          root: { width: '100%' },
          track: { height: 12 },
        }}
      />
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Low
        </Text>
        <Text size="sm" c="dimmed">
          High
        </Text>
      </Group>
    </Stack>
  )
}

function MultipleChoice({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Stack gap="sm" style={{ width: '100%' }}>
      {options.map((opt) => (
        <UnstyledButton
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            width: '100%',
            padding: '18px 24px',
            borderRadius: 14,
            border: `2px solid ${value === opt ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-default-border)'}`,
            background: value === opt ? 'var(--mantine-color-blue-light)' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
            textAlign: 'left',
          }}
        >
          <Text size="lg" fw={value === opt ? 700 : 400} c={value === opt ? 'blue' : undefined}>
            {opt}
          </Text>
        </UnstyledButton>
      ))}
    </Stack>
  )
}

function TextResponse({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder="Type your response here…"
      minRows={4}
      autosize
      size="lg"
      style={{ width: '100%' }}
      styles={{ input: { fontSize: '1.1rem' } }}
    />
  )
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: SensoryQuestion
  value: string
  onChange: (v: string) => void
}) {
  switch (question.question_type) {
    case 'rating_9':
      return <Rating9 value={value} onChange={onChange} />
    case 'slider_100':
      return <Slider100 value={value} onChange={onChange} />
    case 'multiple_choice':
    case 'demographic':
      if (question.options.length > 0)
        return <MultipleChoice options={question.options} value={value} onChange={onChange} />
      return <TextResponse value={value} onChange={onChange} />
    case 'text':
      return <TextResponse value={value} onChange={onChange} />
    case 'instruction':
      return null
    default:
      return <TextResponse value={value} onChange={onChange} />
  }
}

// ─── Number pad ──────────────────────────────────────────────────────────────

function NumPad({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  const handleKey = (k: string) => {
    if (k === 'del') {
      onChange(value.slice(0, -1))
    } else if (value.length < 3) {
      onChange(value + k)
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <Stack gap="md" align="center" style={{ width: '100%', maxWidth: 320 }}>
      {/* Display */}
      <Box
        style={{
          width: '100%',
          padding: '20px 24px',
          borderRadius: 14,
          border: '2px solid var(--mantine-color-default-border)',
          textAlign: 'center',
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fw={900} style={{ fontSize: '3rem', letterSpacing: 8 }}>
          {value || <Text c="dimmed" component="span" style={{ fontSize: '2rem' }}>_ _ _</Text>}
        </Text>
      </Box>

      {/* Pad */}
      <SimpleGrid cols={3} spacing={10} style={{ width: '100%' }}>
        {keys.map((k, i) => (
          <UnstyledButton
            key={i}
            onClick={() => k && handleKey(k)}
            style={{
              height: 72,
              borderRadius: 12,
              border: k ? '2px solid var(--mantine-color-default-border)' : 'none',
              background: k === 'del' ? 'var(--mantine-color-red-light)' : k ? 'var(--mantine-color-default)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: k ? 'pointer' : 'default',
              fontSize: '1.5rem',
              fontWeight: 700,
              transition: 'all 0.1s',
            }}
          >
            {k === 'del' ? '⌫' : k}
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <Button
        size="xl"
        fullWidth
        disabled={value.length === 0}
        onClick={onSubmit}
        rightSection={<IconArrowRight size={20} />}
      >
        Continue
      </Button>
    </Stack>
  )
}

// ─── Cup graphic ──────────────────────────────────────────────────────────────

function CupGraphic({ number }: { number?: string }) {
  return (
    <Stack align="center" gap={4}>
      <Box
        style={{
          width: 120,
          height: 140,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCup size={120} stroke={1.2} color="var(--mantine-color-blue-5)" />
        {number && (
          <Text
            fw={900}
            style={{
              position: 'absolute',
              fontSize: number.length > 2 ? '1.4rem' : '1.8rem',
              color: 'var(--mantine-color-blue-9)',
              textShadow: '0 0 0 transparent',
            }}
          >
            {number}
          </Text>
        )}
      </Box>
    </Stack>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DeepFlavor() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [panelistInput, setPanelistInput] = useState('')
  const [panelistId, setPanelistId] = useState('')
  const [session, setSession] = useState<SessionData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Demographics state
  const [demoIndex, setDemoIndex] = useState(0)
  const [demoResponses, setDemoResponses] = useState<Record<string, string>>({})

  // Sample state
  const [sampleSearch, setSampleSearch] = useState('')
  const [selectedSample, setSelectedSample] = useState<string | null>(null)
  const [completedSamples, setCompletedSamples] = useState<string[]>([])

  // Question state
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questionResponses, setQuestionResponses] = useState<Record<number, string>>({})

  const [submitting, setSubmitting] = useState(false)

  // ── Handlers ──

  const handleBegin = () => {
    setPanelistInput('')
    setScreen('identify')
  }

  const handleIdentify = useCallback(async () => {
    if (!panelistInput) return
    setScreen('loading')
    setLoadError(null)
    try {
      const data = await startSession(panelistInput)
      setSession(data)
      setPanelistId(panelistInput)
      setCompletedSamples(data.completed_samples)

      if (!data.panelist.demographics_complete && data.demographic_questions.length > 0) {
        setDemoIndex(0)
        setDemoResponses({})
        setScreen('demographics')
      } else {
        setScreen('sample_select')
      }
    } catch (e: any) {
      setLoadError(e?.response?.data?.error || 'Failed to load session. Please try again.')
      setScreen('welcome')
    }
  }, [panelistInput])

  const handleDemoNext = useCallback(async () => {
    if (!session) return
    const questions = session.demographic_questions
    const nextIndex = demoIndex + 1

    if (nextIndex < questions.length) {
      setDemoIndex(nextIndex)
    } else {
      // Submit all demo responses
      setSubmitting(true)
      try {
        const payloads: ResponsePayload[] = questions.map((dq) => ({
          question_id: dq.id,
          question_type: dq.question_type,
          attribute: dq.attribute,
          wording: dq.wording,
          demographic_key: dq.demographic_key,
          response: demoResponses[dq.id.toString()] ?? '',
        }))
        await submitDemographics(panelistId, payloads)
        setScreen('sample_select')
      } catch {
        // ignore, still proceed
        setScreen('sample_select')
      } finally {
        setSubmitting(false)
      }
    }
  }, [session, demoIndex, demoResponses, panelistId])

  const handleSampleConfirm = () => {
    if (!selectedSample || !session) return
    setQuestionIndex(0)
    setQuestionResponses({})
    setScreen('questions')
  }

  const handleQuestionNext = useCallback(async () => {
    if (!session || selectedSample === null) return
    const questions = session.live_questions.filter((q) => q.question_type !== 'instruction' || true)
    const nextIndex = questionIndex + 1

    if (nextIndex < questions.length) {
      setQuestionIndex(nextIndex)
    } else {
      // Submit sample responses
      setSubmitting(true)
      try {
        const payloads: ResponsePayload[] = questions.map((q) => ({
          question_id: q.id,
          question_type: q.question_type,
          attribute: q.attribute,
          wording: q.wording,
          demographic_key: null,
          response: questionResponses[q.id] ?? '',
        }))
        await submitSampleResponse(panelistId, selectedSample, payloads)
        const newCompleted = [...completedSamples, selectedSample]
        setCompletedSamples(newCompleted)
        setScreen('sample_done')
      } catch {
        setScreen('sample_done')
      } finally {
        setSubmitting(false)
      }
    }
  }, [session, questionIndex, questionResponses, panelistId, selectedSample, completedSamples])

  const handleSampleDoneNext = () => {
    if (!session) return
    if (completedSamples.length >= session.samples_per_panelist) {
      setScreen('complete')
    } else {
      setSampleSearch('')
      setSelectedSample(null)
      setScreen('sample_select')
    }
  }

  // ── Render screens ──

  if (screen === 'welcome') {
    return (
      <ScreenWrap>
        <Text style={{ fontSize: '5rem' }}>🫐</Text>
        <Stack gap="xs" align="center">
          <Title order={1} style={{ fontSize: '2.8rem', textAlign: 'center' }}>
            Sensory Panel
          </Title>
          <Text size="xl" c="dimmed" ta="center">
            Welcome! Please sit down and tap Begin when you're ready.
          </Text>
        </Stack>
        {loadError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" style={{ width: '100%' }}>
            {loadError}
          </Alert>
        )}
        <Button size="xl" style={{ minWidth: 280, height: 72, fontSize: '1.4rem' }} onClick={handleBegin}>
          Begin
        </Button>
      </ScreenWrap>
    )
  }

  if (screen === 'identify') {
    return (
      <ScreenWrap>
        <Stack gap="xs" align="center">
          <Title order={2} style={{ fontSize: '2rem', textAlign: 'center' }}>
            Enter Your Panelist ID
          </Title>
          <Text c="dimmed" ta="center">
            Use the number on your name tag (1–3 digits)
          </Text>
        </Stack>
        <NumPad value={panelistInput} onChange={setPanelistInput} onSubmit={handleIdentify} />
      </ScreenWrap>
    )
  }

  if (screen === 'loading') {
    return (
      <ScreenWrap>
        <Loader size="xl" />
        <Text size="lg" c="dimmed">
          Loading your session…
        </Text>
      </ScreenWrap>
    )
  }

  if (screen === 'demographics' && session) {
    const questions = session.demographic_questions
    const q = questions[demoIndex]
    if (!q) return null
    const currentVal = demoResponses[q.id.toString()] ?? ''
    const isSlider = q.question_type === 'slider_100'
    const isInstruction = q.question_type === 'instruction'
    const isMC = q.question_type === 'multiple_choice' || (q.question_type === 'demographic' && q.options.length > 0)
    const canAdvance = isInstruction || isSlider || currentVal.trim().length > 0

    return (
      <ScreenWrap>
        {/* Progress */}
        <Stack gap={6} style={{ width: '100%' }}>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              About You — Question {demoIndex + 1} of {questions.length}
            </Text>
          </Group>
          <Progress value={((demoIndex + 1) / questions.length) * 100} size="sm" radius="xl" />
        </Stack>

        {/* Question */}
        <Title order={2} ta="center" style={{ fontSize: '1.8rem' }}>
          {q.wording}
        </Title>

        <QuestionInput
          question={q}
          value={currentVal}
          onChange={(v) => {
            setDemoResponses((prev) => ({ ...prev, [q.id.toString()]: v }))
          }}
        />

        {/* Auto-advance for MC, manual for text */}
        {(isMC && currentVal) || !isMC ? (
          <Button
            size="xl"
            disabled={!canAdvance || submitting}
            loading={submitting}
            onClick={handleDemoNext}
            rightSection={<IconArrowRight size={20} />}
            style={{ minWidth: 240 }}
          >
            {demoIndex + 1 === questions.length ? 'Continue' : 'Next'}
          </Button>
        ) : null}
      </ScreenWrap>
    )
  }

  if (screen === 'sample_select' && session) {
    const remaining = session.all_samples.filter((s) => !completedSamples.includes(s))
    const filtered = sampleSearch
      ? remaining.filter((s) => s.toLowerCase().includes(sampleSearch.toLowerCase()))
      : remaining

    return (
      <ScreenWrap>
        {/* Progress badge */}
        <Badge size="xl" variant="light" color="blue" style={{ fontSize: '1rem', padding: '10px 18px' }}>
          {completedSamples.length} / {session.samples_per_panelist} samples rated
        </Badge>

        <Stack gap="xs" align="center">
          <CupGraphic />
          <Title order={2} ta="center" style={{ fontSize: '2rem' }}>
            Select Your Sample
          </Title>
          <Text c="dimmed" ta="center" size="lg">
            Enter the 3-digit number printed on your cup
          </Text>
        </Stack>

        {remaining.length > 8 && (
          <TextInput
            placeholder="Search sample number…"
            value={sampleSearch}
            onChange={(e) => setSampleSearch(e.currentTarget.value)}
            size="lg"
            style={{ width: '100%' }}
          />
        )}

        <SimpleGrid
          cols={{ base: 3, sm: 4 }}
          spacing="sm"
          style={{ width: '100%' }}
        >
          {filtered.map((s) => (
            <UnstyledButton
              key={s}
              onClick={() => {
                setSelectedSample(s)
                setScreen('sample_confirm')
              }}
              style={{
                padding: '20px 8px',
                borderRadius: 14,
                border: '2px solid var(--mantine-color-default-border)',
                background: 'var(--mantine-color-default)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Text fw={800} size="xl">
                {s}
              </Text>
            </UnstyledButton>
          ))}
        </SimpleGrid>

        {filtered.length === 0 && (
          <Text c="dimmed" ta="center">
            No matching samples found.
          </Text>
        )}
      </ScreenWrap>
    )
  }

  if (screen === 'sample_confirm' && selectedSample) {
    return (
      <ScreenWrap>
        <CupGraphic number={selectedSample} />
        <Stack gap="xs" align="center">
          <Title order={2} style={{ fontSize: '2rem', textAlign: 'center' }}>
            Confirm Your Sample
          </Title>
          <Text size="xl" c="dimmed" ta="center">
            Is{' '}
            <Text component="span" fw={900} size="xl" c="blue">
              {selectedSample}
            </Text>{' '}
            the number printed on your cup?
          </Text>
        </Stack>
        <Stack gap="sm" style={{ width: '100%', maxWidth: 380 }}>
          <Button
            size="xl"
            fullWidth
            onClick={handleSampleConfirm}
            leftSection={<IconCheck size={20} />}
          >
            Yes, that's my cup
          </Button>
          <Button
            size="lg"
            fullWidth
            variant="subtle"
            color="gray"
            onClick={() => {
              setSelectedSample(null)
              setScreen('sample_select')
            }}
          >
            No, go back
          </Button>
        </Stack>
      </ScreenWrap>
    )
  }

  if (screen === 'questions' && session && selectedSample !== null) {
    const questions = session.live_questions
    const q = questions[questionIndex]
    if (!q) return null

    const isInstruction = q.question_type === 'instruction'
    const isSlider = q.question_type === 'slider_100'
    const currentVal = questionResponses[q.id] ?? (isSlider ? '50' : '')
    const canAdvance = isInstruction || isSlider || currentVal.trim().length > 0

    return (
      <ScreenWrap>
        {/* Header */}
        <Stack gap={4} style={{ width: '100%' }}>
          <Group justify="space-between">
            <Badge variant="light" size="lg">
              Sample {selectedSample}
            </Badge>
            <Text size="sm" c="dimmed">
              Question {questionIndex + 1} of {questions.length}
            </Text>
          </Group>
          <Progress value={((questionIndex + 1) / questions.length) * 100} size="sm" radius="xl" />
        </Stack>

        {/* Attribute label */}
        {q.attribute && (
          <Text fw={700} size="lg" c="blue" tt="uppercase" style={{ letterSpacing: 2 }}>
            {q.attribute}
          </Text>
        )}

        {/* Wording */}
        <Title order={2} ta="center" style={{ fontSize: '1.8rem', lineHeight: 1.3 }}>
          {q.wording}
        </Title>

        {/* Input */}
        <QuestionInput
          question={q}
          value={currentVal}
          onChange={(v) => setQuestionResponses((prev) => ({ ...prev, [q.id]: v }))}
        />

        {/* Next button */}
        <Button
          size="xl"
          disabled={!canAdvance || submitting}
          loading={submitting}
          onClick={handleQuestionNext}
          rightSection={!submitting && <IconArrowRight size={20} />}
          style={{ minWidth: 240 }}
        >
          {questionIndex + 1 === questions.length ? 'Submit Sample' : 'Next'}
        </Button>
      </ScreenWrap>
    )
  }

  if (screen === 'sample_done' && session) {
    const done = completedSamples.length
    const total = session.samples_per_panelist
    const finished = done >= total

    return (
      <ScreenWrap>
        <Box
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'var(--mantine-color-green-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCheck size={52} color="var(--mantine-color-green-6)" stroke={2.5} />
        </Box>

        <Stack gap="xs" align="center">
          <Title order={2} style={{ fontSize: '2.2rem', textAlign: 'center' }}>
            Sample {selectedSample} Complete!
          </Title>
          <Text size="xl" c="dimmed" ta="center">
            {done} of {total} samples rated
          </Text>
        </Stack>

        <Progress
          value={(done / total) * 100}
          size="lg"
          radius="xl"
          color="green"
          style={{ width: '100%' }}
        />

        <Button
          size="xl"
          style={{ minWidth: 280, height: 72, fontSize: '1.4rem' }}
          onClick={handleSampleDoneNext}
          color={finished ? 'green' : 'blue'}
          rightSection={!finished && <IconArrowRight size={20} />}
        >
          {finished ? 'Finish' : 'Next Sample'}
        </Button>
      </ScreenWrap>
    )
  }

  if (screen === 'complete') {
    return (
      <ScreenWrap>
        <Text style={{ fontSize: '5rem' }}>🎉</Text>
        <Stack gap="xs" align="center">
          <Title order={1} style={{ fontSize: '2.8rem', textAlign: 'center' }}>
            All Done!
          </Title>
          <Text size="xl" c="dimmed" ta="center">
            Thank you for participating in the sensory panel.
          </Text>
          <Text c="dimmed" ta="center">
            You may leave your cups on the table and return to your seat.
          </Text>
        </Stack>
        <Button
          variant="subtle"
          color="gray"
          onClick={() => {
            setPanelistInput('')
            setPanelistId('')
            setSession(null)
            setDemoIndex(0)
            setDemoResponses({})
            setSelectedSample(null)
            setCompletedSamples([])
            setQuestionIndex(0)
            setQuestionResponses({})
            setScreen('welcome')
          }}
        >
          Start new session
        </Button>
      </ScreenWrap>
    )
  }

  return null
}
