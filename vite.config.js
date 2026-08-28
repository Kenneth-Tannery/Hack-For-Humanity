import { spawn } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function thresholdApi() {
  return {
    name: 'threshold-api',
    configureServer(server) {
      const child = spawn(process.execPath, ['server/index.js'], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, PORT: '3001' },
      })
      const stop = () => {
        if (child.exitCode == null) child.kill()
      }
      server.httpServer?.once('close', stop)
      process.once('exit', stop)
    },
  }
}

export default defineConfig({
  plugins: [react(), thresholdApi()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
