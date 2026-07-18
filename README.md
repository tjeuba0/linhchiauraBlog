# Linhchiaura

Blog tĩnh xây bằng Astro, deploy bằng Cloudflare Worker + Static Assets. Nội dung blog được quản lý bằng Sveltia CMS; Hộp thư dùng Worker endpoint tại `POST /api/contact` và gửi email qua Resend.

## Phát triển giao diện

Yêu cầu Node.js `>=22.12.0`.

```sh
npm ci
npm run dev
```

Các lệnh chính:

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy Astro dev server tại `localhost:4321` |
| `npm run check` | Kiểm tra Astro/TypeScript |
| `npm run build` | Chạy check rồi build site tĩnh vào `dist/` |
| `npm run preview` | Build rồi chạy Static Assets cùng Worker API bằng Wrangler |

`npm run dev` không chạy Worker API. Muốn kiểm thử Hộp thư cùng origin, dùng `npm run preview` theo hướng dẫn bên dưới.

## Hộp thư: Resend và Cloudflare Workers

Endpoint nhận JSON:

```json
{
  "name": "Tên người gửi",
  "mail": "email-khong-bat-buoc@example.com",
  "msg": "Nội dung lời nhắn",
  "website": "",
  "turnstileToken": ""
}
```

- `name`: bắt buộc, tối đa 80 ký tự.
- `mail`: không bắt buộc, tối đa 254 ký tự. Khi có email, nút Reply trong email nhận được sẽ trả lời đúng người gửi.
- `msg`: bắt buộc, tối đa 5.000 ký tự.
- `website`: honeypot, giao diện luôn để trống và ẩn khỏi người dùng.
- `turnstileToken`: chỉ bắt buộc khi đã cấu hình `TURNSTILE_SECRET_KEY`.

Function chỉ chấp nhận `POST` JSON từ đúng origin của site, giới hạn kích thước request, escape toàn bộ HTML và không trả lỗi của Resend hay secret về trình duyệt.

### 1. Chuẩn bị Resend

1. Thêm và xác minh domain gửi trong Resend.
2. Tạo Resend API key có quyền gửi email.
3. Chọn địa chỉ nhận thư và một địa chỉ gửi thuộc domain đã xác minh. Ví dụ địa chỉ gửi: `Linhchiaura <hopthu@example.com>`.

Nếu dùng domain thử nghiệm mặc định của Resend, dịch vụ có thể chỉ cho gửi đến email của chính tài khoản Resend. Nên xác minh domain riêng trước khi đưa site lên production.

### 2. Biến môi trường trên Cloudflare

Trong Cloudflare Dashboard, mở **Workers & Pages → linhchiaura → Settings → Variables and Secrets**. Khai báo cho Worker production.

| Tên | Loại | Bắt buộc | Giá trị |
| --- | --- | --- | --- |
| `SITE_URL` | Variable | Không | Ghi đè origin production mặc định `https://linhchiaura.khoivandev.workers.dev` khi đổi domain |
| `RESEND_API_KEY` | Secret | Có | API key bắt đầu bằng `re_` |
| `CONTACT_TO_EMAIL` | Variable | Có | Email sẽ nhận lời nhắn, ví dụ `linh@example.com` |
| `CONTACT_FROM_EMAIL` | Variable | Có | Người gửi thuộc domain Resend đã xác minh, ví dụ `Linhchiaura <hopthu@example.com>` |
| `PUBLIC_TURNSTILE_SITE_KEY` | Variable | Không | Site key công khai để frontend render Turnstile |
| `TURNSTILE_SECRET_KEY` | Secret | Không | Secret key của Cloudflare Turnstile |

Không đưa `RESEND_API_KEY` hay `TURNSTILE_SECRET_KEY` vào biến `PUBLIC_*`, mã frontend hoặc Git.

`SITE_URL` là nguồn tạo canonical, Open Graph, RSS và sitemap. Project đã dùng `https://linhchiaura.khoivandev.workers.dev` làm mặc định; chỉ cần khai báo biến này khi chuyển sang domain khác.

Turnstile là tùy chọn nhưng phải cấu hình theo cặp: `PUBLIC_TURNSTILE_SITE_KEY` cho build frontend và `TURNSTILE_SECRET_KEY` cho Worker endpoint. Nếu chỉ đặt secret, mọi request thật sẽ bị từ chối.

### 3. Kiểm thử Function ở local

Tạo file local từ template và điền thông tin thật:

```sh
cp .dev.vars.example .dev.vars
cp .env.example .env
npm run preview -- --port 8788
```

Mở site qua `http://localhost:8788` để frontend và `/api/contact` có cùng origin. Không mở frontend ở cổng `4321` rồi gọi API cổng `8788`, vì endpoint chủ động chặn request khác origin.

Có thể kiểm thử trực tiếp; lệnh này sẽ gửi email thật nếu `.dev.vars` chứa Resend key hợp lệ:

```sh
curl -i http://localhost:8788/api/contact \
  -H 'Origin: http://localhost:8788' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Bạn đọc","mail":"ban@example.com","msg":"Xin chào Linh!","website":"","turnstileToken":""}'
```

Thành công trả `200` với:

```json
{"ok":true}
```

Lỗi luôn có cấu trúc an toàn để frontend hiển thị:

```json
{"ok":false,"error":{"code":"SEND_FAILED","message":"Chưa thể gửi lời nhắn, bạn thử lại sau nhé."}}
```

### 4. Deploy Cloudflare Worker

Với Git integration, cấu hình Workers Builds:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: thư mục gốc repository
- Environment variables/secrets: các biến tương ứng trong bảng trên

`wrangler.jsonc` kết hợp Astro Cloudflare Worker với thư mục `dist/`; các trang blog đã prerender được phục vụ trực tiếp từ Static Assets, còn `/api/contact` chạy trong Worker. Sau khi thêm hoặc đổi biến, chạy một deployment mới rồi kiểm tra Hộp thư trên đúng domain production.

Nếu deploy trực tiếp bằng Wrangler:

```sh
npm run build
npx wrangler deploy
```

Các secret/variable production vẫn phải được cấu hình trong project Cloudflare, không lấy từ `.dev.vars` khi deploy.

## Quản lý nội dung

- CMS: `/admin/index.html`.
- Bài viết nằm trong `src/content/blog/` và hỗ trợ Markdown đầy đủ: heading, danh sách, link, ảnh, quote và định dạng chữ.
- Mỗi bài có URL thật `/bai/<slug>`; build cũng tạo RSS tại `/rss.xml`, sitemap và `robots.txt`.
