// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const productionSite = 'https://linhchiaura.khoivandev.workers.dev';
const configuredSite = process.env.SITE_URL?.trim() || productionSite;

// https://astro.build/config
export default defineConfig({
  site: configuredSite,
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
