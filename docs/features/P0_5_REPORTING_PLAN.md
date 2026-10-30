# P0.5 — Báo cáo nội dung, chặn người dùng & an toàn AI (plan tổng quát)

> Trạng thái: **Phase 0–4 đã kiểm trên production; Phase 5 code xong, chờ dán `chat-proxy`; còn Phase 6–7**. Cập nhật: 2026-10-30
> Thuộc P0.5 trong [CHPLAY_LAUNCH_PLAN.md](../deployment/CHPLAY_LAUNCH_PLAN.md)
> Mục tiêu: đáp ứng chính sách **AI-Generated Content** và **User Generated Content** của Google Play trước khi nộp app.

## 1. Yêu cầu cần đáp ứng

| Chính sách Play | Yêu cầu | Việc cần làm |
|---|---|---|
| AI-Generated Content | Người dùng báo cáo/gắn cờ được nội dung AI xúc phạm; nhà phát triển phải xử lý | Nút báo cáo trên tin nhắn AI + nơi nhận/xử lý |
| User Generated Content | Có điều khoản rõ ràng, công cụ báo cáo nội dung, chức năng chặn người khác | Terms (đã có) + báo cáo/chặn trong phòng học |
| Target 13+ | Biện pháp an toàn phù hợp người chưa thành niên | Guardrail AI + xử lý báo cáo |

## 2. Phân tích hiện trạng

### 2.1. Chat AI
- UI tin nhắn: `src/components/study/chat/components/MessageList.tsx` — mỗi tin có hàng nút Copy / Lưu note / Làm lại / Tải về.
- Hook: `src/components/study/chat/hooks/useChatMessages.ts` — gọi `callChatApi`, lưu tin vào Firestore (`conversations/{uid}/sessions/{sid}/messages`).
- Type `Msg` đã có field `rating?: 1 | -1` nhưng **không có UI nào ghi giá trị này** → có thể bỏ hoặc dùng làm tín hiệu phụ; không thay thế được nút báo cáo.
- Backend AI: `workers/chat-proxy/worker.js` — xác thực Firebase token, D1 (bảng `chat_usage`), KV quota, không có endpoint báo cáo.

### 2.2. Phòng học nhóm
- UI: `src/components/study/rooms/components/StudyRoomView.tsx` — tile người tham gia đã có menu host (mute/kick/co-host). Chưa có menu cho thành viên thường để báo cáo/chặn.
- Identity LiveKit = `user-{uid}`; tên phòng/host nằm ở D1 `meet_rooms`, phiên ở `meet_sessions` (có `identity`, `display_name`, `left_at`).
- Backend: `workers/livekit-rooms/worker.js` — `/token` xác thực, kiểm tra phòng/mật khẩu/quota, gọi Twirp `ListParticipants`; có `/rooms/:room/(lock|password|kick|mute)`; D1 `meet_audit_logs` để ghi thao tác host. Chưa có báo cáo/chặn.

### 2.3. Backend & admin
- `workers/data-api/worker.js` — D1, xác thực Firebase token, đã có `DELETE /account`. **Chưa có endpoint báo cáo/chặn.**
- `admin-worker/` + `admin-host/` — admin console chạy sau Cloudflare Access; `admin-host/scripts/dashboard.js` (tracked) là UI thật đang deploy. `src/app/admin/` là bản local, **bị gitignore**, không dùng để build bản deploy.
- D1 dùng chung: `user_data`, `chat_usage`, `meet_*`, `admin_audit`, `admin_error_log`, `content_manifest`.
- Xóa tài khoản: `deleteAccountData()` trong data-api hiện xóa `user_data`, `chat_usage`, `meet_*` — **sẽ phải xóa thêm báo cáo/chặn**.

### 2.4. Pháp lý
- `/privacy` và `/terms` đã có; terms mục 7 đã mô tả báo cáo qua email/công cụ trong app.
- Privacy chưa mô tả dữ liệu báo cáo (nội dung bị báo cáo, lý do, UID) và thời hạn lưu.
- Bảng Data Safety trong plan CH Play chưa có dòng dữ liệu báo cáo.

### 2.5. Khoảng trống tóm tắt
1. Chưa có bảng/API lưu báo cáo.
2. Chưa có nút báo cáo AI.
3. Chưa có báo cáo/chặn trong phòng.
4. Chưa có nơi admin xem và xử lý báo cáo.
5. Chưa có biện pháp chặn hiệu lực ở server.
6. Chưa có guardrail AI cho 13+.
7. Privacy/Data Safety chưa cập nhật.

## 3. Kiến trúc đề xuất

**Gom một đầu ghi dữ liệu:** cả báo cáo AI và báo cáo phòng đều gửi về `data-api` (đã có xác thực Firebase + D1 + nằm trong luồng xóa tài khoản).

```text
Chat UI ──POST /report──┐
                        ├──> data-api (D1: content_reports, user_blocks)
Room UI ──POST /report──┤            │
        ──POST /blocks──┘            │
                                     ├──> admin-worker /api/admin/reports ──> admin-host
                                     │
LiveKit /token ──đọc user_blocks─────┘  (chặn vào chung phòng)
Chat proxy /chat ──đọc user_restrictions (khóa AI nếu admin xử lý)
```

Lý do chọn data-api:
- Đã xác thực token, đã có D1, đã có luồng xóa dữ liệu tài khoản.
- Không phải sửa 2 Worker cho phần ghi báo cáo.
- LiveKit worker chỉ cần **đọc** bảng `user_blocks` khi cấp token.

## 4. Mô hình dữ liệu (D1)

```sql
CREATE TABLE content_reports (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- 'ai' | 'room'
  reporter_uid TEXT NOT NULL,
  reporter_name TEXT,                -- tên hiển thị lúc gửi (admin đọc thay UID)
  target_uid TEXT,                   -- người bị báo cáo (phòng) / null (AI)
  target_name TEXT,
  room TEXT,
  session_id TEXT,                   -- phiên chat
  message_id TEXT,                   -- tin nhắn AI
  question TEXT,                     -- câu hỏi dẫn tới câu trả lời AI
  content TEXT,                      -- nội dung bị báo cáo (AI) hoặc mô tả
  reason TEXT NOT NULL,              -- mã lý do
  detail TEXT,                       -- ghi chú thêm
  status TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  resolution_note TEXT
);
CREATE INDEX idx_reports_status_created ON content_reports (status, created_at DESC);

CREATE TABLE user_blocks (
  blocker_uid TEXT NOT NULL,
  blocked_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_uid, blocked_uid)
);

-- Khuyến nghị: công cụ xử lý thật sự cho admin
CREATE TABLE user_restrictions (
  uid TEXT PRIMARY KEY,
  ai_disabled INTEGER NOT NULL DEFAULT 0,
  rooms_disabled INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
```

Thời hạn lưu đề xuất:
- Báo cáo: **180 ngày** (đủ để xử lý/khiếu nại), sau đó tự xóa khi ghi/đọc mới.
- Chặn: đến khi người dùng bỏ chặn hoặc xóa tài khoản.
- Hạn chế do admin đặt: đến khi admin gỡ.

## 5. Hợp đồng API

### data-api
| Method | Path | Nội dung |
|---|---|---|
| POST | `/report` | `{ source, sessionId?, messageId?, question?, content?, targetUid?, room?, reason, detail? }`; `question` ≤2000 ký tự, chỉ dùng cho `source: "ai"`; giới hạn ~10 báo cáo/ngày/UID |
| GET | `/blocks` | Danh sách UID đã chặn |
| POST | `/blocks` | `{ targetUid }` — chặn |
| DELETE | `/blocks/:uid` | Bỏ chặn |

Tất cả yêu cầu Firebase ID token; kiểm tra UID không báo cáo/chặn chính mình; chuẩn hóa `reason` theo danh sách cố định.

### livekit-rooms
- Trong `/token`, sau khi xác định phòng/host: từ chối nếu cặp (người vào, host) hoặc (người vào, người đang trong phòng) nằm trong `user_blocks` (một trong hai chiều). Trả `403 BLOCKED`.
- Đọc `user_restrictions.rooms_disabled` → `403 RESTRICTED`.
- Khi người dùng bấm chặn trong phòng: client gọi data-api rồi **tự rời phòng**; lần vào sau bị chặn ở server.

### admin-worker
| Method | Path | Nội dung |
|---|---|---|
| GET | `/api/admin/reports?status=&source=` | Danh sách + tổng hợp |
| POST | `/api/admin/reports/:id/resolve` | `{ status: resolved|dismissed, note }` |
| POST | `/api/admin/users/:uid/restrictions` | `{ aiDisabled?, roomsDisabled?, note }` |
| GET | `/api/admin/users/:uid/restrictions` | Xem hạn chế |

Mọi thao tác ghi vào `admin_audit`.

## 6. Thay đổi UI

1. **Chat (desktop + mobile dùng chung `StudyChatWidget`)**
   - Thêm nút cờ “Báo cáo câu trả lời” cạnh Copy/Lưu/Tải về (chỉ tin assistant).
   - Dialog chọn lý do + ghi chú (tùy chọn) → gửi → toast “Đã gửi báo cáo”.
   - Không tự xóa tin; có thể thêm nút “Ẩn câu trả lời này” (local) nếu muốn.
2. **Phòng học**
   - Menu trên tile người khác: “Báo cáo” + “Chặn”.
   - Báo cáo: dialog lý do; gửi kèm room + target identity.
   - Chặn: xác nhận → gọi API → rời phòng (nếu đang chung) + toast giải thích.
   - Danh sách chặn: xem/bỏ chặn ở đâu? Đề xuất thêm mục nhỏ trong Cài đặt/“Thêm”.
3. **Admin**
   - Thêm mục “Báo cáo” trong `admin-host/panels/reports.html` + `admin-host/scripts/reports.js`: bảng lọc theo trạng thái/nguồn, xem chi tiết, đánh dấu đã xử lý/bỏ qua, ghi chú, tùy chọn khóa AI/phòng của người bị báo cáo.

## 7. Thứ tự thực hiện (quan trọng)

### Phase 0 — Chốt quyết định (0.5 ngày) — xong 2026-10-29
- [x] Chặn 2 chiều việc vào chung phòng; đang chung thì tự rời.
- [x] Lưu báo cáo 180 ngày.
- [x] Admin resolve/dismiss + ghi chú + tùy chọn khóa AI/phòng.
- [x] Danh sách lý do cố định cho AI và phòng.
- [x] MVP chưa thông báo ngược cho người báo cáo.
- [x] Bỏ chặn trong Cài đặt/“Thêm”.

### Phase 1 — Nền tảng dữ liệu & API (1–1.5 ngày) — code xong 2026-10-29
- [x] Thêm bảng vào `workers/schema.sql` + bản dán tay `workers/report-schema.sql`: `content_reports`, `user_blocks`, `user_restrictions` + index.
- [x] Thêm `/report`, `/blocks` vào `data-api`: xác thực Firebase token, validate source/reason/room/target, chặn tự báo cáo/chặn mình, giới hạn 10 báo cáo/ngày/UID, dọn báo cáo > 180 ngày.
- [x] Cập nhật `deleteAccountData()` xóa `content_reports`, `user_blocks`, `user_restrictions`.
- [x] Test: 7 ca endpoint mới + mở rộng test xóa tài khoản; toàn bộ 617 test xanh, `tsc`/`lint` sạch.
- [x] Deploy Phase 1: chạy `report-schema.sql` trên D1 `zenspace`, dán `data-api` mới, gọi thử bằng token thật.
  - Kiểm 2026-10-30: D1 `zenspace` có đủ 3 bảng; `POST /report` và `GET /blocks` trả **401** (route sống, chưa có token) — chưa gọi bằng token thật.
- **Điều kiện xong:** gọi API bằng token thật tạo được báo cáo/chặn; không token trả 401; xóa tài khoản xóa sạch.

### Phase 2 — Admin nhận & xử lý báo cáo (1 ngày) — code xong 2026-10-30
- [x] API admin: `GET /api/admin/reports` (lọc trạng thái/nguồn, phân trang, đếm), `GET /api/admin/reports/:id`, `POST /api/admin/reports/:id/resolve`, `GET/POST /api/admin/users/:uid/restrictions`; audit trước ghi.
- [x] Shell “Báo cáo” trong `admin-host/`: bảng 6 cột, lọc, chi tiết (render text thuần), resolve/dismiss + ghi chú, khối khóa AI/phòng.
- [x] Test: 6 ca API + 4 ca DOM; toàn bộ 627 test xanh, `tsc`/`lint` sạch.
- [x] Chạy thử local: 2 báo cáo seed → resolve → danh sách còn 1 chờ xử lý; không lỗi console.
- [x] Deploy admin: `npm run build:admin` + wrangler (sau khi D1 + data-api Phase 1 lên).
  - Kiểm 2026-10-30: worker version `2ff4e780` (2026-10-30T04:33Z) mang `reports-api.ts`; bảng `content_reports` còn 0 dòng.
- **Điều kiện xong:** báo cáo seed hiện trong admin, xử lý xong đổi trạng thái.

### Phase 3 — Báo cáo AI (1 ngày) — code xong 2026-10-30
- [x] Nút “Báo cáo câu trả lời” trên mọi tin của trợ lý (`MessageList`), đổi sang dấu ✓ khóa sau khi gửi.
- [x] Dialog `ReportAnswerDialog`: xem trước câu trả lời, 5 lý do cố định khớp `REPORT_REASONS.ai`, ghi chú ≤500, Esc/bấm ngoài để đóng, chặn đóng nhầm khung chat.
- [x] `src/lib/content-reports.ts` gọi `POST /report` (source `ai`, kèm `sessionId` + `messageId`), xử lý 401/429/mạng bằng toast.
- [x] Gắn ở cả chat desktop (`StudyChatWidget`) và mobile (`MobileChatSheet`).
- [x] Test: 8 ca mới (`report-ai-answer.test.tsx`), toàn bộ 640 test xanh, `tsc` sạch, `lint` 0 lỗi.
- [x] Kiểm giao diện thật ở `/dev/report-check` (trang nháp đã xoá): nút cờ, dialog, trạng thái chọn lý do, toast lỗi.
- [x] Lưu thêm câu hỏi của người dùng (cột `question`, 2026-10-30): `MessageList` lấy tin người dùng gần nhất trước câu trả lời, data-api lưu ≤2000 ký tự, panel Báo cáo hiện khối “Câu hỏi của người dùng” và dòng “Ghi chú của người báo cáo”.
  - D1 `zenspace`: đã chạy `ALTER TABLE content_reports ADD COLUMN question TEXT` (2026-10-30), cột tồn tại trên production.
  - Còn lại: dán `workers/data-api/worker.js` mới trong dashboard; bản cũ bỏ qua trường `question` nên không lỗi, chỉ chưa lưu.
- [x] Thử end-to-end bằng tài khoản thật: báo cáo AI xuất hiện trong tab Báo cáo kèm câu trả lời, câu hỏi, ghi chú.
- **Điều kiện xong:** báo cáo từ app xuất hiện trong admin kèm nội dung tin.

### Phase 4 — Báo cáo & chặn trong phòng (2 ngày) — code xong 2026-10-30
- [x] Menu “⋮” trên tile thành viên khác (desktop `StudyRoomView`, mobile `MobileRoomView`): `MemberSafetyMenu` với hai lựa chọn Báo cáo / Chặn; dialog xác nhận chặn giải thích hậu quả.
- [x] `RoomReportDialog`: 5 lý do phòng (`harassment|inappropriate|recording|spam|other`), ghi chú ≤500, gửi `POST /report` source `room` kèm `room` + `targetUid`.
- [x] Chặn: `POST /blocks` rồi tự rời phòng hiện tại (`room.disconnect()` + `onLeave`), toast giải thích, id toast `block-notice`.
- [x] Server chặn 2 chiều trong `livekit-rooms /token`: 403 `BLOCKED` khi người vào và host/người đang trong phòng chặn nhau (một trong hai chiều); host/phó phòng bỏ qua kiểm tra để vào phòng của mình. Danh sách người trong phòng lấy từ `ListParticipants` (fail-open nếu Twirp lỗi).
- [x] Hạn chế từ admin: `livekit-rooms /token` trả 403 `RESTRICTED` khi `user_restrictions.rooms_disabled=1`; `chat-proxy /chat` trả 403 `AI_RESTRICTED` khi `ai_disabled=1`, chặn trước khi trừ lượt.
- [x] Tên người dùng trong admin: báo cáo lưu `reporter_name` và `target_name` (≤30 ký tự, gửi từ web lúc báo cáo); panel hiện tên ở cả danh sách (“Tên → Tên”) và chi tiết, rê chuột thấy UID. Dữ liệu cũ chưa có tên thì lùi về UID rút gọn. Đã chạy `ALTER TABLE content_reports ADD COLUMN reporter_name TEXT; ... target_name TEXT` trên D1 `zenspace` (2026-10-30).
- [x] Danh sách chặn: `BlockedUsersSection` trong Cài đặt (desktop + mobile sheet), đọc `GET /blocks`, bỏ chặn `DELETE /blocks/:uid`. Hiện **tên** người bị chặn (cột `user_blocks.blocked_name`, lưu lúc chặn, ≤30 ký tự); dữ liệu cũ không có tên thì hiện UID rút gọn. Đã chạy `ALTER TABLE user_blocks ADD COLUMN blocked_name TEXT` trên D1 `zenspace` (2026-10-30).
- [x] Helper dùng chung `src/lib/user-blocks.ts` (báo cáo phòng, chặn, bỏ chặn, danh sách).
- [x] Test: 6 ca `/token` (`meet-block-restrictions.test.ts`), 3 ca chat-proxy (`chat-proxy-restrictions.test.ts`), 4 ca UI (`room-safety.test.tsx`); tổng 659 test xanh, `tsc` sạch, `lint` 0 lỗi. Kiểm giao diện ở `/dev/safety-check` (trang nháp đã xoá).
- [x] Deploy `968bce8`: web lên Pages; đã dán `livekit-rooms`, `chat-proxy`, `data-api` trong dashboard.
- [x] Thử 2 tài khoản A/B trên production: người dùng xác nhận báo cáo/chặn chạy đúng; báo cáo phòng hiện ở tab Báo cáo kèm tên hai bên (dòng `Nhật Duy → leutiendung`).
- **Điều kiện xong:** 2 tài khoản A/B: A chặn B → không vào chung phòng; báo cáo hiện trong admin.

### Phase 5 — Guardrail AI cho 13+ (1–1.5 ngày) — code xong 2026-10-30
- [x] Prompt an toàn cố định (`SAFETY_PREFIX`) luôn ghép **trước** prompt admin trong `toMessages`, nên sửa prompt ở admin không gỡ được quy tắc.
- [x] Admin đọc được quy tắc: chat-proxy trả `safetyPrompt` trong `/models` (kênh admin), admin-worker chuyển tiếp trong `GET /api/admin/chat/config`, panel "Trợ lý chat" → mục 3 hiện khối **"Quy tắc an toàn (cố định)"** chỉ-đọc ngay trên ô câu lệnh, kèm ghi chú sửa trong mã chat-proxy. Chưa dán chat-proxy bản mới thì khối hiện "Chưa đọc được quy tắc an toàn." là đúng.
- [x] Lọc đầu vào (`screenSafety`) theo 5 nhóm: `self_harm`, `violence`, `drugs`, `sexual`, `personal`. Câu vi phạm được trả lời an toàn ngay (`blocked: true`), **không gọi AI, không trừ lượt**.
- [x] Lọc đầu ra: model lỡ sinh hướng dẫn nguy hiểm thì thay bằng câu an toàn cùng nhóm, có `console.warn` mã nhóm (không log nội dung).
- [x] Cách tính lượt (chốt 2026-10-30): chỉ **kiểm tra** hạn mức trước khi gọi; bộ đếm tăng **sau khi AI trả lời được**. Câu bị guardrail chặn hoặc mọi nhà cung cấp lỗi đều không bị tính. Đổi lại, nhiều tab gửi song song có thể vượt hạn mức ngày vài lượt.
- [x] Tránh chặn oan: mẫu yêu cầu cụm xin hướng dẫn (“cách/làm sao/hướng dẫn…”), biên Unicode thay `` (từ có dấu), miễn trừ ngữ cảnh trò chơi cho nhóm súng/vũ khí; “từ từ”, “tự tử trong văn học”, “cách mạng công nghiệp” đi qua bình thường.
- [x] Câu trấn an tự hại có hotline 111 (bảo vệ trẻ em) và 115 (cấp cứu).
- [x] Test: 23 ca (`src/__tests__/unit/admin/chat-proxy-guardrail.test.ts`) gồm bộ câu thử 4 nhóm, câu học tập không bị chặn oan, prompt an toàn, chặn đầu vào ở `/chat` không trừ lượt; tổng 682 test xanh, `tsc` sạch, `lint` 0 lỗi.
- [ ] Deploy: dán `workers/chat-proxy/worker.js` (Worker dán tay) rồi thử vài câu trong bộ test trên production.
- **Giới hạn đã biết:** so khớp mẫu từ khóa (không phải phân loại ngữ nghĩa) nên có thể lọt câu diễn đạt lạ và chặn nhầm câu hiếm; câu **không dấu** (“cach che tao bom”) chưa được phủ để tránh nhầm “tu tu” với “từ từ”.
- **Điều kiện xong:** các câu thử bị từ chối/làm nhẹ đúng; câu học tập bình thường không bị chặn oan.

### Phase 6 — Đồng bộ pháp lý (0.5 ngày)
- `/privacy`: dữ liệu báo cáo/chặn, mục đích, thời hạn 180 ngày, chỉ admin truy cập.
- Data Safety: thêm dòng dữ liệu báo cáo; giữ nhất quán với privacy.
- Terms: cập nhật câu “công cụ báo cáo trong ứng dụng” (đã có) + mô tả chặn.

### Phase 7 — QA & bằng chứng cho Play (0.5–1 ngày)
- Test hồi quy chat/phòng/xóa tài khoản.
- Chụp màn hình nút báo cáo/chặn + admin xử lý để đối chiếu khi Play hỏi.
- Cập nhật plan CH Play, đánh dấu P0.5 xong.

**Tổng ước lượng:** ~7–8 ngày làm việc, chưa tính deploy/chờ duyệt.

Vì sao thứ tự này:
- Admin có trước nút báo cáo → tránh “báo cáo xong không ai xử lý” (Play đánh giá cả quy trình).
- AI trước phòng → luồng nhỏ, xác nhận toàn tuyến; phòng chạm LiveKit + test 2 tài khoản nên để sau.
- Guardrail sau báo cáo → độc lập, nhưng phải xong trước khi khai “an toàn cho 13+”.
- Pháp lý sau cùng → chốt đúng dữ liệu/thời hạn thực tế, tránh sửa privacy 2 lần.

## 8. Kiểm thử

- Unit: auth 401, validate reason, giới hạn 10/ngày, chặn tự mình, xóa tài khoản xóa reports/blocks.
- Chat: gửi báo cáo desktop + mobile; báo cáo tin cũ; mất mạng (toast lỗi, không mất nội dung).
- Phòng: 2 tài khoản; host/member; chặn trước khi vào, chặn khi đang chung; bỏ chặn.
- Admin: lọc, resolve, dismiss, audit log; tài khoản không có Access bị chặn.
- AI: bộ prompt an toàn; không chặn oan câu hỏi học tập.
- Hồi quy: xóa tài khoản vẫn thành công sau khi thêm bảng.

## 9. Rủi ro & lưu ý

- **Admin deploy:** sửa `admin-host/` (tracked), không sửa `src/app/admin/` (gitignored). Deploy bằng `npm run build:admin` + wrangler.
- **Worker deploy thủ công:** data-api/livekit/chat-proxy đang được dán code trên dashboard; cần thứ tự: schema → data-api → livekit → admin.
- **Xóa tài khoản:** quên cập nhật `deleteAccountData` sẽ để lại báo cáo/chặn → vi phạm chính sách xóa dữ liệu.
- **Chặn khi đang chung phòng:** server chỉ chặn lần vào sau; cần client tự rời + có thể host kick.
- **Rate limit báo cáo:** tránh spam làm ngập admin; 10/ngày/UID là mức đề xuất.
- **Dữ liệu báo cáo chứa nội dung người dùng:** admin đọc được → phải ghi rõ trong privacy.
- **AI guardrail:** lọc từ khóa có thể chặn oan; cần bộ test và câu từ chối trung tính.

## 10. Quyết định đã chốt (2026-10-29)

| # | Vấn đề | Đã chốt |
|---|---|---|
| 1 | Chặn hoạt động thế nào | Chặn 2 chiều việc vào chung phòng; đang chung thì tự rời |
| 2 | Lưu báo cáo bao lâu | 180 ngày |
| 3 | Admin xử lý | Resolve/dismiss + ghi chú + tùy chọn khóa AI/phòng |
| 4 | Lý do báo cáo | AI: sai lệch, không phù hợp, nguy hiểm, quấy rối, khác. Phòng: quấy rối, không phù hợp, ghi âm trái phép, spam/mạo danh, khác |
| 5 | Có thông báo ngược cho người báo cáo | Không ở MVP |
| 6 | Bỏ chặn ở đâu | Mục nhỏ trong Cài đặt/“Thêm” |

## 11. Ngoài phạm vi (làm sau nếu cần)

- Ban toàn hệ thống, cơ chế khiếu nại/phúc khảo.
- Gửi email thông báo kết quả xử lý.
- Moderation bằng model AI thay vì lọc từ khóa.
- Ghi âm/ghi hình phòng học (hiện không có và không nên thêm).
