import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Don't rewrite by default so that /api/* stays /api/*; 
        // if server expects no prefix, use: rewrite: path => path.replace(/^\/api/, '')
      },
    },
  },
})
