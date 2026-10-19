export type LimitSeverity = "critical" | "warning" | "info";

export type LimitCategory = "all" | "ai" | "storage" | "realtime" | "client" | "embed";

export interface RateLimitMetric {
  label: string;
  value: string;
}

export interface HitLimitItem {
  id: string;
  category: "ai" | "storage" | "realtime" | "client" | "embed";
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
      "Trong /admin/chat, cấu hình Groq làm bước dự phòng ưu tiên 1; giảm bớt Max Output Tokens xuống 1024; hạn mức Neurons tự reset vào 00:00 UTC (07:00 sáng VN).",
    severity: "warning",
    resetCycle: "00:00 UTC hàng ngày (07:00 giờ VN)",
    docUrl: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
    troubleshootingSteps: [
      "Kiểm tra telemetry tại trang /admin/chat xem cờ cooling có đang bật không.",
      "Xác nhận provider dự phòng (Groq) có API key hợp lệ và đang ở trạng thái Enabled.",
      "Nếu hết 10,000 Neurons trong ngày, đẩy Groq lên đầu chuỗi Chain Entry cho đến 07:00 sáng hôm sau.",
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
      { label: "Tokens/phút (TPM)", value: "6,000 TPM" },
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
      { label: "Tokens/phút (TPM)", value: "30,000 TPM" },
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
    id: "cf-r2-storage",
    category: "storage",
    service: "Cloudflare R2",
    component: "Kho Lưu trữ Bối cảnh (Video MP4 & Ảnh nền 4K)",
    currentTier: "Free Tier (Hàng tháng)",
    quotaDescription: "10 GB dung lượng lưu trữ tĩnh miễn phí mỗi tháng; hoàn toàn 0$ chi phí băng thông tải về (Zero Egress Fees).",
    rateLimits: [
      { label: "Dung lượng lưu trữ", value: "10 GB miễn phí / tháng" },
      { label: "Băng thông tải về (Egress)", value: "0$ Không giới hạn" },
      { label: "Kích thước 1 file tối đa", value: "5 GB (Khuyến nghị < 50MB)" },
    ],
    hitLimitSymptoms: [
      "Vượt quá 10 GB: Bị chặn upload file mới nếu tài khoản chưa add thẻ thanh toán, hoặc tính phí $0.015 / GB-tháng nếu đã liên kết thẻ.",
    ],
    errorCode: "HTTP 413 / Insufficient Storage",
    fallbackMechanism:
      "Client ZenStudy tích hợp cơ chế dự phòng ảnh tĩnh cục bộ nếu file video từ R2 gặp sự cố kết nối mạng.",
    remedyAction:
      "Khuyến nghị video tối đa 35-50MB (chuẩn H.264/WebM 1080p 24fps), ảnh nền tối đa 3MB. Dùng Studio /admin/scenes để xóa bỏ cảnh thừa.",
    severity: "warning",
    resetCycle: "Lũy kế theo chu kỳ tháng",
    docUrl: "https://developers.cloudflare.com/r2/pricing/",
    troubleshootingSteps: [
      "Vào /admin/scenes kiểm tra danh sách cảnh hiện có.",
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
      "Chỉ bấm nút 'Đẩy ảnh mới lên kho mạng' trong /admin/scenes khi thực sự có cảnh mới được thêm vào.",
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
    currentTier: "Free Community Plan",
    quotaDescription: "50 GB băng thông truyền phát (Egress) mỗi tháng; tối đa 100 người dùng kết nối đồng thời; tối đa 20 phòng hoạt động cùng lúc.",
    rateLimits: [
      { label: "Băng thông dữ liệu (Egress)", value: "50 GB / tháng" },
      { label: "Số người kết nối đồng thời", value: "Tối đa 100 người" },
      { label: "Phòng học hoạt động cùng lúc", value: "Tối đa 20 phòng" },
      { label: "Thời lượng vé token (TTL)", value: "2 giờ / phiên" },
    ],
    hitLimitSymptoms: [
      "Người tham gia thứ 101 bị từ chối kết nối WebRTC (Connection Rejected).",
      "API tạo phòng từ chối cấp vé khi vượt 20 phòng hoạt động song song.",
      "Hết 50 GB băng thông: Phiên họp bị tạm khóa cho đến đầu tháng sau.",
    ],
    errorCode: "WebRTC Disconnect / Room Limit Exceeded",
    fallbackMechanism:
      "Phòng tự động giải phóng khi người cuối cùng thoát (RoomServiceClient.listRooms() chỉ giữ phòng có người). LiveKit SDK tự động hạ độ phân giải video (Dynacast) khi mạng yếu.",
    remedyAction:
      "Khuyến khích người học chỉ bật camera khi cần phát biểu; ưu tiên chế độ voice để tiết kiệm 85% băng thông; cân nhắc self-host máy chủ LiveKit nguồn mở bằng Docker nếu vượt quy mô 100 người.",
    severity: "critical",
    resetCycle: "Reset vào ngày 1 hàng tháng",
    docUrl: "https://livekit.io/pricing",
    troubleshootingSteps: [
      "Kiểm tra số phòng hoạt động qua API /api/livekit-rooms.",
      "Nhắc nhở người tham gia tắt camera khi chỉ cần nghe nhạc hoặc học bài tập trung.",
      "Kiểm tra dung lượng Egress đã dùng trên Dashboard console của LiveKit Cloud.",
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
    quotaDescription: "50,000 lượt đọc (Reads)/ngày; 20,000 lượt ghi (Writes)/ngày; 1 GB dung lượng Firestore miễn phí.",
    rateLimits: [
      { label: "Lượt đọc (Document Reads)", value: "50,000 reads / ngày" },
      { label: "Lượt ghi (Document Writes)", value: "20,000 writes / ngày" },
      { label: "Dung lượng Firestore", value: "1 GB miễn phí" },
    ],
    hitLimitSymptoms: [
      "Lỗi RESOURCE_EXHAUSTED khi vượt quá lượt đọc/ghi trong ngày.",
      "Đồng bộ đám mây tạm dừng cho tới ngày tiếp theo.",
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
];
