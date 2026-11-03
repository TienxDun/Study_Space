---
name: Chat V2 UI
description: Style guide cho giao diện chatbot v2 (ZenStudy). Dùng làm nền cho các sprint S3–S5.
colors:
  background: "#070A11"
  panel: "#0A0F18"
  panel-soft: "#FFFFFF0A"
  line: "#FFFFFF14"
  text-main: "#FFFFFF"
  text-sub: "#D4D4D8"
  text-faint: "#71717A"
  accent-emerald: "#10B981"
  accent-emerald-bright: "#34D399"
  accent-amber: "#FBBF24"
  accent-rose: "#FB7185"
  accent-sky: "#38BDF8"
lightColors:
  background: "#F4F6F5"
  panel: "#FFFFFF"
  surface: "#F8FAF9"
  line: "#0F172A1A"
  text-main: "#111827"
  text-sub: "#4B5563"
  text-muted: "#6B7280"
  accent-emerald: "#059669"
  accent-amber: "#92400E"
  accent-rose: "#9F1239"
typography:
  font: "Be Vietnam Pro"
  body-mobile: { fontSize: 13px, lineHeight: 24px, fontWeight: 400 }
  body-desktop: { fontSize: 14px, lineHeight: 24px, fontWeight: 400 }
  title: { fontSize: 14px, fontWeight: 600 }
  label: { fontSize: 10px, fontWeight: 600, letterSpacing: "0.16em" }
  meta: { fontSize: 10px, fontWeight: 400 }
rounded:
  panel: 24px
  card: 16px
  composer: 22px
  button: 12px
  pill: 999px
spacing:
  page-x-mobile: 12px
  page-x-desktop: 24px
  content-gap: 20px
  max-chat: 820px
  max-empty: 980px
  sidebar: 276px
---

# Chat V2 UI — Style Guide

> Cập nhật: 2026-11-01. Áp dụng cho `src/features/chat-v2/**` và route `/dev/chat-v2`.
> Tham khảo repo: [UI_REFERENCE_REPOS.md](./UI_REFERENCE_REPOS.md).
> Không áp dụng cho chatbot cũ trong `src/components/study/chat/**`.

## 1. Hướng thiết kế

**Quiet Study Desk** — bàn học ban đêm, kính mờ, ánh emerald nhẹ.

- Nền tối xanh đen, không dùng nền sáng.
- Kính mờ vừa phải: topbar, sidebar, composer; không bọc mọi thứ trong blur.
- Emerald là màu hành động chính; amber là cảnh báo; rose là dừng/lỗi; sky là thông tin.
- Chữ Việt, ngắn, thân thiện, không giáo điều.
- Cảm giác “công cụ học tập”, không phải clone ChatGPT.
- Không gradient tím, không neon, không glass dày đặc nhiều lớp.

## 2. Bố cục

### Desktop ≥ 1024px

```text
┌──────────────┬──────────────────────────────────────────────┬─────────────┐
│ Sidebar 276  │ Topbar full-bleed: title · model · context  │             │
│ brand        ├──────────────────────────────────────────────┤ Rail 280    │
│ new chat     │ Chat scroll (max 820)                       │ (≥1600, khi │
│ conversation │  user bubble phải, assistant bubble trái    │  có nội     │
│ safety card  ├──────────────────────────────────────────────┤  dung)      │
│              │ Composer (max 820)                          │             │
└──────────────┴──────────────────────────────────────────────┴─────────────┘
```

- Topbar trải hết vùng main, không còn giới hạn 980px.
- Empty state rộng tối đa 1120px; lưới gợi ý tối đa 900px.
- Rail phải 280px chỉ ở `min-width: 1600px`, và chỉ render khi phiên có tóm tắt hoặc tệp.
- **Liền mạch**: sidebar, topbar, rail và composer không có đường kẻ chia cắt; chúng dùng chung nền canvas (`chat-bg`), tách nhau bằng khoảng trắng và blur nhẹ.

### Tablet 640–1023px

- Không sidebar.
- Topbar 2 hàng: brand + title; model + context + new chat.
- Chat và composer rộng toàn bộ, giới hạn 820px.

### Mobile < 640px

- Không sidebar.
- Topbar dính trên, 2 hàng như tablet.
- Chat scroll toàn màn hình; composer dính đáy.
- Chừa safe area: `--app-safe-bottom`.
- Portrait-first; không thiết kế layout ngang riêng.
- Nút chính ≥ 40px; nút gửi/dừng 40px; nút phụ 32–36px.

## 3. Token

Dùng token có sẵn trong `src/app/styles/tokens.css` và các màu zinc/emerald/amber/rose/sky của Tailwind. Không thêm bảng màu mới.

| Vai trò | Giá trị |
|---|---|
| Nền app | `#070A11` |
| Sidebar | trong suốt, cùng nền app, không viền |
| Card | `bg-white/[0.035]` + `border-white/8` |
| Panel nổi | `#0A0F18` / `bg-[#0a0f18]/97` |
| Chữ chính | `text-white` / `text-zinc-100` |
| Chữ phụ | `text-zinc-400` |
| Chữ mờ | `text-zinc-500` / `text-zinc-600` |
| Accent chính | `emerald-400` / `emerald-300` |
| Cảnh báo | `amber-300/400` |
| Dừng/lỗi | `rose-300/400` |
| Thông tin | `sky-300` |

Quy tắc:

- Nền tối, chữ sáng; không dùng nền trắng cho theme tối.
- Viền glass: `border-white/8` đến `border-white/15` (theme tối).
- Không dùng `!important`; giữ lint CSS xanh.
- Blur chỉ ở topbar, composer, popover; mobile dùng blur nhẹ hơn.
- **Không hardcode màu trong component**: dùng class `chat-*` hoặc biến `--chat-*`.
- Không dùng `border-r`/`border-l`/`border-t`/`border-b` để chia vùng khung; chỉ card, popover và input mới có viền.

### 3.1 Theme sáng/tối

- `data-chat-theme="dark" | "light"` gắn trên `<html>` (không phải root `ChatV2`).
- Script đồng bộ trong `<head>` root layout đọc `chat-v2-theme` và gắn attribute trước paint, nên F5 ở theme sáng không lóe nền tối.
- Nút đổi theme ở topbar (`SunIcon` / `MoonIcon`); icon chọn bằng CSS theo attribute để đúng ngay từ paint đầu, không chờ hydrate.
- Lưu lựa chọn vào `localStorage` key `chat-v2-theme`; hook `useChatV2Theme` gắn lại theme khi soft navigation và cập nhật `meta[name="theme-color"]`.
- Mặc định: theme tối.
- CSS token: [`src/app/styles/chat-v2.css`](../../src/app/styles/chat-v2.css).
- Component dùng class sinh từ token:
  - `bg-chat-bg`, `bg-chat-surface`, `bg-chat-elevated`
  - `text-chat-ink`, `text-chat-sub`, `text-chat-muted`, `text-chat-faint`
  - `border-chat-border`, `border-chat-border-strong`
  - `bg-chat-accent-soft`, `text-chat-accent`, `bg-chat-accent-button`
  - `bg-chat-user`, `border-chat-user-border`, `text-chat-user-text`
  - `bg-chat-amber-soft`, `text-chat-amber`, `bg-chat-rose-soft`, `text-chat-rose`

| Vai trò | Dark | Light |
|---|---|---|
| Nền app | `#070A11` | `#F4F6F5` |
| Panel/card | `rgba(255,255,255,0.035)` | `#FFFFFF` |
| Chữ chính | `#F4F4F5` | `#111827` |
| Chữ phụ | `#A1A1AA` | `#4B5563` |
| Accent | `#34D399` | `#059669` |
| User bubble | `rgba(16,185,129,0.11)` | `#D1FAE5` |
| User text | `#ECFDF5` | `#064E3B` |

Quy tắc theme sáng:

- Không dùng chữ trắng trên nền trắng.
- Secondary text không nhạt hơn `#6B7280`.
- Primary button dùng nền `#059669` + chữ trắng.
- Viền phải đủ thấy: `rgba(15,23,42,0.10)` trở lên.
- Blur giữ nhẹ; ưu tiên bóng mềm thay vì viền trắng.
- Mọi component mới phải kiểm tra cả dark và light.

## 4. Typography

Font: **Be Vietnam Pro** (đã cấu hình `--font-be-vietnam`).

| Vai trò | Mobile | Desktop |
|---|---|---|
| Nội dung chat | 13px / 24px | 14px / 24px |
| Tiêu đề phiên | 13px semibold | 14px semibold |
| Tên trợ lý / label | 11px semibold | 11px semibold |
| Nhãn nhóm | 10px uppercase, tracking 0.16em | 10px |
| Meta / footer | 9–10px | 10px |
| Mã / token | 13px mono | 13px mono |

- Không dùng chữ nhỏ hơn 9px.
- Tiêu đề dài dùng `truncate`; không xuống 2 dòng ở topbar/sidebar.
- Nội dung trả lời dùng markdown; không tự chèn HTML thô.

## 5. Component

### 5.1 Sidebar (`ChatSidebar`)

- Rộng 276px, chỉ desktop; ẩn/hiện bằng nút ở topbar, lưu `chat-v2-sidebar-open`.
- Nền trong suốt, không viền phải: sidebar nằm cùng mặt phẳng với vùng chat, chỉ tách bằng khoảng trắng.
- Brand: mascot mầm cây **StudySproutMascot** 38px đứng tự do (không viền, không nền) + “ZenStudy” + “STUDY ASSISTANT”.
- Nút “Cuộc trò chuyện mới”: cao 44px, emerald đặc, bo 16px.
  - Phiên đang mở mà chưa có tin nhắn nào thì **disable** (nền `chat-surface`, chữ `chat-faint`, không đổ bóng, không scale); nhãn đổi thành “Đang ở cuộc trò chuyện mới”.
- Mục “Hội thoại”: danh sách phiên thật, mới nhất trước.
  - Item active: nền `emerald-400/[0.07]`, viền `emerald-400/20`.
  - Tiêu đề 1 dòng truncate; dòng meta: số tin · thời gian tương đối.
  - Phiên đã tóm tắt: icon bookmark + số tin, màu emerald.
  - Menu “⋯” luôn hiện (không ẩn theo hover): Đổi tên / Xoá phiên.
  - Đổi tên tại chỗ: Enter lưu, Esc huỷ, blur lưu; rỗng = quay lại tiêu đề tự động.
  - Xoá: xác nhận 2 bước ngay dưới item, không dùng `window.confirm`.
- Bottom card “An toàn 16+” + disclaimer AI.

### 5.1b Drawer mobile (`SessionDrawer`)

- Mở bằng nút menu ở topbar; panel 288px (tối đa 86vw) trượt từ trái.
- Nền panel **đặc** (`bg-chat-elevated`) vì drawer nổi trên nội dung chat; không dùng nền trong suốt như sidebar desktop.
- Backdrop tối + blur nhẹ; `role="dialog"`, `aria-modal`, Escape đóng.
- Dùng chung `SidebarBody` với desktop: brand + nút đóng, “Cuộc trò chuyện mới”, danh sách phiên, card an toàn.
- Chọn phiên hoặc tạo phiên mới thì đóng drawer.

### 5.2 Topbar (`ChatTopbar`)

- Cao ~64px desktop, 2 hàng mobile; không `border-b`, nền `bg-chat-bg/80` + blur để dính trên mà không tạo đường chia.
- Trái: nút menu (mobile), nút ẩn/hiện sidebar (desktop), tiêu đề phiên + “Trợ lý học tập · AI có thể sai”.
- Phải: `ModelPicker`, `ContextMeter`, nút đổi theme, nút bật/tắt rail, nút “Cuộc trò chuyện mới” ở **mọi breakpoint** (emerald nhạt, icon plus, tooltip rõ).
  - Nút này dùng chung trạng thái disable với sidebar/drawer: phiên rỗng thì mờ và tooltip “Đang ở cuộc trò chuyện mới”, tránh hành động lặp vô nghĩa.

### 5.3 ModelPicker

- Nút pill glass, icon CPU, tên model, context thật của model (`1M context`, `391k context`…), `ảnh/chữ`.
- Desktop: popover 390px neo phải nút.
- Mobile: popover full chiều rộng (`inset-x-3`), bắt đầu dưới topbar; không tràn ngang.
- Search, danh sách cuộn, check model đang chọn.
- Mỗi option: tên, provider, context, vision; giá vào/ra mỗi 1M token nằm cột phải, có tooltip giải thích.
- Hàng lọc chỉ giữ 3 chip loại model (`Tất cả`, `Miễn phí`, `Đọc ảnh`); các hãng gom vào dropdown `Hãng` (nút hiển thị tên hãng đang lọc), không cuộn ngang, không cắt chữ.
- Nút sắp xếp theo giá nằm ở footer cạnh số lượng model: `Mặc định` / `Giá thấp → cao` / `Giá cao → thấp`; menu mở lên trên và có chú thích `Giá vào/ra · USD / 1M token`. Xếp hạng dùng chi phí ước tính `vào × 3 + ra`; model chưa có giá luôn nằm cuối.
- Giá lấy từ bảng niêm yết motapis (`models.js`, USD / 1M token), không phải số tự tính.
- Không dùng native select trần; popover phải đóng khi click ngoài/Escape.
- Tương lai: thêm nhóm provider/nhãn “mạnh”, nhưng không đổi vị trí.

### 5.4 ContextMeter

- Vòng tròn 36px, conic-gradient:
  - < 70%: emerald
  - 70–89%: amber
  - ≥ 90%: rose
- Chỉ hiện vòng tròn + tooltip; **không hiện label chữ** để topbar gọn.
- Chi tiết token nằm trong tooltip; model picker đã hiện context của model đang chọn.
- Nếu có tin bị lược bớt, hiện callout/info riêng, không nhồi vào vòng.
- Có bản tóm tắt: badge bookmark nhỏ ở góc trên phải vòng; tooltip thêm “Đã tóm tắt N tin cũ”.
- Đang tóm tắt nền: chấm amber nhấp nháy cùng vị trí; tooltip “Đang tóm tắt hội thoại…”. Không chặn gửi tin mới.

### 5.5 MessageBubble

- User: bubble phải, nền `emerald-400/[0.11]`, viền `emerald-400/20`, bo 16px, góc dưới phải nhỏ.
- Assistant: chỉ tên “ZenStudy” + nhãn AI, **không avatar** để khung hội thoại thoáng; bubble nền `white/[0.035]`, viền `white/8`.
- Nội dung assistant dùng `ChatV2Markdown`.
- Streaming: 3 chấm nhấp nháy khi chưa có chữ; con trỏ dọc khi đã có chữ.
- Hành động dưới câu trả lời: sao chép, làm lại; icon 14px, nút 32px.
- Attachment chip: thumbnail 24–32px hoặc icon file, tên truncate.

### 5.6 Composer

- Khối glass bo 22px, viền `white/12`, focus ring emerald nhẹ.
- Vùng composer không có `border-t`; nền `bg-chat-bg/80` + blur để tin nhắn mờ dần phía sau thay vì bị cắt bằng đường kẻ.
- Textarea tự giãn 44–160px, không scrollbar thô.
- Trái: đính kèm (40px), text “Enter để gửi · Shift + Enter xuống dòng”.
- Phải: nút gửi 40px emerald hoặc dừng 40px rose.
- Attachment tray phía trên, chip có nút xoá.
- Dán ảnh từ clipboard (Ctrl+V) tạo attachment như chọn tệp; dán chữ vẫn vào textarea bình thường.
- Kéo–thả tệp vào vùng composer (desktop) tạo attachment như chọn tệp. Khi đang kéo, phủ viền emerald đứt nét + nhãn “Thả tệp để đính kèm”; thả xong nhãn biến mất, không để trình duyệt mở tệp.
- Ảnh (trong tray, bong bóng tin nhắn, rail “Tệp trong phiên”) mở lightbox khi bấm: portal toàn màn hình `bg-black/75`, khung rộng `min(92vw,1100px)`, ảnh `max-h-[78vh]`, tên tệp + nút đóng 32px, đóng bằng Esc hoặc bấm nền.
- Ảnh gốc (bản 1280px gửi cho model) lưu trong IndexedDB theo id attachment; localStorage chỉ giữ thumb và bản xem trước 800px nên phiên không tràn quota. Lightbox tải ảnh gốc từ IndexedDB, hiện thumb ngay trong lúc chờ; ảnh gửi trước bản này chỉ còn thumb 240px nên có ghi chú “Ảnh cũ chỉ còn bản xem trước nhỏ.”.
- Cảnh báo vision ở trên composer.
- Footer disclaimer AI luôn hiển thị.

### 5.7 EmptyState

- Mascot mầm cây **StudySproutMascot** 64px đứng tự do, không viền/nền.
- Nhãn “TRỢ LÝ HỌC TẬP”.
- Tiêu đề “Hôm nay bạn muốn học gì?”.
- 3 gợi ý: giải thích, tóm tắt, luyện tập.
- Mobile: xếp dọc, bắt đầu từ trên, không center gây cắt icon.

### 5.8 SessionRail

- Chỉ có ở `min-width: 1600px`; dưới 1600 và trên mobile không render chiều rộng.
- **Chỉ hiện khi có nội dung**: phiên có `summary` hoặc có tệp đính kèm. Phiên trống không có rail và không có nút bật.
- Bật/tắt bằng nút cạnh theme ở topbar; lưu `chat-v2-rail-open` (`1`/`0`), F5 giữ trạng thái. Nút X trong rail cũng lưu trạng thái tắt.
- Mục **Bộ nhớ phiên**: text tóm tắt (clamp 8 dòng, có “Xem thêm” khi dài), meta “Đã tóm tắt N tin cũ · thời gian”; khi đang tóm tắt hiện chấm amber.
- Mục **Tệp trong phiên**: thumbnail 28px nếu là ảnh, icon nếu là tệp chữ; tên truncate + loại. Ghi chú “Ảnh chỉ giữ bản xem trước trên máy này”.
- Không lặp lại vòng context/model của topbar; rail chỉ dành cho bộ nhớ và tệp.
- Nền trong suốt, không viền trái; rail cùng mặt phẳng canvas với vùng chat. Nội dung cuộn riêng; card bộ nhớ/tệp tự có viền riêng.

### 5.9 Callout

- Amber: cảnh báo model/vision/context.
- Rose: lỗi gọi API.
- Emerald: thông tin đã lược bớt/chuyển model.
- Bo 16px, icon 15px, chữ 11px, không dùng alert toàn màn hình.

## 6. Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Trống | EmptyState + gợi ý |
| Đang tải model | Fallback list + callout nếu lỗi |
| Đang stream | Chấm/con trỏ + nút Dừng |
| Đã dừng | Callout “Đã dừng câu trả lời” |
| Bị cắt | Callout finish_reason |
| Lỗi | Callout rose, giữ tin nhắn đã có |
| Đã lược bớt | Callout emerald + trimmed trong topbar/meta |
| Đã tóm tắt | Callout emerald “Đã tóm tắt N tin cũ — áp dụng từ lượt gửi tiếp theo” + badge bookmark ở ContextMeter |
| Đang tóm tắt | Chấm amber nhấp nháy ở ContextMeter; chat vẫn dùng được |
| Vision bị chặn | Cảnh báo amber + disable gửi |

## 7. Chuyển động

Hiện có (đều ngắn, không chặn thao tác):

| Hiệu ứng | Thời lượng | Nơi |
|---|---|---|
| Drawer trượt từ trái | 220ms | `SessionDrawer` |
| Backdrop drawer fade | 160ms | `SessionDrawer` |
| Popover model / menu phiên | 160ms fade + nhích 4px | `ModelPicker`, `SessionList` |
| Callout / xác nhận xoá | 180ms / 160ms | `ChatV2`, `SessionList` |
| Sidebar desktop fade khi mở | 160ms | `ChatSidebar` |
| 3 chấm soạn / con trỏ stream / chấm tóm tắt | pulse 2s | `MessageBubble`, `ContextMeter` |
| Hover nút, card gợi ý, mũi tên model | 150–180ms | toàn bộ |

- Class animation đặt trong [chat-v2.css](../../src/app/styles/chat-v2.css): `chat-v2-anim-fade`, `chat-v2-anim-pop`, `chat-v2-anim-rise`, `chat-v2-anim-drawer`.
- Chỉ dùng transition ngắn 150–250ms.
- Hover: border/sáng lên; active: `scale(0.95–0.98)`.
- Không animate mỗi token; chỉ con trỏ/chấm streaming.
- Popover: fade + scale nhẹ; không bounce.
- **Bắt buộc tôn trọng `prefers-reduced-motion`**:
  - Class animation tự tắt qua `@media (prefers-reduced-motion: reduce)`.
  - Pulse dùng `motion-reduce:animate-none`.
  - Card gợi ý dùng `motion-reduce:hover:translate-y-0`.
  - Auto-scroll dùng `behavior: "auto"` thay vì smooth.
- Không dùng animation trang trí kéo dài, không parallax.

## 8. Nội dung & an toàn

- Luôn hiện: “Bạn đang trò chuyện với AI” hoặc “AI có thể sai”.
- Không hứa “chính xác 100%”.
- Không khuyến khích gửi ảnh mặt/giấy tờ.
- Copy lỗi phải nói việc cần làm, không chỉ “Error”.
- Nút dừng/làm lại dùng tiếng Việt.
- Giữ mục tiêu 16+; không thêm UI hướng tới trẻ nhỏ.

## 9. Accessibility

- Mọi nút icon có `aria-label`.
- Popover có `aria-haspopup`, `aria-expanded`, `role="listbox"`, option `aria-selected`.
- Focus ring rõ: `ring-2 ring-emerald-400/50`.
- Không chỉ dùng màu để báo trạng thái; kèm chữ/icon.
- Vùng chat `aria-live="polite"`.
- Touch target chính ≥ 40px; phụ ≥ 32px.
- Không chặn bàn phím; Escape đóng popover.

## 10. Chỗ dành cho sprint sau

- ~~**S3 — Sessions:** thay dòng “Nhiều phiên chat” bằng danh sách phiên thật; thêm rename/delete/search.~~ Đã xong: danh sách phiên thật, rename/delete, drawer mobile, ẩn/hiện sidebar. Search để sau.
- ~~**S3 — Memory:** badge “Đã tóm tắt N tin”; mở rộng ContextMeter.~~ Đã xong: badge bookmark + chấm đang tóm tắt.
- **S4 — Tools:** card tool call trong MessageBubble; trạng thái đang gọi tool.
- **S5 — Report:** nút báo cáo trong hàng action của assistant; dialog độc lập.
- **S5 — Auth:** avatar user thật ở topbar/sidebar; giữ layout.
- **S5 — Cloud sync:** đánh dấu phiên “chỉ máy này” khi chưa nối D1; không đổi layout sidebar.

## 11. Nên / Không nên

Nên:

- Dùng token hiện có + emerald làm accent chính.
- Giữ topbar/composer gọn; nội dung là trung tâm.
- Dùng một nguồn model picker duy nhất.
- Kiểm tra desktop 1440×900 và mobile 390×844.
- Tách logic vào `useChatV2`; component chỉ render.

Không nên:

- Copy UI ChatGPT/Material.
- Thêm gradient tím/neon.
- Dùng nhiều lớp `backdrop-blur` trên mobile.
- Đổi API/Worker khi chỉ làm UI.
- Import component/hook từ chatbot cũ.
- Thêm nút giả hoạt động (session/report) khi chưa có backend.

## 12. File map

```text
src/features/chat-v2/
  ChatV2.tsx
  hooks/useChatV2.ts
  hooks/useChatV2Theme.ts
  components/
    ChatSidebar.tsx
    SessionDrawer.tsx
    SessionList.tsx
    ChatTopbar.tsx
    ModelPicker.tsx
    ContextMeter.tsx
    SessionRail.tsx
    MessageList.tsx
    MessageBubble.tsx
    Composer.tsx
    EmptyState.tsx
    ChatV2Markdown.tsx
  lib/ (api, sse, tokens, sessions, attachments, contract)
```

Theme CSS: `src/app/styles/chat-v2.css`.

## 13. Checklist trước khi merge UI

- [ ] Desktop 1440×900: empty, populated, model picker, cả dark và light.
- [ ] Mobile 390×844: empty, populated, composer, attachments, cả dark và light.
- [ ] Toggle theme, F5 vẫn giữ lựa chọn.
- [ ] Không có chữ trắng trên nền trắng ở theme sáng.
- [ ] Stream, dừng, làm lại, copy.
- [ ] Ảnh/file, vision warning, xoá attachment.
- [ ] Context meter + trimmed callout.
- [ ] Tạo/chuyển phiên, F5 còn phiên, đổi tên, xoá 2 bước.
- [ ] Ẩn/hiện sidebar desktop; F5 giữ lựa chọn; drawer mobile mở/đóng bằng Escape.
- [ ] 1920/1600: rail hiện khi có tóm tắt/tệp, ẩn khi phiên trống; 1440 không có rail; toggle + F5 giữ trạng thái.
- [ ] Tóm tắt dài: badge bookmark + callout “Đã tóm tắt N tin”; tin gần nhất còn nguyên văn.
- [ ] Không tràn ngang (`scrollWidth === innerWidth`).
- [ ] `npm test`, `tsc`, `lint` xanh.
- [ ] Không sửa Worker/API/chat cũ.
