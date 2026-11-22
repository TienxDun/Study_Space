export type LimitSeverity = "critical" | "warning" | "info";

export type LimitCategory = "all" | "ai" | "backend" | "storage" | "realtime" | "client" | "embed";

export interface RateLimitMetric {
  label: string;
  value: string;
}

export interface HitLimitItem {
  id: string;
  category: "ai" | "backend" | "storage" | "realtime" | "client" | "embed";
  service: string;
  component: string;
  currentTier: string;
  quotaDescription: string;
  rateLimits: RateLimitMetric[];
  hitLimitSymptoms: string[];
  errorCode?: string;
  fallbackMechanism: string;
  remedyAction: string;
  severity: LimitSeverity;
  resetCycle: string;
  docUrl?: string;
  troubleshootingSteps: string[];
}

export const SYSTEM_HIT_LIMITS: HitLimitItem[] = [
  {
    id: "cf-workers-ai",
    category: "ai",
    service: "Cloudflare Workers AI",
    component: "Chatbot AI Trợ lý Học tập (Llama-3.1-8b-instruct, v.v.)",
    currentTier: "Free Tier (Workers AI Free Allocation)",
    quotaDescription: "10,000 Neurons / ngày (~100 - 300 câu hỏi tùy độ dài prompt và context).",
    rateLimits: [
      { label: "Rate Limit (Phút)", value: "300 requests / phút" },
      { label: "Hạn mức (Ngày)", value: "10,000 Neurons / ngày" },
      { label: "Timeout phản hồi", value: "60 giây" },
    ],
    hitLimitSymptoms: [
      "API trả về mã lỗi HTTP 429 Too Many Requests.",
      "Trạng thái telemetry của server kích hoạt cờ cooling: true.",
      "Chatbot thông báo 'Đang làm mát hệ thống' hoặc tạm ngưng nếu không có fallback.",
    ],
    errorCode: "HTTP 429 / cooling: true",
    fallbackMechanism:
      "Cơ chế Multi-Provider Failover Chain tự động nhảy sang nhà cung cấp dự phòng tiếp theo (Groq Cloud hoặc OpenRouter) mà người học không nhận thấy gián đoạn.",
    remedyAction:
      "Theo dõi số neurons thật trên Cloudflare Dashboard → Workers AI → Usage. ZenStudy không tự đếm neurons nữa vì ước lượng dễ sai; khi sát hạn mức thì đẩy Groq lên đầu chuỗi hoặc giảm Max Output Tokens. Hạn mức tự reset lúc 00:00 UTC (07:00 sáng VN).",
    severity: "warning",
    resetCycle: "00:00 UTC hàng ngày (07:00 giờ VN)",
    docUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    troubleshootingSteps: [
      "Mở Cloudflare Dashboard → Workers AI → Usage để xem neurons đã dùng trong ngày.",
      "Xác nhận provider dự phòng (Groq) có API key hợp lệ và đang ở trạng thái Enabled.",
      "Nếu hết 10,000 Neurons trong ngày, đẩy Groq lên đầu chuỗi Chain Entry cho đến 07:00 sáng hôm sau.",
    ],
  },
  {
    id: "zenstudy-chat-daily",
    category: "ai",
    service: "ZenStudy Chat v2 (bộ đếm D1)",
    component: "Hạn mức hỏi AI của mỗi người (USER_DAILY_LIMIT)",
    currentTier: "Cấu hình Worker (mặc định 30)",
    quotaDescription:
      "Mỗi tài khoản được hỏi tối đa 30 câu/ngày (biến USER_DAILY_LIMIT). Mỗi câu ghi 1 dòng D1 vào chat_usage. Ngày tính theo giờ Thái Bình Dương. Lượt gọi và neurons Workers AI xem trực tiếp trên Cloudflare Dashboard.",
    rateLimits: [
      { label: "Số câu / người / ngày", value: "30 câu (USER_DAILY_LIMIT)" },
      { label: "Dòng D1 ghi mỗi câu", value: "1 dòng (chat_usage)" },
      { label: "Thời điểm reset", value: "00:00 giờ Thái Bình Dương" },
    ],
    hitLimitSymptoms: [
      "Chat báo đã hết lượt hỏi trong ngày và nút gửi bị khóa.",
      "Worker trả HTTP 429 kèm thông báo hạn mức ngày.",
    ],
    errorCode: "HTTP 429 (daily limit)",
    fallbackMechanism:
      "Chặn ngay trước khi gọi model nên không đốt quota AI; buffered tin nhắn cũ vẫn đọc được từ cache.",
    remedyAction:
      "Đổi USER_DAILY_LIMIT trong phần biến môi trường của worker chat-v2 nếu cần nới; kiểm tra bảng chat_usage để biết ai đang dùng nhiều.",
    severity: "warning",
    resetCycle: "00:00 giờ Thái Bình Dương hàng ngày (14:00–15:00 giờ VN tuỳ mùa)",
    docUrl: "workers/chat-v2/worker.js",
    troubleshootingSteps: [
      "Chạy SELECT * FROM chat_usage ORDER BY day DESC LIMIT 10; trong D1 console.",
      "Xác nhận biến USER_DAILY_LIMIT đang đặt trên worker, không phải trên web.",
    ],
  },
  {
    id: "groq-llama-70b",
    category: "ai",
    service: "Groq Cloud",
    component: "Model Suy luận Nâng cao (Llama-3.3-70b-versatile)",
    currentTier: "Free Developer Tier",
    quotaDescription: "Model 70B cho chất lượng giải đề và lập kế hoạch ôn thi cao nhất, nhưng hạn mức token/phút khắt khe.",
    rateLimits: [
      { label: "Requests/phút (RPM)", value: "30 RPM" },
      { label: "Requests/ngày (RPD)", value: "1,000 RPD" },
      { label: "Tokens/phút (TPM)", value: "12,000 TPM" },
      { label: "Tokens/ngày (TPD)", value: "100,000 TPD" },
    ],
    hitLimitSymptoms: [
      "API trả về mã lỗi HTTP 429 rate_limit_exceeded.",
      "Nội dung lỗi: 'Rate limit reached for model llama-3.3-70b-versatile on tokens per minute (TPM)'.",
    ],
    errorCode: "HTTP 429 (TPM / RPD Exceeded)",
    fallbackMechanism:
      "Chain runner tự động bỏ qua model 70B khi gặp lỗi 429 và chuyển tiếp sang Llama 3.1 8B Instant hoặc Cloudflare Workers AI.",
    remedyAction:
      "Chỉ dùng model 70B cho câu hỏi yêu cầu phân tích học thuật sâu; đặt Llama 3.1 8B làm model xử lý nhanh mặc định trong /admin/chat.",
    severity: "warning",
    resetCycle: "RPM/TPM tính trượt theo phút, RPD reset 00:00 UTC",
    docUrl: "https://console.groq.com/docs/rate-limits",
    troubleshootingSteps: [
      "Kiểm tra console Groq xem lượng TPM hiện tại đang tiêu thụ bao nhiêu.",
      "Giảm chiều dài System Prompt Template trong /admin/chat để tiết kiệm token đầu vào.",
      "Chuyển sang dùng model 8B nếu người dùng chỉ hỏi đáp ngắn hoặc tóm tắt.",
    ],
  },
  {
    id: "groq-llama-8b",
    category: "ai",
    service: "Groq Cloud",
    component: "Model Phản hồi Siêu tốc (Llama-3.1-8b-instant)",
    currentTier: "Free Developer Tier",
    quotaDescription: "Model phản hồi cực nhanh (~800 tokens/giây), hạn mức lớn gấp 14 lần bản 70B.",
    rateLimits: [
      { label: "Requests/phút (RPM)", value: "30 RPM" },
      { label: "Requests/ngày (RPD)", value: "14,400 RPD" },
      { label: "Tokens/phút (TPM)", value: "6,000 TPM" },
      { label: "Tokens/ngày (TPD)", value: "500,000 TPD" },
    ],
    hitLimitSymptoms: [
      "HTTP 429 chỉ xảy ra khi gửi liên tục dồn dập vượt 30 requests trong vòng 60 giây.",
    ],
    errorCode: "HTTP 429 (RPM Spike)",
    fallbackMechanism:
      "Tự động retry với cơ chế Exponential Backoff hoặc chuyển sang Workers AI nếu lỗi kéo dài.",
    remedyAction:
      "Cấu hình làm model mặc định phục vụ sinh viên trong /admin/chat; an toàn cho việc sử dụng thường nhật với 14,400 lượt/ngày.",
    severity: "info",
    resetCycle: "RPM/TPM trượt theo phút, RPD reset 00:00 UTC",
    docUrl: "https://console.groq.com/docs/rate-limits",
    troubleshootingSteps: [
      "Đảm bảo client không gửi request trùng lặp (debounce ô chat).",
      "Nếu đạt ngưỡng 30 RPM, chờ 60 giây để hạn mức tự hồi phục.",
    ],
  },
  {
    id: "cf-workers-platform",
    category: "backend",
    service: "Cloudflare Workers (Workers Free)",
    component: "2 Worker: data-api (đồng bộ) + chat-v2 (chat AI)",
    currentTier: "Workers Free",
    quotaDescription:
      "100,000 request/ngày dùng chung cho cả hai worker; 10 ms CPU mỗi lượt; 50 subrequest; script tối đa 64 MiB. Reset 00:00 UTC.",
    rateLimits: [
      { label: "Request / ngày (toàn tài khoản)", value: "100,000" },
      { label: "CPU time / request", value: "10 ms (Free)" },
      { label: "Subrequest / request", value: "50" },
      { label: "Kích thước script", value: "64 MiB" },
    ],
    hitLimitSymptoms: [
      "Cloudflare trả Error 1027 cho mọi request của worker.",
      "Chat báo lỗi mạng, đồng bộ ngừng đẩy dù máy vẫn có mạng.",
    ],
    errorCode: "Error 1027 (Daily request limit exceeded)",
    fallbackMechanism:
      "Web là static export + Local-First: ghi chú, kanban, đồng hồ vẫn chạy offline; thay đổi nằm chờ trong meta và tự đẩy lại sau khi quota reset.",
    remedyAction:
      "Giữ các mốc tiết kiệm đã cấu hình (debounce đẩy 2s, gộp meta 1s, pull tối đa 20s/lần khi quay lại tab); không thêm polling định kỳ; tránh reload liên tục.",
    severity: "critical",
    resetCycle: "00:00 UTC hàng ngày (07:00 giờ VN)",
    docUrl: "https://developers.cloudflare.com/workers/platform/limits/",
    troubleshootingSteps: [
      "Mở Cloudflare Dashboard → Workers & Pages → chọn từng worker → Metrics để xem request theo ngày.",
      "Nếu sát trần, kiểm tra tab /admin mở lâu hoặc nhiều tab cùng lúc đang gọi /health, /settings.",
      "Tạm dừng các script kiểm tra tự động trước khi quota reset.",
    ],
  },
  {
    id: "cf-d1",
    category: "backend",
    service: "Cloudflare D1 (database zenspace)",
    component: "Đồng bộ ghi chú/kanban/cài đặt + bộ đếm chat + lịch sử tập trung",
    currentTier: "Workers Free (D1 free tier)",
    quotaDescription:
      "5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày, 5 GB tổng, tối đa 500 MB mỗi database, 50 query mỗi lượt gọi worker. Từ 01/09/2026 vượt hạn mức là lỗi query, không chỉ chậm.",
    rateLimits: [
      { label: "Dòng đọc / ngày", value: "5,000,000" },
      { label: "Dòng ghi / ngày", value: "100,000" },
      { label: "Dung lượng tổng", value: "5 GB (mỗi DB tối đa 500 MB)" },
      { label: "Query / lượt gọi worker", value: "50 (Free)" },
    ],
    hitLimitSymptoms: [
      "Worker trả lỗi D1 (daily limit exceeded / 500) ở /settings hoặc /chat.",
      "Đồng bộ ngừng đẩy, chat báo hết lượt dù chưa dùng hết 30 câu.",
    ],
    errorCode: "D1_ERROR / HTTP 500",
    fallbackMechanism:
      "Dữ liệu vẫn nằm đầy đủ trên máy; meta giữ trạng thái chưa đẩy nên lần đồng bộ sau (sau 00:00 UTC) sẽ gửi bù. Không mất dữ liệu.",
    remedyAction:
      "Mỗi câu chat tốn 1 dòng ghi (UPSERT chat_usage); mỗi lần đẩy snapshot chỉ ghi 1 dòng user_data. Giữ debounce 2s, không bấm đồng bộ liên tục.",
    severity: "critical",
    resetCycle: "00:00 UTC hàng ngày (07:00 giờ VN)",
    docUrl: "https://developers.cloudflare.com/d1/platform/pricing/",
    troubleshootingSteps: [
      "Cloudflare Dashboard → D1 → zenspace → Metrics: xem Rows read / Rows written trong ngày.",
      "Kiểm tra dung lượng thật: SELECT COUNT(*), MAX(LENGTH(data_json)) FROM user_data; và SELECT COUNT(*) FROM chat_usage;",
      "Dọn bớt dữ liệu cũ bằng DELETE có điều kiện nếu chạm 500 MB.",
    ],
  },
  {
    id: "cf-kv-fallback",
    category: "backend",
    service: "Cloudflare Workers KV",
    component: "Đường lùi của bộ đếm câu chat khi chat-v2 thiếu binding D1",
    currentTier: "Workers Free (KV free tier)",
    quotaDescription:
      "100.000 lượt đọc/ngày, 1.000 lượt ghi/ngày, 1 GB. Chỉ dùng khi worker chat-v2 không có binding DB; bình thường bộ đếm câu chat đã nằm trong D1.",
    rateLimits: [
      { label: "Lượt đọc / ngày", value: "100,000" },
      { label: "Lượt ghi / ngày (key khác nhau)", value: "1,000" },
      { label: "Ghi cùng một key", value: "1 lần/giây" },
      { label: "Dung lượng", value: "1 GB" },
    ],
    hitLimitSymptoms: [
      "Bộ đếm chat dừng tăng sau vài trăm câu/ngày (trần 1.000 lượt ghi).",
      "Log worker xuất hiện nhánh fallback KV thay vì D1.",
    ],
    errorCode: "KV PUT 429 / limit exceeded",
    fallbackMechanism:
      "Code tự dùng D1 nếu có binding DB; KV chỉ còn cho trường hợp chưa gắn D1 nên không ảnh hưởng cấu hình hiện tại.",
    remedyAction:
      "Luôn giữ binding DB cho chat-v2. Không xóa binding để 'thử' vì sẽ tụt ngay về trần 1.000 ghi/ngày.",
    severity: "warning",
    resetCycle: "00:00 UTC hàng ngày",
    docUrl: "https://developers.cloudflare.com/kv/platform/limits/",
    troubleshootingSteps: [
      "Kiểm tra Settings → Bindings của worker chat-v2 có biến DB trỏ tới D1 zenspace.",
      "Xem nhánh fallback KV trong workers/chat-v2/quota.js khi log báo lỗi D1.",
    ],
  },
  {
    id: "cf-r2-storage",
    category: "storage",
    service: "Cloudflare R2",
    component: "Kho Lưu trữ Bối cảnh (Video MP4 & Ảnh nền 4K)",
    currentTier: "Free Tier (Hàng tháng)",
    quotaDescription: "10 GB dung lượng lưu trữ tĩnh miễn phí mỗi tháng; hoàn toàn 0$ chi phí băng thông tải về (Zero Egress Fees).",
    rateLimits: [
      { label: "Dung lượng lưu trữ", value: "10 GB miễn phí / tháng" },
      { label: "Băng thông tải về (Egress)", value: "0$ Không giới hạn" },
      { label: "Kích thước 1 file tối đa", value: "5 GB / lần PUT (multipart tới 5 TB)" },
    ],
    hitLimitSymptoms: [
      "Vượt quá 10 GB: Bị chặn upload file mới nếu tài khoản chưa add thẻ thanh toán, hoặc tính phí $0.015 / GB-tháng nếu đã liên kết thẻ.",
    ],
    errorCode: "HTTP 413 / Insufficient Storage",
    fallbackMechanism:
      "Client ZenStudy tích hợp cơ chế dự phòng ảnh tĩnh cục bộ nếu file video từ R2 gặp sự cố kết nối mạng.",
    remedyAction:
      "Khuyến nghị video tối đa 35-50MB (chuẩn H.264/WebM 1080p 24fps), ảnh nền tối đa 3MB. Dùng tab Kho tệp trong admin để xóa bỏ cảnh thừa.",
    severity: "warning",
    resetCycle: "Lũy kế theo chu kỳ tháng",
    docUrl: "https://developers.cloudflare.com/r2/pricing/",
    troubleshootingSteps: [
      "Vào tab Nội dung trong admin để kiểm tra danh sách cảnh hiện có.",
      "Xóa các cảnh chất lượng kém hoặc không dùng để giải phóng dung lượng R2.",
      "Nén video bằng Handbrake hoặc ffmpeg trước khi tải lên.",
    ],
  },
  {
    id: "cf-r2-operations",
    category: "storage",
    service: "Cloudflare R2",
    component: "Thao tác Quản trị & Đồng bộ Kho mạng (Upload/Sync Script)",
    currentTier: "Free Tier",
    quotaDescription: "1,000,000 requests Class A (PutObject, Copy, List) và 10,000,000 requests Class B (GetObject, Head) mỗi tháng.",
    rateLimits: [
      { label: "Class A (Ghi / List)", value: "1,000,000 requests / tháng" },
      { label: "Class B (Đọc / Head)", value: "10,000,000 requests / tháng" },
    ],
    hitLimitSymptoms: [
      "Vượt quá hạn mức: Script sync-r2 báo lỗi nếu tài khoản bị khóa thao tác ghi hoặc tính phụ phí $4.50/triệu Class A.",
    ],
    errorCode: "HTTP 429 / Operation Limit Exceeded",
    fallbackMechanism:
      "Script scripts/sync-r2.mjs sử dụng HeadObjectCommand để so sánh kích thước file và chỉ tải lên (PutObject) file mới, tiết kiệm 95% thao tác Class A.",
    remedyAction:
      "Chỉ tải cảnh mới lên kho qua tab Nội dung trong admin khi thực sự cần; muốn đẩy cả loạt ảnh có sẵn thì dùng `npm run sync:r2`.",
    severity: "info",
    resetCycle: "Reset ngày đầu tiên hàng tháng",
    docUrl: "https://developers.cloudflare.com/r2/pricing/",
    troubleshootingSteps: [
      "Không chạy sync:r2 lặp lại liên tục khi không có file mới.",
      "Kiểm tra log của sync-r2.mjs xem số file skip và số file uploaded.",
    ],
  },
  {
    id: "livekit-cloud",
    category: "realtime",
    service: "LiveKit Cloud",
    component: "Phòng Học Nhóm Âm thanh & Màn hình Trực tuyến",
    currentTier: "Build (Miễn phí)",
    quotaDescription:
      "5.000 phút WebRTC mỗi tháng (Worker chặn an toàn ở 4.500 phút) và 50 GB dữ liệu tải xuống; tối đa 6 người/phòng, tối đa 100 người kết nối đồng thời toàn project.",
    rateLimits: [
      { label: "Phút WebRTC (ngưỡng chặn)", value: "4,500 phút / tháng (Plan 5,000)" },
      { label: "Sức chứa tối đa / phòng", value: "6 người / phòng (MAX_ROOM_PARTICIPANTS)" },
      { label: "Dữ liệu tải xuống (Downstream)", value: "50 GB / tháng" },
      { label: "Người kết nối đồng thời", value: "Tối đa 100 người" },
      { label: "Thời lượng phiên học tối đa", value: "120 phút / phiên (SESSION_MAX_MINUTES)" },
    ],
    hitLimitSymptoms: [
      "Hết 4.500 phút: Worker trả HTTP 429 QUOTA_EXCEEDED, chặn vào phòng mới cho tới đầu tháng sau.",
      "Người thứ 7 vào phòng bị Worker từ chối với HTTP 409 ROOM_FULL.",
      "Người tham gia thứ 101 toàn project bị từ chối kết nối WebRTC (Connection Rejected).",
      "Phiên học tự động ngắt khi chạm mốc 120 phút.",
    ],
    errorCode: "HTTP 429 QUOTA_EXCEEDED / HTTP 409 ROOM_FULL",
    fallbackMechanism:
      "Khi D1 lỗi hoặc thiếu binding DB, Worker tự động fail-open (vẫn phát token) kèm quotaStatus: 'unknown' để không làm gián đoạn phòng học.",
    remedyAction:
      "Theo dõi số phút và số phòng thực tế qua GET /usage với header Authorization: Bearer ADMIN_TOKEN. Ngưỡng chặn an toàn 4.500 phút bảo vệ không vượt quá 5.000 phút miễn phí.",
    severity: "critical",
    resetCycle: "Reset vào ngày 1 hàng tháng (00:00 UTC)",
    docUrl: "https://docs.livekit.io/home/cloud/quotas-and-limits",
    troubleshootingSteps: [
      "Kiểm tra số phút và số phòng thực tế: curl.exe -H \"Authorization: Bearer <ADMIN_TOKEN>\" https://<worker>/usage.",
      "Kiểm tra danh sách phòng đang mở qua API /api/livekit-rooms hoặc GET /rooms.",
      "Nhắc nhở người tham gia tắt camera khi chỉ cần nghe nhạc hoặc học bài tập trung.",
      "Đối soát với số phút thực tế trên LiveKit Cloud Dashboard console.",
    ],
  },
  {
    id: "client-localstorage",
    category: "client",
    service: "Trình duyệt Client (LocalStorage)",
    component: "Lưu trữ Trạng thái Học tập (Kanban, Multi-Notes, Cài đặt, Yêu thích)",
    currentTier: "Client Hardware / Origin Sandbox",
    quotaDescription: "Hạn mức từ 5MB đến 10MB tối đa cho mỗi tên miền (Origin) tùy trình duyệt (Chrome, Safari iOS, Firefox, Edge).",
    rateLimits: [
      { label: "Safari iOS / WebKit", value: "~5 MB / origin" },
      { label: "Desktop Chrome / Firefox", value: "~10 MB / origin" },
    ],
    hitLimitSymptoms: [
      "Trình duyệt quăng ngoại lệ DOMException: QuotaExceededError hoặc NS_ERROR_DOM_QUOTA_REACHED.",
      "Dữ liệu mới (ghi chú, task) không thể lưu vào máy người dùng.",
    ],
    errorCode: "DOMException: QuotaExceededError",
    fallbackMechanism:
      "Module src/lib/safe-storage.ts bắt chặn lỗi QuotaExceededError, không để ứng dụng crash, hiển thị Toast cảnh báo người dùng xóa bớt dữ liệu cũ.",
    remedyAction:
      "Sử dụng công cụ kiểm tra dung lượng trong trang Admin này để quét dung lượng chiếm dụng; xuất sao lưu JSON và xóa bớt ghi chú cũ.",
    severity: "critical",
    resetCycle: "Không tự reset (Phụ thuộc vào người dùng hoặc xóa cache trình duyệt)",
    docUrl: "https://developer.mozilla.org/en-US/docs/Web/API/Storage_API",
    troubleshootingSteps: [
      "Mở công cụ quét bộ nhớ ở đầu trang Admin này để xem dung lượng từng key.",
      "Xóa bớt ghi chú hoặc task đã hoàn thành nếu bộ nhớ chạm ngưỡng 4MB.",
      "Bấm nút 'Xuất sao lưu' để lưu file JSON về máy tính cá nhân trước khi dọn dẹp.",
    ],
  },
  {
    id: "client-chat-media-idb",
    category: "client",
    service: "IndexedDB (StudySpaceChatMediaDB)",
    component: "Ảnh gốc Full HD của chat (bộ nhớ đệm cục bộ)",
    currentTier: "Browser Storage Quota",
    quotaDescription:
      "Ảnh gốc (tối đa 7 MB/ảnh) lưu cục bộ để xem lại nét 100% mà không tốn Firestore. App chưa đặt giới hạn số lượng hay dung lượng, nên mức dùng tăng dần theo thời gian.",
    rateLimits: [
      { label: "Kích thước mỗi ảnh", value: "Tối đa 7 MB" },
      { label: "Số ảnh lưu trữ", value: "Không giới hạn (theo hạn mức trình duyệt)" },
      { label: "Hạn mức trình duyệt", value: "Chia theo dung lượng đĩa trống, thường vài trăm MB - vài GB" },
    ],
    hitLimitSymptoms: [
      "Ảnh mới không xem lại được nét (chỉ còn hình nhỏ) do ghi IndexedDB thất bại.",
      "Trình duyệt bắt đầu nén mạnh cache hoặc cảnh báo thiếu dung lượng.",
    ],
    errorCode: "DOMException: QuotaExceededError",
    fallbackMechanism:
      "Câu hỏi và câu trả lời vẫn hiển thị với hình thu nhỏ lưu ở Firestore; ảnh gốc chỉ mất phần xem lại nét.",
    remedyAction:
      "Dùng nút 'Ảnh chat' trong phần chẩn đoán dung lượng để xóa bớt; đăng xuất cũng xóa sạch IndexedDB.",
    severity: "warning",
    resetCycle: "Không tự reset (xóa thủ công hoặc khi đăng xuất)",
    docUrl: "https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API",
    troubleshootingSteps: [
      "Bấm 'Quét ảnh chat' trong trang Admin này để xem số ảnh và dung lượng.",
      "Xóa ảnh chat khi dung lượng vượt vài trăm MB.",
    ],
  },
  {
    id: "client-focus-sessions",
    category: "client",
    service: "ZenStudy Focus Storage Engine",
    component: "Nhật ký Lịch sử Tập trung & Thống kê Pomodoro (src/lib/focus-sessions.ts)",
    currentTier: "Quy chuẩn mã nguồn ZenStudy",
    quotaDescription: "Ngưỡng chặn cứng MAX_STORED_SESSIONS = 2000 phiên học nhằm bảo vệ LocalStorage không bị tràn.",
    rateLimits: [
      { label: "Số phiên lưu trữ tối đa", value: "2,000 phiên học" },
      { label: "Dung lượng ước tính", value: "~300 KB - 500 KB JSON" },
    ],
    hitLimitSymptoms: [
      "Khi đạt phiên thứ 2,001: Không báo lỗi mà tự động kích hoạt thuật toán Pruning loại bỏ phiên cũ nhất.",
    ],
    errorCode: "Tự động cắt tỉa (Auto-Prune)",
    fallbackMechanism:
      "Hệ thống tự động cắt lấy 2000 phiên gần nhất (next.slice(next.length - MAX_STORED_SESSIONS)) đảm bảo bộ nhớ luôn ở mức an toàn tuyệt đối.",
    remedyAction:
      "Admin hoặc người học nên bấm 'Xuất dữ liệu' định kỳ sang file CSV/JSON nếu muốn lưu trữ vĩnh viễn lịch sử cả năm học.",
    severity: "info",
    resetCycle: "Cắt tỉa liên tục khi vượt ngưỡng",
    docUrl: "src/lib/focus-sessions.ts",
    troubleshootingSteps: [
      "Kiểm tra số phiên học đang lưu trong thẻ trạng thái bộ nhớ.",
      "Xuất file lịch sử tập trung nếu cần thống kê thời gian dài hạn.",
    ],
  },
  {
    id: "embed-audio-players",
    category: "embed",
    service: "Google YouTube / Spotify Web Player",
    component: "Đài phát Nhạc Lofi & Âm thanh Tự nhiên (Embed Widgets)",
    currentTier: "IFrame Client Playback",
    quotaDescription: "Không tiêu tốn Quota Google Cloud API v3 (0 units) do tích hợp trực tiếp qua IFrame nhúng của trình duyệt.",
    rateLimits: [
      { label: "Browser Autoplay Policy", value: "Cần click tương tác trước khi phát âm thanh" },
      { label: "Spotify Free Preview", value: "Giới hạn 30 giây nếu chưa đăng nhập Spotify" },
      { label: "YouTube Quota API v3", value: "0 units (Không tiêu hao)" },
    ],
    hitLimitSymptoms: [
      "Âm thanh bị tắt tiếng (Muted) hoặc không tự chạy ở lần đầu mở web nếu trình duyệt chưa có cử chỉ người dùng.",
      "Video YouTube hiển thị thông báo 'Video không có sẵn' nếu tác giả video tắt quyền nhúng (Embedding Disabled).",
    ],
    errorCode: "NotAllowedError (Autoplay Blocked)",
    fallbackMechanism:
      "StudyEmbedPlayerWidget hiển thị lớp phủ mờ với hướng dẫn bấm nút Play rõ ràng; tự động nhớ trạng thái tương tác qua key musicAutoplayVisited.",
    remedyAction:
      "Chọn các link phát trực tiếp (Live Stream) hoặc Playlist YouTube chính thống cho phép nhúng công khai.",
    severity: "info",
    resetCycle: "Không giới hạn",
    docUrl: "https://developer.chrome.com/blog/autoplay/",
    troubleshootingSteps: [
      "Nếu nhạc không tự phát, bấm trực tiếp vào nút Play trên màn hình một lần.",
      "Kiểm tra link YouTube có bị đặt chế độ Riêng tư (Private) hoặc Chặn nhúng không.",
    ],
  },
  {
    id: "firebase-cloud-limits",
    category: "realtime",
    service: "Google Firebase (Spark Plan)",
    component: "Đồng bộ Tài khoản & Lưu trữ Đám mây Cá nhân (Tùy chọn)",
    currentTier: "Spark Plan (Miễn phí)",
    quotaDescription:
      "Mỗi câu chat ghi 3 document (câu hỏi, câu trả lời, preview phiên) nên 20.000 writes/ngày tương đương ~6.600 câu. Kèm 50.000 reads/ngày, 20.000 deletes/ngày, 1 GiB lưu trữ, 10 GiB egress/tháng và giới hạn 1 MiB mỗi document.",
    rateLimits: [
      { label: "Lượt đọc (Document Reads)", value: "50,000 reads / ngày" },
      { label: "Lượt ghi (Document Writes)", value: "20,000 writes / ngày" },
      { label: "Lượt xóa (Document Deletes)", value: "20,000 deletes / ngày" },
      { label: "Dung lượng Firestore", value: "1 GiB miễn phí" },
      { label: "Băng thông ra (Egress)", value: "10 GiB / tháng" },
      { label: "Kích thước 1 document", value: "1 MiB" },
    ],
    hitLimitSymptoms: [
      "Lỗi RESOURCE_EXHAUSTED khi vượt quá lượt đọc/ghi trong ngày.",
      "Đồng bộ đám mây và chat tạm dừng cho tới ngày tiếp theo.",
      "Gửi ảnh/file quá lớn vào chat có thể sinh lỗi document vượt 1 MiB.",
    ],
    errorCode: "FirebaseError: RESOURCE_EXHAUSTED",
    fallbackMechanism:
      "Kiến trúc Local-First: Toàn bộ trải nghiệm học tập, ghi chú, đồng hồ vẫn hoạt động 100% trơn tru offline tại LocalStorage máy người dùng.",
    remedyAction:
      "Chỉ đồng bộ trạng thái khi có sự thay đổi thực sự (Debounce sync), không đọc dữ liệu liên tục theo chu kỳ giây.",
    severity: "info",
    resetCycle: "00:00 Pacific Time (14:00 giờ VN)",
    docUrl: "https://firebase.google.com/pricing",
    troubleshootingSteps: [
      "Kiểm tra Usage trên Firebase Console xem lượng Reads/Writes trong ngày.",
      "Đảm bảo các listener Firestore có hủy đăng ký (unsubscribe) khi component unmount.",
    ],
  },
  {
    id: "firebase-auth",
    category: "realtime",
    service: "Firebase Authentication (Spark Plan)",
    component: "Đăng nhập Email/Mật khẩu & Google cho tài khoản học tập",
    currentTier: "Spark Plan (Miễn phí)",
    quotaDescription:
      "50.000 người dùng hoạt động mỗi tháng (MAU) cho các phương thức đăng nhập tiêu chuẩn; tính theo tháng, không phải theo ngày.",
    rateLimits: [
      { label: "Người dùng hoạt động / tháng", value: "50,000 MAU" },
      { label: "SAML/OIDC (không dùng)", value: "50 MAU" },
    ],
    hitLimitSymptoms: [
      "Đăng nhập/đăng ký mới bị từ chối khi vượt 50.000 MAU.",
      "Tài khoản đang đăng nhập vẫn hoạt động tới khi token hết hạn.",
    ],
    errorCode: "auth/quota-exceeded",
    fallbackMechanism:
      "Không cần tài khoản vẫn học được đầy đủ (chế độ khách + Local-First); chỉ mất phần đồng bộ đám mây và chat AI.",
    remedyAction:
      "Chỉ chạy một project Firebase; không tạo thêm project song song làm tăng MAU. Nếu vượt, cần nâng lên Blaze.",
    severity: "info",
    resetCycle: "Theo tháng (đầu chu kỳ thanh toán)",
    docUrl: "https://firebase.google.com/pricing",
    troubleshootingSteps: [
      "Firebase Console → Authentication → Users xem tổng người dùng.",
      "Kiểm tra có app/test nào tự tạo tài khoản ảo làm tăng MAU không.",
    ],
  },
];
