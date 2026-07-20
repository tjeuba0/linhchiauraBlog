// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

const productionSite = 'https://linhchiaura.khoivandev.workers.dev';
const configuredSite = process.env.SITE_URL?.trim() || productionSite;

// https://astro.build/config
export default defineConfig({
  site: configuredSite,
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Without CSS targets, Lightning CSS minifies media queries into range
      // syntax ("(width<=640px)"), which iOS Safari < 16.4 cannot parse — the
      // whole mobile layout block gets dropped on older iPhones.
      cssTarget: ['safari15', 'ios15'],
    },
  },

  adapter: cloudflare(),
});