import { Badge, Group, Paper, Text, Timeline } from '@mantine/core'
import { IconCheck, IconHistory } from '@tabler/icons-react'
import type { TissueHistoryEvent, TissueQuestion } from '../api/tissue'

export function TissueHistory({ history, questions }: { history: TissueHistoryEvent[]; questions: TissueQuestion[] }) {
  const labels = new Map(questions.map((question) => [question.field_key, question.label]))
  if (!history.length) return <Text c="dimmed" size="sm">No saved history is available yet.</Text>
  return (
    <Timeline active={history.length} bulletSize={28} lineWidth={2}>
      {history.map((event, index) => (
        <Timeline.Item
          key={event.id}
          bullet={index === 0 ? <IconCheck size={15} /> : <IconHistory size={15} />}
          title={event.action === 'created' ? 'Plant record created' : 'Plant record updated'}
        >
          <Text size="xs" c="dimmed">{new Date(event.recorded_at).toLocaleString()}{event.user_email ? ` by ${event.user_email}` : ''}</Text>
          {event.combined_name && <Badge mt={6} variant="light" style={{ textTransform: 'none' }}>{event.combined_name}</Badge>}
          {event.changed_fields.length > 0 && (
            <Paper withBorder p="xs" mt="xs">
              <Text size="xs" fw={600} mb={4}>Fields saved in this version</Text>
              <Group gap={4}>{event.changed_fields.map((field) => <Badge key={field} size="xs" variant="outline" color="gray">{labels.get(field) ?? field}</Badge>)}</Group>
            </Paper>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  )
}
