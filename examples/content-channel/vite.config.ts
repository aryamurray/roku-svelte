import { defineConfig } from 'vite'
import { svelteRoku } from '@svelte-roku/vite-plugin'

export default defineConfig({
  plugins: [svelteRoku()],
})
