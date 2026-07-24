import { readFileSync } from 'node:fs';

const topicsSource = readFileSync(new URL('../src/lib/topics.ts', import.meta.url), 'utf8');
const cmsSource = readFileSync(new URL('../public/admin/config.yml', import.meta.url), 'utf8');

const topicsBlock = topicsSource.match(
  /export const BLOG_TOPICS = \[([\s\S]*?)\] as const;/,
)?.[1];

if (!topicsBlock) {
  throw new Error('Không tìm thấy BLOG_TOPICS trong src/lib/topics.ts.');
}

const appTopics = Array.from(
  topicsBlock.matchAll(/^\s*(['"])(.*?)\1,?\s*$/gm),
  (match) => match[2],
);

const tagFieldStart = cmsSource.indexOf('name: "tag"');
const nextFieldStart = cmsSource.indexOf('\n      - ', tagFieldStart);

if (tagFieldStart === -1 || nextFieldStart === -1) {
  throw new Error('Không tìm thấy trường Chủ đề trong public/admin/config.yml.');
}

const tagField = cmsSource.slice(tagFieldStart, nextFieldStart);
const cmsTopics = Array.from(
  tagField.matchAll(/^\s*-\s*"([^"]+)"\s*$/gm),
  (match) => match[1],
);

if (JSON.stringify(cmsTopics) !== JSON.stringify(appTopics)) {
  console.error('Danh sách chủ đề trong CMS không khớp schema của website.');
  console.error(`CMS:    ${JSON.stringify(cmsTopics)}`);
  console.error(`Schema: ${JSON.stringify(appTopics)}`);
  process.exit(1);
}

console.log(`CMS và schema đang đồng bộ ${appTopics.length} chủ đề.`);
