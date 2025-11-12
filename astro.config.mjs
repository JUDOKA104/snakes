import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// If you publish under https://<user>.github.io/<repo>, set base to '/<repo>' later.
export default defineConfig({
  integrations: [react()],
  output: 'static',
  site: 'https://example.com', // replace with your real URL later
  prefetch: true
});
