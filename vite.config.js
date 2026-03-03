import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Permite que o Vite aceite conexões vindas do Render
    allowedHosts: ['.onrender.com'] 
  },
  preview: {
    // Isso resolve o erro específico que apareceu no seu log
    allowedHosts: ['.onrender.com']
  }
})
