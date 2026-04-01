import {
  AppShell, Group, ActionIcon, useMantineColorScheme, Image,
} from '@mantine/core'
import { IconSun, IconMoon } from '@tabler/icons-react'

export function LayoutPublic({ children }: { children: React.ReactNode }) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
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
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  )
}
