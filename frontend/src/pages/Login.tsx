import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Stack,
  Anchor,
  Alert,
  Center,
  Box,
  Group,
} from '@mantine/core'
import { IconLeaf, IconAlertCircle } from '@tabler/icons-react'
import { login, updateUser, getUserGroup } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const [isNewUser, setIsNewUser] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userName, setUserName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { setUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      if (isNewUser) {
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          return
        }
        await updateUser(email, userName, password)
      }

      const result = await login(email, password)

      if (result.status === 'login_successful') {
        const groupData = await getUserGroup(email)
        setUser({ email, user_group: groupData.user_group })
        navigate('/')
      } else if (result.status === 'incorrect_password') {
        setError('Incorrect password')
      } else if (result.status === 'user_not_found_but_whitelisted') {
        setError('No account found. Create one below.')
        setIsNewUser(true)
      } else if (result.status === 'email_not_whitelisted') {
        setError('This email is not authorized to access BlueWeb.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Center h="100vh">
      <Box w={400}>
        <Stack align="center" mb="xl">
          <IconLeaf size={48} color="var(--mantine-color-green-6)" />
          <Title order={2}>BlueWeb</Title>
          <Text c="dimmed" size="sm">
            {isNewUser ? 'Create your account' : 'Sign in to your account'}
          </Text>
        </Stack>

        <Paper withBorder shadow="sm" p="xl" radius="md">
          <Stack>
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {isNewUser && (
              <TextInput
                label="Display name"
                placeholder="Your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            )}

            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {isNewUser && (
              <PasswordInput
                label="Confirm password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}

            <Button fullWidth onClick={handleSubmit} loading={loading} color="green">
              {isNewUser ? 'Create account' : 'Sign in'}
            </Button>

            <Group justify="center">
              <Anchor size="sm" onClick={() => { setIsNewUser((v) => !v); setError('') }}>
                {isNewUser ? 'Already have an account? Sign in' : "Need an account? Register"}
              </Anchor>
            </Group>
          </Stack>
        </Paper>
      </Box>
    </Center>
  )
}
