# P2 — Quản lý được (kế hoạch triển khai)

Trạng thái: P2.0 đã deploy 2026-10-26, đang theo dõi 24 giờ; P2a có thêm chỉnh hạn mức câu/ngày, chưa bắt đầu. Bản 4 — 2026-10-27.
Thuộc P2 của `docs/features/ADMIN_CONSOLE_PLAN.md`; P1 đã đóng, xem `docs/archive/ADMIN_P1_PLAN.md`.

Mục tiêu: bảng điều khiển từ chỗ **chỉ xem** chuyển sang **sửa được** — chặn sự cố không cần deploy, đổi cấu hình chat, đẩy nội dung có phiên bản và quay lại, dọn kho — nhưng mọi hành động ghi đều đi qua Access, có audit ghi trước, và không đưa token xuống trình duyệt.

## Nguyên tắc chung

1. Ghi chỉ qua `admin-worker/_worker.ts` tại `/api/admin/*`, sau `verifyAccessJwt`. Browser không gọi thẳng chat-proxy/livekit bằng token.
2. Audit trước khi ghi: chèn `admin_audit` xong mới `put`/`DELETE`. Audit lỗi thì trả 500 và không thay đổi gì. Nếu bước ghi sau audit lỗi, dòng audit vẫn ở lại và được hiểu là "đã thử đổi nhưng chưa áp dụng" — endpoint trả lỗi rõ ràng.
3. Kho cấu hình là KV `CHAT_QUOTA` (`a16e430f9bbe46afa51ffc9d4f9bce9d`): chat-proxy đã bind sẵn, key mới đặt cạnh các `cfg:*` cũ. Chưa tạo namespace thứ hai.
4. Không thêm dependency, không dashboard framework. UI mới viết trong `admin-host/` (HTML/CSS/JS thuần).
5. Làm từng phần, deploy và kiểm tra xong mới sang phần sau. Thứ tự: P2.0 → P2a → P2b → P2c → P2d.
6. Mặc định an toàn: thiếu cờ, KV lỗi hoặc JSON hỏng → coi như đang bật bình thường, không tự khóa chat/rooms.

## Hiện trạng 2026-10-26

- `/api/admin/overview` chỉ đọc; `wrangler.admin.jsonc` có `DB`, `R2`, `ASSETS`, **chưa có KV**.
- chat-proxy: KV `CHAT_QUOTA` (đang dùng `cfg:cfModel`, `cfg:providers`, `cfg:chain`, `cfg:prompt`, `cfg:gen`), D1 `DB`, chưa có endpoint công khai đọc cấu hình. Hạn mức câu/người/ngày đọc từ env `USER_DAILY_LIMIT`, mặc định 30 ([`worker.js:944`](../../workers/chat-proxy/worker.js)).
- Admin worker hiển thị hạn mức bằng `auth.userDailyLimit` từ `/status`, dự phòng 30 nếu chat-proxy không trả lời ([`_worker.ts:580`](../../admin-worker/_worker.ts)).
- livekit-rooms: chỉ env + `DB`, **không có KV**; `/usage` gọi Twirp `ListRooms` không timeout.
- Bảng `admin_audit` + index đã có trong D1 `zenspace`; helper `logAudit` đã bị xóa ở P1b.
- Web là static export: banner và trạng thái tắt phải lấy từ endpoint công khai lúc chạy, không nhúng vào bản build.
- R2 `study-space`: 121 object / 487.851.634 byte, chưa có manifest cảnh/âm thanh.
- Nợ P1: log lỗi trùng dòng (throttle nằm trong RAM từng isolate) và LiveKit `/usage` chậm.

## Kiến trúc

```
Trình duyệt admin (Access)
  └─ admin-host/  ── POST /api/admin/flags ──▶ worker admin
                                                ├─ audit → D1 admin_audit
                                                └─ put cfg:flags → KV CHAT_QUOTA

chat-proxy     ── đọc cfg:flags (cache 30s) ──▶ chặn /chat, áp hạn mức câu/ngày
livekit-rooms  ── đọc cfg:flags (cache 30s) ──▶ chặn /token, /rooms khi roomsEnabled = false
web (tĩnh)     ── GET chat-proxy /config (công khai, poll 60s) ──▶ banner + ẩn nút
```

---

## P2.0 — Dọn nợ P1 (2 việc nhỏ, làm trước)

### 0.1 Đặt timeout cho Twirp trong `/usage`

- [x] `workers/livekit-rooms/worker.js:761`: thêm `signal: AbortSignal.timeout(4000)` cho `fetch(ListRooms)`. Nhánh `catch` sẵn có đã trả `roomsOpen: 0, participants: 0`.
- [x] Dán lại code worker `livekit-rooms` trên dashboard (2026-10-26).
- [ ] Xong khi: `/usage` trả trong **dưới 5 giây** kể cả khi LiveKit chậm; `admin_error_log` không còn sinh thêm dòng `livekit:unreachable` trong 24 giờ.

### 0.2 Chặn log lỗi trùng

Chọn một hướng, mặc định là (a):

- [x] (a) Trong `logAdminError` (`admin-worker/_worker.ts:272`): trước khi insert, đọc dòng gần nhất cùng `source`+`code`; nếu trong 1 giờ thì bỏ qua. Giữ Map trong RAM làm lớp giảm tải trước.
- [ ] (b) Hoặc gộp trùng ở `readErrors` (hiển thị 1 dòng + số lần).
- [ ] (c) Hoặc giữ nguyên và chỉ ghi chú trong docs.
- [x] Unit test: hai lần gọi liên tiếp chỉ chèn 1 dòng; quá 1 giờ thì chèn tiếp (`src/__tests__/unit/admin/error-log.test.ts`, 6 ca).
- [x] Deploy admin worker: version `1a427f38`, 2026-10-26 16:54 UTC.
- [ ] Xong khi: bảng lỗi không còn nhiều dòng giống nhau trong cùng một giờ (theo dõi 24 giờ sau deploy).

---

## P2a — Cờ hệ thống (làm chi tiết, thực thi ngay sau P2.0)

Mục tiêu: tắt chat hoặc phòng học nhóm, bật chế độ bảo trì, đổi banner, chỉnh hạn mức câu/người/ngày — tất cả trong vài giây, không deploy, và mọi lần đổi đều có dấu vết.

### Đã chốt cho P2a

- Năm trường, mỗi trường một nghĩa:

| Trường | Kiểu | Tác dụng |
| --- | --- | --- |
| `chatEnabled` | boolean | `false` → `/chat` trả 503, web ẩn nút chat |
| `roomsEnabled` | boolean | `false` → `/token`, `/rooms` trả 503, web ẩn nút phòng |
| `maintenance` | boolean | Chỉ hiện banner bảo trì; **không** chặn gì |
| `banner` | chuỗi ≤ 140 ký tự | Thông báo chung; rỗng = không hiện |
| `chatDailyLimit` | số nguyên 1–200 | Hạn mức câu/người/ngày; mặc định 30 |

- Một key duy nhất `cfg:flags`, lưu cả object JSON (ghi đè toàn bộ, không patch từng phần) để tránh trạng thái nửa cũ nửa mới.
- Có thêm `updatedAt` (ms) và `updatedBy` (email Access) trong object để hiển thị.
- `maintenance` không chặn server: bảo trì thường vẫn muốn người dùng đọc ghi chú local.
- Hạn mức hiệu lực, theo thứ tự: `cfg:flags.chatDailyLimit` hợp lệ → env `USER_DAILY_LIMIT` hợp lệ → 30. Env chỉ còn là mặc định dự phòng để bản deploy cũ vẫn chạy đúng nếu KV trống.
- Hạ hạn mức xuống dưới số câu một người đã dùng hôm nay sẽ chặn người đó tới hết ngày (mốc ngày Thái Bình Dương); nâng hạn mức làm tăng chi phí gọi AI.

### A1. Admin worker — kiểu dữ liệu và đọc cờ

- [x] `wrangler.admin.jsonc`: thêm

```jsonc
"kv_namespaces": [
  { "binding": "FLAGS", "id": "a16e430f9bbe46afa51ffc9d4f9bce9d" }
],
```

- [x] `admin-worker/_worker.ts`: thêm `FLAGS?: { get(key: string): Promise<string | null> }` vào `AdminEnv`; hằng `FLAGS_KEY = "cfg:flags"`, `FLAG_BANNER_MAX = 140`, `FLAG_LIMIT_MIN = 1`, `FLAG_LIMIT_MAX = 200`, `DEFAULT_FLAGS`.
- [x] `readFlags(env)`: trả `{ ok: true, ...merge(DEFAULT_FLAGS, parsed) }`; thiếu binding → `missing_binding`; JSON hỏng/sai kiểu → `invalid_json` và dùng mặc định.
- [x] `buildOverview`: thêm khối `flags` vào `Promise.all`, vào response; `flags.ok !== true` thì `degraded = true` và ghi `logAdminError(env, "flags", code)`; thêm nhãn `flags: "Cờ hệ thống"` vào `ERROR_SOURCE_LABELS` và `SOURCE_LABELS`/`ERROR_LABELS` trong `admin.js`.
- [x] Hợp đồng trong `overview`:

```json
"flags": {
  "ok": true,
  "chatEnabled": true,
  "roomsEnabled": true,
  "maintenance": false,
  "banner": "",
  "chatDailyLimit": 30,
  "updatedAt": 1761500000000,
  "updatedBy": "admin@example.com"
}
```

### A2. Admin worker — ghi cờ

- [x] Route `POST /api/admin/flags` (chỉ POST; GET trả 405 — trạng thái đọc qua `overview`).
- [x] Body: đủ 5 trường `chatEnabled`, `roomsEnabled`, `maintenance`, `banner`, `chatDailyLimit`. Sai kiểu, thiếu trường, banner > 140 ký tự hoặc có ký tự điều khiển, `chatDailyLimit` không phải số nguyên trong 1–200 → 400 `{ error: "invalid_body" }`.
- [x] Trình tự bắt buộc: đọc cờ hiện tại → validate → **insert `admin_audit`** (`action: "flags.update"`, `target: "cfg:flags"`, `detail_json: { before, after }`, `actor_email` từ JWT`) → `FLAGS.put("cfg:flags", JSON.stringify(next))`.
- [x] Lỗi: audit lỗi → 500 `{ error: "audit_failed" }`, **không** ghi KV; KV lỗi → 500 `{ error: "kv_error" }`.
- [x] Thành công → `{ ok: true, flags: { ...next } }`.
- [x] Giới hạn: 10 lần ghi/phút cho mỗi actor (Map trong isolate) để tránh bấm nhầm liên tục.

### A3. Admin shell — panel "Cờ hệ thống"

- [x] `admin-host/index.html`: thêm `panel-card` "Cờ hệ thống" phía trên khối Lỗi, gồm 3 công tắc (Chat, Phòng học nhóm, Bảo trì), ô nhập banner kèm đếm ký tự `x/140`, ô số "Câu hỏi mỗi người mỗi ngày" (1–200, gợi ý mặc định 30), dòng "Cập nhật lúc … bởi …", nút **Lưu thay đổi** chỉ bật khi có thay đổi.
- [x] `admin-host/admin.js`: đổ trạng thái từ `data.flags` trong `overview`; nút Lưu gọi `POST /api/admin/flags`, hiện `confirm()` với câu rõ hậu quả ("Tắt chat sẽ chặn tất cả người dùng ngay. Tiếp tục?"; hạ hạn mức thấp hơn số câu đã dùng hôm nay sẽ chặn người đó tới hết ngày), thành công thì cập nhật lại panel, thất bại thì hiện mã lỗi đã dịch.
- [x] Cờ đọc lỗi (`flags.ok: false`) → panel đỏ, các công tắc bị khóa, ghi chú "Không đọc được cờ hệ thống".
- [x] `admin-host/admin.css`: dùng lại `panel-*`, `status-pill`, `usage-note`; chỉ thêm style cho công tắc, ô banner và ô số. Không đổi bố cục hiện có.

### A4. chat-proxy — đọc cờ, chặn `/chat`, mở `/config`

- [x] `getFlags(env)`: đọc `cfg:flags` từ KV, cache **30 giây** trong RAM isolate (`mem.flags`), thiếu/hỏng → mặc định bật.
- [x] `getDailyLimit(env)`: hạn mức hiệu lực theo thứ tự `cfg:flags.chatDailyLimit` hợp lệ → env `USER_DAILY_LIMIT` hợp lệ → 30. Dùng chung hàm này ở chỗ đếm câu và ở `/status`.
- [x] `POST /chat`: nếu `chatEnabled === false` → `503 { error: "Trợ lý chat đang tạm tắt. Bạn vẫn học và ghi chú bình thường.", code: "CHAT_DISABLED" }`; không gọi AI, không ghi `chat_usage`, không ghi log lỗi.
- [x] Chỗ kiểm tra `uCount >= userLimit` và payload `429` dùng `getDailyLimit` thay cho env trực tiếp.
- [x] `GET /config` công khai (dùng `corsHeaders` sẵn có), trả đúng 4 trường công khai + `updatedAt`; header `Cache-Control: public, max-age=30`. Không trả `updatedBy` và `chatDailyLimit`.
- [x] `/health` giữ nguyên; `/status` giữ shape, `auth.userDailyLimit` trả hạn mức hiệu lực.
- [x] Unit test: `src/__tests__/unit/admin/chat-proxy-flags.test.ts` (10 ca).

### A5. livekit-rooms — đọc cờ, chặn phát vé

- [x] Dashboard: thêm KV binding cho worker `livekit-rooms`, chọn namespace `CHAT_QUOTA`, tên binding `CHAT_QUOTA` (cùng kho với chat-proxy).
- [x] `getFlags(env)` giống chat-proxy, cache 30 giây; thiếu binding → mặc định bật.
- [x] `POST /token` và `GET /rooms`: `roomsEnabled === false` → `503 { error: "Phòng học nhóm đang tạm tắt. Vui lòng quay lại sau.", code: "ROOMS_DISABLED" }`.
- [x] `/webhook/livekit` **không** bị chặn: phút học vẫn được ghi để không mất số liệu.
- [x] Cập nhật khối comment đầu file (danh sách biến/binding cần khai trên dashboard).
- [x] Unit test: `src/__tests__/unit/study/meet-flags.test.ts` (6 ca).

### A6. Web — banner và ẩn nút

- [x] `src/lib/system-flags.ts`: `fetchSystemFlags()` gọi `${CHAT_URL}/config`, timeout 3 giây, cache module 60 giây; lỗi → `{ chatEnabled: true, roomsEnabled: true, maintenance: false, banner: "" }`.
- [x] Gắn vào `useStudySpaceState` (đúng quy ước state trung tâm), poll 60 giây, dừng khi tab ẩn.
- [x] Banner: hiện khi `maintenance` hoặc `banner` khác rỗng; nội dung chỉ render dạng text; cả desktop và mobile.
- [x] Ba nhóm điểm vào: chat desktop (`StudyChatWidget.tsx`, `ChatFab` + sự kiện `study-space:send-to-chat`; trạng thái mở chat nằm trong widget, không nằm ở state trung tâm), phòng học nhóm (nút mở trong `StudyDesktopLayout`/`page.tsx` + `setIsRoomsOpen`/`mobileOpenRoot("rooms")`), mobile (`MobileMoreSheet.tsx:87-88`, `MobileRadialBubbleMenu.tsx:167`). Cờ `false` → nút hiện "Tạm tắt", không phát vé, không gọi API. Không tháo component, không đổi bố cục.
- [x] Không đưa `ADMIN_TOKEN` hay bất kỳ khóa nào xuống web.

### A7. Test

- [x] admin worker: merge mặc định; `missing_binding`; JSON hỏng; validate body (thiếu trường, sai kiểu, banner 141 ký tự, `chatDailyLimit` 0 / 201 / 30.5); audit chạy **trước** `put`; audit lỗi thì không `put`; POST thiếu JWT → 401; GET `/api/admin/flags` → 405.
- [x] chat-proxy: `chatEnabled:false` → 503 và không gọi AI; `/config` đúng CORS + `Cache-Control`; KV lỗi → vẫn cho chat; `getDailyLimit` ưu tiên KV, kế đến env, cuối cùng 30; `/status` trả hạn mức hiệu lực; chạm hạn mức mới → 429.
- [x] livekit: `roomsEnabled:false` → 503 trước khi mint token; webhook vẫn 200.
- [x] web: `fetchSystemFlags` lỗi mạng → mặc định bật; banner render text; nút bị disable.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch.

### A8. Deploy và kiểm tra

Thứ tự bắt buộc (mỗi bước mặc định vẫn bật nên không khóa ai):

1. [x] Dán `chat-proxy` (đã có KV) → gọi `/config` thấy 4 trường.
2. [x] Dán `livekit-rooms` + thêm binding KV trên dashboard → `/usage` vẫn 200.
3. [x] `npm run build:admin` → `npx wrangler deploy --config wrangler.admin.jsonc` → `overview.flags.ok = true`.
4. [ ] Push web (Pages tự build).

Kiểm tra chấp nhận:

- [ ] Tắt chat trong admin → app chat trả 503, nút chat bị disable trong ≤ 60 giây; bật lại → chat chạy.
- [ ] Đổi hạn mức 30 → 35: người đã dùng 30 câu hỏi được câu tiếp theo; hạ về thấp hơn số đã dùng → 429 tới hết ngày; thẻ chat trên admin hiện đúng hạn mức mới trong ≤ 30 giây.
- [ ] Tắt phòng học nhóm → `/token` trả 503; phòng đang mở không bị đá ra.
- [ ] Bật bảo trì + banner "Thử bảo trì" → web hiện banner trong ≤ 60 giây; chat/rooms vẫn chạy.
- [ ] Mỗi lần lưu có **đúng 1** dòng `admin_audit` với `actor_email` của bạn và `detail_json` có trước/sau.
- [ ] Network của trang admin: chỉ gọi `/api/admin/*`, không có token, không có `?token=`.

### DoD P2a

- [ ] Năm trường cờ đọc/ghi được từ shell, có audit, có mặc định an toàn.
- [ ] Hạn mức câu/ngày chỉnh được không cần deploy; chat-proxy áp dụng và `/status` báo đúng hạn mức hiệu lực.
- [ ] chat-proxy và livekit-rooms tôn trọng cờ trong ≤ 30 giây.
- [ ] Web hiện banner và ẩn nút trong ≤ 60 giây, không cần build lại.
- [ ] Không có đường ghi nào khác ngoài `POST /api/admin/flags`.

---

## P2b — Chat admin (khung, chi tiết khi bắt tay)

Mục tiêu: đổi model mặc định, thứ tự chuỗi dự phòng, prompt và hãng ngoài từ shell mới — thay trang `/admin/chat` local.

Các bước nhỏ dự kiến:

- [ ] B1. Chốt phạm vi: model mặc định, chain, prompt, danh sách hãng (thêm/sửa/xóa/tắt), thử nhanh một model. Không đụng lịch sử chat.
- [ ] B2. Endpoint proxy trong worker admin: `GET /api/admin/chat/config` (không trả API key, chỉ trạng thái "đã có key") và `POST /api/admin/chat/config` cho từng nhóm thay đổi. Browser không gọi thẳng chat-proxy bằng token.
- [ ] B3. Validate + audit mỗi lần đổi (cùng khuôn A2), không ghi log nội dung prompt vào audit — chỉ ghi hành động và khác biệt khóa.
- [ ] B4. UI: các khối Model / Chain / Prompt / Hãng; key nhập một chiều (không hiện lại), có nút xóa.
- [ ] B5. Kiểm tra: đổi model → câu trả lời dùng model mới; đổi chain → thứ tự thử đúng; key sai → lỗi hiện ở khối Lỗi.
- [ ] Quyết định cần chốt khi bắt tay: có giữ trang `/admin/chat` local song song không (mặc định: giữ đến khi P2b xong kiểm tra, rồi xóa).

## P2c — Nội dung runtime (khung)

Mục tiêu: cảnh/âm thanh/track có manifest trong D1, media trên R2, publish và rollback theo phiên bản; studio dev chỉ để thử.

- [ ] C1. Định nghĩa manifest (cùng shape với `src/data/assets/*.json`) + bảng `content_manifest(version, kind, json, created_at, created_by)`.
- [ ] C2. Seed v1 từ file hiện tại; web đọc manifest qua data-api, lỗi thì rơi về file bundled.
- [ ] C3. UI: xem phiên bản, publish bản mới, rollback về bản trước (audit từng lần).
- [ ] C4. Media: URL đi qua `src/lib/asset-resolver.ts`; kiểm tra file tồn tại trên R2 trước khi publish.
- [ ] Quyết định cần chốt khi bắt tay: cache manifest ở client bao lâu; rollback giữ bao nhiêu bản (mặc định 10).

## P2d — Kho R2 (khung)

Mục tiêu: biết file nào mồ côi/thiếu so với manifest và xóa được, có xác nhận.

- [ ] D1. So manifest với `R2.list()` → danh sách thiếu/mồ côi (dùng lại phân trang 30 trang + cache 60 giây của P1c).
- [ ] D2. UI: đếm theo loại, danh sách rút gọn, không hiện key đầy đủ của ảnh người dùng.
- [ ] D3. Xóa: chỉ file mồ côi, gõ đúng tên file để xác nhận, audit trước khi xóa.
- [ ] Quyết định cần chốt khi bắt tay: có cho xóa hàng loạt không (mặc định: không, từng file).

---

## Definition of Done toàn P2

- [ ] Mọi hành động ghi đều có dòng `admin_audit` tương ứng, actor là email Access.
- [ ] Không có token, key hay đường dẫn nội bộ trong response trả về trình duyệt.
- [ ] Mọi thay đổi cấu hình có hiệu lực **không cần deploy** worker.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch sau mỗi phần.
- [ ] Mỗi phần có mục kiểm tra trên production trước khi đóng.

## Rollback

- Cờ: mở shell, bật lại 3 công tắc, đặt hạn mức về 30 và xóa banner. Nếu shell hỏng:

```
npx wrangler kv key put --namespace-id=a16e430f9bbe46afa51ffc9d4f9bce9d --remote \
  "cfg:flags" '{"chatEnabled":true,"roomsEnabled":true,"maintenance":false,"banner":"","chatDailyLimit":30,"updatedAt":0,"updatedBy":""}'
```

- chat-proxy / livekit-rooms: dán lại bản code trước đó trên dashboard (giữ một bản trong `docs/archive` hoặc commit trước khi deploy).
- Admin worker: `npx wrangler deploy` bản trước; gỡ `kv_namespaces` khỏi `wrangler.admin.jsonc` nếu muốn bỏ hẳn.
- Audit: không xóa dòng khi rollback — đó là dấu vết.

## Rủi ro

- **Tắt nhầm chat/rooms**: cờ áp dụng toàn hệ thống trong ≤ 30 giây. Giảm thiểu: `confirm()` nêu rõ hậu quả, audit ghi trước/sau, và KV rollback bằng một câu lệnh.
- **Hạ hạn mức quá tay**: người đã dùng nhiều hơn mức mới bị chặn tới hết ngày (mốc Thái Bình Dương); nâng hạn mức làm tăng chi phí AI. Giảm thiểu: giới hạn 1–200, `confirm()` nêu hậu quả, audit ghi trước/sau.
- **KV là single point**: mất KV thì mọi cờ về mặc định "bật" — chấp nhận được vì đó là trạng thái an toàn; ghi lỗi vào `admin_error_log`.
- **livekit-rooms phải thêm binding trên dashboard**: quên bước này thì cờ "tắt phòng" không có tác dụng mà không báo lỗi. Kiểm tra bằng cách tắt thử một lần.
- **Web là bản tĩnh**: banner phụ thuộc endpoint public; nếu chat-proxy chết, banner không hiện — không ảnh hưởng chức năng học.
- **Key nhà cung cấp đi qua worker admin**: tuyệt đối không trả lại key trong response; chỉ trả `hasKey: true/false`.
- **Audit phình**: mỗi lần lưu 1 dòng; dọn theo cửa sổ 90 ngày ở P3, chưa cần bây giờ.
- **P2b–P2d đụng dữ liệu thật**: mọi bước publish/rollback/xóa phải thử trên bản local + một object thử trước.

## Không làm ở P2

- Tự viết login/2FA; publish admin vào web chính; thêm framework dashboard.
- Sửa cấu hình hạ tầng Cloudflare (DNS, Access, quota tài khoản).
- Duyệt dữ liệu từng người dùng; hiển thị uid đầy đủ.
- Ghi/xóa khi chưa có audit.

## Lịch sử bản

- **Bản 1** (2026-10-26): tách P2 khỏi plan tổng; chia P2.0 (nợ P1) → P2a (cờ, chi tiết từng bước) → P2b/P2c/P2d (khung); chốt KV dùng chung `CHAT_QUOTA`, key `cfg:flags`, audit trước ghi, mặc định bật khi thiếu cờ, `maintenance` chỉ hiện banner.
- **Bản 2** (2026-10-26): P2.0 xong phần code — timeout 4 giây cho Twirp `/usage`, `logAdminError` đọc D1 trước khi chèn, test `error-log.test.ts`; còn chờ dán `livekit-rooms` và deploy admin worker.
- **Bản 3** (2026-10-26): dán `livekit-rooms` và deploy admin worker version `1a427f38` (16:54 UTC); admin 3/3 xanh, chưa có dòng lỗi mới; còn chờ 24 giờ để chốt "Xong khi".
- **Bản 4** (2026-10-27): gộp chỉnh hạn mức câu/người/ngày vào P2a — thêm trường `chatDailyLimit` (1–200, mặc định 30) vào `cfg:flags`, chat-proxy đọc KV với env chỉ còn là dự phòng, `/status` báo hạn mức hiệu lực; plan P2a thành 5 trường.
