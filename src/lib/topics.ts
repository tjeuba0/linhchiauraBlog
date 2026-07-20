export const BLOG_TOPICS = [
  'Não bộ & Tâm lý',
  'Phát triển bản thân',
  'Triết học & các tư tưởng',
  'Chữa lành- Con người & Các mối quan hệ',
  'Nhật ký trưởng thành',
] as const;

export type BlogTopic = (typeof BLOG_TOPICS)[number];
