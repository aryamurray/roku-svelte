import { svelteRokuPreprocess } from '@svelte-roku/preprocessor'

export default {
  preprocess: [svelteRokuPreprocess({ platform: 'roku' })],
}
