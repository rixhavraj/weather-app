import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ai-proxy': {
        target: 'https://gen.pollinations.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-proxy/, ''),
        secure: true,
      },
      '/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
        secure: true,
      },
      '/anthropic-proxy': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic-proxy/, ''),
        secure: true,
      }
    }
  }
})
