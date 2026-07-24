export const BLOG_TOPICS = [
  'Chữa lành - Con người & Các mối quan hệ',
  'Phát triển bản thân',
  'Não bộ & Tâm lý',
  'Khoa học & Các hệ tư tưởng',
] as const;

export type BlogTopic = (typeof BLOG_TOPICS)[number];
