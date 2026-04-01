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
  Tooltip,
} from '@mantine/core'
import {
  IconPlant2,
  IconFlask,
  IconDatabase,
  IconSearch,
  IconSettings,
  IconSun,
  IconMoon,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMicroscope,
} from '@tabler/icons-react'

const navItems = [
  { label: 'Add Samples', path: '/add-samples', icon: IconPlant2 },
  { label: 'FQ Lab', path: '/fq-lab', icon: IconFlask },
  { label: 'FQ Database', path: '/fq-database', icon: IconDatabase },
  { label: 'Search Pedigree', path: '/search-pedigree', icon: IconSearch },
  { label: 'Sensory Panels', path: '/sensory-panels', icon: IconMicroscope },
  { label: 'Configure', path: '/configure', icon: IconSettings },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpened, setMobileOpened] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const navbarWidth = collapsed ? 60 : 220

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: navbarWidth, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Burger opened={mobileOpened} onClick={() => setMobileOpened((o) => !o)} hiddenFrom="sm" size="sm" />
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

      <AppShell.Navbar p={collapsed ? 4 : 'sm'} style={{ transition: 'width 150ms ease, padding 150ms ease', overflow: 'hidden' }}>
        <Stack gap="xs" h="100%">
          <Stack gap={4} style={{ flex: 1 }}>
            {navItems.map((item) =>
              collapsed ? (
                <Tooltip key={item.path} label={item.label} position="right" withArrow>
                  <MantineNavLink
                    component={NavLink}
                    to={item.path}
                    leftSection={<item.icon size={20} />}
                    onClick={() => setMobileOpened(false)}
                    styles={{
                      root: { borderRadius: 'var(--mantine-radius-sm)', padding: '8px', justifyContent: 'center' },
                      section: { margin: 0 },
                    }}
                  />
                </Tooltip>
              ) : (
                <MantineNavLink
                  key={item.path}
                  component={NavLink}
                  to={item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  onClick={() => setMobileOpened(false)}
                  styles={{ root: { borderRadius: 'var(--mantine-radius-sm)' } }}
                />
              )
            )}
          </Stack>

          {/* Collapse toggle at bottom */}
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} position="right" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setCollapsed((c) => !c)}
              visibleFrom="sm"
              style={{ alignSelf: collapsed ? 'center' : 'flex-end' }}
            >
              {collapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
            </ActionIcon>
          </Tooltip>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
