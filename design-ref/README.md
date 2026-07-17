# Handoff: Website cá nhân Linhchiaura — trang đọc sâu + hộp thư

## Overview
Website cá nhân dạng "linktree mở rộng" cho blogger Linhchiaura: một trang duy nhất gồm hồ sơ cá nhân, nhật ký (blog) với trải nghiệm **đọc sâu không phân tâm** (bài mở trong modal, có tùy chỉnh cỡ chữ / đậm / nghiêng), trang giới thiệu, và **hộp thư riêng tư** để độc giả gửi lời nhắn ("Gửi đi yêu thương" — không hiển thị công khai).

Chủ site muốn build bằng **Astro**. Khuyến nghị: Astro + island component (React/Svelte/Vanilla) cho phần tab + modal + form.

## About the Design Files
Các file trong gói này là **bản thiết kế tham chiếu viết bằng HTML** (Design Component chạy trong môi trường preview riêng) — KHÔNG phải production code để copy nguyên. Nhiệm vụ là **tái tạo giao diện + hành vi này trong codebase Astro**, dùng pattern/thư viện của dự án. File `Linhchiaura.dc.html` chứa toàn bộ markup (inline style) và logic (class `Component`, cú pháp giống React class component) — đọc để lấy chính xác style và hành vi. `image-slot.js` chỉ là công cụ preview cho placeholder ảnh, không cần port.

## Fidelity
**High-fidelity.** Màu, font, spacing, copy là bản chốt — tái tạo pixel-perfect. Copy text tiếng Việt dùng đúng nguyên văn trong file HTML.

## Screens / Views

### 1. Trang chính (một trang, 3 tab)
Nền trang: `#f4faf5`. Container nội dung: max-width **920px**, căn giữa, padding ngang 20px.

**Card hồ sơ** (bg `#ffffff`, radius 24px, shadow `0 6px 24px rgba(46,125,91,.08)`, overflow hidden):
- **Cover**: cao 190px, ảnh thật do chủ site upload; fallback là nền watercolor CSS:
  `radial-gradient(ellipse at 15% 45%, rgba(178,219,190,.8), transparent 58%), radial-gradient(circle at 80% 20%, rgba(247,227,166,.75), transparent 52%), radial-gradient(ellipse at 55% 100%, rgba(150,200,170,.55), transparent 65%), #eaf5ec`
- **Avatar**: 132×132px, tròn, viền trắng 4px, shadow `0 4px 14px rgba(46,125,91,.25)`, margin-top −66px (đè lên cover), căn giữa. Ảnh thật do chủ site upload.
- **Tên**: "Linhchiaura" — Be Vietnam Pro 700, 34px, `#1e5a40`, căn giữa.
- **Bio quote**: `"Hành trình học cách yêu thương bản thân đúng đắn!" ✨💖` — Lora italic 500, 14px, **cam nhạt `#ec8a63`**.
- **Đoạn giới thiệu**: Be Vietnam Pro 400, 14.5px/1.9, `#4a5a51`, max-width 640px (nguyên văn trong file).
- **Social icons** (flex, gap 10px, căn giữa): 5 nút tròn 38px, viền `1.5px solid #dcebe0`, icon lucide 17px stroke-width 2 màu `#2e7d5b`, hover bg `#e7f3ea`:
  - Mail → `mailto:Nguyenlinhchi21@gmail.com`
  - Facebook → `https://www.facebook.com/mosakid/`
  - LinkedIn → `https://www.linkedin.com/in/linh-chi-nguyen-8349961ab/`
  - Instagram → `https://instagram.com/linhchiaura`
  - Globe → `/`
  (Nên data-drive bằng mảng `{platform, url, iconName, label}` — dùng lucide-astro hoặc lucide-react.)

**Thanh tab** (căn giữa, cách card 26px): pill trắng viền `#e3efe6`, radius full, padding 5px, shadow nhẹ. 3 nút: **Nhật Ký / Giới Thiệu / Hộp Thư** — Be Vietnam Pro 600 13.5px, padding 10px 26px, radius full. Active: bg `#fdeee0`, chữ `#ec8a63`. Inactive: trong suốt, chữ `#4d7361`.

### 2. Tab Nhật Ký
- Header row (flex, space-between): trái là tiêu đề `📖 Nhật Ký Linhchiaura` (H2, 700 22px `#1e5a40`, emoji cách chữ 10px bằng flex gap) + phụ đề "Nơi lắng đọng những dòng suy ngẫm mộc mạc và chân thành." (13px `#7fa08d`); phải là nút **"+ Viết bài mới"** (pill, bg `#1e5a40`, chữ trắng 600 12.5px, padding 11px 20px, hover `#174834`) — nút này thuộc chế độ admin, dẫn tới trình soạn bài.
- **Grid bài viết**: `grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`, gap 18px.
- **Card bài viết** (bg trắng, radius 16px, padding 22px 24px, shadow `0 2px 10px rgba(46,125,91,.06)`, cursor pointer; hover: `translateY(-3px)` + shadow `0 10px 26px rgba(46,125,91,.13)`, transition .15s):
  - Hàng trên: tag pill (11px 600 `#2e7d5b` trên `#e7f3ea`, radius full, padding 4px 11px) + thời gian đọc bên phải (12px `#96b3a3`).
  - Title: 700 16.5px/1.5, **`#ec8a63`**.
  - Excerpt: 13.5px/1.7 `#6b7f75`, clamp 3 dòng (`-webkit-line-clamp:3`).
  - Footer: "Đọc tiếp →" 600 12.5px `#2e7d5b`, đẩy xuống đáy card (flex column + margin-top auto).

### 3. Modal đọc bài (trải nghiệm đọc sâu)
Mở khi click card bài viết. **Chỉ có bài viết** — không quote trang trí, không form, không chữ ký.
- Overlay: `position:fixed; inset:0; background:rgba(30,58,47,.5)`, flex center, padding 32px. Click overlay = đóng. Phím **Escape** = đóng.
- Modal card: bg trắng, radius 18px, shadow `0 24px 60px rgba(30,58,47,.35)`, max-width 720px, max-height 86vh, flex column, animation fade+slide-up 0.25s ease (`opacity 0→1, translateY 12px→0`).
- **Dải gradient trên cùng**: cao 6px, `linear-gradient(90deg, #8fc9a8, #f2d98d, #2e7d5b)`.
- **Header** (padding 18px 30px 16px, border-bottom `#eef4ef`): tag pill + "17 tháng 7, 2026 · 3 phút đọc" (12px `#96b3a3`); bên phải là cụm nút chỉnh chữ + nút × (17px `#2e7d5b`). Title: 700 22px/1.45 `#ec8a63`.
- **Nút chỉnh chữ** (tròn/pill 28px, viền `#dcebe0`, bg `#f8fbf8`, chữ `#38584a` 600 11px, hover bg `#e7f3ea`):
  - `A−` / `A+`: giảm/tăng font-size thân bài 1px mỗi lần, kẹp trong [13px, 24px]. Mặc định **15.5px**.
  - `Đậm`: toggle font-weight 400 ↔ 600. Active: bg `#2e7d5b`, chữ trắng.
  - `Nghiêng`: toggle font-style normal ↔ italic. Active: như trên.
  - Nên lưu lựa chọn vào `localStorage` để giữ qua các lần đọc.
- **Thân bài** (scroll riêng, flex:1, padding 24px 32px): Be Vietnam Pro, 15.5px/1.85, `#3f4b44`; mỗi đoạn `<p>` margin-bottom 18px.
- **Footer** (border-top `#eef4ef`, padding 14px 30px, flex space-between): trái "Cảm ơn bạn đã ghé đọc trang nhật ký!" (Lora italic 12.5px `#7fa08d`); phải nút **"Đóng lại"** (bg `#1e5a40`, trắng, radius 8px, padding 9px 20px, hover `#174834`).

### 4. Tab Giới Thiệu
- **3 card** (grid auto-fit minmax 240px, gap 18px; bg trắng, radius 16px, padding 26px 26px 28px, shadow như card bài): mỗi card có **blob tròn trang trí** góc trên-phải (78px, tròn, tràn ra ngoài: top −26px, right −26px; card có `overflow:hidden`):
  1. **Sở thích & Đam mê** — blob `#eaf5ec`; icon trái tim lucide outline `#2e7d5b` trong vòng tròn 42px viền `1.5px #bfe0cc` nền trắng.
  2. **Phong cách sống** — blob `#fdf3e7`; icon sparkle lucide `#e8944a` trong vòng tròn 42px bg `#fdeee0`.
  3. **Triết lý sống** — blob `#eaf5ec`; glyph `❞` (Lora 700 20px `#2e7d5b`) trong vòng tròn 42px bg `#e7f3ea`; phần mô tả in nghiêng Lora.
  - Title card: 700 17px `#234c3d`; mô tả 13.5px/1.75 `#6b7f75` (nguyên văn trong file).
- **Banner quote**: bg `#1e5a40`, radius 20px, padding 38px 46px, margin-top 22px; dấu `"` lớn Lora 40px trắng 45%; câu quote Lora italic 500 19px/1.7 `#f2f8f4`: *"Aut inveniam viam aut faciam – Hoặc tôi sẽ tìm thấy một con đường, hoặc tôi sẽ tự tạo con đường cho chính tôi"*.

### 5. Tab Hộp Thư (riêng tư)
Cột giữa max-width 560px.
- Tiêu đề: `🕊 Gửi Lời Nhắn Cho Mình` (700 22px `#1e5a40`, căn giữa) + phụ đề: "Một câu tâm sự, một câu hỏi, hay chỉ đơn giản là lời chào dịu ngọt. Thư gửi riêng cho mình thôi — không hiển thị công khai, và mình sẽ hồi âm sớm nhất có thể 🤍".
- **Form card** (bg trắng, radius 20px, padding 30px 34px, shadow `0 4px 16px rgba(46,125,91,.08)`), 3 trường:
  - "Tên của bạn *" — placeholder "Nhập tên đáng yêu của bạn..."
  - "Gmail (không bắt buộc)" — placeholder "ban@gmail.com — nếu muốn nhận hồi âm nè"
  - "Lời nhắn gửi *" — textarea 4 dòng, placeholder "Hãy viết điều bạn đang nghĩ vào đây..."
  - Style input: padding 12px 14px, viền `1.5px solid #dcebe0`, radius 12px, bg `#fbfdfb`, 14px `#2f3b34`; focus viền `#2e7d5b`; placeholder `#a9bfb1`. Label: 600 12.5px `#38584a`.
- **Nút gửi**: full-width pill, chữ trắng 700 13.5px letter-spacing .08em: `🕊 GỬI ĐI YÊU THƯƠNG`. Disabled (khi tên hoặc lời nhắn trống): bg `#a9c9b5`, cursor default. Enabled: bg `#2e7d5b`, hover `#256a4c`.
- **Màn cảm ơn** (thay form sau khi gửi thành công): emoji 💌 38px, "Đã gửi đi yêu thương!" (700 18px `#1e5a40`), "Cảm ơn bạn đã để lại đôi dòng dịu dàng. Mình sẽ đọc và hồi âm sớm nhất có thể 🤍", nút outline "Viết thêm lời nhắn" (viền `1.5px #2e7d5b`, chữ `#2e7d5b`, pill, hover bg `#e7f3ea`) reset form.

### 6. Footer
Bg `#eaf5ec`, padding 22px, căn giữa: dòng 1 Lora italic 12.5px `#5f8672` "Hành trình học cách yêu thương bản thân đúng đắn ✨"; dòng 2 12px "© 2026 Linhchiaura · Facebook ↗" (link `#2e7d5b` 600, không gạch chân).

## Interactions & Behavior
- **Tabs**: đổi nội dung tại chỗ, không reload; tab mặc định "Nhật Ký". Trong Astro: island nhỏ hoặc URL hash/`?tab=`.
- **Modal**: mở khi click card; đóng bằng ×, nút "Đóng lại", click overlay, phím Escape. Khi mở nên khóa scroll nền (`overflow:hidden` trên body). Bài dài scroll bên trong modal. Nên hỗ trợ deep-link (`/bai/[slug]`) để share — render modal (hoặc trang riêng cùng layout modal) khi truy cập trực tiếp.
- **Chỉnh chữ**: xem mục Modal; áp dụng cho thân bài duy nhất.
- **Form validation**: bắt buộc Tên + Lời nhắn (trim non-empty); email optional, nếu nhập thì validate định dạng. Nút gửi disable khi thiếu.
- **Hover**: card bài nâng lên; mọi nút có hover state như mô tả.

## State Management
- `tab: 'nhatky' | 'gioithieu' | 'hopthu'`
- `activePost: slug | null` (modal mở/đóng)
- Reading prefs: `{ size: number (13–24, default 15.5), bold: boolean, italic: boolean }` → localStorage
- Form: `{ name, email, message }` + `sent: boolean`

## Backend (cần dev quyết định cùng chủ site)
1. **Bài viết**: Astro Content Collections (markdown, frontmatter: `title, tag, date, readingMinutes, excerpt`). Nút "+ Viết bài mới" thuộc chế độ admin.
2. **Hộp thư riêng tư**: form POST tới API route (Astro endpoint / serverless). Lưu + thông báo cho chủ site: đơn giản nhất là gửi email (Resend/Formspree) hoặc lưu DB (Supabase). **Không render công khai.** Chống spam: honeypot field + rate limit.
3. **Chỉnh sửa avatar / cover / bio**: chủ site yêu cầu **có thể tự edit sau này** → cần chế độ admin (đăng nhập đơn giản) cho phép upload/thay avatar, cover và sửa bio/đoạn giới thiệu. Trong bản thiết kế, hai vùng ảnh là drop-target (`image-slot.js`) chỉ dành cho preview; production thay bằng upload thật (lưu vào storage như Cloudinary/Supabase Storage).

## Design Tokens
**Màu**
- Xanh đậm nhất (nút chính, banner): `#1e5a40` (hover `#174834`)
- Xanh chủ đạo (accent, icon, link): `#2e7d5b` (hover nút gửi `#256a4c`)
- Cam nhạt (title bài, bio, tab active): `#ec8a63`; cam icon: `#e8944a`
- Nền trang: `#f4faf5` · nền dịu: `#eaf5ec` · pill/nền icon xanh: `#e7f3ea`
- Nền cam nhạt: `#fdeee0` · blob cam: `#fdf3e7`
- Viền: `#dcebe0`, `#e3efe6`, `#eef4ef`, `#bfe0cc`
- Chữ: heading xanh `#1e5a40` / `#234c3d`; body `#4a5a51` / `#3f4b44`; phụ `#6b7f75`, `#7fa08d`, `#96b3a3`, label `#38584a`, footer `#5f8672`
- Overlay modal: `rgba(30,58,47,.5)`

**Typography** (Google Fonts, subset vietnamese)
- UI + thân bài: **Be Vietnam Pro** (400/500/600/700)
- Điểm nhấn văn chương (quote, italic): **Lora** (400/500/700 + italic)
- Scale: 34 (tên) / 22 (H2, title modal) / 17–16.5 (title card) / 15.5 (thân bài, điều chỉnh 13–24) / 14.5 (giới thiệu) / 13.5 (mô tả) / 12–13 (phụ) / 11 (tag)

**Radius**: 24 (card hồ sơ) · 20 (form, banner) · 16–18 (card, modal) · 12 (input) · 8 (nút nhỏ) · 999 (pill)
**Shadow**: card `0 2px 10px rgba(46,125,91,.06)` · hover `0 10px 26px rgba(46,125,91,.13)` · hồ sơ `0 6px 24px rgba(46,125,91,.08)` · form `0 4px 16px rgba(46,125,91,.08)` · modal `0 24px 60px rgba(30,58,47,.35)`
**Motion**: hover card .15s ease; modal fade/slide .25s ease.

## Assets
- Avatar + cover: ảnh thật của chủ site (đã thả vào preview qua image-slot; production cần upload flow riêng — ảnh nằm trong file `.image-slots.state.json` cạnh file design nếu cần trích xuất).
- Icons: lucide (Mail, Facebook, Linkedin, Instagram, Globe, Heart, Sparkles) — dùng package lucide cho framework tương ứng.
- Watercolor cover fallback: thuần CSS (gradient ở mục Cover), không cần file ảnh.
- Emoji dùng trong copy: 📖 🕊 💌 ✨💖 🌿 🤍 (giữ nguyên, là giọng thương hiệu).

## Files
- `Linhchiaura.dc.html` — bản thiết kế đầy đủ: markup inline-style + logic (template giữa `<x-dc>`, logic trong `<script data-dc-script>`). Nguồn chân lý cho style, copy và hành vi.
- `image-slot.js` — component preview cho vùng thả ảnh (không port sang production).
