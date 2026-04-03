import {
  AppShell, Group, ActionIcon, useMantineColorScheme, Image,
} from '@mantine/core'
import { IconSun, IconMoon } from '@tabler/icons-react'
import darkLogo from '../assets/whitetextnobg_logo.webp'
import lightLogo from '../assets/blacktextnobg_logo.webp'
import berryLogo from '../assets/berrylogo.webp'

export function LayoutPublic({ children }: { children: React.ReactNode }) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Image
              src={isDark ? darkLogo : lightLogo}
              alt="BlueWeb"
              h={46}
              w="auto"
              fit="contain"
            />
            <Image src={berryLogo} alt="" h={46} w="auto" fit="contain" />
          </Group>
          <ActionIcon variant="subtle" onClick={toggleColorScheme} size="lg" color="gray">
            {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </AppShell.Header>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
