# P2 — Quản lý được (kế hoạch triển khai)

Trạng thái (2026-11-10): **P2.0** đóng mục 0.1, còn 1 lỗi nhỏ ở 0.2 (chat-proxy chưa khử trùng); **P2a** đóng 2026-10-27, chỉ để mở nhánh hạn mức 30 → 35 vì chưa có người dùng thật chạm hạn mức; **P2b** đóng 2026-10-28; **P2c đợt 1 đóng** (T1–T20, manifest v1 live), **đợt 2 T21–T24 code xong 2026-11-10** (upload + tab Kho tệp + dọn mồ côi hàng loạt, còn bước kiểm upload trên production); **P2e đóng** (E1–E6 xong, E4 có hiệu lực và QA tay pass 2026-11-03); **P2d đóng** vì phần hàng loạt đã gộp vào P2c đợt 2. P3 chưa bắt đầu. Bản 24 — 2026-11-10.
Thuộc P2 của `docs/features/ADMIN_CONSOLE_PLAN.md`; P1 đã đóng, xem `docs/archive/ADMIN_P1_PLAN.md`.

### Đối chiếu shell production 2026-11-09

Đăng nhập `admin.zenstudy.space` bằng `jimwork218@gmail.com`: 6 tab tải đủ, không có lỗi console, chỉ gọi `/api/admin/*`.

- **Tổng quan**: health 3/3 (127–345 ms); chat hôm nay 0 câu / 0 người, hạn mức 30; sync 5 người, bản lớn nhất 22,0 KB; LiveKit 526/4.500 phút tháng 11; R2 **127 tệp / 497,65 MB** (P1 đo 121 tệp / 487,85 MB — tăng 6 tệp, chưa rõ nguồn; sau đó xác định là 6 bản video 720p cho mobile, đã xóa 2026-11-09, R2 về **121 tệp**).
- **Cờ hệ thống**: bật đủ, banner trống, hạn mức 30, lần lưu cuối 01:25 27-10 bởi chính tài khoản admin.
- **Trợ lý chat**: đủ 3 mục (Thử model / Thứ tự trả lời / Câu lệnh hệ thống) và khối "Quy tắc an toàn (cố định)" đã là bản 16+. Shell production vẫn là bố cục một trang; bản tách tab con đang sửa dở chưa deploy.
- **Nội dung**: **bản v1 · 40 cảnh · 20 âm · 49 nhạc · 28/10 13:43**, Lịch sử chỉ có 1 bản, mọi dòng "Có file"; **tab "Kho tệp" + upload mới thêm 2026-11-10, chưa deploy**.
- **Báo cáo**: **0 chờ xử lý / 4 tổng**, cả 4 đã xử lý.
- **Chẩn đoán**: 9 dòng lỗi; vẫn còn cặp `fallback_failed` trùng giờ ngày 27–28/10 → xác nhận mục 0.2 còn mở; không có dòng mới sau 28/10.
- **Nợ giao diện phát hiện khi rà**: ô tài khoản ghi cứng "Quyền: **chỉ xem**" ([`index.html:159`](../../admin-host/index.html#L159)) và footer "Phiên bản **chỉ xem**" ([`index.html:217`](../../admin-host/index.html#L217)) — copy di sản từ thời P1 chỉ đọc, trong khi tài khoản này đã ghi bình thường (cờ, nội dung v1, resolve báo cáo). **Đã sửa 2026-11-10**: nay ghi "Quyền: quản trị" và "Phiên bản đầy đủ".

Mục tiêu: bảng điều khiển từ chỗ **chỉ xem** chuyển sang **sửa được** — chặn sự cố không cần deploy, đổi cấu hình chat, đẩy nội dung có phiên bản và quay lại, dọn kho — nhưng mọi hành động ghi đều đi qua Access, có audit ghi trước, và không đưa token xuống trình duyệt.

## Nguyên tắc chung

1. Ghi chỉ qua `admin-worker/_worker.ts` tại `/api/admin/*`, sau `verifyAccessJwt`. Browser không gọi thẳng chat-proxy/livekit bằng token.
2. Audit trước khi ghi: chèn `admin_audit` xong mới `put`/`DELETE`. Audit lỗi thì trả 500 và không thay đổi gì. Nếu bước ghi sau audit lỗi, dòng audit vẫn ở lại và được hiểu là "đã thử đổi nhưng chưa áp dụng" — endpoint trả lỗi rõ ràng.
3. Kho cấu hình là KV `CHAT_QUOTA` (`a16e430f9bbe46afa51ffc9d4f9bce9d`): chat-proxy đã bind sẵn, key mới đặt cạnh các `cfg:*` cũ. Chưa tạo namespace thứ hai.
4. Không thêm dependency, không dashboard framework. UI mới viết trong `admin-host/` (HTML/CSS/JS thuần).
5. Làm từng phần, deploy và kiểm tra xong mới sang phần sau. Thứ tự: P2.0 → P2a → P2b → P2c → **P2e** → P2d.
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
- [x] Xong khi: `/usage` trả trong **dưới 5 giây** kể cả khi LiveKit chậm; `admin_error_log` không còn sinh thêm dòng `livekit:unreachable` trong 24 giờ.
  - Chốt 2026-11-09: quét D1 `zenspace` toàn bộ 30 ngày chỉ có 5 dòng `livekit:unreachable`, dòng mới nhất **2026-10-26 16:31** (trước bản deploy 16:54), không phát sinh dòng nào sau đó; `/usage` production trả 190–336 ms.

### 0.2 Chặn log lỗi trùng

Chọn một hướng, mặc định là (a):

- [x] (a) Trong `logAdminError` (`admin-worker/_worker.ts:272`): trước khi insert, đọc dòng gần nhất cùng `source`+`code`; nếu trong 1 giờ thì bỏ qua. Giữ Map trong RAM làm lớp giảm tải trước.
- [ ] (b) Hoặc gộp trùng ở `readErrors` (hiển thị 1 dòng + số lần).
- [ ] (c) Hoặc giữ nguyên và chỉ ghi chú trong docs.
- [x] Unit test: hai lần gọi liên tiếp chỉ chèn 1 dòng; quá 1 giờ thì chèn tiếp (`src/__tests__/unit/admin/error-log.test.ts`, 6 ca).
- [x] Deploy admin worker: version `1a427f38`, 2026-10-26 16:54 UTC.
- [ ] Xong khi: bảng lỗi không còn nhiều dòng giống nhau trong cùng một giờ (theo dõi 24 giờ sau deploy).
  - Kiểm 2026-11-09: khử trùng đúng cho dòng do worker admin ghi, nhưng **chat-proxy có `logAdminError` riêng chưa khử trùng** ([`workers/chat-proxy/worker.js:331`](../../workers/chat-proxy/worker.js)) nên vẫn còn 2 cặp `fallback_failed` trùng trong cùng giờ (2026-10-27 06:55 và 2026-10-28 04:48, cách nhau 1–3 giây). Cần thêm luật 1 giờ vào chat-proxy **hoặc** gộp trùng lúc đọc (hướng (b)) rồi mới chốt.

Rà soát 2026-10-28: code và deploy của 0.1 và 0.2 đều đã xong; hai mục "Xong khi" vẫn để mở vì chưa có bằng chứng 24 giờ trong `admin_error_log` — muốn chốt thì mở admin, xem khối Lỗi và đếm dòng `livekit:unreachable`.
Chốt lại 2026-11-09: 0.1 **đóng**; 0.2 **còn mở** đúng một phần — worker admin đã khử trùng, chat-proxy chưa.
Cập nhật 2026-11-10: đã thêm luật 1 giờ vào `logAdminError` của `chat-proxy` (đọc dòng mới nhất trong D1 như worker admin, có test riêng 6 ca). Còn chờ dán lại worker lên dashboard rồi theo dõi mới chốt được.

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
4. [x] Push web (Pages tự build) — push `db8b078` (2026-10-27), Pages build xanh, bundle production chứa code P2a.

Kiểm tra chấp nhận:

- [x] Tắt chat trong admin → app chat trả 503, nút chat bị disable trong ≤ 60 giây; bật lại → chat chạy.
  - Kiểm 2026-10-27: audit id 6 (tắt) và id 7 (bật) do chính bạn lưu; `/config` production trả đúng trạng thái hiện tại (`chatEnabled:true`); bundle production bị chặn `/config` trả `chatEnabled:false` thì menu hiện "Chatbot AI đang tạm tắt"; nhánh 503 trước khi gọi AI phủ bằng unit test.
- [ ] Đổi hạn mức 30 → 35: người đã dùng 30 câu hỏi được câu tiếp theo; hạ về thấp hơn số đã dùng → 429 tới hết ngày; thẻ chat trên admin hiện đúng hạn mức mới trong ≤ 30 giây.
  - **Chưa kiểm được (2026-10-27):** chưa có người dùng nào đạt 30 câu/ngày để thử "câu thứ 31". Phần còn lại đã kiểm: đổi 30 → 1 → 30 không cần deploy (audit id 5 và 9), panel admin hiện "Đang áp dụng: 30 câu/người/ngày" lấy từ `/status`; thứ tự ưu tiên KV → env → 30 và ngưỡng 429 phủ bằng unit test. Sẽ kiểm khi có người dùng thật chạm hạn mức.
  - Rà 2026-11-09: `chat_usage` có 13 dòng, cao nhất **4 câu/người/ngày** (ngày mới nhất 2026-11-03) — vẫn chưa có ai chạm hạn mức, tiếp tục để mở.
- [x] Tắt phòng học nhóm → `/token` trả 503; phòng đang mở không bị đá ra.
  - Kiểm 2026-10-27: audit id 7 (tắt) và id 8 (bật); bundle production với `roomsEnabled:false` hiện nút "Phòng học nhóm · Tạm tắt" và `disabled`; worker chỉ chặn `/token` + `/rooms`, `/webhook/livekit` vẫn 200 (unit test).
- [x] Bật bảo trì + banner "Thử bảo trì" → web hiện banner trong ≤ 60 giây; chat/rooms vẫn chạy.
  - Kiểm 2026-10-27: audit id 1–4 (bảo trì + banner "Demo Bảo trì", "Demo Bảo trì 2"); bundle production với `maintenance:true` + banner hiện đúng chữ "Thử bảo trì" ở đầu trang, chat/rooms vẫn bật.
- [x] Mỗi lần lưu có **đúng 1** dòng `admin_audit` với `actor_email` của bạn và `detail_json` có trước/sau.
  - Kiểm 2026-10-27: 9 lần lưu = 9 dòng (id 1–9), actor `jimwork218@gmail.com`, dòng nào cũng có `before`/`after`; audit chèn trước `FLAGS.put`, audit lỗi thì không ghi KV (unit test).
- [x] Network của trang admin: chỉ gọi `/api/admin/*`, không có token, không có `?token=`.
  - Kiểm 2026-10-27: tải `https://admin.zenstudy.space/admin/` chỉ thấy `GET /api/admin/overview`; `localStorage` rỗng; không có chuỗi `token=` trong request.

### DoD P2a

- [x] Năm trường cờ đọc/ghi được từ shell, có audit, có mặc định an toàn.
- [x] Hạn mức câu/ngày chỉnh được không cần deploy; chat-proxy áp dụng và `/status` báo đúng hạn mức hiệu lực.
- [x] chat-proxy và livekit-rooms tôn trọng cờ trong ≤ 30 giây — cơ chế cache 30 giây trong isolate (không đo bằng đồng hồ trên production).
- [x] Web hiện banner và ẩn nút trong ≤ 60 giây, không cần build lại — chứng minh trên bundle production đã deploy (chặn `/config`), không cần build lại; thời gian do poll 60 giây.
- [x] Không có đường ghi nào khác ngoài `POST /api/admin/flags` — chỉ một `FLAGS.put` (`admin-worker/_worker.ts:902`), `GET` trả 405.

Ghi chú chốt (2026-10-27): P2a đóng, còn đúng một mục để mở là nhánh "30 → 35" vì chưa có người dùng thật đạt hạn mức. Trạng thái production lúc chốt: chat bật, phòng học bật, bảo trì tắt, banner trống, 30 câu/người/ngày.

---

## P2b — Chat admin (đóng 2026-10-28)

Mục tiêu: đổi model mặc định, thứ tự chuỗi dự phòng, prompt và hãng ngoài từ shell mới — thay trang `/admin/chat` local.

Các bước nhỏ dự kiến:

- [x] B1. Chốt phạm vi: model mặc định, chain, prompt, danh sách hãng (thêm/sửa/xóa/tắt), thử nhanh một model. Không đụng lịch sử chat.
  - `temperature` và `max_tokens` gộp chung khối Model (chốt 2026-10-27); **bỏ khỏi UI cùng ngày** — giữ mặc định đang lưu, chỉ chọn model.
- [x] B2. Endpoint proxy trong worker admin: `GET /api/admin/chat/config` (không trả API key, chỉ trạng thái "đã có key") và `POST /api/admin/chat/config` cho từng nhóm thay đổi. Browser không gọi thẳng chat-proxy bằng token.
  - Thực tế trả **key đã che** (`***abcd`) từ chat-proxy để giữ key cũ khi sửa; key thật không bao giờ về trình duyệt và POST nhận lại mặt nạ thì giữ key cũ.
  - Endpoint phụ: `POST /api/admin/chat/check-key`, `GET /api/admin/chat/provider-models?id=`, `POST /api/admin/chat/test` (Bearer `ADMIN_TOKEN`, `strict:true`, không trừ lượt người dùng).
- [x] B3. Validate + audit mỗi lần đổi (cùng khuôn A2), không ghi log nội dung prompt vào audit — chỉ ghi hành động và khác biệt khóa.
  - Audit `chat.config.update`, target `cfg:cfModel` / `cfg:gen` / `cfg:prompt` / `cfg:chain` / `cfg:providers`; prompt chỉ ghi `beforeChars`/`afterChars`, hãng chỉ ghi id/type/baseUrl/enabled.
  - Giới hạn 10 lần ghi/phút/email; audit lỗi thì không gọi chat-proxy.
- [x] B4. UI: các khối Thử model / Thứ tự trả lời / Prompt / Hãng; key nhập một chiều (không hiện lại), có nút xóa.
  - **Mục 1 chỉ để thử, không lưu gì (chốt lại 2026-10-27):** chọn hãng (Cloudflare + hãng đã lưu đang bật) → chọn model của hãng đó → "Thử" → `POST /api/admin/chat/test` đúng cặp hãng/model. Bỏ ô "Model Cloudflare", dòng "Đang dùng", nút "Lưu model" và lệnh `kind:"model"` khỏi UI; endpoint `cfg:cfModel` giữ nguyên trong chat-proxy.
  - **Why:** chat-proxy chạy thật theo `cfg:chain` đúng thứ tự, bước 1 trước ([`worker.js:1055`](../../workers/chat-proxy/worker.js)); web chỉ gửi câu hỏi, không gửi model ([`chatApi.ts:38`](../../src/components/study/chat/utils/chatApi.ts)). `cfg:cfModel` chỉ để hiển thị, nên "model chính" ở mục 1 là khái niệm sai.
  - **Mục 2 đổi tên "Thứ tự trả lời":** bước 1 chạy trước, lỗi mới xuống bước 2, 3; toàn quyền thêm/xóa/đổi thứ tự, Cloudflare là một hãng bình thường trong danh sách.
  - Chain 1–5 bước: đổi thứ tự, xóa, chọn hãng, thử từng bước; mỗi bước tự tải model của hãng đang chọn vào dropdown thật, có thêm ô nhập mã riêng khi cần.
  - Hãng: bật/tắt, sửa, xóa, "Kiểm tra key", "Làm mới" danh sách model; sửa key đã lưu phải xóa ô rồi dán key mới.
  - **Dựng lại 2026-10-27:** bỏ datalist dùng chung + nút "Xem model" (danh sách chọn bị chập chờn), thay bằng 4 mục đánh số, dropdown tự tải theo hãng, chip trạng thái từng mục; script tách riêng `admin-host/admin-chat.js`.
- [x] B5. Kiểm tra: đổi model → câu trả lời dùng model mới; đổi chain → thứ tự thử đúng; key sai → lỗi hiện ở khối Lỗi.
  - **Đã kiểm local (2026-10-27):** đọc cấu hình thật qua `wrangler dev` (4 model, 3 bước chain, 3 hãng), key chỉ hiện mặt nạ, không có key/localStorage/token trong trang, không tràn ngang ở 390px, layout desktop 2 cột ở 1200px; 19 test DOM bấm nút thật (khối thử tự tải model theo hãng, nhập mã tay, tải lại khi lỗi, lưu chain/prompt/hãng, kiểm tra key, chặn xóa hãng đang dùng, thử model chỉ gọi `/test`, lỗi 502 khóa panel).
  - **Kiểm khối thử (2026-10-27):** danh sách hãng có Cloudflare đứng đầu cùng các hãng đã lưu; đổi hãng thì model tải theo hãng (Groq 4, OpenRouter 200); thử model free OpenRouter trả lời sau 2.093 ms, mạng chỉ có `POST /chat/test`, không có `POST /config`; 320/390/640px xếp một cột, 641/1200px một hàng, không tràn ngang.
  - **Chưa kiểm production:** cần deploy rồi đổi model/chain thật và đọc lại câu trả lời; chưa ghi gì lên production trong lúc kiểm local.
  - **Rà soát 2026-10-28:** code B5 đã lên production (local trùng `origin/main` ở `9a30f7a`, Workers Builds deploy admin theo mỗi lần push).
  - **Chốt 2026-10-28 — nhìn thấy hãng/model thật của lần thử:** khối "Thử model" chỉ in câu trả lời + số ms nên không phân biệt được Cloudflare với hãng ngoài. `testText()` ([`admin-chat.js`](../../admin-host/admin-chat.js)) giờ in `nội dung · provider:model · N ms`, lấy `provider`/`model` từ **response** của chat-proxy (giá trị của lần gọi thành công thật, không phải giá trị gửi lên), và `strict:true` bảo đảm không rơi êm sang bước khác. Kiểm trên shell local bằng cách chỉ chặn `/api/admin/chat/test` rồi trả `{ provider: "groq-1", model: "llama-3.3-70b-versatile", ms: 1234 }` → dòng kết quả hiện `Xin chào… · groq-1:llama-3.3-70b-versatile · 1.234 ms`; test DOM `chat-panel.test.ts` thêm ca kiểm `Cloudflare:qwen3-30b`. Kèm sửa nút icon ↑ ↓ ✕ dính mép trái (`justify-content: center` + `line-height: 1` cho `.chat-icon-btn`, [`admin.css:1671`](../../admin-host/admin.css)).
  - **Còn lại sau deploy:** bấm Thử/đổi chain trên bản production để xác nhận bằng mắt — code đã nằm trong `main`, chỉ chờ bản deploy chứa `testText()` và bản sửa icon.
- [x] Xóa trang `/admin/chat` local (chốt 2026-10-27, người dùng xác nhận P2b xong): xóa `src/app/admin/chat/`, gỡ tab "Quản Lý Chatbot" khỏi `src/components/admin/AdminHeader.tsx` (`AdminTab` còn `limits | studio`), cập nhật `admin-header.test.tsx`.

## P2c — Quản lý nội dung trong admin (đợt 1 đóng 2026-10-30; đợt 2 code xong 2026-11-10)

Mục tiêu: mọi thao tác với thư viện nội dung — **thêm, xem, sửa, xóa từng cảnh / âm thanh / bài nhạc và cả file media của nó** — làm được ngay trong shell admin: không cần máy local, không sửa JSON tay, không build lại web. Từ đợt 2, `/dev/studio` đã xóa (2026-11-10) vì shell admin làm được toàn bộ.

### Vì sao bản 11 chưa đủ

Bản 11 chỉ cho dán nguyên 3 file JSON: vẫn phải sửa JSON ở ngoài máy, không upload hay xóa được file media, và một lỗi cú pháp làm hỏng cả danh sách. Yêu cầu hiện tại là CRUD theo từng mục + kiểm soát file, nên đổi cách làm.

### Có sẵn gì để dựa vào (đo 2026-10-28)

- Studio local (đã xóa 2026-11-10) từng có đúng quy tắc CRUD cảnh: 50 MB/file, video bắt buộc có ảnh xem trước, tên file làm sạch, **không ghi đè** file trùng tên, xóa mục thì xóa file nhưng **chừa file còn mục khác dùng**. Port các quy tắc này sang worker là xong phần khó nhất.
- Catalog hiện tại: 40 cảnh, 20 âm, 49 nhạc (lofi 22, jazz 15, relax 12); **118 file media / 449 MB**; file lớn nhất 34,5 MB; mọi đường dẫn trong JSON đều trỏ tới file có thật.
- Âm thanh dùng **15 tên icon cố định** (`CloudRain`, `Zap`, `Trees`, `Bird`, …); tên lạ thì web rơi về icon loa ([`SoundTileItem.tsx:33`](../../src/components/study/mixer/components/SoundTileItem.tsx)) — nên form phải chọn từ danh sách, không cho gõ tự do.
- Admin worker đã bind `DB` + `R2` và đã có liệt kê R2 phân trang 30 trang, cache 60 giây ([`_worker.ts:1020`](../../admin-worker/_worker.ts)).
- Web đọc catalog qua đúng **3 hằng** ở [`study-types.ts:55-63`](../../src/components/study/study-types.ts); 14 file dùng nhưng đều đi qua 3 hằng đó.
- data-api khóa mọi route sau token trừ `/health`, nên cần thêm một route công khai để web đọc danh sách đang phát.

### Kiến trúc

| Thao tác | Đường đi | Ghi chú |
| --- | --- | --- |
| Thêm / sửa / xóa mục | `POST` `PATCH` `DELETE /api/admin/content/items` | validate → audit → ghi phiên bản mới |
| Upload / thay file | `POST /api/admin/content/media` (thân nhị phân ≤ 50 MB) | vào thẳng R2, không qua Next |
| Xem / xóa file | `GET` `DELETE /api/admin/content/media` | chỉ xóa file không mục nào dùng |
| Xem / quay lại bản cũ | `GET /api/admin/content/versions`, `POST .../rollback` | rollback = tạo phiên bản mới |
| Web đọc | `GET data-api /content` (công khai, `max-age=60`) | lỗi hoặc chưa có bản → dùng JSON bundle |

Không có đường nào khác được ghi vào bảng `content_manifest` hay vào R2.

### Nguyên tắc cố định (không cần bàn)

- **id không đổi sau khi tạo** — localStorage của người dùng đang giữ `sceneId` / `trackId`; server sinh id dạng `scene-custom-<ms>`.
- **Không ghi đè file**: thay media thì tạo tên mới, file cũ thành mồ côi (dọn ở tab Kho tệp). Nếu ghi đè, CDN có thể còn phục vụ bản cũ.
- Chỉ nhận `mp4, webm, mp3, jpg, jpeg, png, webp, avif`, ≤ 50 MB; tên file được làm sạch, không `..`, không đường dẫn tuyệt đối; `Content-Type` suy ra từ đuôi file, không tin header của trình duyệt.
- Video bắt buộc kèm ảnh xem trước; cảnh loại ảnh thì dùng chính nó làm ảnh xem trước.
- Audit ghi id, đường dẫn, dung lượng; **không** ghi nội dung file hay nội dung JSON.

### Đã chốt (2026-10-28)

| # | Chốt | Hệ quả |
| --- | --- | --- |
| 1 | **Lưu = lên sóng ngay**, mỗi lần lưu thành 1 phiên bản | Không có bản nháp; sai thì bấm Quay lại |
| 2 | **Có trường `hidden`** (nút Ẩn/Hiện) | Web bỏ qua mục ẩn ngay ở khối dựng danh sách, một chỗ duy nhất; admin vẫn thấy |
| 3 | **Xóa mục ≠ xóa file**: xóa mục chỉ bỏ dòng khỏi danh sách, file giữ nguyên trong kho | Dọn file là việc riêng ở tab "Kho tệp", chỉ file không mục nào dùng mới xóa được |
| 4 | **Chia 2 đợt, mỗi đợt chia task nhỏ** | Đợt 1: T1–T20 (CRUD mục + web đọc + xem kho). Đợt 2: T21–T24 (upload + xóa file) |

Vì sao tách xóa mục và xóa file: một file có thể được nhiều mục dùng chung (nhiều cảnh trỏ cùng ảnh xem trước). Xóa mục chỉ ảnh hưởng danh sách và **hoàn tác được** bằng Quay lại; xóa file là mất dữ liệu thật, không hoàn tác được và có thể làm vỡ mục khác. Tách hai việc giúp thao tác thường ngày (xóa cảnh) không bao giờ đụng tới dữ liệu thật.

### Task nhỏ (làm đúng thứ tự, xong task nào kiểm task đó)

**Đợt 1 — Mốc A: dữ liệu và API (chưa đụng web)**

| # | Task | Xong khi |
| --- | --- | --- |
| T1 | Thêm bảng `content_manifest` + index vào `workers/schema.sql` và một file SQL dán tay cho DB đang chạy | `wrangler d1 execute --local` chạy sạch, bảng có trong D1 local |
| T2 | Kiểu & hằng dùng chung trong worker: `ContentKind`, `ContentItem`, 8 nhóm cảnh, 15 icon, 3 mood, các trần kích thước | `tsc --noEmit` sạch |
| T3 | Port `sanitizeFileName`, `uniqueKey`, `detectKind` từ studio | 6 unit test |
| T4 | `validateItem` + `validateCatalog` (không ném lỗi, trả danh sách lỗi) | 8 unit test (trùng id, `type` sai, icon lạ, path tuyệt đối, quá trần, JSON hỏng) |
| T5 | `readPublished()` + `writeVersion()` (batch, `version = MAX+1`) | 3 unit test, ghi lỗi giữa chừng không để lại bản nửa vời |
| T6 | `GET /api/admin/content/items?kind=` + `fileState` theo `R2.list` cache 60 giây | 3 unit test, 40 cảnh trả về trong 1 lần gọi |
| T7 | `POST` / `PATCH` / `DELETE` mục (không xóa file) + audit trước khi ghi | 6 unit test, audit lỗi thì không ghi |
| T8 | `GET versions`, `GET versions/:version`, `POST rollback` | 3 unit test, rollback tạo bản mới cùng nội dung |
| T9 | Giới hạn 20 lần ghi/phút/email + 401 khi thiếu JWT | 2 unit test |

**Đợt 1 — Mốc B: web đọc**

| # | Task | Xong khi |
| --- | --- | --- |
| T10 | data-api `GET /content` công khai, trước cửa kiểm token, `max-age=60` | 4 unit test, route cũ vẫn 401 |
| T11 | `content-catalog.ts` + khóa `contentCatalog` + đổi nguồn 3 hằng ở `study-types.ts` + bỏ mục `hidden` | 6 unit test, mục ẩn không xuất hiện |
| T12 | `refreshCatalog()` + tự reload 1 lần/phiên khi version đổi | 2 unit test, fetch lỗi thì giữ bundle |

**Đợt 1 — Mốc C: giao diện**

| # | Task | Xong khi |
| --- | --- | --- |
| T13 | Khung panel "Nội dung": 4 tab, dòng "Bản v… · số lượng · cập nhật lúc", style bảng/tab | DOM test: đủ tab, không tràn ngang ở 390px |
| T14 | Tab Cảnh: bảng + ảnh xem trước + tìm kiếm + lọc nhóm + trạng thái file | DOM test: đếm đúng 40 dòng, lọc đúng |
| T15 | Form cảnh (thêm/sửa) gồm nút Ẩn/Hiện, xem trước, cảnh báo rời form chưa lưu | DOM test: mở form điền sẵn, lưu gọi đúng endpoint |
| T16 | Tab Âm thanh: bảng + form chọn 15 icon + nghe thử | DOM test: icon lạ không chọn được |
| T17 | Tab Nhạc: bảng + form mood/ảnh bìa/nghe thử | DOM test: đổi mood đổi nhóm |
| T18 | Khối Lịch sử: 20 bản gần nhất, Quay lại, Tải JSON | DOM test: nút Quay lại hỏi xác nhận |
| T19 | Build admin nhúng 3 file JSON làm bản khởi tạo + nút "Khởi tạo v1" khi chưa có bản nào | `npm run build:admin` sinh `dist-admin/seed/*.json`; bấm khởi tạo ra version 1 |

**Đợt 1 — Mốc D: deploy**

| # | Task | Xong khi |
| --- | --- | --- |
| T20 | Deploy theo C7 bước 1–5 (chưa publish nội dung mới), kiểm trên production | Web vẫn 40/20/49, `/content` trả version 1, shell đọc được danh sách |

**Đợt 2 — upload và kho tệp**

| # | Task | Xong khi |
| --- | --- | --- |
| T21 | `POST /api/admin/content/media` (thân nhị phân, ≤ 50 MB, tên làm sạch) | 4 unit test (sai đuôi, quá 50 MB, tên trùng, thiếu JWT) |
| T22 | `GET /api/admin/content/media?prefix=` + "đang dùng bởi" + cờ mồ côi | 3 unit test |
| T23 | `DELETE media` chặn khi còn mục dùng, audit trước khi xóa | 3 unit test, xóa file dùng chung vẫn được nếu mục khác dùng |
| T24 | Tab "Kho tệp" + upload trong form cảnh/âm/nhạc có thanh tiến trình | Kiểm production: upload 1 cảnh mới, xóa file mồ côi, file đang dùng bị chặn |

**Đợt 2 xong 2026-11-10 (code + test):** T21–T24 làm đủ trong `admin-worker/content-api.ts`, `admin-host/panels/content.html`, `admin-host/scripts/content.js`, `admin-host/styles/content.css`; 11 test worker + 5 test DOM mới; `npm test` 94 file / 758 test xanh, `tsc` và `lint` sạch. Còn lại chỉ là bước kiểm trên production (C7 bước 7) sau khi deploy.

Ghi chú triển khai khác bản gốc:

- Upload nhận `folder` (không phải `kind`) và chỉ cho 5 thư mục thật của bucket: `scenes`, `thumbnails`, `sounds`, `musics`, `authors`. Đuôi file phải khớp loại của thư mục (`scenes` nhận ảnh + video, `thumbnails`/`authors` chỉ ảnh, `sounds`/`musics` chỉ âm thanh) → lệch thì 415.
- Khi client khai `Content-Length`, worker chuyển thẳng stream vào `R2.put`; không có header thì đọc `arrayBuffer()` rồi kiểm dung lượng thật (413 nếu vượt). Mọi lần upload đều `R2.list` mới để chọn key trống — không bao giờ ghi đè.
- `GET media` trả thêm `summary` (tổng tệp/byte/mồ côi/thiếu), `folders` (tổng theo thư mục), `orphanKeys` (tối đa 200) và `missing` (tối đa 100 mục trỏ tới file không có trong kho) — đây là phần P2d gộp vào.
- `POST /api/admin/content/media/prune` `{ keys }` (1–50 key/lần): máy chủ đọc lại catalog và **kiểm lại từng key** còn mồ côi mới xóa, audit `content.media.prune` trước; trả `{ deleted, skipped, freed }`. Không có đường xóa hàng loạt nào khác.
- Giới hạn ghi dùng chung bộ đếm nội dung: 20 lần/phút, tính cả upload/xóa/dọn.

### Tiến độ đợt 1 (2026-10-28)

T1–T19 đã xong: 82 test mới (21 validate, 30 API worker, 9 data-api, 13 catalog web, 7 DOM panel, 2 seed); `npm test` 72 file / 587 test xanh, `npx tsc --noEmit` sạch, `npm run lint` chỉ còn cảnh báo cũ, `npm run build:admin` sinh `dist-admin/admin/seed/*.json`. **Cập nhật 2026-11-09: đã commit (`922864a`) và lên production — T20 đóng, `GET /content` trả version 1 với 40/20/49.**

### C1. Bảng dữ liệu và validate (đợt 1)

- [x] `workers/schema.sql`: thêm bảng; bản dán tay riêng để chạy trên D1 đang sống ở `workers/content-schema.sql`.

```sql
CREATE TABLE IF NOT EXISTS content_manifest (
  version    INTEGER NOT NULL,
  kind       TEXT NOT NULL,          -- 'scenes' | 'sounds' | 'tracks'
  json       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY (version, kind)
);
CREATE INDEX IF NOT EXISTS idx_content_manifest_created ON content_manifest (created_at DESC);
```

- [x] `admin-worker/content.ts`: kiểu `ContentKind`, `ContentItem`; `validateItem(kind, item)` trả `{ ok, errors[] }` (không ném lỗi), mỗi lỗi gồm `kind`, `id`, `field`, `message`. `_worker.ts` nhận `catalogFromRows` / `validateCatalog` từ đây.
- [x] Luật: `id` không rỗng và không trùng trong cùng loại; cảnh `type` ∈ `VIDEO|IMAGE`; nhóm cảnh thuộc 8 nhóm hiện có; âm thanh `icon` thuộc 15 tên hợp lệ; nhạc `category` ∈ `lofi|jazz|relax` và khớp khóa trong `tracks`; `mediaPath`/`thumbnailPath`/`audioPath` phải tương đối; `coverPath` được URL tuyệt đối; trần số mục (cảnh 200, âm 100, nhạc 100/mood) và tổng JSON ≤ 256 KB.
- [x] Port từ studio: `sanitizeFileName`, `uniqueKey` (tránh trùng), `detectKind` theo đuôi file.
- [x] Mỗi lần ghi: đọc phiên bản đang phát → áp thay đổi → validate **toàn bộ** danh sách → ghi 3 dòng của version mới bằng **một** câu `INSERT` nhiều dòng (atomic, không để lại bản nửa vời); trùng version → 409 `version_conflict`.

### C2. API mục — thêm / sửa / xóa (đợt 1)

- [x] `GET /api/admin/content/items?kind=` → danh sách mục của bản đang phát + `fileState` cho từng file (`ok` / `missing`), suy ra từ một lần `R2.list` theo tiền tố, cache 60 giây (không gọi `head` từng file để khỏi vượt hạn mức subrequest).
- [x] `POST` thêm mục: nhận các trường + đường dẫn file đã có trong kho; server sinh `id`; validate; audit `content.item.create` → ghi phiên bản mới.
- [x] `PATCH` sửa mục theo `id`: cho sửa tên, nhóm, tags, icon, badge, `type`, đường dẫn media, `hidden`; **không** cho sửa `id`; audit `content.item.update` với danh sách trường đã đổi (trước → sau).
- [x] `DELETE` xóa mục theo `id`: chỉ bỏ dòng khỏi danh sách, **không** đụng file; audit `content.item.delete` kèm danh sách file vừa thành mồ côi (response trả `files`) để tab Kho tệp biết.
- [x] Giới hạn 20 lần ghi/phút/email (CRUD bấm nhiều hơn cờ); audit lỗi → không ghi gì.
- [x] `GET /api/admin/content/versions` (20 bản mới nhất, chỉ số lượng + người + giờ), `GET /api/admin/content/versions/:version` (JSON đầy đủ), `POST /api/admin/content/rollback` `{ version }` → audit `content.rollback` `{ from, to }` → tạo phiên bản mới.

### C3. API tệp — upload, xem kho và xóa (đợt 2)

- [x] `POST /api/admin/content/media?folder=<thư mục>&name=<tên gốc>`: chặn `Content-Length` > 50 MB trước khi đọc, làm sạch tên (bỏ dấu, chữ thường, `-`), `R2.list` mới rồi `pickFreeKey`, `R2.put(key, body, { httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" } })`; trả `{ ok, key, size, contentType }`. Audit `content.media.upload` **trước** khi ghi.
- [x] `GET /api/admin/content/media?prefix=&q=&orphans=1&fresh=1` → key, dung lượng, ngày tải, **đang dùng bởi** (kind/id/tên, đối chiếu catalog đang phát), cờ mồ côi; kèm `summary`, `folders`, `orphanKeys` (≤ 200), `missing` (≤ 100). Danh sách R2 cache 60 giây (`fresh=1` bỏ cache), khớp hạn mức free tier.
- [x] `DELETE /api/admin/content/media?key=` → 409 `{ error: "media_in_use", usedBy }` nếu còn mục dùng, 400 nếu key nằm ngoài 5 thư mục cho phép; audit `content.media.delete` **trước** khi xóa R2; lỗi audit thì không xóa.
- [x] `POST /api/admin/content/media/prune` `{ keys }` (1–50 key): kiểm lại từng key còn mồ côi, audit `content.media.prune` trước, trả `{ deleted, skipped, freed }`.
- [x] Upload từ trình duyệt dùng `XMLHttpRequest` để có thanh tiến trình (fetch không báo tiến trình upload); thành công thì tự điền đường dẫn vào ô của biểu mẫu, lỗi thì báo mã lỗi đã dịch và giữ nguyên form.

### C4. Web đọc danh sách đang phát (đợt 1)

- [x] `workers/data-api/worker.js`: thêm `GET /content` **trước** cửa kiểm Authorization; trả `{ ok, version, updatedAt, scenes, sounds, tracks }` đúng shape 3 file bundle; `Cache-Control: public, max-age=60`; dùng `corsHeaders` sẵn có; bảng trống → `{ ok: true, version: 0 }`; route cũ giữ nguyên.
- [x] `src/lib/content-catalog.ts` (mới): đọc cache `localStorage` lúc import (đồng bộ, không có màn hình chờ), `refreshCatalog()` gọi `/content` (timeout 3 giây) → ghi cache → `splice()` nội dung mới vào 3 mảng cũ; bỏ qua mục `hidden`; payload sai shape thì giữ bundle.
- [x] `src/lib/storage-keys.ts`: thêm khóa `contentCatalog` (không nằm trong snapshot cloud-sync).
- [x] [`study-types.ts`](../../src/components/study/study-types.ts): 3 hằng giữ nguyên tên và kiểu, chỉ đổi nguồn khởi tạo — 14 file đang đọc không phải sửa.
- [x] `useContentCatalog` (hook mount ở `src/app/page.tsx`) gọi `refreshCatalog()` một lần sau mount; nếu version khác cache và chưa reload trong phiên (`sessionStorage`) thì `location.reload()` để bản mới hiện ngay.
- [x] Không có mạng, `/content` chết, JSON hỏng → app chạy y như hôm nay bằng bundle.

### C5. Giao diện panel "Nội dung" (đợt 1 phần chính, đợt 2 thêm upload)

- [x] `index.html`: `panel-card` `content-panel` đặt sau "Trợ lý chat", trước "Lỗi"; đầu panel hiện "Bản v3 · 40 cảnh · 20 âm · 49 nhạc · 28/10 14:32 bởi email".
- [x] Bốn tab: **Cảnh nền** · **Âm thanh** · **Nhạc** · **Kho tệp**.
- [x] Tab Cảnh: bảng có ảnh xem trước nhỏ, tên, nhóm, loại, trạng thái file, **Ẩn/Hiện**, nút **Sửa** / **Xóa**; ô tìm kiếm + lọc nhóm + lọc "đang ẩn"; nút **Thêm cảnh**.
- [x] Form thêm/sửa cảnh (mở ngay trong panel, che bảng — master/detail, không cần modal mới): tên, nhóm, tags, file ảnh/video, ảnh xem trước cho video, công tắc **Ẩn khỏi web**, xem trước ngay trên form, nút **Lưu** / **Hủy**, cảnh báo khi rời form còn thay đổi chưa lưu.
- [x] Tab Âm thanh: tên, nhóm, **icon chọn từ 15 tên**, file mp3, công tắc Ẩn, nghe thử tại chỗ.
- [x] Tab Nhạc: tiêu đề, ca sĩ, thể loại, mood (`lofi`/`jazz`/`relax`, đổi mood là chuyển nhóm), file mp3, ảnh bìa (upload hoặc dán URL ngoài), công tắc Ẩn, nghe thử.
- [x] Tab Kho tệp: chọn thư mục + tìm theo tên + lọc **chỉ tệp mồ côi**, bảng key / dung lượng / ngày tải / đang dùng bởi / trạng thái; nút **Xóa** chỉ bật với file mồ côi và phải gõ đúng tên file; dòng tổng dung lượng + số file mồ côi + tổng theo thư mục; nút **Dọn tệp mồ côi** (hàng loạt, tối đa 50/lần) và khối **Tệp thiếu trong kho**. (P2d D1–D3 gộp vào đây.)
- [x] Khối "Lịch sử": 20 bản gần nhất, **Quay lại** (có `confirm()` nêu rõ sẽ tạo bản mới), **Tải JSON**.
- [x] `admin-host/admin-content.js` (mới) + `admin.css` thêm style bảng, tab, form; dưới 640px xếp một cột như panel chat hiện có.
- [x] Mỗi ô đường dẫn file có nút **Tải tệp lên** + thanh tiến trình (%); thành công thì điền đường dẫn mới, tên trùng được đổi đuôi số chứ không ghi đè; lỗi thì báo rõ mã lỗi và giữ nguyên form.

### C6. Test (đợt 1 và 2)

- [x] worker: validate (trùng id, sai `type`, icon lạ, `mediaPath` tuyệt đối, quá trần số mục, JSON hỏng); tạo/sửa/xóa ghi đúng 1 phiên bản + 1 dòng audit **trước** khi ghi; audit lỗi → không ghi; rollback tạo bản mới cùng nội dung; xóa mục không gọi xóa file và `releasedFiles` đúng; thiếu JWT → 401; rate limit. Đợt 2 thêm: upload (sai đuôi → 415, `Content-Length` > 50 MB → 413, trùng tên → key mới, thiếu JWT → 401, thư mục/loại lệch → 415, key mới đúng `put` + `contentType`), đọc kho (mồ côi, đang dùng bởi, tệp thiếu, tổng theo thư mục), xóa (file đang dùng → 409 kèm `usedBy` và không xóa, audit lỗi → không xóa, key ngoài thư mục → 400), dọn hàng loạt (chỉ xóa mồ côi, bỏ qua file đang dùng).
- [x] data-api: `/content` công khai không cần token, đúng `Cache-Control` + CORS, bảng trống trả `version: 0`, route cũ vẫn 401 khi thiếu token.
- [x] web: cache ghi/đọc, payload sai shape bị bỏ, fetch lỗi → giữ bundle, mục `hidden` không xuất hiện, `splice` đổi nội dung mà `resolveAssetUrl` vẫn đúng.
- [x] DOM: bảng hiện đúng số mục, mở form sửa điền sẵn giá trị, lưu gọi đúng endpoint, xóa hỏi xác nhận. Đợt 2 thêm: tab Kho tệp (hiện tệp đang dùng / mồ côi / tệp thiếu, lọc theo thư mục + chỉ mồ côi, nút Xóa tắt với tệp đang dùng, xóa phải gõ đúng tên tệp, dọn hàng loạt gọi `prune` sau khi hỏi lại máy chủ) và upload qua `XMLHttpRequest` (gọi đúng `folder` + `name`, điền đường dẫn mới vào form).
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch.

### C7. Deploy và kiểm tra (thứ tự bắt buộc, mỗi bước không khóa ai)

1. [x] Chạy SQL C1 trên D1 `zenspace` (bảng mới, không đụng 4 bảng cũ). — xác minh 2026-11-09: bảng `content_manifest` có đúng 3 dòng của version 1, tạo 2026-10-28 06:43 UTC bởi `jimwork218@gmail.com`.
2. [x] Dán `data-api` mới → `GET /content` trả `{ ok: true, version: 0 }`. — xong; hiện trả `version: 1`.
3. [x] `npm run build:admin` + deploy admin worker → panel hiện "chưa có bản nào", đọc được 40 cảnh từ bundle. — xong; admin worker tự deploy theo push `main`.
4. [x] Push web → trang chủ vẫn chạy bằng bundle (chưa có bản nào). — xong.
5. [x] Trong shell: publish lần đầu bằng chính 3 file bundle → `/content` trả `version: 1`, web vẫn 40 cảnh / 20 âm / 49 nhạc. — probe 2026-11-09: `version: 1`, `counts 40/20/49`.
6. [ ] Sửa tên 1 cảnh → tải lại web thấy tên mới; xóa 1 cảnh thử → biến mất và file được chừa lại nếu mục khác dùng; rollback → như cũ.
   - **Chưa làm (2026-11-09):** D1 mới có đúng version 1 (3 dòng), chưa có version 2 nên chưa chứng minh luồng sửa / xóa / quay lại trên production.
7. [ ] Upload 1 cảnh mới (đợt 2) → file nằm trên R2, cảnh hiện trên web sau khi tải lại; thử xóa file đang dùng → bị chặn.
   - **Code + test xong 2026-11-10, chưa kiểm trên production:** cần deploy admin worker (tự deploy theo push `main`) rồi upload một tệp thật, xác nhận key mới trên R2 và nút Xóa bị tắt với tệp đang dùng.

Xong khi: thêm/sửa/xóa một cảnh, một âm, một bài nhạc và file của nó đều làm được trong shell **không cần máy local, không build lại web**; mọi lần ghi có đúng 1 dòng `admin_audit`; web vẫn chạy bình thường khi `/content` chết.

### Ước lượng và ranh giới

- Đợt 1: ~600–700 dòng (worker ~350, web ~120, UI ~350 gồm cả style) + ~12 test.
- Đợt 2 (thực tế): ~800 dòng (worker ~330 cho media, UI ~470 gồm tab Kho tệp + upload + style) + 16 test mới (11 worker, 5 DOM).
- **P2d** gộp vào đợt 2: tổng quan dung lượng theo thư mục, dọn mồ côi **hàng loạt** (≤ 50 key/lần), cảnh báo file thiếu trên toàn kho — đều nằm trong `GET /media` và tab Kho tệp.

## P2e — Báo cáo nội dung & chặn người dùng (phục vụ Play P0.5)

Trạng thái: **đóng 2026-11-03** — E1–E3/E5 code xong 2026-10-30; E4 (hiệu lực khóa AI/phòng) đã lên production cùng P0.5 Phase 4; QA tay 2026-11-03 xác nhận khóa/mở AI đúng; D1 + `data-api` + admin worker đã deploy.
Luồng client/backend đầy đủ: [P0_5_REPORTING_PLAN.md](./P0_5_REPORTING_PLAN.md). P2e chỉ làm **phần admin**: đọc, xử lý, hạn chế tài khoản.

Mục tiêu: admin có hộp thư báo cáo AI + phòng học, xử lý được và có công cụ hạn chế tài khoản — đáp ứng AI-Generated Content + UGC của Google Play. Không thay thế "Phản hồi chung" (P3).

**Điều kiện vào:** P0.5 Phase 1 xong (bảng `content_reports`, `user_blocks`, `user_restrictions` + API ghi ở `data-api`). Admin không tự tạo bảng.

### Dữ liệu admin dùng

- `content_reports`: `id, source ('ai'|'room'), reporter_uid, target_uid, room, session_id, message_id, content, reason, detail, status ('open'|'resolved'|'dismissed'), created_at, resolved_at, resolved_by, resolution_note`.
- `user_restrictions`: `uid, ai_disabled, rooms_disabled, note, updated_at, updated_by`.
- `admin_audit`: mọi lần resolve hoặc đổi hạn chế.
- Báo cáo quá **180 ngày**: endpoint list tự xóa trước khi trả kết quả.

### E1. API đọc

- [x] `GET /api/admin/reports?status=&source=&limit=&before=` — mới nhất trước; trả kèm đếm theo trạng thái; tự dọn báo cáo > 180 ngày.
- [x] `GET /api/admin/reports/:id` — chi tiết.
- [x] Không trả token/URL nội bộ; nội dung báo cáo trả dạng text.

### E2. API ghi

- [x] `POST /api/admin/reports/:id/resolve` `{ status: 'resolved'|'dismissed', note }` — audit trước ghi.
- [x] `POST /api/admin/users/:uid/restrictions` `{ aiDisabled?, roomsDisabled?, note }` — upsert, audit trước ghi, trả trạng thái mới.
- [x] `GET /api/admin/users/:uid/restrictions`.
- [x] Chỉ nhận UID từ tham số; không nhận email hay chuỗi tự do.

### E3. Shell "Báo cáo"

- [x] Thêm mục "Báo cáo" dưới dạng partial `admin-host/panels/reports.html` + `admin-host/styles/reports.css` + `admin-host/scripts/reports.js` (build admin tự mở rộng include; không sửa `src/app/admin/`).
- [x] Danh sách: thời gian, nguồn, người báo cáo → đối tượng, lý do, trạng thái; lọc open/resolved/dismissed + nguồn; đếm nhanh.
- [x] Chi tiết: nội dung báo cáo render **text thuần** (`textContent`, không `innerHTML`); kèm phòng/phiên/tin.
- [x] Nút "Đã xử lý" / "Bỏ qua" + ghi chú.
- [x] Khối "Hạn chế tài khoản": công tắc khóa AI, khóa phòng, ghi chú; xác nhận trước khi lưu.
- [x] Không thêm dependency; giữ style shell hiện tại.

### E4. Hiệu lực hạn chế (phối hợp P0.5)

- [x] chat-proxy đọc `user_restrictions.ai_disabled` trước khi gọi AI → 403. — `workers/chat-proxy/worker.js:1137` trả 403 `AI_RESTRICTED`; deploy 2026-11-03.
- [x] livekit-rooms đọc `rooms_disabled` trước khi phát vé → 403. — `workers/livekit-rooms/worker.js:848` trả 403 `RESTRICTED`; deploy 2026-10-30, QA 2026-11-03 mục 11.
- [x] Admin chỉ ghi dữ liệu; hai worker đọc theo P0.5 Phase 4/5. — đúng như triển khai.

### E5. Test

- [x] Worker: 401 Access, validate status, audit đúng 1 dòng, phân trang, dọn báo cáo > 180 ngày, restrictions upsert.
- [x] DOM: danh sách, escape nội dung, resolve đổi trạng thái, restriction gửi đúng payload.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test` sạch (7 ca API + 4 ca DOM; toàn bộ 628 test).

### E6. Deploy (thứ tự)

1. [x] D1 migration + `data-api` (P0.5 Phase 1). — xong 2026-10-30: `content_reports`, `user_blocks`, `user_restrictions` có trong D1; `/report` và `/blocks` trả 401 (route sống).
2. [x] `npm run build:admin` + `npx wrangler deploy --config wrangler.admin.jsonc`. — xong 2026-10-30, admin worker version `2ff4e780` (push `main` tự deploy từ đó).
3. [x] Seed 1 báo cáo thử → resolve → kiểm `admin_audit`. — production có 11 dòng `report.resolve`, mới nhất 2026-11-03 10:17.
4. [x] Đặt restriction thử → chat/phòng bị chặn đúng → gỡ restriction. — production có 4 dòng `user.restrictions`; QA 2026-11-03 mục 11 khóa AI tài khoản thử → chat từ chối → mở lại chạy bình thường.

### DoD P2e

- [x] Báo cáo AI/phòng hiện trong shell, lọc được, resolve/dismiss có audit. — đã dùng thật trong QA 2026-11-03 (báo cáo AI + báo cáo phòng, resolve 11 lần).
- [x] Hạn chế AI/phòng có hiệu lực thật và gỡ được. — QA 2026-11-03 mục 11.
- [x] Không lộ token; nội dung báo cáo không chạy HTML. — chỉ gọi `/api/admin/*`; nội dung render bằng `textContent`.
- [x] Báo cáo > 180 ngày được dọn. — endpoint list tự xóa trước khi trả; có unit test; chưa có dữ liệu quá 180 ngày để chứng minh thực tế.

### Rủi ro P2e

- **XSS**: nội dung báo cáo là dữ liệu người dùng → chỉ dùng `textContent`, không `innerHTML`.
- **Sửa sai thư mục**: UI thật nằm ở `admin-host/`; `src/app/admin/` chỉ là bản local, gitignored.
- **Audit trước ghi**: theo nguyên tắc chung của P2; audit lỗi thì không đổi dữ liệu.
- **Tải nặng**: phân trang + index `(status, created_at)`.
- **Xóa tài khoản**: data-api phải xóa luôn reports/blocks/restrictions (đã ghi trong P0.5 plan).

---

## P2d — Kho R2 (đóng 2026-11-10, gộp vào P2c đợt 2)

Mục tiêu: phần **hàng loạt** của kho — tổng quan dung lượng theo thư mục, dọn file mồ côi một lượt, cảnh báo file thiếu trên toàn kho. Xem/sửa/xóa từng file đã nằm trong tab "Kho tệp" của P2c. Cả ba việc đã làm trong đợt 2, không cần đợt riêng.

- [x] D1. So catalog đang phát với `R2.list()` → danh sách thiếu/mồ côi (dùng lại phân trang 30 trang + cache 60 giây của P1c) — nằm trong `GET /api/admin/content/media` (`summary`, `folders`, `missing`, `orphanKeys`).
- [x] D2. UI: đếm theo loại, danh sách rút gọn, không hiện key đầy đủ của ảnh người dùng — dòng tổng + tổng theo thư mục trong tab Kho tệp; bảng chỉ hiện key tương đối (không có host CDN).
- [x] D3. Xóa hàng loạt: chỉ file mồ côi, hỏi lại máy chủ lấy danh sách mới + `confirm()`, audit trước khi xóa (single-file đã có ở P2c) — `POST /api/admin/content/media/prune`, tối đa 50 key/lần.
- Chốt: **có** cho xóa hàng loạt nhưng chỉ với tệp mồ côi tại thời điểm xóa; máy chủ kiểm lại từng key, bỏ qua tệp có mục dùng.

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
- **Bản 5** (2026-10-27): **chốt P2a**. Push `db8b078` đưa web P2a lên production; audit production có 9 lần lưu đúng 9 dòng (chat, phòng, bảo trì + banner, hạn mức 30 → 1 → 30), `/config` trả đúng CORS + `Cache-Control`, admin chỉ gọi `GET /api/admin/overview` không token. Bundle production đã deploy được kiểm bằng cách chặn `/config`: banner "Thử bảo trì" hiện, nút phòng học và chat "Tạm tắt". Mục "30 → 35" để mở vì chưa có người dùng đạt hạn mức.
- **Bản 6** (2026-10-27): P2b xong phần code — worker admin thêm 5 endpoint (config GET/POST, check-key, provider-models, test), audit trước ghi, prompt không vào audit, key chỉ trả mặt nạ; shell thêm panel "Trợ lý chat" (Model + gen, Chain 1–5, Prompt, Hãng). 15 test DOM chạy trên `index.html`/`admin.js` thật; 501 test toàn repo xanh. Kiểm local với cấu hình thật qua `wrangler dev`, không ghi production.
- **Bản 7** (2026-10-27): chỉnh theo yêu cầu người dùng — **mục 1 chỉ để thử** (hãng + model + Thử, không lưu, có cả Cloudflare), bỏ khái niệm "model chính" và nút "Lưu model" khỏi UI; **mục 2 đổi thành "Thứ tự trả lời"**, bước 1 chạy trước và toàn quyền sắp xếp. Lý do: chat-proxy vốn chạy theo `cfg:chain`, `cfg:cfModel` chỉ để hiển thị.
- **Bản 8** (2026-10-27): xóa trang admin chat local. `src/app/admin/chat/` (93 KB, đọc/ghi `chat-admin-token` trong localStorage) đã xóa; tab "Quản Lý Chatbot" gỡ khỏi `AdminHeader` để không còn link chết; `AdminTab` còn `limits | studio`. `npx tsc --noEmit` sạch sau khi xóa `.next` (types cũ còn trỏ `admin/chat/page`); test `admin-header` 3/3 xanh.
- **Bản 9** (2026-10-28): rà soát lại tiến độ so với code — xác nhận P2.0 đã có `AbortSignal.timeout(4000)` và chặn log trùng 1 giờ, P2b đã có đủ 5 endpoint và panel, P2c/P2d chưa có dòng code nào; sửa dòng trạng thái và thứ tự "Lịch sử bản" bị lệch. Sửa môi trường test: Node 26 gắn `localStorage` toàn cục trả `undefined`, đè bản của happy-dom làm 13 test DOM fail → thêm shim `vitest.setup.ts` (Storage trong RAM) và đăng ký `setupFiles`; toàn bộ 505 test xanh. Sửa kèm nút icon ↑ ↓ ✕ trong mục "Thứ tự trả lời" bị dính mép trái.
- **Bản 10** (2026-10-28): **chốt P2b**. Khối "Thử model" in thêm `provider:model` lấy từ response của chat-proxy để nhìn ra hãng/model thật của lần gọi (`strict:true`, không rơi êm); test DOM thêm ca `Cloudflare:qwen3-30b`; sửa `localStorage` cho Node 26 bằng `vitest.setup.ts`; B5 tick kèm ghi chú "còn bấm lại trên production sau deploy". P2c chuyển sang bước soạn kế hoạch, chờ duyệt trước khi viết code.
- **Bản 11** (2026-10-28): viết kế hoạch chi tiết P2c — đếm lại catalog (40 cảnh / 20 âm / 49 nhạc, 114 đường dẫn media duy nhất), xác định 14 file đọc hằng catalog nên chỉ 3 hằng trong `study-types.ts` phải đổi nguồn; chốt cấu trúc bảng `content_manifest` (version + kind làm khóa chính), route công khai `GET /content` đặt trong data-api trước cửa kiểm token, rollback = tạo version mới, kiểm media bằng `R2.list()` theo tiền tố. Sáu quyết định kèm đề xuất đang chờ duyệt.
- **Bản 12** (2026-10-28): **đổi hướng P2c** theo yêu cầu — không dán file JSON nữa mà CRUD từng mục (cảnh / âm / nhạc) và quản lý luôn file media trong shell. Port quy tắc từ studio local (50 MB, video phải có ảnh xem trước, không ghi đè, xóa chừa file dùng chung), thêm bảng `content_manifest` giữ mọi lần lưu thành một phiên bản, thêm `hidden` để ẩn thay vì xóa, tab "Kho tệp" xem/xóa file mồ côi, upload có thanh tiến trình. Chia 2 đợt (đợt 1 CRUD mục + web đọc, đợt 2 upload). P2d thu hẹp còn phần hàng loạt. Bốn quyết định chờ duyệt.
- **Bản 13** (2026-10-28): chốt 4 quyết định P2c — Lưu là lên sóng ngay; có `hidden` (Ẩn/Hiện); **xóa mục tách hẳn khỏi xóa file** (xóa mục chỉ bỏ dòng, file dọn riêng ở tab Kho tệp vì một file có thể được nhiều mục dùng chung); chia 24 task nhỏ T1–T24 theo 4 mốc (dữ liệu/API → web đọc → giao diện → deploy) cộng đợt 2 upload/kho tệp.
- **Bản 14** (2026-10-28): **code xong đợt 1 P2c (T1–T19)**. Worker: `content.ts` (validate/chuẩn hoá/insert/update/delete/diff) + `_worker.ts` (`GET/POST/PATCH/DELETE /api/admin/content/items`, `versions`, `rollback`, `init`, audit trước ghi, 20 lần ghi/phút, đọc dung lượng R2 cache 60 giây); bảng `content_manifest` trong `workers/schema.sql` + bản dán tay `workers/content-schema.sql`. Web: data-api `GET /content` công khai (60 giây), `content-catalog.ts` thay 3 hằng ở `study-types.ts` (live binding, lọc `hidden`), hook `useContentCatalog` reload 1 lần/phiên. Admin shell: panel "Nội dung" 3 tab + form master/detail + khối Lịch sử + nút nạp bộ nội dung ban đầu, `admin-content.js` ~1.000 dòng, seed JSON được `build:admin` chép vào `dist-admin/admin/seed/`. Test: 82 ca mới, toàn bộ 587 ca xanh. Còn T20 (deploy) và đợt 2 T21–T24.
- **Bản 15** (2026-10-29): thêm **P2e — Báo cáo nội dung & chặn** (đọc/xử lý báo cáo AI + phòng, hạn chế AI/phòng) phục vụ Play P0.5; đặt trước P2d. Ghi rõ phụ thuộc P0.5 Phase 1, UI ở `admin-host/`, cảnh báo XSS khi render nội dung báo cáo, dọn báo cáo 180 ngày, và việc xóa tài khoản phải xóa reports/blocks/restrictions.
- **Bản 16** (2026-10-30): **E1–E3, E5 code xong.** `admin-worker/reports-api.ts` (list/detail/resolve/restrictions, audit trước ghi, rate limit 30/phút, dọn 180 ngày); shell `admin-host` thêm panel "Báo cáo" 6 cột + chi tiết text thuần + khóa AI/phòng; 7 ca API + 4 ca DOM, toàn bộ 628 test xanh. Chạy thử local: 2 báo cáo seed → resolve → còn 1 chờ xử lý. Còn E4 (chat-proxy/livekit đọc restrictions) và deploy.
- **Bản 17** (2026-10-30): tách panel Báo cáo khỏi file khổng lồ — HTML sang `admin-host/panels/reports.html`, CSS sang `admin-host/admin-reports.css`; `prepare-admin-bundle.mjs` mở rộng `<!-- include: ... -->` khi build và không publish thư mục `panels/`; test DOM dùng helper `loadAdminHtml()`. Không đổi hành vi, 628 test vẫn xanh.
- **Bản 18** (2026-10-30): tách toàn bộ shell — `index.html` còn ~187 dòng; thêm `panels/usage.html`, `panels/flags.html`, `panels/chat.html`, `panels/content.html`, `panels/diagnostics.html`; CSS chia `admin-usage/flags/chat/content/reports.css`; 3 test panel đổi sang `loadAdminHtml()`; bỏ 5 inline style tĩnh. 628 test vẫn xanh, admin local chạy đúng.
- **Bản 19** (2026-10-30): tách tiếp `admin.css` thành `admin.css` (nền, 147 dòng), `admin-topbar.css` (248), `admin-dashboard.css` (316), `admin-footer.css` (145). Tổng 9 file CSS, không file nào quá 320 dòng; link theo thứ tự base → topbar → dashboard → footer → panel. Build và kiểm local OK.
- **Bản 20** (2026-10-30): sắp xếp `admin-host/` thành `assets/`, `panels/`, `styles/`, `scripts/` và đổi tên file cho gọn (`styles/base.css`, `styles/chat.css`, `scripts/dashboard.js`, `scripts/chat.js`…). Build copy đúng cấu trúc, không publish `panels/`/`assets/`; vẫn copy favicon ra `/favicon.svg` và `/admin/favicon.svg`. Test DOM cập nhật đường dẫn; 207 test admin + 628 toàn bộ xanh.
- **Bản 21** (2026-11-09): rà tiến độ theo production. Đóng P2.0 mục 0.1 (không còn `livekit:unreachable` sau deploy; quét 30 ngày). Mục 0.2 vẫn để mở vì phát hiện `chat-proxy` có `logAdminError` riêng chưa khử trùng — còn 2 cặp `fallback_failed` trùng giờ (27–28/10). Đóng P2c đợt 1: T20 xong, `content_manifest` version 1 (3 dòng, 28/10) và `GET /content` trả 40/20/49; C7 bước 6 (sửa/xóa/rollback trên production) **chưa làm** vì chưa có version 2; đợt 2 T21–T24 vẫn chưa bắt đầu. Đóng P2e: E4 có hiệu lực trong `chat-proxy`/`livekit-rooms`, E6 và DoD đủ bằng chứng từ production (11 `report.resolve`, 4 `user.restrictions`, QA tay 2026-11-03). P2a vẫn để mở nhánh 30 → 35: `chat_usage` cao nhất 4 câu/người/ngày. Đối chiếu shell production cùng ngày (mục "Đối chiếu shell production 2026-11-09"): 6 tab đủ, Báo cáo 0 chờ / 4 tổng, Nội dung chỉ có v1, R2 127 tệp / 497,65 MB; phát hiện copy cứng "chỉ xem" ở ô tài khoản và footer (di sản P1) cần sửa.
- **Bản 22** (2026-11-10): **code + test xong P2c đợt 2 và đóng P2d.** Worker: `POST/GET/DELETE /api/admin/content/media` (5 thư mục cho phép, ≤ 50 MB, `Content-Length` chặn trước khi đọc, stream vào `R2.put`, không bao giờ ghi đè, audit trước khi ghi/xóa) + `POST /media/prune` (≤ 50 key/lần, kiểm lại từng key); `GET /media` trả `summary`/`folders`/`missing`/`orphanKeys` và cache danh sách R2 60 giây. UI: nút **Tải tệp lên** + thanh tiến trình trong cả 5 ô đường dẫn (cảnh, ảnh xem trước, âm, nhạc, bìa), tab **Kho tệp** thứ tư (lọc thư mục/tên/chỉ mồ côi, đang dùng bởi, tệp thiếu, xóa phải gõ đúng tên, dọn mồ côi hàng loạt). Test: +11 worker, +5 DOM; `npm test` 94 file / 758 test xanh, `tsc` + `lint` sạch. Chưa deploy; C7 bước 7 và bước 6 vẫn chờ kiểm trên production.
- **Bản 23** (2026-11-10): **xóa `/dev/studio` và code chỉ studio dùng** — trang studio, 2 route dev `api/admin/scenes` + `api/admin/sync`, `AdminHeader`/`AdminThemeContext` cũ và test `admin-header`; gỡ nút mở studio trong `SceneSelectorWidget`, cập nhật copy `hit-limits`/`SYSTEM_LIMITS` sang tab Nội dung + Kho tệp; `npm test` 93 file / 755 test xanh. Còn lại: `/dev/surface-lab` và `/dev/toasts` (trang thử, bị strip khỏi bản web).
- **Bản 24** (2026-11-10): **thay hộp thoại native bằng hộp thoại trong trang** ở panel Nội dung. Thêm module dùng chung `admin-host/scripts/dialogs.js` + `styles/dialogs.css` (`window.AdminDialog.confirm/prompt`, Promise, backdrop/Escape đóng, focus trap + trả focus, Enter gửi khi đã khớp, nút xóa chỉ bật khi gõ đúng tên tệp) và chuyển 7 điểm gọi `window.confirm`/`window.prompt` của `content.js` (bỏ thay đổi khi mở mục khác / đóng form / chuyển tab, xóa mục, xóa tệp, dọn mồ côi, rollback). Test DOM chạy `dialogs.js` + `content.js` thật, thêm ca Escape trả focus và ca hủy hộp thoại gõ tên; `npm test` 93 file / 757 test xanh. `chat.js`/`dashboard.js` vẫn dùng `confirm` native — chuyển sau nếu cần đồng bộ.
- **Bản 25** (2026-11-10): **đồng bộ hộp thoại cho toàn shell** — 5 chỗ `window.confirm` còn lại (`chat.js` ×4: xóa nhà cung cấp, lưu thứ tự, lưu câu lệnh, lưu nhà cung cấp; `dashboard.js` ×1: lưu cờ) chuyển sang `AdminDialog`; thêm `white-space: pre-line` cho mô tả/chi tiết để danh sách nhiều dòng không dồn thành một dòng. Test DOM chạy `dialogs.js` thật (thêm ca xóa nhà cung cấp có xác nhận); `npm test` 94 file / 764 test xanh, lint + tsc + `build:admin` sạch. Kiểm trên `wrangler dev`: hộp thoại lưu cờ và lưu thứ tự hiện đúng, hủy không ghi gì.
