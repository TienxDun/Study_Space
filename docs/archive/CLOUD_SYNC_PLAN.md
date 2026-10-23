# Kế Hoạch Triển Khai: Cloudflare D1 Snapshot Cloud Save (ZenStudy)

> **ĐÃ LƯU TRỮ:** Kế hoạch triển khai đã hoàn tất. Vận hành xem [`../guides/CLOUD_SYNC_GUIDE.md`](../guides/CLOUD_SYNC_GUIDE.md).

> **Mục tiêu:** Xóa bỏ toàn bộ 2.700 dòng code phức tạp cũ (CAS, Tombstone, Delta Sync 22 keys, Adaptive Debounce kép). Thay thế bằng mô hình **Cloud Save Tinh Gọn (Snapshot Document)** trên Cloudflare D1 — đơn giản, dễ hiểu 100%, chịu tải hàng nghìn người dùng hoàn toàn miễn phí.

---

## 1. Kiến Trúc Tổng Quan (System Architecture)

```
┌──────────────────────────────────────────────────────────────────┐
│                   Trình Duyệt (Web ZenStudy)                     │
│  - Ghi chú, Việc cần làm, Cài đặt, Pomodoro (LocalStorage)       │
│  - Module đồng bộ (~120 dòng code): Debounce 2s + Nút Sync Now   │
│  - Chỉ báo trạng thái: 🟢 Đã lưu  | 🟡 Đang offline  | 🔵 Đang lưu │
└───────────────────────────────┬──────────────────────────────────┘
                                │
               HTTPS REST API (GET /data & POST /data)
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│             Cloudflare Worker (data-api) (~80 dòng code)         │
│  - Kiểm tra vé đăng nhập Firebase Auth (Bearer Token)            │
│  - Không CAS, không Tombstone, không phân tách 22 bảng           │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                  Cloudflare D1 Database (zenspace)               │
│  Bảng duy nhất: user_data (uid, data_json, updated_at)           │
│  Hạn mức miễn phí: 100.000 lượt ghi / 5.000.000 lượt đọc / 5GB   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Đặc Tả Dữ Liệu & Hợp Đồng API

### 2.1 Cấu Trúc Bảng D1 (`workers/schema.sql`)
Gồm 2 bảng duy nhất: `user_data` (lưu snapshot tài liệu học tập) và `chat_usage` (đếm giới hạn chat AI 30 câu/ngày). Đã loại bỏ hoàn toàn `cf_usage` và các bảng cũ.
```sql
CREATE TABLE IF NOT EXISTS user_data (
  uid        TEXT PRIMARY KEY,
  data_json  TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_data_updated ON user_data (updated_at);
```

### 2.2 Nội Dung Gói Dữ Liệu (`data_json`)
Toàn bộ thông tin học tập của người dùng được đóng gói thành 1 chuỗi JSON:
```json
{
  "version": 1,
  "updatedAt": 1718000000000,
  "settings": {
    "sceneId": "cyberpunk-rain",
    "ambientSounds": { "rain": 0.5 },
    "pomoDurations": { "work": 25, "shortBreak": 5, "longBreak": 15 },
    "ambientVolume": 0.8
  },
  "notes": [
    { "id": "n1", "title": "Toán hình", "content": "Công thức...", "updatedAt": 1718000000000 }
  ],
  "tasks": [
    { "id": "b1", "title": "Kế hoạch tuần", "columns": [...] }
  ],
  "focusSessions": [
    { "id": "s1", "taskTitle": "Học Văn", "startedAt": 1717990000000, "focusSeconds": 1500 }
  ]
}
```

### 2.3 Hai Endpoint Duy Nhất Trên Worker (`workers/data-api/worker.js`)
Mọi request cần header `Authorization: Bearer <Firebase_ID_Token>`.

1. **`GET /data`** — Kéo toàn bộ dữ liệu về:
   - Query: `SELECT data_json, updated_at FROM user_data WHERE uid = ?`
   - Phản hồi:
     - Chưa có dữ liệu: `{ ok: true, data: null }`
     - Đã có dữ liệu: `{ ok: true, data: { ... }, updatedAt: 1718000000000 }`

2. **`POST /data`** — Lưu toàn bộ dữ liệu lên:
   - Body: `{ data: { ... } }`
   - Query: 
     ```sql
     INSERT INTO user_data (uid, data_json, updated_at) 
     VALUES (?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET
       data_json = excluded.data_json,
       updated_at = excluded.updated_at;
     ```
   - Phản hồi: `{ ok: true, updatedAt: 1718000000000 }`

---

## 3. Kế Hoạch Triển Khai Chi Tiết (4 Giai Đoạn)

### 📌 Giai Đoạn 1: Dọn Dẹp & Chuẩn Hóa Hạ Tầng Backend (Server)
- [x] **1.1. Cập nhật `workers/schema.sql`:** Thay thế các bảng cũ bằng 2 bảng `user_data` và `chat_usage` (loại bỏ `cf_usage`).
- [x] **1.2. Viết lại `workers/data-api/worker.js`:**
  - Rút gọn từ 1.000 dòng xuống **~250 dòng**.
  - Phục vụ 2 route `GET /data` và `POST /data` + kiểm tra token Firebase Auth RS256 chuẩn + CORS.
  - Bỏ toàn bộ CAS batch, tombstone, soft-delete, prune cron, rate limit phức tạp.
- [x] **1.3. Xác nhận deploy & test tải:** Chạy script `scripts/load-test.mjs` mô phỏng 200 CCU đạt 100% thành công.

---

### 📌 Giai Đoạn 2: Viết Lõi Đồng Bộ Client Mới (`src/lib/simple-cloud-sync.ts`)
- [x] **2.1. Module đồng bộ tinh gọn:**
  - Viết module mới `simple-cloud-sync.ts` (~350 dòng code hoàn chỉnh).
  - Đóng gói dữ liệu từ localStorage thành 1 object: `settings`, `notes`, `tasks`, `focusSessions`.
  - Tải dữ liệu về (`pullData`) khi user đăng nhập.
  - Tự động lưu (`pushData`) sau 2 giây ngừng gõ (debounce ngầm).
- [x] **2.2. Xử lý trạng thái Offline & Online:**
  - Theo dõi sự kiện `window.addEventListener("online")` và `offline`.
  - Khi offline: Giữ nguyên dữ liệu trên máy, gắn cờ `unsaved = true`.
  - Khi online trở lại: Tự động gọi `pushData()` đẩy dữ liệu lên ngay lập tức.
- [x] **2.3. Đăng xuất an toàn:**
  - Khi user bấm Đăng xuất: Xóa sạch dữ liệu trong `localStorage` (trở về trạng thái mặc định như người mới).

---

### 📌 Giai Đoạn 3: Nút "Đồng Bộ Ngay" (Sync Now) & Chỉ Báo Giao Diện
- [x] **3.1. Thiết kế component `SyncStatusBadge`:**
  - Đặt ở thanh header góc trên cạnh Avatar tài khoản và trong sheet mobile.
  - 4 trạng thái hiển thị rõ ràng:
    - 🟢 **Đã lưu lên đám mây** (kèm mốc giờ: *vừa xong*, *5 phút trước*).
    - 🔵 **Đang lưu...** (vòng xoay loading).
    - 🟡 **Chưa sao lưu (Đang offline)**.
    - 🔴 **Lỗi kết nối** (kèm nút bấm "Thử lại").
- [x] **3.2. Nút bấm "Đồng bộ ngay" (Sync Now):**
  - Cho phép người dùng bấm bất kỳ lúc nào để lưu tức thì trước khi gập laptop hoặc đổi máy.
  - Hiển thị Toast thông báo: *"Đã sao lưu dữ liệu lên đám mây thành công!"*.

---

### 📌 Giai Đoạn 4: Dọn Dẹp Code Cũ & Kiểm Thử Toàn Diện
- [x] **4.1. Dọn dẹp code rác & cập nhật hook:**
  - Thay thế hệ thống sync cũ bằng `simple-cloud-sync.ts`.
  - Cập nhật hook `use-cloud-sync.ts` và `use-auth.ts` gọi theo cơ chế mới.
- [x] **4.2. Kiểm thử chất lượng:**
  - Chạy `npx tsc --noEmit` đạt 0 lỗi typecheck.
  - Chạy `npm run lint` đạt 0 lỗi lint (`lint:css OK`).
  - Chạy `npm test` đạt 274/274 tests pass 100%.
  - Chạy `npm run test:load` đạt 100% thành công với 200 CCU.
  - Chạy `npm run build` build thành công trang web tĩnh.
  - Test kịch bản thực tế: Đăng nhập $\to$ viết note $\to$ bấm Sync Now $\to$ mở tab ẩn danh đăng nhập lại $\to$ dữ liệu hiện đầy đủ 100%.

---

## 4. Bảng Tiêu Chí Nghiệm Thu (Definition of Done)

| Mục tiêu | Tiêu chuẩn đạt |
|---|---|
| **Dung lượng code** | Tổng code sync (cả server + client) **giảm từ 2.700 dòng xuống dưới 250 dòng**. |
| **Bảo toàn dữ liệu** | Đăng nhập tài khoản ở máy khác: tải về đúng ghi chú, task, hình nền, thời gian pomodoro. |
| **Nút Sync Now** | Bấm nút $\to$ lưu thành công trong vòng $< 1$ giây. |
| **Offline mượt mà** | Tắt wifi: gõ ghi chú bình thường, hiện icon vàng 🟡; bật wifi: tự động lưu và chuyển sang xanh 🟢. |
| **Đăng xuất bảo mật** | Bấm Đăng xuất: máy công cộng sạch bong không còn ghi chú; đăng nhập lại: khôi phục nguyên vẹn. |
| **Chi phí & Quota** | Hoàn toàn 0 VNĐ trên gói Cloudflare D1 Free (100.000 writes/ngày dư sức gánh 200–1.000 user). |
