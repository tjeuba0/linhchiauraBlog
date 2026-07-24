export const BLOG_TOPICS = [
  'Chữa lành - Con người & Các mối quan hệ',
  'Phát triển bản thân',
  'Não bộ & Tâm lý',
  'Khoa học & Các hệ tư tưởng',
] as const;

export type BlogTopic = (typeof BLOG_TOPICS)[number];

export const LEGACY_BLOG_TOPIC_ALIASES = {
  'Lối sống': 'Phát triển bản thân',
  'Tâm lý': 'Não bộ & Tâm lý',
  'Suy ngẫm': 'Khoa học & Các hệ tư tưởng',
  'Triết học & các tư tưởng': 'Khoa học & Các hệ tư tưởng',
  'Chữa lành- Con người & Các mối quan hệ': 'Chữa lành - Con người & Các mối quan hệ',
  'Nhật ký trưởng thành': 'Phát triển bản thân',
} as const satisfies Record<string, BlogTopic>;

export function normalizeBlogTopic(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const topic = value.trim();
  return Object.hasOwn(LEGACY_BLOG_TOPIC_ALIASES, topic)
    ? LEGACY_BLOG_TOPIC_ALIASES[topic as keyof typeof LEGACY_BLOG_TOPIC_ALIASES]
    : topic;
}
