import { defineConfig } from '@svelte-roku/config'

export default defineConfig({
  title: 'Content Channel',
  entry: 'src/HomeScreen.svelte',
  roku: process.env.ROKU_HOST ? {
    host: process.env.ROKU_HOST,
    password: process.env.ROKU_PASSWORD ?? 'rokudev',
  } : undefined,
})
