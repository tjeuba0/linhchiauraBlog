// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const configuredSite = process.env.SITE_URL?.trim();

if (process.env.CF_PAGES && !configuredSite) {
  throw new Error('Cloudflare production build requires the SITE_URL environment variable.');
}

// https://astro.build/config
export default defineConfig({
  site: configuredSite || 'http://localhost:4321',
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
