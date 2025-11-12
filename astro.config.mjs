import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// ⚠️ For GitHub Pages, set `site` to your Pages URL and `base` to your repo name (e.g., '/snake').
export default defineConfig({
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  output: 'static',
  site: 'https://<USERNAME>.github.io',
  base: '/snake',
});
