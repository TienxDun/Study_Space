# ZenStudy Space

Không gian học tập nhập vai trên web: bối cảnh 4K, âm thanh thư giãn và bộ công cụ tập trung trong một màn hình duy nhất.

[![Website](https://img.shields.io/badge/Website-zenstudy.space-6366f1?style=flat-square&logo=google-chrome&logoColor=white)](https://zenstudy.space)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-149eca?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6ee7b7?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber?style=flat-square)](LICENSE)

## Tính năng

- **Bối cảnh 4K** — 30+ scene video/ảnh (cà phê mưa, thư viện, anime, vũ trụ...), lọc theo chủ đề, yêu thích, phục vụ qua CDN.
- **Ambient sound mixer** — 20+ âm thanh môi trường trộn đa tầng, ghi nhớ âm lượng.
- **Nhạc & Embed player** — playlist Lo-fi / Acoustic / Jazz kèm đĩa than, nhúng YouTube, Spotify, radio; hỗ trợ PiP.
- **Pomodoro, Clock, Stopwatch** — chuông Web Audio, gắn với task đang làm.
- **Kanban & To-do** — kéo thả Todo / In Progress / Done, ưu tiên, deadline; 1 chạm "Bắt đầu tập trung".
- **Ghi chú nhanh** — Markdown, nhiều chủ đề màu, chế độ sticky note.
- **Phòng học nhóm** — phòng video realtime qua LiveKit (âm thanh, chia sẻ, quota theo phút).
- **Trợ lý học tập AI** — chatbot v2 chạy trên Worker riêng, hỗ trợ gửi ảnh.
- **Local-first + cloud sync** — dữ liệu lưu `localStorage`, đồng bộ snapshot lên Cloudflare D1 khi đăng nhập; offline vẫn dùng bình thường.
- **Đa nền tảng** — web (desktop/mobile) và app Android qua Capacitor.
- **Bàn phím toàn năng** — Zen mode, mở/đóng mọi widget không cần chuột.

## Công nghệ

| Lớp | Công nghệ |
| --- | --- |
| Framework | Next.js 16 (App Router, static export cho Cloudflare Pages) |
| UI | React 19.2, TypeScript 5, Tailwind CSS v4, Framer Motion, Phosphor Icons |
| Realtime | LiveKit (`livekit-rooms` Worker), Firebase Auth |
| Chat AI | Cloudflare Worker `chat-v2` |
| Dữ liệu | `localStorage` + Cloudflare D1, R2/CDN cho media |
| Kiểm thử | Vitest (unit), load test 200 CCU |
| Mobile | Capacitor 8 (Android) |

## Bắt đầu

Yêu cầu: Node.js 20+ (khuyến nghị 22/24) và npm 10+.

```bash
git clone https://github.com/TienxDun/Study_Space.git
cd Study_Space
npm install
npm run dev            # http://localhost:3001 (Turbopack)
```

| Lệnh | Việc |
| --- | --- |
| `npm test` | Chạy toàn bộ unit test Vitest |
| `npm run lint` | ESLint + kiểm tra `!important` trong CSS |
| `npx tsc --noEmit` | Typecheck |
| `npm run build` | Build production (server mode) |
| `npm run build:web` | Export tĩnh cho Cloudflare Pages |
| `npm run build:admin` | Bundle shell admin vào `dist-admin/` |
| `npm run sync:android` | Đồng bộ Capacitor sang project Android |
| `npm run test:load` | Load test 200 CCU lên Data API |
| `npm run sync:r2` | Upload asset lên Cloudflare R2 |

## Cấu hình

Tạo `.env.local` từ [.env.example](.env.example). Thiếu biến nào thì phần dịch vụ đó tự tắt và app vẫn chạy local-only.

| Biến | Dùng cho |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL, sitemap, metadata SEO |
| `NEXT_PUBLIC_STUDY_CDN_URL` | CDN bối cảnh/âm thanh (R2 hoặc Worker shield) |
| `NEXT_PUBLIC_DATA_API_URL` | Worker D1 lưu dữ liệu học tập |
| `NEXT_PUBLIC_LIVEKIT_TOKEN_URL` | Worker phát vé phòng học nhóm |
| `NEXT_PUBLIC_CHAT_V2_URL` | Worker chatbot v2 (cũng trả cờ hệ thống) |
| `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Đăng nhập Google |
| `NEXT_PUBLIC_GOATCOUNTER_URL` | Thống kê truy cập (không cookie) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME` | Script `sync:r2` |

## Cấu trúc dự án

```text
src/app/               trang chính và route phụ (privacy, terms, account-deletion)
src/components/study/  toàn bộ UI, chia theo tính năng (music, pomodoro, tasks...)
src/lib/               storage keys, cloud sync, auth, asset resolver
src/data/              JSON bối cảnh, âm thanh, nhạc
workers/               Cloudflare Workers (data-api, chat-v2, livekit-rooms, ...)
admin-worker/          shell admin chạy trên Worker riêng
android/               vỏ Capacitor
scripts/               build, deploy, sync R2, load test
docs/                  tài liệu vận hành và thiết kế
```

## Kiến trúc

- **Một trang client duy nhất** — state tập trung ở `useStudySpaceState`, mọi thao tác mở/đóng widget đi qua đây; layout desktop và mobile tách ở mốc 640px.
- **Local-first** — mọi dữ liệu nằm trong `localStorage`; đăng nhập thì đồng bộ snapshot lên D1 (debounce, tự phục hồi khi có mạng lại, dọn máy khi đăng xuất).
- **Backend Cloudflare** — Pages chạy web tĩnh, Workers đảm nhận data API, chat, phòng học và shell admin; binding khai báo trong `wrangler.admin.jsonc`.
- **Deploy** — push `main` là Pages tự build và deploy admin Worker. Quy trình chi tiết ở [docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md).

## Tài liệu

- [Tổng quan hệ thống](docs/overview/SYSTEM_OVERVIEW.md)
- [Đồng bộ đám mây](docs/guides/CLOUD_SYNC_GUIDE.md)
- [Phòng học nhóm](docs/features/PHONG_HOC_NHOM.md)
- [Hạn mức hệ thống](docs/guides/SYSTEM_LIMITS.md)
- [Deploy & Android/Play](docs/deployment/ANDROID_CHPLAY_OTA_GUIDE.md)
- [Chỉ mục đầy đủ](docs/README.md)

## Tác giả

Phát triển và duy trì bởi [TienxDun](https://github.com/TienxDun) · [zenstudy.space](https://zenstudy.space)
