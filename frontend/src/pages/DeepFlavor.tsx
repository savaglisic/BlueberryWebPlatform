import { useEffect, useState } from 'react'
import { Text, Title, Stack, Loader } from '@mantine/core'

export function DeepFlavor() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deepflavor')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setMessage(data.message))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Stack p="md">
      <Title order={2}>DeepFlavor</Title>
      {loading && <Loader size="sm" />}
      {error && <Text c="red">{error}</Text>}
      {message && <Text>{message}</Text>}
    </Stack>
  )
}
