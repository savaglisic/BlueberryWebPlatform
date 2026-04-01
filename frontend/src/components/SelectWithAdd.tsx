import { useState } from 'react'
import { Select, Modal, TextInput, Button, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { addOption } from '../api/options'

interface Props {
  label: string
  optionType: string
  data: { value: string; label: string }[]
  value: string | null
  onChange: (value: string | null) => void
  required?: boolean
  clearable?: boolean
}

const ADD_SENTINEL = '__add_new__'

export function SelectWithAdd({ label, optionType, data, value, onChange, required, clearable }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)
  const qc = useQueryClient()

  const augmentedData = [
    ...data,
    { value: ADD_SENTINEL, label: '+ Add new option…' },
  ]

  const handleChange = (val: string | null) => {
    if (val === ADD_SENTINEL) {
      setNewText('')
      setModalOpen(true)
      return
    }
    onChange(val)
  }

  const handleSave = async () => {
    const text = newText.trim()
    if (!text) return
    setSaving(true)
    try {
      await addOption(optionType, text)
      await qc.invalidateQueries({ queryKey: ['options'] })
      onChange(text)
      setModalOpen(false)
      notifications.show({ message: `"${text}" added to ${label}`, color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save option', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Select
        label={label}
        data={augmentedData}
        value={value}
        onChange={handleChange}
        required={required}
        clearable={clearable}
        searchable
      />

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Add new ${label} option`}
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm" c="dimmed">This will be saved and available for all future entries.</Text>
          <TextInput
            label={label}
            placeholder={`New ${label.toLowerCase()} value`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            data-autofocus
          />
          <Button onClick={handleSave} loading={saving} color="indigo">Save & Select</Button>
        </Stack>
      </Modal>
    </>
  )
}
