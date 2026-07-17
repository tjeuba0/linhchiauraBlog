import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;

/**
 * The serialisable shape used by the interactive home page and RSS metadata.
 * The Markdown body deliberately stays on the content entry so article routes
 * can render it through Astro's Markdown pipeline instead of flattening it.
 */
export type PostSummary = {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  isoDate: string;
  mins: string;
};

// Date is stored as YAML date (UTC midnight); read UTC parts so the day never
// shifts under the build machine's timezone.
export function formatVietnameseDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return `${day} tháng ${month}, ${year}`;
}

export function toPostSummary(entry: BlogEntry): PostSummary {
  return {
    slug: entry.id,
    tag: entry.data.tag,
    title: entry.data.title,
    excerpt: entry.data.excerpt,
    date: formatVietnameseDate(entry.data.date),
    isoDate: entry.data.date.toISOString(),
    mins: `${entry.data.readingMinutes} phút đọc`,
  };
}

/** Return complete entries, newest first, for article rendering and feeds. */
export async function getSortedPostEntries(): Promise<BlogEntry[]> {
  const entries = await getCollection('blog');
  return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Return only JSON-safe card data, newest first, for hydrated consumers. */
export async function getPostSummaries(): Promise<PostSummary[]> {
  const entries = await getSortedPostEntries();
  return entries.map(toPostSummary);
}
