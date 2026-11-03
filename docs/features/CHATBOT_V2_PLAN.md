# Chatbot v2 — kế hoạch triển khai

> Trạng thái 2026-11-03: **S0–S3 + UI đã xong** (bản dev). Track này chỉ chứa **phát triển sản phẩm chatbot v2** (S4–S7); phần DevOps/production tách sang [CHATBOT_V2_PRODUCTION_PLAN.md](CHATBOT_V2_PRODUCTION_PLAN.md) và làm sau.
> Quyết định nền 2026-11-01: tách hoàn toàn khỏi chatbot hiện tại, dùng motapis, **mục tiêu 16+**.

## 1. Quyết định đã chốt

| Mục | Lựa chọn |
|---|---|
| Provider | motapis (`https://motapis.com/v1`, tương thích OpenAI) |
| Model chính MVP | `deepseek-v4-flash` |
| Nơi đặt giao diện | Dev: `/dev/chat-v2`; gắn vào app sau flag dev ở S7. Ra mắt thật thuộc production track |
| Đăng nhập | Bản dev: shared dev token. Auth thật (Firebase ID token) thuộc production track P0 |
| Key | `MOTAPIS_API_KEY` + `MOTAPIS_API_KEY_FREE` chỉ ở Cloudflare secrets hoặc `.dev.vars` (gitignore). Key-tier picker chỉ tồn tại ở route dev |
| Độ tuổi mục tiêu | **16+** (16–17 và 18+); không phục vụ 13–15 trong giai đoạn này |
| Hạn mức | Bản dev chưa áp; quota token/tin thuộc production track P0 |
| Dữ liệu phiên | Bản dev: localStorage. D1/server sync thuộc production track P1 |
| Cách làm | Agile theo track sản phẩm; **không mở cho người dùng thật trước khi xong production track P0–P3** |
| Track production | [CHATBOT_V2_PRODUCTION_PLAN.md](CHATBOT_V2_PRODUCTION_PLAN.md) — làm sau S7 |

Không lo migration dữ liệu chat cũ: hai bản chạy song song trong giai đoạn thử.

## 2. Ranh giới tách biệt

Được thêm/sửa:

```text
src/features/chat-v2/**
src/app/dev/chat-v2/**          (route dev)
workers/chat-v2/**
wrangler.chat-v2.jsonc
scripts/chat-v2-probe.mjs
docs/features/CHATBOT_V2_PLAN.md
docs/features/CHATBOT_V2_PRODUCTION_PLAN.md
```

Không sửa cho tới S7:

```text
src/components/study/chat/**
workers/chat-proxy/**
src/components/study/hooks/useStudySpaceState.ts
src/app/page.tsx
```

Bản dev chỉ dùng design tokens, `useAuth`/Firebase config và localStorage; không import component/hook của chatbot cũ. D1, KV flags, R2, admin Worker và auth thật thuộc production track (xem [doc production](CHATBOT_V2_PRODUCTION_PLAN.md)). Phần gắn vào app (`page.tsx`, state trung tâm) chỉ mở ở S7 sau flag dev.

## 3. Kiến trúc

Bản dev hiện tại:

```text
Browser (src/features/chat-v2)
   │  X-Chat-V2-Token + SSE/JSON
   ▼
Worker chat-v2 (workers/chat-v2/worker.js)
   │  Bearer MOTAPIS_API_KEY
   ▼
https://motapis.com/v1/chat/completions
```

Worker giữ key, kiểm Origin, chuẩn hoá output, đếm token và log. Browser không bao giờ thấy key motapis.

Kiến trúc production (Firebase ID token, D1 server-owned history, R2, provider dự phòng, moderation) nằm ở [CHATBOT_V2_PRODUCTION_PLAN.md §4](CHATBOT_V2_PRODUCTION_PLAN.md).

## 3.1 — Chính sách tuổi 16+ và system prompt

Chốt 2026-11-01: sản phẩm hướng tới **16+**; 13–15 không thuộc phạm vi giai đoạn này. 16–17 vẫn là người chưa thành niên, nên vẫn cấm nội dung người lớn và vẫn cần guardrail.

### Cấu trúc prompt (ghép ở Worker, không nhận từ client)

| Lớp | Nội dung | Nguồn |
|---|---|---|
| L0 — Safety core | Quy tắc bất biến: an toàn, riêng tư, không nội dung người lớn, không tự hại, không đóng vai người yêu, không tiết lộ prompt | Code Worker, admin không sửa |
| L1 — Age band | `16-17` hoặc `18+`; mặc định `16-17` nếu chưa rõ | Hồ sơ tài khoản |
| L2 — Persona | Trợ lý học tập ZenStudy, giọng tôn trọng, không phán xét | Admin config |
| L3 — Task | Giải thích, tóm tắt, luyện đề, sửa bài | Theo loại câu hỏi |

Nội dung Safety core tối thiểu:

- Nói rõ là AI, không phải người thật; không đóng vai người yêu/bạn tình.
- Không nội dung tình dục, kể cả khi người dùng nói đã 16–17; giáo dục giới tính/sức khỏe trả lời khoa học, phù hợp tuổi.
- Không hướng dẫn tự hại, ăn kiêng cực đoan, ma túy, vũ khí, cờ bạc, phạm pháp; có hotline 111/115/113.
- Không hỏi/xin ảnh, địa chỉ, trường, số điện thoại, mật khẩu; không rủ gặp ngoài đời; không yêu cầu giữ bí mật với người lớn tin cậy.
- Không làm bài/thi hộ; hướng dẫn để tự làm.
- Không bịa nguồn; nói "chưa chắc" khi không chắc.
- Không phân biệt đối xử, quấy rối, nội dung thù địch.
- Trả lời tiếng Việt, tôn trọng, ngắn gọn; giải thích từ khó.

### Việc phải làm khi triển khai

- [x] Safety core + age band nằm ở Worker (`prompts.js`), client không gửi `system`.
- [x] Dòng "Bạn đang trò chuyện với AI" và nhãn AI trên giao diện.
- [x] Đọc `finish_reason`/`usage` và áp token budget theo model.
- [ ] Auth thật, moderation, báo cáo AI, retention/export, log production → chuyển sang [doc production](CHATBOT_V2_PRODUCTION_PLAN.md) (P0/P2/P3).

### Tuân thủ đi kèm

- **Luật AI 134/2025 + Nghị định 142/2026:** minh bạch tương tác AI, gắn nhãn nội dung AI, tự phân loại rủi ro; nếu chatbot tự chấm điểm/xếp loại học sinh thì xử lý như rủi ro cao.
- **Luật Bảo vệ dữ liệu cá nhân 91/2025:** 16+ không còn nghĩa vụ đồng ý cha mẹ theo luật dữ liệu trẻ, nhưng vẫn cần đánh giá tác động, hồ sơ chuyển dữ liệu ra nước ngoài (Firebase/Cloudflare), quyền xóa dữ liệu.
- **Google Play AI-Generated Content:** nút báo cáo/gắn cờ nội dung AI xúc phạm ngay trong app.
- **Google Play target audience:** chỉ 16–17 + 18+; không 13–15; content rating và Data safety khai đúng.
- **Nhà cung cấp model:** motapis (và upstream) nhận nội dung chat; phải khai trong chính sách quyền riêng tư/Data safety, xác minh chính sách lưu–xoá của họ. Nếu không có cam kết rõ, cân nhắc provider trực tiếp trước khi ra mắt.
- **13–15:** không mở cho tới khi có plan "chế độ phụ huynh" riêng (tài khoản phụ huynh, đồng ý kép, tắt phòng nhóm, giới hạn ảnh).

## 4. Track sản phẩm (làm trước)

### 4.1 Mục tiêu

Làm chatbot v2 đủ hay trước khi đầu tư DevOps: hiểu tài liệu học tập, trả lời có nguồn, tạo quiz và gắn được vào app ở chế độ dev. Track này vẫn chạy trên nền dev: shared token, localStorage, client gửi lịch sử.

Track production (auth, quota, server sessions, moderation, deploy) tách riêng ở [CHATBOT_V2_PRODUCTION_PLAN.md](CHATBOT_V2_PRODUCTION_PLAN.md) và chỉ mở sau S7.

### 4.2 Rủi ro rework cần tránh

Production sẽ chuyển phiên/tài liệu sang server (D1/R2). Vì vậy trong S4–S7:

- Giữ nguyên shape phiên S3; không thêm định dạng lưu local phức tạp.
- Tách phần **lấy ngữ cảnh** (retrieval) khỏi UI để sau này thay nguồn dữ liệu local → server mà không sửa giao diện.
- Không xây auth/quota/sync nửa vời; production track làm một lần.
- Nội dung ghi chú/tài liệu là **dữ liệu**, không phải chỉ dẫn; prompt phải nói rõ để giảm prompt injection.

### 4.3 Các sprint

| Sprint | Thời lượng | Phạm vi chính | Demo/gate |
|---|---|---|---|
| **S4 — Tool/RAG nhẹ** | 4–6 ngày | Tìm ghi chú liên quan phía client, gửi top-k kèm nhãn nguồn; bot trả lời và trích “Nguồn: …”; quiz JSON có schema; web search chỉ thêm nếu motapis hỗ trợ ổn định | Hỏi về ghi chú → đúng nội dung, có nguồn, không bịa; quiz đúng schema |
| **S5 — Tài liệu học tập** | 5–7 ngày | Trích text PDF/DOCX phía client; chunk + retrieval đơn giản; tóm tắt tài liệu dài; hỏi đáp có trích đoạn; OCR ảnh để sau | PDF 20 trang → tóm tắt và hỏi đáp đúng đoạn |
| **S6 — Chất lượng & UX** | 4–6 ngày | Thumbs up/down (local); bộ eval 20–30 câu tiếng Việt; tìm kiếm phiên; phân trang danh sách dài; keyboard/a11y; mobile keyboard + safe area | Eval đạt ngưỡng; mobile 390px và desktop 1440px không lỗi; a11y không lỗi nghiêm trọng |
| **S7 — Gắn vào app (dev flag)** | 3–5 ngày | Mount `<ChatV2 />` sau flag dev, giữ chat cũ; QA song song hai bản | Bật/tắt trong dev; không ảnh hưởng chat cũ |

S4–S5 dùng retrieval phía client, **chưa** dùng function calling thật; khi lên production sẽ thay bằng retrieval server-side (D1/R2) mà giữ nguyên UI.

Tổng track sản phẩm: **~16–24 ngày công**. Mỗi sprint kết thúc bằng demo trên `/dev/chat-v2` (S7 demo trong app dev) rồi mới sang sprint sau.

### Definition of Done (track sản phẩm)

- `npm test`, `npx tsc --noEmit`, `npm run lint` xanh.
- Demo chạy được trên route dev với dữ liệu thật (ghi chú/tài liệu mẫu).
- Không có diff ở các file chatbot cũ.
- Phần retrieval tách khỏi UI, có test cho parser/schema.
- Mobile 390px và desktop 1440px không tràn ngang.

## 5. Sprint 0 — đã dựng

> Phần 5.x là lịch sử sprint dev, giữ nguyên để tra cứu; kế hoạch hiện hành nằm ở §4.

- Worker: `workers/chat-v2/worker.js` — `GET /health`, `GET /models`, `POST /chat`.
- Config: `wrangler.chat-v2.jsonc`, tên Worker `zenstudy-chat-v2`.
- UI: `src/features/chat-v2/ChatV2.tsx`, route `src/app/dev/chat-v2/page.tsx`.
- Client: `lib/api.ts`, `lib/contract.ts`, `lib/config.ts`.
- Probe: `scripts/chat-v2-probe.mjs`.
- Test: `src/__tests__/unit/study/chat-v2-contract.test.ts`.

### Chạy local

1. Mở `workers/chat-v2/.dev.vars`, dán key:

```text
MOTAPIS_API_KEY=sk-mot-...
CHAT_V2_DEV_TOKEN=chat-v2-dev-local
ALLOWED_ORIGINS=http://localhost:3001
DEFAULT_MODEL=deepseek-v4-flash
```

2. Chạy Worker:

```bash
npm run dev:chat-v2
# http://localhost:8788/health
```

3. Chạy web (terminal khác):

```bash
npm run dev
# http://localhost:3001/dev/chat-v2
```

4. Probe capability model:

```bash
npm run probe:chat-v2
```

Probe kiểm tra từng model: text, streaming, ảnh, tools, JSON mode. Kết quả dùng để chốt model cho Sprint 2, không đoán capability từ docs.

### 5.1 Sprint 1 — plan nháp (2026-11-01)

**Mục tiêu:** biến bản Sprint 0 thành chat dùng được thật: chữ hiện dần, markdown, dừng, làm lại, và bot trả lời đúng vai trò nhờ system prompt 16+ đặt ở Worker.

**Hiện trạng trước Sprint 1:**

- UI gửi `stream:false`, phải chờ cả câu.
- Chưa có system prompt; model có thể tự nhận persona lạ.
- Chưa render markdown; dấu `**` hiện thô.
- Chưa có dừng/làm lại.
- Worker đã stream được nhưng client chưa đọc SSE.

**Phạm vi Sprint 1:**

- [x] Worker: thêm `prompts.js` với Safety core 16+ + age band `16-17`/`18+`; ghép system message trước khi gọi motapis.
- [x] Worker: từ chối `system` do client gửi; chỉ nhận `user`/`assistant`.
- [x] Worker: stream gửi kèm `stream_options.include_usage` để lấy token cuối.
- [x] Client: parser SSE + `streamChatV2`, cập nhật chữ theo từng delta.
- [x] UI: markdown cho câu trả lời; nút Dừng; nút Làm lại; dòng "Bạn đang trò chuyện với AI".
- [x] Test: parser SSE, prompt builder, Worker chặn system từ client và chèn system đúng.
- [x] Giữ nguyên phạm vi text-only; ảnh/file để Sprint 2.

**Kết quả test 2026-11-01:** `/dev/chat-v2` stream từng đoạn, markdown hiện đúng, Dừng hoạt động, Làm lại tạo câu mới, worker trả `promptVersion 16.1`/`ageBand 16-17`; 12 test chat-v2 xanh.

**Ngoài phạm vi:** phiên/lưu lịch sử, token budget theo model, ảnh/file, tool/RAG, đăng nhập thật, nút báo cáo.

**Điều kiện xong:**

- Hỏi một câu → thấy chữ hiện dần, không chờ cả câu.
- Bấm Dừng → dừng ngay, giữ phần đã trả lời.
- Bấm Làm lại → tạo câu trả lời mới thay câu cuối.
- Markdown đậm/list/code hiện đúng.
- Hỏi "Bạn là ai?" → trả lời là trợ lý học tập ZenStudy, không phải persona lạ.
- `npm test`, `tsc`, `lint` xanh.

### 5.2 Sprint 2 — plan nháp (2026-11-01)

**Mục tiêu:** làm chat v2 chịu được bài tập thật: gửi ảnh/file, biết giới hạn từng model, tự cắt lịch sử khi quá dài, và báo khi câu trả lời bị cắt.

**Hiện trạng:**

- Chỉ nhận chữ; chưa có ảnh/file.
- Chưa biết context/output/vision của từng model.
- Chưa đếm token; lịch sử dài có thể vượt context.
- Đã đọc `finish_reason` nhưng chưa dùng để cảnh báo đầy đủ.

**Phạm vi:**

- [x] Registry capability cho 13 model đã xác nhận: context, output, vision, prompt overhead.
- [x] `/models` trả kèm capability để UI hiển thị và chặn ảnh với model không đọc được.
- [x] Ước lượng token + budget: trừ output reserve, trim lịch sử cũ, báo lỗi rõ nếu câu hỏi/file vẫn quá dài.
- [x] Gửi ảnh: resize client, tối đa 3 ảnh, model phải có vision.
- [x] Gửi file text: tối đa 3 file, nội dung ≤20.000 ký tự/file, gắn vào câu hỏi hiện tại.
- [x] Trả metadata context (ước tính/max/trimmed) qua header/JSON; UI hiện nhẹ.
- [x] Giữ text-only nếu không có file/ảnh; không đổi Sprint 1.
- [x] Test: token budget, attachment validation, vision gate, file append, worker body.

**Kết quả test 2026-11-01:** gửi ảnh qua UI với `qwen3.8-max` → trả đúng “Trắng”; chọn `grok-4.5` + ảnh → UI chặn và Worker trả 400; file text được nối vào câu hỏi; lịch sử dài bị cắt 2 tin, request vẫn 200; 23 test chat-v2 xanh.

**Lưu ý vision:** chỉ `qwen3.8-max`, `glm-5.3-flash`, `minimax-m3` được đánh dấu đọc ảnh ổn định với prompt 16+ đầy đủ. `deepseek-v4-flash` đọc ảnh không ổn định khi có system prompt dài, nên để text-only; UI tự chuyển sang `qwen3.8-max` khi thêm ảnh.

**Ngoài phạm vi:** lưu phiên (S3), đọc PDF/Word/OCR, tool/RAG, đăng nhập, báo cáo.

**Điều kiện xong:**

- Gửi ảnh bài tập cho model có vision → model trả lời dựa trên ảnh.
- Chọn model không vision + ảnh → UI cảnh báo, Worker trả 400 rõ ràng.
- Chat dài → lịch sử cũ được lược bớt, không lỗi context; UI biết đã lược bớt.
- File text dài → bị chặn hoặc báo rõ, không gửi tràn.
- Câu trả lời bị cắt → hiện cảnh báo từ `finish_reason`.
- `npm test`, `tsc`, `lint` xanh.

### 5.3 Sprint 2.5 — UI Reset (2026-11-01) — xong

Mục tiêu: làm lại toàn bộ UI chat v2 trước Sprint 3, giữ nguyên Worker/API và toàn bộ hành vi hiện tại.

- Style guide: [CHAT_V2_STYLE_GUIDE.md](../guides/CHAT_V2_STYLE_GUIDE.md).
- Nguồn tham khảo: [UI_REFERENCE_REPOS.md](../guides/UI_REFERENCE_REPOS.md).
- Tách logic khỏi UI: `hooks/useChatV2.ts`.
- Component mới: `ChatSidebar`, `ChatTopbar`, `ModelPicker`, `ContextMeter`, `MessageList`, `MessageBubble`, `Composer`, `EmptyState`.
- Desktop có sidebar 276px; mobile không sidebar, topbar 2 hàng, composer dính đáy.
- Theme sáng/tối: toggle topbar, lưu `chat-v2-theme`, token trong `src/app/styles/chat-v2.css`.
- Giữ: stream, markdown, dừng, làm lại, ảnh/file, vision warning, context meter, sao chép.
- Không sửa `workers/chat-v2/**`, API, prompt 16+, token budget.
- Test desktop 1440×900 + mobile 390×844; không tràn ngang.
- Kết quả 2026-11-01: stream + markdown, ảnh/file, model picker, empty/populated states; `706` test toàn repo xanh; `tsc`/lint sạch.

### 5.4 Sprint 3 — Phiên & bộ nhớ (2026-11-01) — xong

Mục tiêu: nhiều phiên chat, lưu trên máy, hội thoại dài được nén thay vì mất phần đầu.

**Dữ liệu phiên (sync-ready)**

```ts
{
  schemaVersion: 1,
  activeSessionId: "s-...",
  sessions: [{
    id: "s-...",                 // client tạo, crypto.randomUUID
    title: "",                   // rỗng = tiêu đề tự động từ câu hỏi đầu
    modelId: "deepseek-v4-flash",
    createdAt: 0,
    updatedAt: 0,
    deletedAt?: 0,               // xoá mềm = tombstone
    messages: [{ id, role, text, attachments?, payload? }],
    summary?: { text, upToMessageId, messageCount, updatedAt }
  }]
}
```

- Key: `STORAGE_KEYS.chatV2Sessions` = `chat_v2_sessions_v1`.
- Module duy nhất đọc/ghi: `lib/sessions.ts`; component không đụng `localStorage`.
- Giới hạn local: 30 phiên sống, 200 tin/phiên; phiên vượt hạn bị đánh `deletedAt`.
- Tombstone giữ 30 ngày rồi dọn; xoá phiên không làm sống lại khi sync sau này.
- **Ảnh base64 không lưu** (chỉ giữ tên + thumbnail + file text). Làm lại câu trả lời cũ sẽ báo “ảnh cũ không còn trong bản lưu”.
- Chưa nối cloud sync: v2 vẫn là route dev; dữ liệu thử nghiệm không được đẩy vào snapshot D1 của user thật.

**Tóm tắt hội thoại dài**

- Endpoint Worker `POST /summarize` (dev token), prompt nén nằm ở server (`SUMMARY_PROMPT`), model mặc định `deepseek-v4-flash` (`CHAT_V2_SUMMARY_MODEL` để đổi).
- Client ước lượng token (2 ký tự/token); khi phần **chưa tóm tắt** ≥ 55% `maxInputTokens`, gọi nền sau khi trả lời xong.
- Chỉ nén phần cũ, **giữ nguyên 6 tin gần nhất**; cần tối thiểu 12 tin chưa nén. Mỗi lần nén tối đa 36.000 ký tự, đi từ cũ → mới để lần sau nén tiếp phần còn lại.
- Lần gửi sau chỉ gửi các tin sau `summary.upToMessageId` + trường `summary`; Worker chèn bản tóm tắt vào system prompt **sau** quy tắc 16+, có ghi rõ là dữ liệu tham khảo.
- UI: chấm amber khi đang tóm tắt, badge bookmark + số tin trong tooltip ContextMeter, callout “Đã tóm tắt N tin cũ — áp dụng từ lượt gửi tiếp theo” (vòng context chỉ giảm ở request kế tiếp).
- Trim cứng trong `tokens.js` vẫn là lưới an toàn cuối nếu tóm tắt lỗi hoặc bị bỏ qua.

**UI**

- Sidebar desktop: danh sách phiên thật, tiêu đề tự động/tự sửa, số tin + thời gian tương đối, badge đã tóm tắt.
- Menu từng phiên: đổi tên tại chỗ (Enter lưu, Esc huỷ), xoá có xác nhận 2 bước.
- Mobile: nút menu mở drawer phiên (288px, backdrop, Escape đóng); chọn phiên hoặc “phiên mới” tự đóng drawer.
- Desktop: nút ẩn/hiện sidebar ở topbar, lưu lựa chọn `chat-v2-sidebar-open`.
- Phiên trống đang mở được tái sử dụng khi bấm “Cuộc trò chuyện mới”, không tạo phiên rỗng trùng.
- Chuyển động: drawer trượt 220ms, popover/menu fade 160ms, callout rise 180ms; tất cả tự tắt khi `prefers-reduced-motion: reduce` (kèm pulse và smooth scroll).

**Demo đã kiểm 2026-11-01**

- Gửi/nhận stream; tạo phiên mới; chuyển phiên còn nguyên tin; F5 vẫn còn phiên.
- Đổi tên phiên, xoá phiên (tombstone), phiên đang mở tự chuyển sang phiên còn lại.
- Seed 12 tin dài → tóm tắt 8 tin, `upToMessageId` đúng, tin gần nhất vẫn nguyên văn.
- Desktop 1440×900 + mobile 390×844, dark/light: không tràn ngang.

## 6. Hợp đồng API v2

> Hợp đồng dưới đây là bản dev (client gửi lịch sử). Production track P1 sẽ chuyển sang **server-owned history**: client chỉ gửi `sessionId` + tin mới + `clientMessageId`; xem [CHATBOT_V2_PRODUCTION_PLAN.md](CHATBOT_V2_PRODUCTION_PLAN.md).

### `GET /models`

Trả danh sách model chat đã lọc bỏ image/video/embedding, kèm `contextTokens`, `maxOutputTokens`, `vision`. Cần dev token.

### `POST /chat`

Request text:

```json
{
  "model": "deepseek-v4-flash",
  "messages": [{ "role": "user", "content": "Xin chào" }],
  "stream": false
}
```

Request kèm ảnh/file (Sprint 2):

```json
{
  "model": "qwen3.8-max",
  "messages": [{ "role": "user", "content": "Giải bài trong ảnh" }],
  "images": [{ "name": "de.png", "data": "data:image/jpeg;base64,..." }],
  "files": [{ "name": "bai.txt", "text": "..." }],
  "stream": true
}
```

Giới hạn: tối đa 3 ảnh, 3 file; mỗi file text ≤20.000 ký tự; ảnh png/jpeg/webp dataURL. Model không có `vision` sẽ bị chặn 400. File text được nối vào câu hỏi hiện tại với nhãn "tài liệu tham khảo".

Sprint 3 thêm trường tuỳ chọn `summary` cho hội thoại đã nén:

```json
{
  "model": "deepseek-v4-flash",
  "messages": [{ "role": "user", "content": "Học tiếp phần 2" }],
  "summary": "Người học đã nắm đạo hàm cơ bản...",
  "stream": true
}
```

`summary` ≤6.000 ký tự; Worker chèn vào system prompt sau quy tắc 16+ và ghi rõ đây là dữ liệu tham khảo, không phải chỉ dẫn. Client không gửi tin `system`.

Response non-stream:

```json
{
  "text": "Xin chào!",
  "model": "deepseek-v4-flash",
  "finishReason": "stop",
  "usage": { "promptTokens": 12, "completionTokens": 8, "totalTokens": 20 },
  "latencyMs": 840,
  "id": "chatcmpl-mot-...",
  "context": {
    "estimatedInputTokens": 880,
    "maxInputTokens": 23552,
    "trimmedMessages": 0,
    "contextTokens": 32768,
    "maxOutputTokens": 8192
  }
}
```

Worker tự trim lịch sử cũ khi vượt `maxInputTokens`; nếu riêng câu hỏi/file cuối đã quá dài thì trả 400 mô tả giới hạn.

> Ví dụ JSON trên là mẫu của giai đoạn S2 (context 32k). Từ 2026-11-03 bảng capability dùng context thật của từng model (1M/200K/…) đã đối chiếu tài liệu hãng; 32k chỉ còn là mức mặc định an toàn cho model lạ.

Worker luôn tự chèn system prompt 16+ trước messages; nếu client gửi role `system`, Worker trả 400. Non-stream vẫn dùng được cho curl/probe.

Streaming (Sprint 1):

```json
{
  "model": "deepseek-v4-flash",
  "messages": [{ "role": "user", "content": "Xin chào" }],
  "stream": true
}
```

Worker thêm `stream_options: { include_usage: true }` khi gọi motapis và trả SSE:

```text
data: {"model":"deepseek-v4-flash","choices":[{"delta":{"content":"Xin "}}]}

data: {"choices":[{"delta":{"content":"chào"},"finish_reason":"stop"}],"usage":{"prompt_tokens":...,"completion_tokens":...}}

data: [DONE]
```

Client parse `delta.content`, cập nhật UI từng đoạn; usage lấy ở event cuối. Nút Dừng huỷ `AbortController`, Worker huỷ request upstream. Stream trả thêm header `X-Chat-V2-Estimated-Input`, `X-Chat-V2-Max-Input`, `X-Chat-V2-Trimmed`, `X-Chat-V2-Context`, `X-Chat-V2-Max-Output` để UI hiện context/trim.

### `POST /summarize`

Nén phần hội thoại cũ thành bộ nhớ ngắn. Cần dev token; prompt và model nằm ở server.

```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "summary": "Bản tóm tắt cũ (tuỳ chọn)"
}
```

Giới hạn: tối đa 80 tin, mỗi tin ≤20.000 ký tự, tổng ≤40.000 ký tự, summary cũ ≤6.000 ký tự; chỉ nhận `user`/`assistant`. Response:

```json
{
  "summary": "- Đang ôn đạo hàm...\n- Còn kẹt quy tắc chuỗi",
  "model": "deepseek-v4-flash",
  "usage": { "promptTokens": 300, "completionTokens": 80, "totalTokens": 380 },
  "latencyMs": 2400
}
```

Model tóm tắt lấy từ `CHAT_V2_SUMMARY_MODEL`, mặc định `deepseek-v4-flash`. Lỗi upstream trả 502/429 giống `/chat`; client bỏ qua lỗi tóm tắt nền và vẫn chat bình thường.

## 7. Bảo mật ở bản dev

- `MOTAPIS_API_KEY`/`MOTAPIS_API_KEY_FREE` chỉ nằm ở Worker (gitignored `.dev.vars`); không đưa vào `NEXT_PUBLIC_*`.
- Dev token chỉ là hàng rào local; `ALLOWED_ORIGINS` mặc định `http://localhost:3001`.
- Log không chứa prompt, key hay nội dung; chỉ model/status/token/latency.
- Bản dev **không** dùng được cho người dùng thật. Auth, quota, moderation, retention, log production và deploy nằm ở [CHATBOT_V2_PRODUCTION_PLAN.md §8](CHATBOT_V2_PRODUCTION_PLAN.md).

## 8. Kết quả probe model

> Ảnh chụp 2026-11-01/02; khả dụng model thay đổi liên tục. Production track sẽ để catalog ở server (P0/P3), không hardcode trong client.

`GET /v1/models` với key cũ trả 19 model chat, 13 model có channel:

```text
deepseek-v4-flash, DeepSeek-V4-Flash-0731, qwen3.8-max,
glm-5.3-flash, minimax-m3, gpt-5.6-sol, gpt-6-luna,
grok-4.5, hy4-preview, kimi-k3.1-pro,
claude-sonnet-4-6, claude-sonnet-5, claude-sonnet-5-5
```

Các model còn lại trả `503 No available channel for model ... under group free`.

### Key mới (2026-11-01)

- `/v1/models` trả **61 model chat**; quét `ping` thấy **45 model trả 200**.
- UI hiện lọc **19 model curated** trong `CHAT_V2_VERIFIED_MODELS` (bản 2026-11-02); các model live còn lại chưa đưa lên UI để tránh danh sách quá dài và tránh model có prompt overhead lớn.
- Đã thêm vào UI: `gemini-3.8-flash`, `gemini-4-argon`, `gpt-5.6`, `gpt-6-astra`, `claude-opus-4-8`, `deepseek-v4-pro`, `qwen3.7-max`.
- Model mới đáng chú ý khác: `gpt-5.6-luna`, `gpt-5.6-sol`, `deepseek-v4.1-flash-1017`, `kimi-k3`, `mimo-v2.5-pro`.
- Một số model có prompt ẩn rất lớn (cần baseline nếu thêm vào UI): `claude-haiku-5-5` ~11.2k token, `codex-auto-review` ~5.7k, nhóm `gpt-5.x` ~4.4k, `gpt-6-astra` ~4.4k.
- Muốn mở rộng UI thêm: cập nhật `CHAT_V2_VERIFIED_MODELS` + capability/baseline tương ứng, rồi chạy lại test.

### Model mạnh thêm vào UI (kiểm 2026-11-01)

| Model | Vision | Baseline prompt | Ghi chú |
|---|---|---|---|
| `gemini-3.8-flash` | Có | 255 | Nhanh, đọc ảnh tốt |
| `gemini-4-argon` | Có | 10 | Flagship Google |
| `gpt-5.6` | Có | 18 | OpenAI standard |
| `gpt-6-astra` | Không xác nhận | 4387 | Text; ảnh timeout khi test |
| `claude-opus-4-8` | Có | 372 | Flagship Anthropic |
| `deepseek-v4-pro` | Không | 84 | Text mạnh, không thấy ảnh |
| `qwen3.7-max` | Có | 7 | Đọc ảnh tốt |

Capability của các model đã probe (text, stream, ảnh, tools, JSON mode):

| Model | Text | Stream | Ảnh | Tools | JSON | Ghi chú |
|---|---|---|---|---|---|---|
| `deepseek-v4-flash` | OK | OK | Không ổn định | OK | OK | Rẻ nhất, text ~3–7s; ảnh chỉ đọc với prompt ngắn, prompt 16+ không thấy ảnh → để text-only |
| `DeepSeek-V4-Flash-0731` | OK | OK | Chưa xác nhận | OK | OK | Ảnh chậm ~39s; chưa dùng cho ảnh |
| `qwen3.8-max` | OK | OK | OK | OK | OK | Nhanh nhất: text ~3s, stream ~1.7s; model ảnh mặc định |
| `glm-5.3-flash` | OK | OK | OK | OK | OK | Text chậm ~29s; đọc ảnh tốt |
| `minimax-m3` | OK | OK | OK | OK | OK | Key cũ OK; **key mới trả 503**, đã bỏ khỏi UI |
| `grok-4.5` | OK | OK | 503 | timeout | OK | Không dùng cho ảnh/tool |

Lưu ý:

- Phải **luôn gửi system prompt**. Không gửi system, `deepseek-v4-flash` tự nhận là trợ lý CNB và `prompt_tokens` tăng bất thường (~1053); có system prompt thì về 52 token và trả lời đúng vai.
- Upstream trả `model: "self-dploy/DeepSeek-V4-Flash"`; Worker giữ `model` mình yêu cầu và thêm `upstreamModel`.
- UI chỉ hiện 13 model đã xác nhận (`CHAT_V2_VERIFIED_MODELS`); danh sách này cần cập nhật khi tài khoản/gateway đổi.
- Chỉ các model có vision đã kiểm với prompt 16+ mới được đánh dấu đọc ảnh: `qwen3.8-max`, `gemini-3.8-flash`, `gemini-4-argon`, `gpt-5.6`, `claude-opus-4-8`, `claude-sonnet-5-5`, `qwen3.7-max`, `glm-5.3-flash`. UI tự chuyển sang model vision khi thêm ảnh; `minimax-m3`/`hy4-preview` bị 503 với key mới nên đã bỏ khỏi UI.
- Key từng bị dán vào chat: nên rotate key sau khi test xong.

## 9. Tích hợp sau này

- S7 gắn `<ChatV2 />` vào app sau flag dev, giữ chat cũ làm fallback; lúc này vẫn **chưa** mở cho người dùng thật.
- Ra mắt thật (flag production, rollout %, Play/Capacitor) thuộc [production track P4](CHATBOT_V2_PRODUCTION_PLAN.md).
- Phiên production dùng bảng D1 riêng (P1). **Không** nhét lịch sử vào snapshot 2 MB của `data-api`; snapshot chỉ giữ cài đặt/ghi chú.
- Ảnh production lên R2; xoá tài khoản/DSAR mở rộng `DELETE /account` + endpoint export.
- Hình dạng dữ liệu S3 đã có `schemaVersion`, `id`, `updatedAt`, `deletedAt` nên bước chuyển sang server chỉ cần adapter, không phải migrate UI.
- Không có migration dữ liệu chat cũ: hai bản chạy song song trong giai đoạn thử.
