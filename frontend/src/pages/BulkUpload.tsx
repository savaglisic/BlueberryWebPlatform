import { Container, Title, Text, Stack } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'

export function BulkUpload() {
  return (
    <Container size="md" pt="xl">
      <Stack align="center" gap="md" pt={60}>
        <IconUpload size={64} stroke={1} opacity={0.3} />
        <Title order={2}>Bulk Upload</Title>
        <Text c="dimmed">Coming soon.</Text>
      </Stack>
    </Container>
  )
}
