# Đặc tả Nghiệp vụ (BA Spec) — HUFLIT StudySpace Fullstack

> **ĐÃ LƯU TRỮ:** Đặc tả cũ, không còn phản ánh code hiện tại. Xem [`../features/PHONG_HOC_NHOM.md`](../features/PHONG_HOC_NHOM.md) và [`../features/LIVEKIT_ROADMAP.md`](../features/LIVEKIT_ROADMAP.md).

> Phiên bản: 1.0 — Ngày: 22/09/2026 — Tác giả BA: AI Assistant + TienxDun
> Nguồn đối chiếu code hiện tại: `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/study/*`, `next.config.ts`, `package.json`
> Phạm vi tài liệu: đặc tả AS-IS (frontend static hiện tại) + TO-BE (lộ trình fullstack).

---

## 1. Tổng quan sản phẩm

### 1.1. Vấn đề & cơ hội
Sinh viên HUFLIT và người làm việc tại nhà khó duy trì tập trung dài: xao nhãng từ mạng xã hội, không gian ồn, không có nhịp nghỉ khoa học, task và ghi chú phân mảnh nhiều app.

### 1.2. Giải pháp
**HUFLIT StudySpace** là không gian học tập nhập vai (Immersive Study Environment) trên web: 1 màn hình duy nhất kết hợp bối cảnh 4K + âm thanh môi trường + nhạc + Pomodoro + Tasks/Kanban + Notes + Zen Mode. Không cần đăng nhập, mở là học ngay.

### 1.3. Mục tiêu đo được
| ID | Mục tiêu | Chỉ số | Target v1.x |
|----|----------|--------|-------------|
| G-01 | Tập trung | Thời gian focus/session | ≥ 25 phút liên tục |
| G-02 | Giữ chân | Quay lại trong 7 ngày | ≥ 30% |
| G-03 | Hiệu năng | LCP trên desktop | < 2.5s |
| G-04 | Ổn định | Lỗi phát media gây trắng màn hình | 0 (luôn có fallback thumbnail) |

### 1.4. Không thuộc phạm vi v1.x
- Không có tài khoản, đồng bộ cloud, chia sẻ phòng học chung.
- Không có backend/API riêng; dữ liệu chỉ nằm ở trình duyệt.
- Không chấm điểm, không AI gợi ý lộ trình học.

---

## 2. Stakeholder & Persona

| Stakeholder | Vai trò | Mối quan tâm |
|-------------|---------|--------------|
| Sinh viên HUFLIT | Người dùng chính | Nhẹ, đẹp, có nhạc mưa + Pomodoro + deadline |
| Freelancer / dân văn phòng | Người dùng mở rộng | Zen Mode, phím tắt, fullscreen |
| TienxDun (dev + PO) | Vận hành | Build tĩnh rẻ, deploy GitHub Pages/Vercel, ít bảo trì |
| Chủ sở hữu asset (Pixabay/Pexels/CDN) | Tuân thủ bản quyền | Ghi credit, dùng link CDN hợp lệ |

**Persona chính — Linh, SV năm 2:** học 2-3 tiếng/buổi tối, hay mở YouTube lofi nhưng dễ lạc sang video khác. Cần: 1 nút mở không gian mưa + coffee jazz, đồng hồ 25-5-15 tự reo, checklist bài tập có deadline, ghi chú nhanh không mất khi F5.

---

## 3. Kiến trúc AS-IS (đang chạy)

- **Framework:** Next.js 16.2.6 static export (`next.config.ts:3` `output: "export"`), React 19.2.4, Tailwind CSS v4, Framer Motion, lucide-react, sonner, canvas-confetti.
- **Render:** `"use client"` toàn trang `src/app/page.tsx:1`. Widget nặng lazy-load `ssr:false` (`src/app/page.tsx:33-51`): Tasks, Notes, SceneSelector, EmbedPlayer.
- **Lưu trữ:** 100% LocalStorage, không backend. Khôi phục ở `src/app/page.tsx:88-128`.
- **Media:** asset local `public/study/*` + CDN `STUDY_CDN_URL` (`src/components/study/study-types.ts:1`).
- **Font/i18n:** Be Vietnam Pro + vi-VN (`src/app/layout.tsx:6-10`, `src/app/page.tsx:218`).
- **SEO:** metadata tiếng Việt + OpenGraph (`src/app/layout.tsx:19-44`).

### 3.1. Sơ đồ màn hình chính
```
┌ TopBar: [GPA link] [HUFLIT StudySpace + Clock] [?][Ẩn UI][Mute][⚙][Fullscreen] ┐
│ LeftDock: [Pomodoro T][Tasks K][Notes N][Scenes B][Đài E]                        │
│ CENTER: Pomodoro / Clock / Stopwatch widget                                     │
│ BOTTOM: MusicPlayer + SoundMixer                                                │
│ POPOUT: Tasks | Notes | Scenes | EmbedPlayer | Settings | Shortcuts modal       │
│ BG: Video/Image crossfade 1.2s + fallback thumbnail khi lỗi                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Yêu cầu chức năng (FR) — AS-IS

### FR-01. Bối cảnh nhập vai (Scene)
- **Mô tả:** thư viện ~60 scene VIDEO/IMAGE (`src/components/study/study-types.ts:672-1081`), category: chill/anime/cyberpunk/dark/urban/nature/cartoon/cute.
- **Luồng:** Dock `B` → `SceneSelectorWidget` → chọn scene → crossfade 1.2s (`src/app/page.tsx:380-412`) → lưu `huflit_study_scene_id`.
- **Fallback:** video lỗi → log warn + hiện thumbnail (`src/app/page.tsx:397-400`).
- **AC:** đổi scene < 1.5s thấy ảnh mới; F5 giữ đúng scene đã chọn; video lỗi không trắng màn hình.

### FR-02. Trình phát nhạc (Music Player)
- **Mô tả:** 3 mood `lofi | jazz | relax` (`study-types.ts:3`), ~49 track (`ALL_STUDY_TRACKS`, `study-types.ts:523-527`). Luôn mounted để không dừng khi ẩn UI (`src/app/page.tsx:738-783`).
- **Điều khiển:** play/pause `Space`, next `→`, prev `←`, volume `↑/↓`, mute `M`, shuffle `S`, loop `L` (xem modal phím tắt `page.tsx:824-863`).
- **AC:** chuyển bài không khựng background; mute toàn cục lưu `huflit_study_global_mute`.

### FR-03. Bộ trộn âm thanh môi trường (Sound Mixer)
- **Mô tả:** 20 âm (`AMBIENT_SOUNDS`, `study-types.ts:529-670`), nhóm rain/nature/indoor. Mở bằng dock mixer, chỉnh volume từng lớp, phát chồng lên nhạc.
- **AC:** bật ≥3 lớp cùng lúc không vỡ tiếng; tắt mixer nhạc nền vẫn chạy.

### FR-04. Đài ngoài (YouTube / Spotify Embed)
- **Mô tả:** preset Chillhop + Peaceful Piano (`CURATED_EMBED_PRESETS`, `study-types.ts:1097-1118`), tự nhập URL qua `parseEmbedUrl` (`study-types.ts:1120-1209`): hỗ trợ watch/youtu.be/shorts/live/playlist, Spotify track/playlist/album, custom embed URL.
- **AC:** URL sai → báo lỗi thân thiện, không crash; bật stream ngoài hiện chấm xanh ở dock `E`; URL độc hại (non-https) bị từ chối.

### FR-05. Pomodoro / Clock / Stopwatch
- **Mô tả:** widget trung tâm `StudyPomodoroWidget`, 3 tab qua `centerTab: TimerTab` (`page.tsx:63`). Mặc định focus 25 / ngắn 5 / dài 15 (`page.tsx:79-83`), chỉnh được trong Settings và lưu `study_pomodoro_durations`.
- **Chuông:** Web Audio API, 4 loại `classic_clock | zen_bell | birds | digital` (`study-sound.ts:3-32`), bật/tắt + đổi loại lưu `study_sound_enabled`, `study_pomodoro_sound_type`.
- **Clock:** giờ vi-VN + ngày dd/mm/yyyy (`page.tsx:213-233`), tùy chọn hiện giây `study_clock_show_seconds`, 12h `study_clock_12hour`.
- **Stopwatch:** tùy chọn hiện `.00` mili-giây `study_stopwatch_show_ms`.
- **AC:** hết focus tự reo + toast; đổi duration có hiệu lực ngay chu kỳ sau; F5 không mất cấu hình.

### FR-06. Tasks + Kanban
- **Mô tả:** quick task (`StudyTask`: text/completed/pomodoros/priority/createdAt, `study-types.ts:32-39`) + Kanban board/column/card/checklist/dueDate (`study-types.ts:41-71`). Mở bằng `K`.
- **AC:** CRUD + kéo thả đổi cột; F5 không mất; card quá hạn hiển thị cảnh báo.

### FR-07. Ghi chú nhanh (Quick Notes)
- **Mô tả:** Markdown, autosave LocalStorage, mở bằng `N`. Đang gõ thì phím tắt toàn cục tạm ngưng (`page.tsx:250-271`).
- **AC:** gõ `f/z/k...` trong note không kích hoạt shortcut; mất mạng vẫn gõ/lưu được.

### FR-08. Zen Mode + Fullscreen + Global Mute
- **Zen (`Z`):** ẩn topbar/dock/player (`page.tsx:416-417, 557`), đóng mọi popout (`page.tsx:278-289`), hiện nút `Hiện lại giao diện`.
- **Fullscreen (`F`):** `requestFullscreen/exitFullscreen` (`page.tsx:236-246`).
- **Mute:** toggle lưu LocalStorage (`page.tsx:203-211`).
- **AC:** `Esc` thoát mọi modal + tắt Zen (`page.tsx:259-268`).

### FR-09. Settings thống nhất
- Mở từ nút `Sliders`, đóng hết widget khác (`page.tsx:130-139`), đóng thì trả lại tab cũ (`page.tsx:141-147`). Gồm: giây đồng hồ, 12h, mili-giây stopwatch, durations, sound on/off + loại chuông.
- **AC:** mọi toggle lưu ngay vào LocalStorage, hiệu lực tức thì.

### FR-10. Phím tắt & trợ giúp
- Danh sách đầy đủ trong modal `?/h` (`page.tsx:785-919`): Space, →, ←, ↑, ↓, M, S, L, F, Z, T, K, N, B, E, ?, Esc.
- **AC:** modal mở/đóng bằng `?` và `Esc`; có dòng cảnh báo tạm ngưng khi nhập liệu.

---

## 5. Yêu cầu phi chức năng (NFR)

| ID | Nhóm | Yêu cầu |
|----|------|---------|
| NFR-01 | Hiệu năng | Dynamic import widget nặng; ảnh `.avif`, video `muted+playsInline+preload poster`; LCP < 2.5s |
| NFR-02 | Sẵn sàng | Static export nên chạy được GitHub Pages/Vercel/CDN, offline một phần sau lần tải đầu |
| NFR-03 | Tương thích | Chrome/Edge/Safari/Firefox mới nhất; mobile có layout co giãn, không scroll ngang |
| NFR-04 | A11y | Contrast ≥ 4.5:1, focus ring, nút icon có `title`, hỗ trợ bàn phím 100% luồng chính |
| NFR-05 | Bảo mật | Không secret ở client; embed chỉ cho `youtube-nocookie` + `spotify embed`; validate URL trước khi iframe |
| NFR-06 | Bản quyền | Credit artist Pixabay trong `study-types.ts`; không hotlink nguồn cấm |
| NFR-07 | Khả bảo trì | Type strict (`StudyTask`, `KanbanBoard`, `Scene`...), test `npm test` (vitest `src/`: assets/pomodoro/tasks) |

---

## 6. Mô hình dữ liệu & lưu trữ cục bộ

### 6.1. Entities chính
`Track`, `AmbientSound`, `Scene`, `StudyTask`, `KanbanBoard/Column/Card/ChecklistItem`, `StudyEmbedItem` — xem `src/components/study/study-types.ts:5-71, 1083-1095`.

### 6.2. Bảng LocalStorage keys (AS-IS)
| Key | Giá trị | Ghi tại |
|-----|---------|---------|
| `huflit_study_scene_id` | scene.id | `page.tsx:199` |
| `huflit_study_global_mute` | "true/false" | `page.tsx:207` |
| `huflit_study_pomo_visible` | "true/false" | `page.tsx:295` |
| `study_clock_show_seconds` | bool | `page.tsx:158` |
| `study_clock_12hour` | bool | `page.tsx:164` |
| `study_stopwatch_show_ms` | bool | `page.tsx:174` |
| `study_pomodoro_durations` | `{focus, short_break, long_break}` JSON | `page.tsx:180` |
| `study_sound_enabled` | bool | `page.tsx:186` |
| `study_pomodoro_sound_type` | 1 trong 4 loại | `page.tsx:193` |
| (tasks/notes/kanban/queue) | JSON do widget tự quản | `StudyTasksWidget`, `StudyNotesWidget`, `StudyMusicPlayer` |

Rủi ro AS-IS: đầy quota 5MB, mất khi xóa cache, không đồng bộ đa thiết bị → động lực lên fullstack.

---

## 7. TO-BE Fullstack — Lộ trình đề xuất như 1 BA

### Phase 2A — Backend tối thiểu (không phá static)
- `POST /api/parse-embed` thay `parseEmbedUrl` ở client để chặn SSRF + cache thumbnail.
- `GET /api/tracks?mood=` + `GET /api/scenes?category=` phân trang, giảm bundle JSON cứng trong `study-types.ts`.
- DB Postgres: `users, scenes, tracks, sounds` (read-only seed từ data hiện tại).
- AC: FE cũ vẫn chạy nếu API chết (fallback data cứng).

### Phase 2B — Tài khoản + đồng bộ
- Auth (NextAuth Google/Email): bảng `user_settings` map 1-1 với toàn bộ keys mục 6.2 + `updated_at` để merge đa thiết bị (last-write-wins + confirm khi xung đột).
- `tasks`, `kanban_boards/columns/cards`, `notes` (ProseMirror JSON + search FTS), `pomodoro_sessions` (start/end/duration/type/completed).
- API đề xuất:
```
GET/PUT /api/me/settings
GET/POST /api/tasks | PATCH/DELETE /api/tasks/:id
GET/POST /api/boards | POST /api/boards/:id/cards | PATCH /api/cards/:id/move
GET/POST /api/notes | PATCH /api/notes/:id
POST /api/pomodoro/sessions | GET /api/stats/focus?range=7d
```
- AC: offline vẫn dùng được (queue + sync khi online); mất mạng không mất note/task.

### Phase 2C — Realtime & social nhẹ
- Phòng học chung: share scene + sync nhạc (WebSocket), presence, chat tối giản.
- Leaderboard focus tuần (opt-in), streak, huy hiệu.
- NFR thêm: p95 API < 300ms, WS reconnect < 3s, kiểm duyệt nội dung phòng công khai.

### User stories TO-BE (mẫu)
1. Là Linh, tôi muốn đăng nhập Google để F5/đổi máy vẫn còn task, note, scene → AC: login < 10s, sync < 3s, xung đột hiện dialog chọn bản giữ.
2. Là Linh, tôi muốn xem tổng giờ focus 7 ngày để báo cáo → AC: chart đúng ±1 phút so với `pomodoro_sessions`, export CSV.
3. Là chủ phòng, tôi muốn khóa đổi nhạc của member để giữ vibe → AC: chỉ owner/co-host có quyền `DJ`, member request được duyệt.

---

## 8. Tiêu chí nghiệm thu tổng (UAT v1.x)
1. Mở `/`, LCP < 2.5s, không lỗi console chặn render.
2. Đổi 5 scene liên tục: mỗi lần crossfade mượt, không trắng.
3. Bật 1 track lofi + 2 ambient + 1 YouTube live: nghe đồng thời, mute tổng tắt hết.
4. Chạy Pomodoro 25-5-15 rút ngắn còn 0.2 phút test: reo đúng loại chuông đã chọn.
5. Tạo 3 task + 1 Kanban card có deadline + 1 note Markdown → F5 còn nguyên.
6. Bấm `Z` ẩn toàn UI, `Esc` hiện lại; `F` fullscreen; `?` mở bảng phím tắt.
7. Nhập URL YouTube/Spotify sai → báo lỗi, app không crash.
8. `npm run build && npm test` xanh.

---

## 9. Rủi ro & giả định
| Rủi ro | Mức | Giảm thiểu |
|--------|-----|------------|
| CDN/GitHub release asset chết | Cao | Mirror 2 CDN + fallback thumbnail local |
| Autoplay bị chặn | Trung bình | Mặc định muted video; nhạc chờ gesture đầu tiên |
| LocalStorage đầy/mất | Trung bình | Dọn key cũ, nén note, cảnh báo quota; roadmap sync cloud |
| Iframe YouTube/Spotify đổi policy | Thấp | Dùng `youtube-nocookie`, test định kỳ, wrapper lỗi |
| Giả định | — | 1 user/1 trình duyệt ở v1.x; không cần GDPR xóa tài khoản cho tới Phase 2B |

---

## 10. Phụ lục: lệnh & file tham chiếu nhanh
```bash
npm install
npm run dev    # cổng 3001
npm test       # vitest run src/
npm run build  # static export -> out/
```
- Trang chính: `src/app/page.tsx:53-922`
- Kiểu dữ liệu: `src/components/study/study-types.ts`
- Chuông Web Audio: `src/components/study/study-sound.ts`
- Layout/SEO: `src/app/layout.tsx`
- Build tĩnh: `next.config.ts`
