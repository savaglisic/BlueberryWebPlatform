import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon, Alert, Badge, Button, Group, Loader, Modal, Paper, Progress, SimpleGrid,
  Stack, Text, TextInput, ThemeIcon, Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { IconAlertTriangle, IconBarcode, IconCheck, IconChevronLeft, IconChevronRight, IconCloudCheck, IconCloudUpload, IconDna, IconHistory, IconX } from '@tabler/icons-react'
import { isAxiosError } from 'axios'
import type { TissueRecord } from '../api/tissue'
import { getTissueQuestions, getTissueRecentValues, getTissueRecord, saveTissueDraft, saveTissueRecord } from '../api/tissue'
import { TissueFieldInput } from '../components/TissueFieldInput'
import { TissueHistory } from '../components/TissueHistory'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

const hasValue = (value: unknown) => value !== '' && value !== null && value !== undefined

function combinedName(answers: Record<string, unknown>) {
  const genotype = String(answers.genotype ?? '').trim()
  const vector = String(answers.vector_number ?? '').trim()
  const explant = String(answers.explant_number ?? '').trim()
  const shoot = String(answers.shoot_number ?? '').trim()
  return genotype && vector && explant && shoot ? `${genotype}_V${vector}_M${explant}-${shoot}` : 'Complete the four identity fields to generate'
}

export function TissueLab() {
  const [barcode, setBarcode] = useState('')
  const [activeBarcode, setActiveBarcode] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [step, setStep] = useState(0)
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState(false)
  const [loadedRecord, setLoadedRecord] = useState<TissueRecord | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftDirty, setDraftDirty] = useState(false)
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const barcodeRef = useRef<HTMLInputElement>(null)
  const draftSequence = useRef(0)
  const finalizing = useRef(false)
  const { data: questions = [], isLoading } = useQuery({ queryKey: ['tissue-questions'], queryFn: getTissueQuestions })
  const { data: recentValues = {} } = useQuery({ queryKey: ['tissue-recent-values'], queryFn: getTissueRecentValues })
  const question = questions[step]
  const isReview = step === questions.length

  const reset = useCallback(() => {
    draftSequence.current += 1
    finalizing.current = false
    setBarcode(''); setActiveBarcode(''); setAnswers({}); setStep(0); setExisting(false); setLoadedRecord(null); setHistoryOpen(false); setDraftReady(false); setDraftDirty(false); setDraftState('idle')
    window.setTimeout(() => barcodeRef.current?.focus(), 50)
  }, [])

  const lookup = useCallback(async (raw: string) => {
    const code = raw.trim()
    if (code.length < 4) {
      notifications.show({ message: 'Enter or scan a barcode with at least 4 characters.', color: 'orange' })
      return
    }
    setLookingUp(true)
    setDraftReady(false)
    setDraftDirty(false)
    try {
      const record = await getTissueRecord(code)
      setAnswers(record.answers || {})
      setExisting(true)
      setLoadedRecord(record)
      const resumeStep = record.status === 'incomplete' ? Math.min(record.current_step || 0, Math.max(questions.length - 1, 0)) : 0
      setStep(resumeStep)
      notifications.show({
        message: record.status === 'incomplete'
          ? `Incomplete record resumed at question ${resumeStep + 1}.`
          : 'Existing plant loaded. Changes will update its history.',
        color: record.status === 'incomplete' ? 'orange' : 'blue',
      })
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 404) {
        notifications.show({ message: 'Could not look up this barcode.', color: 'red' })
        setLookingUp(false)
        return
      }
      setAnswers({})
      setExisting(false)
      setLoadedRecord(null)
      setStep(0)
      try {
        await saveTissueDraft(code, {}, 0)
      } catch {
        notifications.show({ message: 'Could not start an autosaved draft.', color: 'red' })
        setLookingUp(false)
        return
      }
    }
    setBarcode(code)
    setActiveBarcode(code)
    setDraftReady(true)
    setDraftState('saved')
    setLookingUp(false)
  }, [questions.length])

  useBarcodeScanner(useCallback((scanned) => {
    setBarcode(scanned.trim())
    void lookup(scanned)
  }, [lookup]))

  useEffect(() => {
    if (!activeBarcode || !draftReady || !draftDirty || finalizing.current) return
    const sequence = ++draftSequence.current
    setDraftState('saving')
    const timer = window.setTimeout(() => {
      saveTissueDraft(activeBarcode, answers, step)
        .then(() => { if (sequence === draftSequence.current && !finalizing.current) { setDraftState('saved'); setDraftDirty(false) } })
        .catch(() => { if (sequence === draftSequence.current) setDraftState('idle') })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [activeBarcode, answers, draftDirty, draftReady, step])

  useEffect(() => {
    if (!activeBarcode || !draftReady || !draftDirty) return
    const flushDraft = () => {
      void fetch(`/api/tissue/records/${encodeURIComponent(activeBarcode)}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, current_step: step }),
        keepalive: true,
      })
    }
    window.addEventListener('pagehide', flushDraft)
    return () => window.removeEventListener('pagehide', flushDraft)
  }, [activeBarcode, answers, draftDirty, draftReady, step])

  const warning = useMemo(() => {
    if (!question || question.input_type !== 'number' || !hasValue(answers[question.field_key])) return ''
    const value = Number(answers[question.field_key])
    if (question.min_value !== null && value < question.min_value) return `This is below the expected minimum of ${question.min_value}.`
    if (question.max_value !== null && value > question.max_value) return `This is above the expected maximum of ${question.max_value}.`
    return ''
  }, [answers, question])

  const next = () => {
    if (question?.required && !hasValue(answers[question.field_key])) {
      notifications.show({ message: `${question.label} is required before continuing.`, color: 'orange' })
      return
    }
    setDraftDirty(true)
    setStep((current) => Math.min(questions.length, current + 1))
  }

  const save = async () => {
    const missing = questions.find((item) => item.required && !hasValue(answers[item.field_key]))
    if (missing) {
      setStep(questions.indexOf(missing))
      notifications.show({ message: `Please complete ${missing.label}.`, color: 'orange' })
      return
    }
    finalizing.current = true
    draftSequence.current += 1
    setSaving(true)
    try {
      const record = await saveTissueRecord(activeBarcode, answers)
      notifications.show({ message: `${record.combined_name || activeBarcode} saved successfully.`, color: 'green', icon: <IconCheck size={16} /> })
      reset()
    } catch {
      finalizing.current = false
      notifications.show({ message: 'The tissue sample could not be saved.', color: 'red' })
    } finally { setSaving(false) }
  }

  const startAnother = async () => {
    if (activeBarcode && draftReady && draftDirty && !finalizing.current) {
      try { await saveTissueDraft(activeBarcode, answers, step) } catch { /* The debounced autosave may already have succeeded. */ }
    }
    reset()
  }

  if (isLoading) return <Loader size="sm" />

  return (
    <Stack maw={900} mx="auto">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tissue Sample</Title>
          <Text size="sm" c="dimmed">Scan once, then follow one clear question at a time.</Text>
        </div>
        {activeBarcode && <Button variant="subtle" color="gray" onClick={() => void startAnother()}>Start another</Button>}
      </Group>

      {!activeBarcode ? (
        <Paper withBorder p={{ base: 'lg', sm: 36 }} radius="lg">
          <Stack align="center" gap="md">
            <ThemeIcon size={58} radius="xl" variant="light"><IconBarcode size={30} /></ThemeIcon>
            <div style={{ textAlign: 'center' }}>
              <Text fw={700} size="xl">Scan the plant barcode</Text>
              <Text c="dimmed">A new record will begin, or an existing plant will open automatically.</Text>
            </div>
            <Group w="100%" maw={560} align="flex-end">
              <TextInput
                ref={barcodeRef}
                label="Barcode"
                placeholder="Scan or type a barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.currentTarget.value.slice(0, 64))}
                onKeyDown={(e) => e.key === 'Enter' && void lookup(barcode)}
                size="lg"
                style={{ flex: 1 }}
                autoFocus
                rightSection={barcode ? <ActionIcon variant="subtle" onClick={() => setBarcode('')}><IconX size={16} /></ActionIcon> : null}
              />
              <Button size="lg" onClick={() => void lookup(barcode)} loading={lookingUp}>Begin</Button>
            </Group>
          </Stack>
        </Paper>
      ) : (
        <>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Group gap="xs"><IconDna size={18} /><Text fw={700}>{activeBarcode}</Text>{loadedRecord?.status === 'incomplete' ? <Badge color="orange">Resumed draft</Badge> : existing ? <Badge color="blue">Existing record</Badge> : <Badge color="orange">New draft</Badge>}{loadedRecord?.history?.length ? <Button size="compact-xs" variant="subtle" leftSection={<IconHistory size={14} />} onClick={() => setHistoryOpen(true)}>View {loadedRecord.history.length} saved version{loadedRecord.history.length === 1 ? '' : 's'}</Button> : null}</Group>
              <Group gap="xs"><Text size="xs" c="dimmed">{draftState === 'saving' ? <><IconCloudUpload size={13} style={{ verticalAlign: 'middle' }} /> Saving draft…</> : <><IconCloudCheck size={13} style={{ verticalAlign: 'middle' }} /> Draft saved</>}</Text><Text size="sm" c="dimmed">{isReview ? 'Review' : `Question ${step + 1} of ${questions.length}`}</Text></Group>
            </Group>
            <Progress value={((step + (isReview ? 0 : 1)) / Math.max(questions.length, 1)) * 100} animated={!isReview} />
          </Paper>

          <Paper withBorder p={{ base: 'lg', sm: 32 }} radius="lg" mih={330}>
            {!isReview && question ? (
              <Stack gap="lg">
                <div>
                  <Group gap="xs"><Title order={2}>{question.label}</Title><Badge color={question.required ? 'red' : 'gray'} variant="light">{question.required ? 'Required' : 'Optional'}</Badge></Group>
                </div>
                <TissueFieldInput
                  key={question.id}
                  question={question}
                  value={answers[question.field_key]}
                  onChange={(value) => { setAnswers((current) => ({ ...current, [question.field_key]: value })); setDraftDirty(true) }}
                  autoFocus
                  recentValues={recentValues[question.field_key] ?? []}
                />
                {warning && <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Check this value">{warning} You may continue if it is correct.</Alert>}
                {(question.field_key === 'genotype' || question.field_key === 'vector_number' || question.field_key === 'explant_number' || question.field_key === 'shoot_number') && (
                  <Alert color="indigo" variant="light" title="Combined name preview">{combinedName(answers)}</Alert>
                )}
              </Stack>
            ) : (
              <Stack>
                <div><Title order={2}>Review and save</Title><Text c="dimmed">Confirm the plant identity and answers before saving.</Text></div>
                <Alert color="indigo" title="Combined Name"><Text fw={700}>{combinedName(answers)}</Text></Alert>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  {questions.map((item) => <Paper key={item.id} bg="var(--mantine-color-default-hover)" p="xs"><Text size="xs" c="dimmed">{item.label}</Text><Text size="sm" fw={500}>{answers[item.field_key] === true ? 'Yes' : answers[item.field_key] === false ? 'No' : String(answers[item.field_key] ?? '—')}</Text></Paper>)}
                </SimpleGrid>
              </Stack>
            )}
          </Paper>

          <Group justify="space-between">
            <Button leftSection={<IconChevronLeft size={18} />} variant="default" disabled={step === 0} onClick={() => { setDraftDirty(true); setStep((s) => s - 1) }}>Back</Button>
            {isReview
              ? <Button leftSection={<IconCheck size={18} />} size="md" onClick={() => void save()} loading={saving}>Save tissue record</Button>
              : <Button rightSection={<IconChevronRight size={18} />} size="md" onClick={next}>Continue</Button>}
          </Group>
        </>
      )}
      <Modal opened={historyOpen} onClose={() => setHistoryOpen(false)} title={`Complete history — ${loadedRecord?.combined_name || activeBarcode}`} size="lg">
        <TissueHistory history={loadedRecord?.history ?? []} questions={questions} />
      </Modal>
    </Stack>
  )
}
