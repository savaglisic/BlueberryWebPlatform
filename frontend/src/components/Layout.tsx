import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  AppShell,
  Burger,
  Group,
  NavLink as MantineNavLink,
  Text,
  Avatar,
  Menu,
  ActionIcon,
  useMantineColorScheme,
  Divider,
  Stack,
} from '@mantine/core'
import {
  IconPlant2,
  IconFlask,
  IconDatabase,
  IconSearch,
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
  IconLeaf,
} from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'

const allNavItems = [
  { label: 'Add Samples', path: '/add-samples', icon: IconPlant2, adminOnly: false },
  { label: 'FQ Lab', path: '/fq-lab', icon: IconFlask, adminOnly: false },
  { label: 'FQ Database', path: '/fq-database', icon: IconDatabase, adminOnly: true },
  { label: 'Search Pedigree', path: '/search-pedigree', icon: IconSearch, adminOnly: true },
  { label: 'Configure', path: '/configure', icon: IconSettings, adminOnly: true },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = useState(false)
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()

  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" />
            <Group gap="xs">
              <IconLeaf size={24} color="var(--mantine-color-green-6)" />
              <Text fw={700} size="lg">BlueWeb</Text>
            </Group>
          </Group>
          <Group>
            <ActionIcon variant="subtle" onClick={toggleColorScheme} size="lg">
              {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <Menu shadow="md" width={160}>
              <Menu.Target>
                <Avatar
                  size="sm"
                  radius="xl"
                  color="green"
                  style={{ cursor: 'pointer' }}
                >
                  {user?.email?.[0]?.toUpperCase()}
                </Avatar>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.email}</Menu.Label>
                <Menu.Label tt="uppercase" fz="xs" c="dimmed">{user?.user_group}</Menu.Label>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={handleLogout}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          {navItems.map((item) => (
            <MantineNavLink
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              leftSection={<item.icon size={18} />}
              onClick={() => setOpened(false)}
              styles={{ root: { borderRadius: 'var(--mantine-radius-sm)' } }}
            />
          ))}
        </Stack>
        <Divider my="sm" />
        <MantineNavLink
          label="Logout"
          leftSection={<IconLogout size={18} />}
          color="red"
          onClick={handleLogout}
          styles={{ root: { borderRadius: 'var(--mantine-radius-sm)' } }}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
