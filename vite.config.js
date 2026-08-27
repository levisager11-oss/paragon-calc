import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

const root = fileURLToPath(new URL('.', import.meta.url))

// Which Paragons actually have artwork in public/paragon-art/, resolved once at
// build time. Without this the app would request every PNG and fall back on a
// 404, costing a failed request per Paragon on every load while the set is
// incomplete. Slugs only — the filenames themselves stay in public/.
const artSlugs = (() => {
  try {
    return readdirSync(resolve(root, 'public/paragon-art'))
      .filter((f) => f.endsWith('.png'))
      .map((f) => f.slice(0, -4))
  } catch {
    return []
  }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __PARAGON_ART__: JSON.stringify(artSlugs),
  },
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
