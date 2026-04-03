import { useEffect, useRef, useState } from 'react'
import { Title, Stack, Box, ThemeIcon, Text } from '@mantine/core'
import { IconCheck, IconCameraOff } from '@tabler/icons-react'

export function DeepFlavor() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
      })
      .catch((e) => setError(e.message))

    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <Stack p="md" align="center">
      <Title order={2}>DeepFlavor</Title>

      <Box pos="relative" style={{ width: '100%', maxWidth: 720 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={() => setReady(true)}
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 'var(--mantine-radius-md)',
            background: '#000',
            display: 'block',
          }}
        />

        {ready && (
          <ThemeIcon
            color="green"
            variant="filled"
            radius="xl"
            size="lg"
            pos="absolute"
            style={{ bottom: 12, right: 12 }}
          >
            <IconCheck size={18} />
          </ThemeIcon>
        )}

        {error && (
          <Stack
            align="center"
            justify="center"
            pos="absolute"
            style={{ inset: 0, borderRadius: 'var(--mantine-radius-md)', background: 'rgba(0,0,0,0.7)' }}
          >
            <IconCameraOff size={40} color="white" />
            <Text c="white" size="sm">{error}</Text>
          </Stack>
        )}
      </Box>

      {ready && (
        <Text c="green" fw={500}>
          Camera test successful, ready for panels.
        </Text>
      )}
    </Stack>
  )
}
