import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { UserProvider } from './context/UserContext'
import App from './App'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'

const theme = createTheme({
  primaryColor: 'indigo',
  colors: {
    // blueberry blue-purple
    indigo: [
      '#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc',
      '#818cf8', '#6366f1', '#4f46e5', '#4338ca',
      '#3730a3', '#312e81',
    ],
  },
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, sans-serif',
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <ModalsProvider>
            <Notifications position="top-right" />
            <AuthProvider>
              <UserProvider>
                <App />
              </UserProvider>
            </AuthProvider>
          </ModalsProvider>
        </MantineProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
