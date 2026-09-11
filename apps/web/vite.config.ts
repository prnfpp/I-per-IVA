import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// La build finisce in /docs alla radice del repository: e' la cartella che
// GitHub Pages pubblica senza bisogno di compilare niente sul server.
// base: './' rende i percorsi relativi, quindi il sito funziona sia su
// https://<utente>.github.io/<repo>/ sia aprendo index.html in locale.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../../docs', import.meta.url)),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@iperiva/rules': fileURLToPath(new URL('../../packages/rules/src/index.ts', import.meta.url)),
      '@iperiva/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
})
