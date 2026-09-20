import { useEffect, useState } from 'react'
import { Autocomplete, Button, Group, NumberInput, SegmentedControl, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { listGenotypes } from '../api/genotypes'
import type { TissueQuestion } from '../api/tissue'

interface Props {
  question: TissueQuestion
  value: unknown
  onChange: (value: unknown) => void
  autoFocus?: boolean
  recentValues?: unknown[]
}

export function TissueFieldInput({ question, value, onChange, autoFocus, recentValues = [] }: Props) {
  const [genotypes, setGenotypes] = useState<string[]>([])
  const stringValue = value === null || value === undefined ? '' : String(value)

  useEffect(() => {
    if (question.input_type !== 'genotype') return
    const timer = window.setTimeout(() => {
      listGenotypes(stringValue).then(setGenotypes).catch(() => setGenotypes([]))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [question.input_type, stringValue])

  const hint = question.input_type === 'number' && (question.min_value !== null || question.max_value !== null)
    ? `Expected range: ${question.min_value ?? 'no minimum'}–${question.max_value ?? 'no maximum'}`
    : null

  return (
    <Stack gap={6}>
      {question.help_text && <Text size="sm" c="dimmed">{question.help_text}</Text>}
      {question.input_type === 'number' && (
        <NumberInput
          aria-label={question.label}
          value={value === '' || value == null ? '' : Number(value)}
          onChange={onChange}
          min={question.min_value ?? undefined}
          max={question.max_value ?? undefined}
          clampBehavior="none"
          placeholder={question.placeholder ?? undefined}
          size="lg"
          autoFocus={autoFocus}
        />
      )}
      {question.input_type === 'date' && (
        <TextInput aria-label={question.label} type="date" value={stringValue} onChange={(e) => onChange(e.currentTarget.value)} size="lg" autoFocus={autoFocus} />
      )}
      {question.input_type === 'boolean' && (
        <SegmentedControl
          fullWidth
          size="lg"
          value={value === true ? 'yes' : value === false ? 'no' : ''}
          onChange={(next) => onChange(next === 'yes')}
          data={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
        />
      )}
      {question.input_type === 'textarea' && (
        <Textarea aria-label={question.label} value={stringValue} onChange={(e) => onChange(e.currentTarget.value)} minRows={5} placeholder={question.placeholder ?? undefined} size="lg" autoFocus={autoFocus} />
      )}
      {question.input_type === 'genotype' && (
        <Autocomplete
          aria-label={question.label}
          value={stringValue}
          onChange={onChange}
          data={genotypes}
          placeholder={question.placeholder ?? undefined}
          size="lg"
          autoFocus={autoFocus}
          limit={20}
        />
      )}
      {question.input_type === 'text' && (
        <TextInput aria-label={question.label} value={stringValue} onChange={(e) => onChange(e.currentTarget.value)} placeholder={question.placeholder ?? undefined} size="lg" autoFocus={autoFocus} />
      )}
      {hint && <Text size="xs" c="dimmed">{hint}</Text>}
      {recentValues.length > 0 && !['boolean', 'textarea'].includes(question.input_type) && (
        <div>
          <Text size="xs" c="dimmed" mb={5}>Recently used — click to fill</Text>
          <Group gap={6}>
            {recentValues.slice(0, 3).map((recent) => (
              <Button key={JSON.stringify(recent)} size="compact-sm" variant={String(recent) === stringValue ? 'filled' : 'light'} onClick={() => onChange(recent)}>
                {String(recent)}
              </Button>
            ))}
          </Group>
        </div>
      )}
    </Stack>
  )
}
