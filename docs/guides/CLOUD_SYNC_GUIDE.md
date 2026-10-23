# Hướng Dẫn Vận Hành & Kiểm Tra: Cloudflare D1 Cloud Save (ZenStudy)

> Tài liệu hướng dẫn cách thiết lập, vận hành, kiểm thử tải và kiểm tra hệ thống đồng bộ đám mây tinh gọn mới trên Cloudflare D1 (Kiến trúc Snapshot Save Game Document).

---

## 1. Thiết Lập Trên Cloudflare Dashboard (Chỉ Làm 1 Lần)

### Bước 1: Tạo / Đặt lại cơ sở dữ liệu D1
1. Vào [Cloudflare Dashboard](https://dash.cloudflare.com/) $\to$ **Storage & Databases** $\to$ **D1 SQL Database**.
2. Chọn database: `zenspace`.
3. Bấm tab **Console** $\to$ dán nội dung từ [`workers/schema.sql`](file:///c:/Users/leuti/Desktop/GitHub/Study_Space/workers/schema.sql) $\to$ bấm **Execute**:

```sql
-- 1. XÓA SẠCH CÁC BẢNG DƯ THỪA (kể cả cf_usage)
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS focus_sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS cf_usage;

-- 2. BẢNG DỮ LIỆU HỌC TẬP (SNAPSHOT CLOUD SAVE)
CREATE TABLE IF NOT EXISTS user_data (
  uid        TEXT PRIMARY KEY,
  data_json  TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_data_updated ON user_data (updated_at);

-- 3. BẢNG ĐẾM CÂU CHAT THEO NGÀY (GIỚI HẠN 30 CÂU/NGÀY)
CREATE TABLE IF NOT EXISTS chat_usage (
  uid   TEXT NOT NULL,
  day   TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, day)
);
```

### Bước 2: Deploy Worker `data-api`
1. Vào **Workers & Pages** $\to$ chọn Worker `data-api` (hoặc tạo mới nếu chưa có).
2. Bấm **Edit code** $\to$ dán toàn bộ nội dung từ [`workers/data-api/worker.js`](file:///c:/Users/leuti/Desktop/GitHub/Study_Space/workers/data-api/worker.js) $\to$ bấm **Deploy**.
3. Cấu hình biến môi trường và bindings:
   - Tab **Settings** $\to$ **Variables and Secrets**:
     - `FIREBASE_PROJECT_ID`: `zenspace-d10m13y26` (loại Text)
     - `ALLOWED_ORIGINS`: `https://zenstudy.space,http://localhost:3001` (loại Text)
   - Tab **Settings** $\to$ **Bindings**: 
     - Add $\to$ D1 Database: Đặt **Variable name** là `DB` $\to$ chọn Database `zenspace`.

---

## 2. Cách Xem & Quản Lý Dữ Liệu Trong Database D1

Bạn có thể vào Cloudflare Dashboard để theo dõi trực quan dữ liệu học tập:

1. Mở D1 Database `zenspace` $\to$ tab **Console**.
2. Xem danh sách snapshot người dùng mới nhất:
   ```sql
   SELECT uid, datetime(updated_at/1000, 'unixepoch', 'localtime') AS last_synced, length(data_json) AS size_bytes, substr(data_json, 1, 150) AS preview FROM user_data ORDER BY updated_at DESC LIMIT 10;
   ```
3. Xem dữ liệu của 1 học sinh cụ thể:
   ```sql
   SELECT data_json FROM user_data WHERE uid = 'FIREBASE_UID_CUA_BAN';
   ```

---

## 3. Kiểm Thử Tải Tự Động (Load Testing)

Dự án có sẵn công cụ giả lập kiểm thử tải cao (Stress Testing) cho 200 người dùng đồng thời:

```bash
npm run test:load
```

### Tiêu chuẩn đầu ra chuẩn:
- **Pha 1 (POST /data):** 200 request ghi snapshot đồng thời $\to$ Tỷ lệ 100%, độ trễ trung bình ~10ms, p95 < 20ms.
- **Pha 2 (GET /data):** 200 request đọc snapshot đồng thời $\to$ Tỷ lệ 100%, độ trễ trung bình ~4ms, p95 < 10ms.

---

## 4. Quy Trình Kiểm Thử Thủ Công (5 Kịch Bản Trải Nghiệm)

### 🧪 Kịch bản 1: Đăng nhập & Tự động lưu ngầm (Auto-Save)
1. Mở web ZenStudy tại `http://localhost:3001` hoặc `https://zenstudy.space`, đăng nhập tài khoản Google.
2. Thêm 1 ghi chú mới: *"Ôn thi Giải tích chương 2"*.
3. Đợi 2 giây (thời gian debounce lưu ngầm), quan sát icon ở góc trên:
   - Chuyển sang vòng xoay 🔵 **"Đang lưu..."**
   - Sau đó chuyển sang tích xanh 🟢 **"Đã lưu đám mây"**.
4. Vào D1 Console chạy lệnh: `SELECT * FROM user_data WHERE uid = 'your-uid';` $\to$ Ghi chú đã an toàn trên D1.

### 🧪 Kịch bản 2: Bấm nút "Đồng bộ ngay" (Sync Now)
1. Đổi hình nền video hoặc chọn một âm thanh mưa mới.
2. Click trực tiếp vào icon badge trạng thái 🟢 hoặc bấm nút **"Đồng bộ ngay"** trong menu tài khoản.
3. **Kết quả:** Hệ thống lập tức bắn request POST `/data` lên Cloudflare D1, hiện thông báo Toast: *"Đã sao lưu lên đám mây thành công!"*.

### 🧪 Kịch bản 3: Chuyển máy tính khác (Giả lập bằng Cửa sổ Ẩn danh)
1. Mở một cửa sổ trình duyệt ẩn danh (Ctrl + Shift + N).
2. Vào web ZenStudy và đăng nhập bằng tài khoản Google trên.
3. **Kết quả:** Toàn bộ ghi chú, danh sách việc cần làm, hình nền bối cảnh và lịch sử Pomodoro tự động đồng bộ về máy mới 100%.

### 🧪 Kịch bản 4: Mất mạng đột ngột (Offline Handling)
1. Bấm `F12` $\to$ Thẻ **Network** $\to$ Chọn **Offline** (giả lập rớt wifi).
2. Thao tác bình thường: Thêm việc cần làm mới, gõ ghi chú.
3. **Kết quả:**
   - Web chạy mượt mà trên LocalStorage, không bị văng hay gián đoạn.
   - Icon trạng thái đổi sang màu vàng 🟡 **"Chưa sao lưu (Đang offline)"**.
4. Bật lại mạng (**Online**):
   - Web lập tức phát hiện có kết nối trở lại, tự động bắn bản lưu mới nhất lên D1.
   - Icon tự chuyển về màu xanh 🟢 **"Đã lưu đám mây"**.

### 🧪 Kịch bản 5: Đăng xuất an toàn trên máy công cộng (Privacy Protection)
1. Khi học xong ở máy thư viện/quán net, bấm **Đăng xuất (Sign out)**.
2. Hệ thống sẽ tự động sync lần cuối, sau đó **xóa sạch toàn bộ** ghi chú, danh sách việc cần làm và dữ liệu cá nhân trên trình duyệt máy đó.
3. Người dùng sau ngồi vào máy sẽ không đọc được bất kỳ ghi chú riêng tư nào.
4. Khi bạn về nhà đăng nhập lại trên máy của mình, dữ liệu trên đám mây sẽ tự tải về nguyên vẹn.

---

## 5. Bảng Ý Nghĩa Biểu Tượng Trạng Thái (UI Badges)

| Biểu tượng | Trạng thái hiển thị | Tương tác người dùng |
|---|---|---|
| 🟢 | **Đã lưu đám mây** | Dữ liệu mới nhất đã nằm an toàn trên Cloudflare D1. Click vào để ép đồng bộ ngay. |
| 🔵 (Xoay) | **Đang lưu...** | Đang gửi bản snapshot lên đám mây. |
| 🟡 | **Đang offline (Đã lưu trên máy)** | Mất mạng; dữ liệu an toàn trên LocalStorage và sẽ tự sync ngay khi có mạng. |
| 🔴 | **Lỗi sao lưu** | Click vào để thử sao lưu lại ngay lập tức. |
