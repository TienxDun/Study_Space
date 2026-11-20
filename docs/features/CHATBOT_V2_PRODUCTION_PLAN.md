# Chatbot v2 — kế hoạch DevOps & production

> Trạng thái 2026-11-03: **chưa bắt đầu, để sau**. Track này chỉ mở sau khi xong track sản phẩm (S4–S7) trong [CHATBOT_V2_PLAN.md](CHATBOT_V2_PLAN.md).
> Mục đích: biến bản dev dùng một người thành sản phẩm nhiều người dùng. Không mở cho người dùng thật trước khi qua P0–P3.

## 1. Kết luận

Bản S0–S3 là prototype chạy tốt cho một người, nhưng **chưa dùng chung được**: không có danh tính người dùng, không đo chi phí, phiên chỉ nằm trên máy, không có kiểm duyệt và báo cáo ngoài luồng, không có cổng vận hành (flag, kill switch, dashboard). Ba rủi ro lớn nhất khi mở công khai là **chi phí không giới hạn**, **dữ liệu người học mất khi đổi máy**, và **nội dung AI không có quy trình báo cáo** (vi phạm Google Play AI policy + Luật AI 134/2025).

Track sản phẩm (S4–S7) làm chatbot đủ hay trước; track này làm nó đủ an toàn và vận hành được.

## 2. Khoảng trống chặn production

| # | Khoảng trống | Hiện tại | Rủi ro | Phase |
|---|---|---|---|---|
| 1 | Danh tính | Worker chỉ so `X-Chat-V2-Token` dùng chung; không biết uid | Không thể quota; không chặn tài khoản đã xoá/bị hạn chế; lộ token là dùng được | P0 |
| 2 | Chi phí | Không có usage cho v2; client gửi tới ~23k token lịch sử mỗi lượt; fallback free→paid tự động | Một tài khoản có thể đốt ngân sách bằng lịch sử dài; không có trần ngày/tháng | P0 |
| 3 | Phiên | localStorage, 30 phiên/200 tin; ảnh base64 không lưu; snapshot D1 2MB không chứa nổi | Đổi máy mất dữ liệu; không học tiếp trên thiết bị khác; xoá tài khoản không xoá phiên v2 | P1 |
| 4 | An toàn | Chỉ có prompt; không moderation đầu ra; không nút báo cáo trong v2; `ageBand` lấy từ env | Rủi ro nội dung; không đáp ứng Play AI policy/AI Law; không có nhật ký xử lý | P2 |
| 5 | Vận hành | Route dev bị strip khỏi export; không flag/rollout; model 503 và timeout 60s; không dashboard lỗi/chi phí | Không tắt khẩn cấp được; không biết đang lỗi gì; không rollback | P3 |
| 6 | Sản phẩm | Key-tier picker là công cụ dev; danh mục 66 model với 50 model chưa kiểm/đang hỏng (bị khoá); chưa có PDF/OCR | Người dùng thật khó dùng; thiếu tính năng học tập cốt lõi | Sản phẩm S4–S7 |

## 3. Nguyên tắc production

- **Server là nguồn sự thật**: phiên, lịch sử, quota, usage nằm ở D1; client chỉ cache để vẽ nhanh.
- **Không tin client**: `ageBand`, lịch sử, model ngoài allowlist và kích thước body đều kiểm ở Worker.
- **Đo bằng token**: quota ngày tính cả prompt + completion + tóm tắt, không chỉ số tin.
- **Mọi tính năng AI có kill switch**, nhãn “AI” và đường báo cáo.
- **Không rollout 100%** trước khi qua gate P0–P3.

## 4. Kiến trúc đích

```text
Browser (src/features/chat-v2)
   │  Authorization: Bearer <Firebase ID token>
   │  POST /chat { sessionId, clientMessageId, message, attachments }
   ▼
Worker chat-v2
   ├─ verify token → uid + ageBand; chặn tài khoản đã xoá / bị hạn chế
   ├─ quota token & tin theo ngày, rate/phút, body caps
   ├─ đọc lịch sử phiên từ D1 (server giữ lịch sử, không tin client)
   ├─ trim + summary, moderation vào/ra, nhãn AI
   ├─ provider abstraction (motapis chính, provider dự phòng)
   └─ ghi message + usage/cost vào D1, log request-id (không nội dung)
   ▼
D1 zenspace: chat_v2_sessions / chat_v2_messages / chat_v2_usage
R2: ảnh đính kèm (ký URL khi đọc)
```

## 5. Các phase

| Phase | Thời lượng | Phạm vi chính | Gate (điều kiện qua) |
|---|---|---|---|
| **P0 — Danh tính & chi phí** | 4–5 ngày | Firebase ID token; chặn `deleted_accounts`/`user_restrictions`; quota token + tin theo UID; rate/phút và 1 stream/UID; body caps; allowlist model ở server; bỏ key-tier khỏi UI production | Không token → 401; quá hạn mức → 429 kèm thời điểm reset; admin thấy usage; không dùng được model ngoài allowlist |
| **P1 — Phiên & đồng bộ** | 6–8 ngày | Bảng D1 `chat_v2_sessions/messages`; API phiên phân trang; server tự dựng lịch sử (client chỉ gửi tin mới + `clientMessageId` idempotent); migrate phiên local lần đầu; tóm tắt chạy server-side; ảnh lên R2; xoá tài khoản xoá sạch v2 | Hai trình duyệt cùng tài khoản thấy cùng phiên; xoá tài khoản không còn dữ liệu v2; D1 không chứa base64 |
| **P2 — An toàn & tuân thủ** | 5–6 ngày | Moderation vào/ra + trả lời khủng hoảng (111/115/113); `ageBand` từ hồ sơ; nút báo cáo từng câu trả lời + hàng đợi admin; nhãn AI; retention, export/delete; bộ test red-team | Prompt tự hại nhận tài nguyên hỗ trợ; báo cáo hiện trong admin kèm snapshot; export/delete chạy đúng; bộ test an toàn xanh |
| **P3 — Vận hành & độ tin cậy** | 5–7 ngày | Provider abstraction + model dự phòng/circuit breaker; catalog cache + fallback tĩnh; cost accounting theo model + trần ngày/tháng + cảnh báo; log request-id/p95/lỗi 429/5xx; dashboard admin; deploy staging/prod + canary + rollback; load test 200 CCU | Tắt 1 model → tự chuyển model khác; chạm trần → dừng rõ ràng; dashboard có chi phí/lỗi; load test đạt |
| **P4 — Tích hợp & ra mắt** | 5–7 ngày | Gắn bản production vào app thật sau `chatV2Enabled` + rollout %; giữ chat cũ làm fallback; parity checklist; Capacitor origin/bàn phím/safe area; hồ sơ Play (AI disclosure, báo cáo, data safety); rollout 1%→10%→50%→100% | Flag off = 0 request; 100% dùng được; chi phí trong trần; không sự cố an toàn P0 |
| **P5 — Sau ra mắt** | liên tục | Đánh giá chất lượng (thumbs), bộ eval prompt, cập nhật model, tối ưu chi phí, job retention, quy trình xử lý báo cáo | Chỉ số chất lượng/chi phí ổn định theo tuần |

Tổng track production: **~25–33 ngày công** (một người, chưa tính P5). P1 và P3 có thể song song một phần nếu có thêm người.

## 6. Dữ liệu & lưu trữ

```sql
-- D1 zenspace, từ P1
chat_v2_sessions(id TEXT, uid TEXT, title TEXT, model_id TEXT, schema_version INT,
                 created_at INT, updated_at INT, deleted_at INT, summary_json TEXT,
                 PRIMARY KEY(uid, id));
CREATE INDEX idx_chat_v2_sessions_updated ON chat_v2_sessions(uid, updated_at DESC);

chat_v2_messages(id TEXT, uid TEXT, session_id TEXT, seq INT, role TEXT, text TEXT,
                 attachments_json TEXT, usage_json TEXT, created_at INT,
                 PRIMARY KEY(uid, session_id, id));
CREATE INDEX idx_chat_v2_messages_seq ON chat_v2_messages(uid, session_id, seq);

chat_v2_usage(uid TEXT, day TEXT, requests INT, prompt_tokens INT,
              completion_tokens INT, cost_micros INT, PRIMARY KEY(uid, day));
```

- Ảnh/file: R2 prefix `chat-v2/{uid}/{sessionId}/`, ký URL khi đọc; **không** lưu base64 trong D1.
- `chat_v2_usage` tách khỏi `chat_usage` của chat cũ để hạn mức/chi phí v2 không trộn với hạn mức chatbot hiện tại.
- Lưu trữ: phiên không hoạt động 180 ngày → xoá mềm, xoá cứng sau 30 ngày; ảnh 90 ngày; usage 400 ngày; log lỗi 30 ngày.
- Xoá tài khoản: xoá `chat_v2_*`, prefix R2 và các key `chatV2*` trong `clearLocalUserData`.

## 7. Hạn mức, chi phí, SLO

| Hạng | Tin/ngày | Token/ngày | Output tối đa | Model |
|---|---|---|---|---|
| Free (mặc định) | 20 | 40.000 | 2.048 | model rẻ trong allowlist |
| Paid (sau này) | theo gói | theo gói | 8.192 | mở model mạnh |

- **Trần ngân sách tháng** đặt ở Worker: vượt → 429 toàn hệ thống + banner admin, không để hoá đơn chạy tự do.
- Cảnh báo ở 60/80/100% ngân sách; dashboard theo model/ngày/UID.
- Rate: 6 request/phút/UID, 1 stream đồng thời/UID, body ≤1,5 MB.
- Timeout upstream 60s (giới hạn Worker): huỷ ở ~55s, báo “model chậm, thử lại hoặc đổi model”; ưu tiên model p95 < 20s.
- SLO: lỗi < 2%, p95 phản hồi đủ < 20s, availability 99,5%; stream lỗi giữa chừng phải có fallback non-stream hoặc retry rõ ràng.

## 8. Bảo mật & vận hành

- **Auth:** Worker xác thực Firebase ID token (dùng lại logic RS256 đã có ở `chat-proxy`/`data-api`); uid lấy từ token, không từ body. Dev token chỉ hoạt động khi `ENVIRONMENT=development`.
- **Chặn trước khi gọi provider:** `deleted_accounts`, `user_restrictions.ai_disabled`, flag `chatV2Enabled` + rollout, quota token/ngày, rate/phút, 1 stream/UID.
- **Body caps:** ≤80 tin, mỗi tin ≤20k ký tự, `summary` ≤6k, ≤3 ảnh (≤800 KB sau resize), ≤3 file text (≤20k ký tự/file), tổng body ≤1,5 MB.
- **Key:** `MOTAPIS_API_KEY` và `MOTAPIS_API_KEY_FREE` chỉ ở Worker secrets; xoay key định kỳ; không log key/nội dung.
- **Origin:** allowlist theo môi trường, gồm origin Capacitor; CORS không thay thế auth.
- **Log:** `requestId`, uid hash, model, token, latency, status, `promptVersion`, `ageBand`; **không** prompt/nội dung/ảnh.
- **Báo cáo AI:** mỗi câu trả lời có nút báo cáo; admin duyệt trong hàng đợi; có thể tắt AI cho một UID.
- **Deploy:** `wrangler.chat-v2.jsonc` khai `DB`, `FLAGS`, `R2`; tách staging/production; Workers Builds; canary + rollback.

## 9. Dùng lại hạ tầng đã có

- Xác thực Firebase: bản RS256 đã chạy trong `workers/chat-proxy` và `workers/data-api`.
- D1 `zenspace`: `deleted_accounts`, `user_restrictions`, `content_reports`, `user_blocks`.
- KV `CHAT_QUOTA` (`cfg:flags`) cho bật/tắt, rollout, hạn mức.
- Admin Worker + `admin-host/` cho dashboard, hàng đợi báo cáo, audit.
- R2 bucket `study-space` cho ảnh/file.
- `src/lib/delete-account.ts` + `DELETE /account` để mở rộng xoá dữ liệu v2.
- GoatCounter cho sự kiện không chứa nội dung.

Không dựng hệ thống song song; production dùng chung các thành phần trên.

## 10. Cần chốt trước khi làm P0

| # | Quyết định | Đề xuất |
|---|---|---|
| 1 | Phiên lưu ở đâu | D1 server-canonical; localStorage chỉ cache |
| 2 | Hạn mức free | 20 tin + 40k token/ngày |
| 3 | Provider khi ra mắt | Thêm 1 provider dự phòng cho 2–3 model chủ lực, không chỉ motapis |
| 4 | Lưu trữ | Phiên 180 ngày, ảnh 90 ngày |
| 5 | Mặt ra mắt | Giữ chat cũ làm fallback, rollout theo % |
| 6 | Trần ngân sách/tháng | Cần con số USD cụ thể để đặt hard cap |

## 11. Definition of Done

- `npm test`, `npx tsc --noEmit`, `npm run lint` xanh.
- Test mới cho phần vừa làm (auth, quota, retention, moderation…), có test chống hồi quy.
- Demo trên staging kèm số liệu chi phí/lỗi.
- Không có diff ở các file chatbot cũ, trừ P4.
