import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  AppShell,
  Burger,
  Group,
  NavLink as MantineNavLink,
  ActionIcon,
  useMantineColorScheme,
  Stack,
  Image,
} from '@mantine/core'
import {
  IconPlant2,
  IconFlask,
  IconDatabase,
  IconSearch,
  IconSettings,
  IconSun,
  IconMoon,
} from '@tabler/icons-react'

const navItems = [
  { label: 'Add Samples', path: '/add-samples', icon: IconPlant2 },
  { label: 'FQ Lab', path: '/fq-lab', icon: IconFlask },
  { label: 'FQ Database', path: '/fq-database', icon: IconDatabase },
  { label: 'Search Pedigree', path: '/search-pedigree', icon: IconSearch },
  { label: 'Configure', path: '/configure', icon: IconSettings },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = useState(false)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" />
            <Image
              src={isDark ? '/whitetextnobg_logo.webp' : '/blacktextnobg_logo.webp'}
              alt="BlueWeb"
              h={46}
              w="auto"
              fit="contain"
            />
            <Image src="/berrylogo.webp" alt="" h={46} w="auto" fit="contain" />
          </Group>
          <ActionIcon variant="subtle" onClick={toggleColorScheme} size="lg" color="gray">
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap="xs" pt="xs">
          <Group justify="center" mb="xs">
            <Image src="/berrylogo.webp" alt="" h={52} fit="contain" />
          </Group>
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
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
