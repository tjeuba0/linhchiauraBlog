import { getCollection } from 'astro:content';

export type PostView = {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  mins: string;
  paragraphs: string[];
};

// Date is stored as YAML date (UTC midnight); read UTC parts so the day never
// shifts under the build machine's timezone.
function formatVietnameseDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return `${day} tháng ${month}, ${year}`;
}

function toParagraphs(body: string): string[] {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

export async function getPosts(): Promise<PostView[]> {
  const entries = await getCollection('blog');
  return entries
    .map((entry) => ({
      entry,
      time: entry.data.date.getTime(),
    }))
    .sort((a, b) => b.time - a.time)
    .map(({ entry }) => ({
      slug: entry.id,
      tag: entry.data.tag,
      title: entry.data.title,
      excerpt: entry.data.excerpt,
      date: formatVietnameseDate(entry.data.date),
      mins: `${entry.data.readingMinutes} phút đọc`,
      paragraphs: toParagraphs(entry.body ?? ''),
    }));
}
