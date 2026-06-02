import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page build: the main app + the standalone embeddable widget.
      input: {
        main: resolve(root, 'index.html'),
        embed: resolve(root, 'embed.html'),
      },
    },
  },
  test: {
    environment: "node",
  },
})
