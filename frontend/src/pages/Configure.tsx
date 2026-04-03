import { useState } from 'react'
import {
  Title, Stack, Group, Button, TextInput, Paper, Text, ActionIcon,
  Tabs, Divider, Select,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getWhitelist, addToWhitelist, removeFromWhitelist } from '../api/whitelist'
import { getOptions, addOption, deleteOption } from '../api/options'

const OPTION_TYPES = ['stage', 'site', 'block', 'project', 'post_harvest', 'ph_range', 'brix_range', 'tta_range']

function WhitelistTab() {
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const qc = useQueryClient()
  const { data: emails = [] } = useQuery({ queryKey: ['whitelist'], queryFn: getWhitelist })

  const handleAdd = async () => {
    if (!newEmail.trim()) return
    setAdding(true)
    try {
      await addToWhitelist(newEmail.trim())
      qc.invalidateQueries({ queryKey: ['whitelist'] })
      setNewEmail('')
      notifications.show({ message: 'Email added', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to add email', color: 'red' })
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = (email: string) => {
    modals.openConfirmModal({
      title: 'Remove email',
      children: <Text size="sm">Remove <strong>{email}</strong> from the whitelist?</Text>,
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await removeFromWhitelist(email)
          qc.invalidateQueries({ queryKey: ['whitelist'] })
          notifications.show({ message: 'Email removed', color: 'green' })
        } catch {
          notifications.show({ message: 'Failed to remove email', color: 'red' })
        }
      },
    })
  }

  return (
    <Stack>
      <Group>
        <TextInput
          placeholder="new@example.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1 }}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={handleAdd} loading={adding}>Add</Button>
      </Group>
      <Divider />
      <Stack gap="xs">
        {emails.map((email) => (
          <Paper key={email} withBorder p="xs" radius="sm">
            <Group justify="space-between">
              <Text size="sm">{email}</Text>
              <ActionIcon color="red" variant="subtle" onClick={() => handleRemove(email)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  )
}

function OptionsTab() {
  const [selectedType, setSelectedType] = useState<string>(OPTION_TYPES[0])
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const qc = useQueryClient()
  const { data: options = [] } = useQuery({ queryKey: ['options'], queryFn: getOptions })

  const filtered = options.filter((o) => o.option_type === selectedType)
  const isRange = selectedType.endsWith('_range')

  const handleAdd = async () => {
    if (!newText.trim()) return
    if (isRange && !/^\d+\.?\d*-\d+\.?\d*$/.test(newText.trim())) {
      notifications.show({ message: 'Range must be in format min-max (e.g. 3.0-4.0)', color: 'red' })
      return
    }
    setAdding(true)
    try {
      await addOption(selectedType, newText.trim())
      qc.invalidateQueries({ queryKey: ['options'] })
      setNewText('')
      notifications.show({ message: 'Option added', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to add option', color: 'red' })
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = (id: number, text: string) => {
    modals.openConfirmModal({
      title: 'Delete option',
      children: <Text size="sm">Delete option <strong>{text}</strong>?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteOption(id)
          qc.invalidateQueries({ queryKey: ['options'] })
          notifications.show({ message: 'Option deleted', color: 'green' })
        } catch {
          notifications.show({ message: 'Failed to delete', color: 'red' })
        }
      },
    })
  }

  return (
    <Stack>
      <Select
        label="Option type"
        data={OPTION_TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))}
        value={selectedType}
        onChange={(v) => setSelectedType(v!)}
        w={200}
      />
      <Group>
        <TextInput
          placeholder={isRange ? 'e.g. 3.0-4.0' : 'New option text'}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1 }}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={handleAdd} loading={adding}>Add</Button>
      </Group>
      <Divider />
      <Stack gap="xs">
        {filtered.length === 0 && <Text c="dimmed" size="sm">No options for this type.</Text>}
        {filtered.map((opt) => (
          <Paper key={opt.id} withBorder p="xs" radius="sm">
            <Group justify="space-between">
              <Text size="sm">{opt.option_text}</Text>
              <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(opt.id, opt.option_text)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        ))}
      </Stack>
    </Stack>
  )
}

export function Configure() {
  return (
    <Stack>
      <Title order={3}>Configure</Title>
      <Paper withBorder p="md" radius="md">
        <Tabs defaultValue="whitelist">
          <Tabs.List>
            <Tabs.Tab value="whitelist">Email Whitelist</Tabs.Tab>
            <Tabs.Tab value="options">Dropdown Options</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="whitelist" pt="md"><WhitelistTab /></Tabs.Panel>
          <Tabs.Panel value="options" pt="md"><OptionsTab /></Tabs.Panel>
        </Tabs>
      </Paper>
    </Stack>
  )
}
