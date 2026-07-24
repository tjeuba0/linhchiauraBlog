import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { BLOG_TOPICS, normalizeBlogTopic } from './lib/topics';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    tag: z.preprocess(normalizeBlogTopic, z.enum(BLOG_TOPICS)),
    date: z.coerce.date(),
    readingMinutes: z.number(),
    excerpt: z.string(),
  }),
});

export const collections = { blog };
