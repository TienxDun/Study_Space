# Hạn mức hệ thống ZenStudy

> Sinh tự động từ `src/data/admin/hit-limits.ts` — đừng sửa tay. Chạy `npm run gen:limits` sau khi đổi hạn mức.
> Cập nhật: 2026-10-26 · 16 mục.

## Tổng quan

| Dịch vụ | Thành phần | Gói | Ngưỡng chính | Mức độ |
|---|---|---|---|---|
| Cloudflare Workers AI | Chatbot AI Trợ lý Học tập (Llama-3.1-8b-instruct, v.v.) | Free Tier (Workers AI Free Allocation) | Rate Limit (Phút): 300 requests / phút; Hạn mức (Ngày): 10,000 Neurons / ngày; Timeout phản hồi: 60 giây | Cảnh báo |
| ZenStudy Chat Proxy (bộ đếm D1) | Hạn mức hỏi AI của mỗi người (USER_DAILY_LIMIT) | Cấu hình Worker (mặc định 30) | Số câu / người / ngày: 30 câu (USER_DAILY_LIMIT); Dòng D1 ghi mỗi câu: 1 dòng (chat_usage); Thời điểm reset: 00:00 giờ Thái Bình Dương | Cảnh báo |
| Groq Cloud | Model Suy luận Nâng cao (Llama-3.3-70b-versatile) | Free Developer Tier | Requests/phút (RPM): 30 RPM; Requests/ngày (RPD): 1,000 RPD; Tokens/phút (TPM): 12,000 TPM; Tokens/ngày (TPD): 100,000 TPD | Cảnh báo |
| Groq Cloud | Model Phản hồi Siêu tốc (Llama-3.1-8b-instant) | Free Developer Tier | Requests/phút (RPM): 30 RPM; Requests/ngày (RPD): 14,400 RPD; Tokens/phút (TPM): 6,000 TPM; Tokens/ngày (TPD): 500,000 TPD | Tham khảo |
| Cloudflare Workers (Workers Free) | 2 Worker: data-api (đồng bộ) + chat-proxy (chat AI) | Workers Free | Request / ngày (toàn tài khoản): 100,000; CPU time / request: 10 ms (Free); Subrequest / request: 50; Kích thước script: 64 MiB | Nghiêm trọng |
| Cloudflare D1 (database zenspace) | Đồng bộ ghi chú/kanban/cài đặt + bộ đếm chat + lịch sử tập trung | Workers Free (D1 free tier) | Dòng đọc / ngày: 5,000,000; Dòng ghi / ngày: 100,000; Dung lượng tổng: 5 GB (mỗi DB tối đa 500 MB); Query / lượt gọi worker: 50 (Free) | Nghiêm trọng |
| Cloudflare Workers KV | Đường lùi của bộ đếm câu chat khi chat-proxy thiếu binding D1 | Workers Free (KV free tier) | Lượt đọc / ngày: 100,000; Lượt ghi / ngày (key khác nhau): 1,000; Ghi cùng một key: 1 lần/giây; Dung lượng: 1 GB | Cảnh báo |
| Cloudflare R2 | Kho Lưu trữ Bối cảnh (Video MP4 & Ảnh nền 4K) | Free Tier (Hàng tháng) | Dung lượng lưu trữ: 10 GB miễn phí / tháng; Băng thông tải về (Egress): 0$ Không giới hạn; Kích thước 1 file tối đa: 5 GB / lần PUT (multipart tới 5 TB) | Cảnh báo |
| Cloudflare R2 | Thao tác Quản trị & Đồng bộ Kho mạng (Upload/Sync Script) | Free Tier | Class A (Ghi / List): 1,000,000 requests / tháng; Class B (Đọc / Head): 10,000,000 requests / tháng | Tham khảo |
| LiveKit Cloud | Phòng Học Nhóm Âm thanh & Màn hình Trực tuyến | Build (Miễn phí) | Phút WebRTC (ngưỡng chặn): 4,500 phút / tháng (Plan 5,000); Sức chứa tối đa / phòng: 6 người / phòng (MAX_ROOM_PARTICIPANTS); Dữ liệu tải xuống (Downstream): 50 GB / tháng; Người kết nối đồng thời: Tối đa 100 người; Thời lượng phiên học tối đa: 120 phút / phiên (SESSION_MAX_MINUTES) | Nghiêm trọng |
| Trình duyệt Client (LocalStorage) | Lưu trữ Trạng thái Học tập (Kanban, Multi-Notes, Cài đặt, Yêu thích) | Client Hardware / Origin Sandbox | Safari iOS / WebKit: ~5 MB / origin; Desktop Chrome / Firefox: ~10 MB / origin | Nghiêm trọng |
| IndexedDB (StudySpaceChatMediaDB) | Ảnh gốc Full HD của chat (bộ nhớ đệm cục bộ) | Browser Storage Quota | Kích thước mỗi ảnh: Tối đa 7 MB; Số ảnh lưu trữ: Không giới hạn (theo hạn mức trình duyệt); Hạn mức trình duyệt: Chia theo dung lượng đĩa trống, thường vài trăm MB - vài GB | Cảnh báo |
| ZenStudy Focus Storage Engine | Nhật ký Lịch sử Tập trung & Thống kê Pomodoro (src/lib/focus-sessions.ts) | Quy chuẩn mã nguồn ZenStudy | Số phiên lưu trữ tối đa: 2,000 phiên học; Dung lượng ước tính: ~300 KB - 500 KB JSON | Tham khảo |
| Google YouTube / Spotify Web Player | Đài phát Nhạc Lofi & Âm thanh Tự nhiên (Embed Widgets) | IFrame Client Playback | Browser Autoplay Policy: Cần click tương tác trước khi phát âm thanh; Spotify Free Preview: Giới hạn 30 giây nếu chưa đăng nhập Spotify; YouTube Quota API v3: 0 units (Không tiêu hao) | Tham khảo |
| Google Firebase (Spark Plan) | Đồng bộ Tài khoản & Lưu trữ Đám mây Cá nhân (Tùy chọn) | Spark Plan (Miễn phí) | Lượt đọc (Document Reads): 50,000 reads / ngày; Lượt ghi (Document Writes): 20,000 writes / ngày; Lượt xóa (Document Deletes): 20,000 deletes / ngày; Dung lượng Firestore: 1 GiB miễn phí; Băng thông ra (Egress): 10 GiB / tháng; Kích thước 1 document: 1 MiB | Tham khảo |
| Firebase Authentication (Spark Plan) | Đăng nhập Email/Mật khẩu & Google cho tài khoản học tập | Spark Plan (Miễn phí) | Người dùng hoạt động / tháng: 50,000 MAU; SAML/OIDC (không dùng): 50 MAU | Tham khảo |

## AI & Chat

### Cloudflare Workers AI — Chatbot AI Trợ lý Học tập (Llama-3.1-8b-instruct, v.v.)

- **Mức độ:** Cảnh báo
- **Gói hiện tại:** Free Tier (Workers AI Free Allocation)
- **Hạn mức:** 10,000 Neurons / ngày (~100 - 300 câu hỏi tùy độ dài prompt và context).
- **Ngưỡng:** Rate Limit (Phút) — 300 requests / phút; Hạn mức (Ngày) — 10,000 Neurons / ngày; Timeout phản hồi — 60 giây
- **Dấu hiệu chạm trần:** API trả về mã lỗi HTTP 429 Too Many Requests.; Trạng thái telemetry của server kích hoạt cờ cooling: true.; Chatbot thông báo 'Đang làm mát hệ thống' hoặc tạm ngưng nếu không có fallback.
- **Mã lỗi:** `HTTP 429 / cooling: true`
- **Cơ chế dự phòng:** Cơ chế Multi-Provider Failover Chain tự động nhảy sang nhà cung cấp dự phòng tiếp theo (Groq Cloud hoặc OpenRouter) mà người học không nhận thấy gián đoạn.
- **Cách xử lý:** Theo dõi số neurons thật trên Cloudflare Dashboard → Workers AI → Usage. ZenStudy không tự đếm neurons nữa vì ước lượng dễ sai; khi sát hạn mức thì đẩy Groq lên đầu chuỗi hoặc giảm Max Output Tokens. Hạn mức tự reset lúc 00:00 UTC (07:00 sáng VN).
- **Chu kỳ reset:** 00:00 UTC hàng ngày (07:00 giờ VN)
- **Tài liệu:** https://developers.cloudflare.com/workers-ai/platform/pricing/
- **Các bước kiểm tra:**
  1. Mở Cloudflare Dashboard → Workers AI → Usage để xem neurons đã dùng trong ngày.
  2. Xác nhận provider dự phòng (Groq) có API key hợp lệ và đang ở trạng thái Enabled.
  3. Nếu hết 10,000 Neurons trong ngày, đẩy Groq lên đầu chuỗi Chain Entry cho đến 07:00 sáng hôm sau.

### ZenStudy Chat Proxy (bộ đếm D1) — Hạn mức hỏi AI của mỗi người (USER_DAILY_LIMIT)

- **Mức độ:** Cảnh báo
- **Gói hiện tại:** Cấu hình Worker (mặc định 30)
- **Hạn mức:** Mỗi tài khoản được hỏi tối đa 30 câu/ngày (biến USER_DAILY_LIMIT). Mỗi câu ghi 1 dòng D1 vào chat_usage. Ngày tính theo giờ Thái Bình Dương. Lượt gọi và neurons Workers AI xem trực tiếp trên Cloudflare Dashboard.
- **Ngưỡng:** Số câu / người / ngày — 30 câu (USER_DAILY_LIMIT); Dòng D1 ghi mỗi câu — 1 dòng (chat_usage); Thời điểm reset — 00:00 giờ Thái Bình Dương
- **Dấu hiệu chạm trần:** Chat báo đã hết lượt hỏi trong ngày và nút gửi bị khóa.; Worker trả HTTP 429 kèm thông báo hạn mức ngày.
- **Mã lỗi:** `HTTP 429 (daily limit)`
- **Cơ chế dự phòng:** Chặn ngay trước khi gọi model nên không đốt quota AI; buffered tin nhắn cũ vẫn đọc được từ cache.
- **Cách xử lý:** Đổi USER_DAILY_LIMIT trong phần biến môi trường của worker chat-proxy nếu cần nới; kiểm tra bảng chat_usage để biết ai đang dùng nhiều.
- **Chu kỳ reset:** 00:00 giờ Thái Bình Dương hàng ngày (14:00–15:00 giờ VN tuỳ mùa)
- **Tài liệu:** workers/chat-proxy/worker.js
- **Các bước kiểm tra:**
  1. Chạy SELECT * FROM chat_usage ORDER BY day DESC LIMIT 10; trong D1 console.
  2. Xác nhận biến USER_DAILY_LIMIT đang đặt trên worker, không phải trên web.

### Groq Cloud — Model Suy luận Nâng cao (Llama-3.3-70b-versatile)

- **Mức độ:** Cảnh báo
- **Gói hiện tại:** Free Developer Tier
- **Hạn mức:** Model 70B cho chất lượng giải đề và lập kế hoạch ôn thi cao nhất, nhưng hạn mức token/phút khắt khe.
- **Ngưỡng:** Requests/phút (RPM) — 30 RPM; Requests/ngày (RPD) — 1,000 RPD; Tokens/phút (TPM) — 12,000 TPM; Tokens/ngày (TPD) — 100,000 TPD
- **Dấu hiệu chạm trần:** API trả về mã lỗi HTTP 429 rate_limit_exceeded.; Nội dung lỗi: 'Rate limit reached for model llama-3.3-70b-versatile on tokens per minute (TPM)'.
- **Mã lỗi:** `HTTP 429 (TPM / RPD Exceeded)`
- **Cơ chế dự phòng:** Chain runner tự động bỏ qua model 70B khi gặp lỗi 429 và chuyển tiếp sang Llama 3.1 8B Instant hoặc Cloudflare Workers AI.
- **Cách xử lý:** Chỉ dùng model 70B cho câu hỏi yêu cầu phân tích học thuật sâu; đặt Llama 3.1 8B làm model xử lý nhanh mặc định trong /admin/chat.
- **Chu kỳ reset:** RPM/TPM tính trượt theo phút, RPD reset 00:00 UTC
- **Tài liệu:** https://console.groq.com/docs/rate-limits
- **Các bước kiểm tra:**
  1. Kiểm tra console Groq xem lượng TPM hiện tại đang tiêu thụ bao nhiêu.
  2. Giảm chiều dài System Prompt Template trong /admin/chat để tiết kiệm token đầu vào.
  3. Chuyển sang dùng model 8B nếu người dùng chỉ hỏi đáp ngắn hoặc tóm tắt.

### Groq Cloud — Model Phản hồi Siêu tốc (Llama-3.1-8b-instant)

- **Mức độ:** Tham khảo
- **Gói hiện tại:** Free Developer Tier
- **Hạn mức:** Model phản hồi cực nhanh (~800 tokens/giây), hạn mức lớn gấp 14 lần bản 70B.
- **Ngưỡng:** Requests/phút (RPM) — 30 RPM; Requests/ngày (RPD) — 14,400 RPD; Tokens/phút (TPM) — 6,000 TPM; Tokens/ngày (TPD) — 500,000 TPD
- **Dấu hiệu chạm trần:** HTTP 429 chỉ xảy ra khi gửi liên tục dồn dập vượt 30 requests trong vòng 60 giây.
- **Mã lỗi:** `HTTP 429 (RPM Spike)`
- **Cơ chế dự phòng:** Tự động retry với cơ chế Exponential Backoff hoặc chuyển sang Workers AI nếu lỗi kéo dài.
- **Cách xử lý:** Cấu hình làm model mặc định phục vụ sinh viên trong /admin/chat; an toàn cho việc sử dụng thường nhật với 14,400 lượt/ngày.
- **Chu kỳ reset:** RPM/TPM trượt theo phút, RPD reset 00:00 UTC
- **Tài liệu:** https://console.groq.com/docs/rate-limits
- **Các bước kiểm tra:**
  1. Đảm bảo client không gửi request trùng lặp (debounce ô chat).
  2. Nếu đạt ngưỡng 30 RPM, chờ 60 giây để hạn mức tự hồi phục.

## Backend

### Cloudflare Workers (Workers Free) — 2 Worker: data-api (đồng bộ) + chat-proxy (chat AI)

- **Mức độ:** Nghiêm trọng
- **Gói hiện tại:** Workers Free
- **Hạn mức:** 100,000 request/ngày dùng chung cho cả hai worker; 10 ms CPU mỗi lượt; 50 subrequest; script tối đa 64 MiB. Reset 00:00 UTC.
- **Ngưỡng:** Request / ngày (toàn tài khoản) — 100,000; CPU time / request — 10 ms (Free); Subrequest / request — 50; Kích thước script — 64 MiB
- **Dấu hiệu chạm trần:** Cloudflare trả Error 1027 cho mọi request của worker.; Chat báo lỗi mạng, đồng bộ ngừng đẩy dù máy vẫn có mạng.
- **Mã lỗi:** `Error 1027 (Daily request limit exceeded)`
- **Cơ chế dự phòng:** Web là static export + Local-First: ghi chú, kanban, đồng hồ vẫn chạy offline; thay đổi nằm chờ trong meta và tự đẩy lại sau khi quota reset.
- **Cách xử lý:** Giữ các mốc tiết kiệm đã cấu hình (debounce đẩy 2s, gộp meta 1s, pull tối đa 20s/lần khi quay lại tab); không thêm polling định kỳ; tránh reload liên tục.
- **Chu kỳ reset:** 00:00 UTC hàng ngày (07:00 giờ VN)
- **Tài liệu:** https://developers.cloudflare.com/workers/platform/limits/
- **Các bước kiểm tra:**
  1. Mở Cloudflare Dashboard → Workers & Pages → chọn từng worker → Metrics để xem request theo ngày.
  2. Nếu sát trần, kiểm tra tab /admin mở lâu hoặc nhiều tab cùng lúc đang gọi /health, /settings.
  3. Tạm dừng các script kiểm tra tự động trước khi quota reset.

### Cloudflare D1 (database zenspace) — Đồng bộ ghi chú/kanban/cài đặt + bộ đếm chat + lịch sử tập trung

- **Mức độ:** Nghiêm trọng
- **Gói hiện tại:** Workers Free (D1 free tier)
- **Hạn mức:** 5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày, 5 GB tổng, tối đa 500 MB mỗi database, 50 query mỗi lượt gọi worker. Từ 01/09/2026 vượt hạn mức là lỗi query, không chỉ chậm.
- **Ngưỡng:** Dòng đọc / ngày — 5,000,000; Dòng ghi / ngày — 100,000; Dung lượng tổng — 5 GB (mỗi DB tối đa 500 MB); Query / lượt gọi worker — 50 (Free)
- **Dấu hiệu chạm trần:** Worker trả lỗi D1 (daily limit exceeded / 500) ở /settings hoặc /chat.; Đồng bộ ngừng đẩy, chat báo hết lượt dù chưa dùng hết 30 câu.
- **Mã lỗi:** `D1_ERROR / HTTP 500`
- **Cơ chế dự phòng:** Dữ liệu vẫn nằm đầy đủ trên máy; meta giữ trạng thái chưa đẩy nên lần đồng bộ sau (sau 00:00 UTC) sẽ gửi bù. Không mất dữ liệu.
- **Cách xử lý:** Mỗi câu chat tốn 1 dòng ghi (UPSERT chat_usage); mỗi lần đẩy snapshot chỉ ghi 1 dòng user_data. Giữ debounce 2s, không bấm đồng bộ liên tục.
- **Chu kỳ reset:** 00:00 UTC hàng ngày (07:00 giờ VN)
- **Tài liệu:** https://developers.cloudflare.com/d1/platform/pricing/
- **Các bước kiểm tra:**
  1. Cloudflare Dashboard → D1 → zenspace → Metrics: xem Rows read / Rows written trong ngày.
  2. Kiểm tra dung lượng thật: SELECT COUNT(*), MAX(LENGTH(data_json)) FROM user_data; và SELECT COUNT(*) FROM chat_usage;
  3. Dọn bớt dữ liệu cũ bằng DELETE có điều kiện nếu chạm 500 MB.

### Cloudflare Workers KV — Đường lùi của bộ đếm câu chat khi chat-proxy thiếu binding D1

- **Mức độ:** Cảnh báo
- **Gói hiện tại:** Workers Free (KV free tier)
- **Hạn mức:** 100.000 lượt đọc/ngày, 1.000 lượt ghi/ngày, 1 GB. Chỉ dùng khi worker chat-proxy không có binding DB; bình thường bộ đếm câu chat đã nằm trong D1.
- **Ngưỡng:** Lượt đọc / ngày — 100,000; Lượt ghi / ngày (key khác nhau) — 1,000; Ghi cùng một key — 1 lần/giây; Dung lượng — 1 GB
- **Dấu hiệu chạm trần:** Bộ đếm chat dừng tăng sau vài trăm câu/ngày (trần 1.000 lượt ghi).; Log worker xuất hiện nhánh fallback KV thay vì D1.
- **Mã lỗi:** `KV PUT 429 / limit exceeded`
- **Cơ chế dự phòng:** Code tự dùng D1 nếu có binding DB; KV chỉ còn cho trường hợp chưa gắn D1 nên không ảnh hưởng cấu hình hiện tại.
- **Cách xử lý:** Luôn giữ binding DB cho chat-proxy. Không xóa binding để 'thử' vì sẽ tụt ngay về trần 1.000 ghi/ngày.
- **Chu kỳ reset:** 00:00 UTC hàng ngày
- **Tài liệu:** https://developers.cloudflare.com/kv/platform/limits/
- **Các bước kiểm tra:**
  1. Kiểm tra Settings → Bindings của worker chat-proxy có biến DB trỏ tới D1 zenspace.
  2. Xem nhánh fallback KV trong workers/chat-proxy/worker.js khi log báo lỗi D1.

## Lưu trữ

### Cloudflare R2 — Kho Lưu trữ Bối cảnh (Video MP4 & Ảnh nền 4K)

- **Mức độ:** Cảnh báo
- **Gói hiện tại:** Free Tier (Hàng tháng)
- **Hạn mức:** 10 GB dung lượng lưu trữ tĩnh miễn phí mỗi tháng; hoàn toàn 0$ chi phí băng thông tải về (Zero Egress Fees).
- **Ngưỡng:** Dung lượng lưu trữ — 10 GB miễn phí / tháng; Băng thông tải về (Egress) — 0$ Không giới hạn; Kích thước 1 file tối đa — 5 GB / lần PUT (multipart tới 5 TB)
- **Dấu hiệu chạm trần:** Vượt quá 10 GB: Bị chặn upload file mới nếu tài khoản chưa add thẻ thanh toán, hoặc tính phí $0.015 / GB-tháng nếu đã liên kết thẻ.
- **Mã lỗi:** `HTTP 413 / Insufficient Storage`
- **Cơ chế dự phòng:** Client ZenStudy tích hợp cơ chế dự phòng ảnh tĩnh cục bộ nếu file video từ R2 gặp sự cố kết nối mạng.
- **Cách xử lý:** Khuyến nghị video tối đa 35-50MB (chuẩn H.264/WebM 1080p 24fps), ảnh nền tối đa 3MB. Dùng Studio /dev/studio để xóa bỏ cảnh thừa.
- **Chu kỳ reset:** Lũy kế theo chu kỳ tháng
- **Tài liệu:** https://developers.cloudflare.com/r2/pricing/
- **Các bước kiểm tra:**
  1. Vào /dev/studio kiểm tra danh sách cảnh hiện có.
  2. Xóa các cảnh chất lượng kém hoặc không dùng để giải phóng dung lượng R2.
  3. Nén video bằng Handbrake hoặc ffmpeg trước khi tải lên.

### Cloudflare R2 — Thao tác Quản trị & Đồng bộ Kho mạng (Upload/Sync Script)

- **Mức độ:** Tham khảo
- **Gói hiện tại:** Free Tier
- **Hạn mức:** 1,000,000 requests Class A (PutObject, Copy, List) và 10,000,000 requests Class B (GetObject, Head) mỗi tháng.
- **Ngưỡng:** Class A (Ghi / List) — 1,000,000 requests / tháng; Class B (Đọc / Head) — 10,000,000 requests / tháng
- **Dấu hiệu chạm trần:** Vượt quá hạn mức: Script sync-r2 báo lỗi nếu tài khoản bị khóa thao tác ghi hoặc tính phụ phí $4.50/triệu Class A.
- **Mã lỗi:** `HTTP 429 / Operation Limit Exceeded`
- **Cơ chế dự phòng:** Script scripts/sync-r2.mjs sử dụng HeadObjectCommand để so sánh kích thước file và chỉ tải lên (PutObject) file mới, tiết kiệm 95% thao tác Class A.
- **Cách xử lý:** Chỉ bấm nút 'Đẩy ảnh mới lên kho mạng' trong /dev/studio khi thực sự có cảnh mới được thêm vào.
- **Chu kỳ reset:** Reset ngày đầu tiên hàng tháng
- **Tài liệu:** https://developers.cloudflare.com/r2/pricing/
- **Các bước kiểm tra:**
  1. Không chạy sync:r2 lặp lại liên tục khi không có file mới.
  2. Kiểm tra log của sync-r2.mjs xem số file skip và số file uploaded.

## Realtime

### LiveKit Cloud — Phòng Học Nhóm Âm thanh & Màn hình Trực tuyến

- **Mức độ:** Nghiêm trọng
- **Gói hiện tại:** Build (Miễn phí)
- **Hạn mức:** 5.000 phút WebRTC mỗi tháng (Worker chặn an toàn ở 4.500 phút) và 50 GB dữ liệu tải xuống; tối đa 6 người/phòng, tối đa 100 người kết nối đồng thời toàn project.
- **Ngưỡng:** Phút WebRTC (ngưỡng chặn) — 4,500 phút / tháng (Plan 5,000); Sức chứa tối đa / phòng — 6 người / phòng (MAX_ROOM_PARTICIPANTS); Dữ liệu tải xuống (Downstream) — 50 GB / tháng; Người kết nối đồng thời — Tối đa 100 người; Thời lượng phiên học tối đa — 120 phút / phiên (SESSION_MAX_MINUTES)
- **Dấu hiệu chạm trần:** Hết 4.500 phút: Worker trả HTTP 429 QUOTA_EXCEEDED, chặn vào phòng mới cho tới đầu tháng sau.; Người thứ 7 vào phòng bị Worker từ chối với HTTP 409 ROOM_FULL.; Người tham gia thứ 101 toàn project bị từ chối kết nối WebRTC (Connection Rejected).; Phiên học tự động ngắt khi chạm mốc 120 phút.
- **Mã lỗi:** `HTTP 429 QUOTA_EXCEEDED / HTTP 409 ROOM_FULL`
- **Cơ chế dự phòng:** Khi D1 lỗi hoặc thiếu binding DB, Worker tự động fail-open (vẫn phát token) kèm quotaStatus: 'unknown' để không làm gián đoạn phòng học.
- **Cách xử lý:** Theo dõi số phút và số phòng thực tế qua GET /usage với header Authorization: Bearer ADMIN_TOKEN. Ngưỡng chặn an toàn 4.500 phút bảo vệ không vượt quá 5.000 phút miễn phí.
- **Chu kỳ reset:** Reset vào ngày 1 hàng tháng (00:00 UTC)
- **Tài liệu:** https://docs.livekit.io/home/cloud/quotas-and-limits
- **Các bước kiểm tra:**
  1. Kiểm tra số phút và số phòng thực tế: curl.exe -H "Authorization: Bearer <ADMIN_TOKEN>" https://<worker>/usage.
  2. Kiểm tra danh sách phòng đang mở qua API /api/livekit-rooms hoặc GET /rooms.
  3. Nhắc nhở người tham gia tắt camera khi chỉ cần nghe nhạc hoặc học bài tập trung.
  4. Đối soát với số phút thực tế trên LiveKit Cloud Dashboard console.

### Google Firebase (Spark Plan) — Đồng bộ Tài khoản & Lưu trữ Đám mây Cá nhân (Tùy chọn)

- **Mức độ:** Tham khảo
- **Gói hiện tại:** Spark Plan (Miễn phí)
- **Hạn mức:** Mỗi câu chat ghi 3 document (câu hỏi, câu trả lời, preview phiên) nên 20.000 writes/ngày tương đương ~6.600 câu. Kèm 50.000 reads/ngày, 20.000 deletes/ngày, 1 GiB lưu trữ, 10 GiB egress/tháng và giới hạn 1 MiB mỗi document.
- **Ngưỡng:** Lượt đọc (Document Reads) — 50,000 reads / ngày; Lượt ghi (Document Writes) — 20,000 writes / ngày; Lượt xóa (Document Deletes) — 20,000 deletes / ngày; Dung lượng Firestore — 1 GiB miễn phí; Băng thông ra (Egress) — 10 GiB / tháng; Kích thước 1 document — 1 MiB
- **Dấu hiệu chạm trần:** Lỗi RESOURCE_EXHAUSTED khi vượt quá lượt đọc/ghi trong ngày.; Đồng bộ đám mây và chat tạm dừng cho tới ngày tiếp theo.; Gửi ảnh/file quá lớn vào chat có thể sinh lỗi document vượt 1 MiB.
- **Mã lỗi:** `FirebaseError: RESOURCE_EXHAUSTED`
- **Cơ chế dự phòng:** Kiến trúc Local-First: Toàn bộ trải nghiệm học tập, ghi chú, đồng hồ vẫn hoạt động 100% trơn tru offline tại LocalStorage máy người dùng.
- **Cách xử lý:** Chỉ đồng bộ trạng thái khi có sự thay đổi thực sự (Debounce sync), không đọc dữ liệu liên tục theo chu kỳ giây.
- **Chu kỳ reset:** 00:00 Pacific Time (14:00 giờ VN)
- **Tài liệu:** https://firebase.google.com/pricing
- **Các bước kiểm tra:**
  1. Kiểm tra Usage trên Firebase Console xem lượng Reads/Writes trong ngày.
  2. Đảm bảo các listener Firestore có hủy đăng ký (unsubscribe) khi component unmount.

### Firebase Authentication (Spark Plan) — Đăng nhập Email/Mật khẩu & Google cho tài khoản học tập

- **Mức độ:** Tham khảo
- **Gói hiện tại:** Spark Plan (Miễn phí)
- **Hạn mức:** 50.000 người dùng hoạt động mỗi tháng (MAU) cho các phương thức đăng nhập tiêu chuẩn; tính theo tháng, không phải theo ngày.
- **Ngưỡng:** Người dùng hoạt động / tháng — 50,000 MAU; SAML/OIDC (không dùng) — 50 MAU
- **Dấu hiệu chạm trần:** Đăng nhập/đăng ký mới bị từ chối khi vượt 50.000 MAU.; Tài khoản đang đăng nhập vẫn hoạt động tới khi token hết hạn.
- **Mã lỗi:** `auth/quota-exceeded`
- **Cơ chế dự phòng:** Không cần tài khoản vẫn học được đầy đủ (chế độ khách + Local-First); chỉ mất phần đồng bộ đám mây và chat AI.
- **Cách xử lý:** Chỉ chạy một project Firebase; không tạo thêm project song song làm tăng MAU. Nếu vượt, cần nâng lên Blaze.
- **Chu kỳ reset:** Theo tháng (đầu chu kỳ thanh toán)
- **Tài liệu:** https://firebase.google.com/pricing
- **Các bước kiểm tra:**
  1. Firebase Console → Authentication → Users xem tổng người dùng.
  2. Kiểm tra có app/test nào tự tạo tài khoản ảo làm tăng MAU không.

## Client

### Trình duyệt Client (LocalStorage) — Lưu trữ Trạng thái Học tập (Kanban, Multi-Notes, Cài đặt, Yêu thích)

- **Mức độ:** Nghiêm trọng
- **Gói hiện tại:** Client Hardware / Origin Sandbox
- **Hạn mức:** Hạn mức từ 5MB đến 10MB tối đa cho mỗi tên miền (Origin) tùy trình duyệt (Chrome, Safari iOS, Firefox, Edge).
- **Ngưỡng:** Safari iOS / WebKit — ~5 MB / origin; Desktop Chrome / Firefox — ~10 MB / origin
- **Dấu hiệu chạm trần:** Trình duyệt quăng ngoại lệ DOMException: QuotaExceededError hoặc NS_ERROR_DOM_QUOTA_REACHED.; Dữ liệu mới (ghi chú, task) không thể lưu vào máy người dùng.
- **Mã lỗi:** `DOMException: QuotaExceededError`
- **Cơ chế dự phòng:** Module src/lib/safe-storage.ts bắt chặn lỗi QuotaExceededError, không để ứng dụng crash, hiển thị Toast cảnh báo người dùng xóa bớt dữ liệu cũ.
- **Cách xử lý:** Sử dụng công cụ kiểm tra dung lượng trong trang Admin này để quét dung lượng chiếm dụng; xuất sao lưu JSON và xóa bớt ghi chú cũ.
- **Chu kỳ reset:** Không tự reset (Phụ thuộc vào người dùng hoặc xóa cache trình duyệt)
- **Tài liệu:** https://developer.mozilla.org/en-US/docs/Web/API/Storage_API
- **Các bước kiểm tra:**
  1. Mở công cụ quét bộ nhớ ở đầu trang Admin này để xem dung lượng từng key.
  2. Xóa bớt ghi chú hoặc task đã hoàn thành nếu bộ nhớ chạm ngưỡng 4MB.
  3. Bấm nút 'Xuất sao lưu' để lưu file JSON về máy tính cá nhân trước khi dọn dẹp.

### IndexedDB (StudySpaceChatMediaDB) — Ảnh gốc Full HD của chat (bộ nhớ đệm cục bộ)

- **Mức độ:** Cảnh báo
- **Gói hiện tại:** Browser Storage Quota
- **Hạn mức:** Ảnh gốc (tối đa 7 MB/ảnh) lưu cục bộ để xem lại nét 100% mà không tốn Firestore. App chưa đặt giới hạn số lượng hay dung lượng, nên mức dùng tăng dần theo thời gian.
- **Ngưỡng:** Kích thước mỗi ảnh — Tối đa 7 MB; Số ảnh lưu trữ — Không giới hạn (theo hạn mức trình duyệt); Hạn mức trình duyệt — Chia theo dung lượng đĩa trống, thường vài trăm MB - vài GB
- **Dấu hiệu chạm trần:** Ảnh mới không xem lại được nét (chỉ còn hình nhỏ) do ghi IndexedDB thất bại.; Trình duyệt bắt đầu nén mạnh cache hoặc cảnh báo thiếu dung lượng.
- **Mã lỗi:** `DOMException: QuotaExceededError`
- **Cơ chế dự phòng:** Câu hỏi và câu trả lời vẫn hiển thị với hình thu nhỏ lưu ở Firestore; ảnh gốc chỉ mất phần xem lại nét.
- **Cách xử lý:** Dùng nút 'Ảnh chat' trong phần chẩn đoán dung lượng để xóa bớt; đăng xuất cũng xóa sạch IndexedDB.
- **Chu kỳ reset:** Không tự reset (xóa thủ công hoặc khi đăng xuất)
- **Tài liệu:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **Các bước kiểm tra:**
  1. Bấm 'Quét ảnh chat' trong trang Admin này để xem số ảnh và dung lượng.
  2. Xóa ảnh chat khi dung lượng vượt vài trăm MB.

### ZenStudy Focus Storage Engine — Nhật ký Lịch sử Tập trung & Thống kê Pomodoro (src/lib/focus-sessions.ts)

- **Mức độ:** Tham khảo
- **Gói hiện tại:** Quy chuẩn mã nguồn ZenStudy
- **Hạn mức:** Ngưỡng chặn cứng MAX_STORED_SESSIONS = 2000 phiên học nhằm bảo vệ LocalStorage không bị tràn.
- **Ngưỡng:** Số phiên lưu trữ tối đa — 2,000 phiên học; Dung lượng ước tính — ~300 KB - 500 KB JSON
- **Dấu hiệu chạm trần:** Khi đạt phiên thứ 2,001: Không báo lỗi mà tự động kích hoạt thuật toán Pruning loại bỏ phiên cũ nhất.
- **Mã lỗi:** `Tự động cắt tỉa (Auto-Prune)`
- **Cơ chế dự phòng:** Hệ thống tự động cắt lấy 2000 phiên gần nhất (next.slice(next.length - MAX_STORED_SESSIONS)) đảm bảo bộ nhớ luôn ở mức an toàn tuyệt đối.
- **Cách xử lý:** Admin hoặc người học nên bấm 'Xuất dữ liệu' định kỳ sang file CSV/JSON nếu muốn lưu trữ vĩnh viễn lịch sử cả năm học.
- **Chu kỳ reset:** Cắt tỉa liên tục khi vượt ngưỡng
- **Tài liệu:** src/lib/focus-sessions.ts
- **Các bước kiểm tra:**
  1. Kiểm tra số phiên học đang lưu trong thẻ trạng thái bộ nhớ.
  2. Xuất file lịch sử tập trung nếu cần thống kê thời gian dài hạn.

## Nhúng ngoài

### Google YouTube / Spotify Web Player — Đài phát Nhạc Lofi & Âm thanh Tự nhiên (Embed Widgets)

- **Mức độ:** Tham khảo
- **Gói hiện tại:** IFrame Client Playback
- **Hạn mức:** Không tiêu tốn Quota Google Cloud API v3 (0 units) do tích hợp trực tiếp qua IFrame nhúng của trình duyệt.
- **Ngưỡng:** Browser Autoplay Policy — Cần click tương tác trước khi phát âm thanh; Spotify Free Preview — Giới hạn 30 giây nếu chưa đăng nhập Spotify; YouTube Quota API v3 — 0 units (Không tiêu hao)
- **Dấu hiệu chạm trần:** Âm thanh bị tắt tiếng (Muted) hoặc không tự chạy ở lần đầu mở web nếu trình duyệt chưa có cử chỉ người dùng.; Video YouTube hiển thị thông báo 'Video không có sẵn' nếu tác giả video tắt quyền nhúng (Embedding Disabled).
- **Mã lỗi:** `NotAllowedError (Autoplay Blocked)`
- **Cơ chế dự phòng:** StudyEmbedPlayerWidget hiển thị lớp phủ mờ với hướng dẫn bấm nút Play rõ ràng; tự động nhớ trạng thái tương tác qua key musicAutoplayVisited.
- **Cách xử lý:** Chọn các link phát trực tiếp (Live Stream) hoặc Playlist YouTube chính thống cho phép nhúng công khai.
- **Chu kỳ reset:** Không giới hạn
- **Tài liệu:** https://developer.chrome.com/blog/autoplay/
- **Các bước kiểm tra:**
  1. Nếu nhạc không tự phát, bấm trực tiếp vào nút Play trên màn hình một lần.
  2. Kiểm tra link YouTube có bị đặt chế độ Riêng tư (Private) hoặc Chặn nhúng không.
