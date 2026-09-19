import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    cloudflare({
      configPath: '../wrangler.jsonc',
      persistState: { path: '../.wrangler/state' },
      remoteBindings: false,
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.BLUEBERRY_DEV_PORT ?? 5173),
    strictPort: true,
    allowedHosts: ['fruitfirm.blueberry-web.com', 'preview.glisic.net'],
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === '1',
    },
  },
})
