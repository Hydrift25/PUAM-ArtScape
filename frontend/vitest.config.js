import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/components/**/*.jsx',
        'src/context/**/*.jsx',
        'src/pages/AuthPage.jsx',
        'src/pages/LeaderboardPage.jsx',
        'src/pages/ProfilePage.jsx',
      ],
      exclude: ['src/pages/MapPage.jsx', 'src/pages/ScavengerPage.jsx'],
    },
  },
})
