import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getSortedPostEntries } from '../lib/posts';

export const GET: APIRoute = async (context) => {
  if (!context.site) {
    throw new Error('RSS cần cấu hình `site` trong astro.config.mjs để tạo URL production chính xác.');
  }

  const posts = await getSortedPostEntries();

  return rss({
    title: 'Linhchiaura — Đọc sâu',
    description: 'Những góc nhìn mới về tâm lý, cuộc sống và hành trình trưởng thành mỗi ngày.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.date,
      link: `/bai/${post.id}`,
      categories: [post.data.tag],
    })),
    customData: '<language>vi-vn</language>',
  });
};
