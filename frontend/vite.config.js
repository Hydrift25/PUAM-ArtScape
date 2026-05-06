import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const my_port = env.B_PORT || 8000;
  const f_port = parseInt(env.F_PORT) || 3000;

  return {
    plugins: [react()],

    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-mapbox": ["mapbox-gl"],
            "vendor-react": ["react", "react-dom", "react-router-dom"],
          }
        }
      }
    },

    server: {
      port: f_port,
      proxy: {
        '/api': {
          target: `http://localhost:${my_port}`,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
