# Hướng Dẫn Vận Hành & Kiểm Tra: Cloudflare D1 Cloud Save (ZenStudy)

> Tài liệu hướng dẫn cách thiết lập, vận hành và kiểm tra hệ thống đồng bộ đám mây tinh gọn mới trên Cloudflare D1.

---

## 1. Thiết Lập Trên Cloudflare Dashboard (Chỉ Làm 1 Lần)

### Bước 1: Tạo / Cập nhật bảng D1
1. Vào [Cloudflare Dashboard](https://dash.cloudflare.com/) $\to$ **Storage & Databases** $\to$ **D1 SQL Database**.
2. Chọn database: `zenspace`.
3. Bấm tab **Console** $\to$ dán câu lệnh sau $\to$ bấm **Execute**:
   ```sql
   CREATE TABLE IF NOT EXISTS user_data (
     uid        TEXT PRIMARY KEY,
     data_json  TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );
   ```

### Bước 2: Deploy Worker `data-api`
1. Vào **Workers & Pages** $\to$ chọn Worker `data-api`.
2. Bấm **Edit code** $\to$ dán toàn bộ file `workers/data-api/worker.js` mới $\to$ bấm **Deploy**.
3. Kiểm tra:
   - Tab **Settings** $\to$ **Variables and Secrets**:
     - `FIREBASE_PROJECT_ID`: `zenspace-d10m13y26`
     - `ALLOWED_ORIGINS`: `https://zenstudy.space,http://localhost:3001`
   - Tab **Settings** $\to$ **Bindings**: Đã gắn D1 Database `zenspace` vào tên biến `DB`.

---

## 2. Cách Xem Dữ Liệu Thực Tế Trong Database D1

Bạn có thể vào Cloudflare Dashboard để nhìn tận mắt dữ liệu học tập của mình:

1. Mở D1 Database `zenspace` $\to$ tab **Console**.
2. Chạy câu lệnh:
   ```sql
   SELECT uid, updated_at, substr(data_json, 1, 150) AS preview FROM user_data;
   ```
3. Bạn sẽ thấy danh sách các tài khoản và chuỗi dữ liệu JSON chứa toàn bộ ghi chú, việc cần làm, cài đặt và phiên học tập.

---

## 3. Quy Trình Kiểm Thử Thực Tế (5 Kịch Bản Kiểm Tra)

### 🧪 Kịch bản 1: Đăng nhập & Tự động lưu
1. Mở web ZenStudy, đăng nhập tài khoản Google.
2. Thêm 1 ghi chú mới: *"Ôn tập kiểm tra Toán 1 tiết"*.
3. Đợi khoảng 2 giây, quan sát icon ở góc màn hình: chuyển từ vòng xoay 🔵 sang tích xanh 🟢 **"Đã lưu lên đám mây"**.
4. Vào D1 Console chạy lệnh: `SELECT * FROM user_data WHERE uid = 'your-uid';` $\to$ Thấy ngay ghi chú vừa gõ nằm trong `data_json`.

### 🧪 Kịch bản 2: Bấm nút "Đồng bộ ngay" (Sync Now)
1. Đổi hình nền hoặc chọn một âm thanh mưa/sóng biển mới.
2. Bấm vào icon đồng bộ $\to$ Bấm nút **"Đồng bộ ngay"**.
3. **Kết quả:** Hệ thống lập tức gửi dữ liệu lên Cloudflare D1 trong vòng 0,5 giây, hiện thông báo Toast: *"Đã sao lưu thành công!"*.

### 🧪 Kịch bản 3: Đổi máy tính (Mô phỏng bằng Tab Ẩn danh)
1. Mở một cửa sổ ẩn danh (Ctrl + Shift + N) hoàn toàn mới.
2. Truy cập web ZenStudy và đăng nhập bằng tài khoản Google trên.
3. **Kết quả:** Toàn bộ ghi chú, việc cần làm, hình nền và lịch sử Pomodoro tự động xuất hiện đầy đủ 100%.

### 🧪 Kịch bản 4: Thử nghiệm khi mất mạng (Offline)
1. Nhấn `F12` trên trình duyệt $\to$ Thẻ **Network** $\to$ Chọn **Offline** (giả lập rớt wifi).
2. Viết thêm 1 ghi chú mới và đổi thời gian Pomodoro.
3. **Kết quả:**
   - Ứng dụng vẫn chạy mượt mà, không bị văng, không báo lỗi đỏ.
   - Icon đồng bộ chuyển sang màu vàng 🟡 kèm thông báo: *"Chưa sao lưu (Đang offline)"*.
4. Bật lại mạng (**Online**):
   - Ứng dụng tự động phát hiện có mạng và gửi bản ghi chú mới lên Cloudflare D1.
   - Icon tự chuyển lại màu xanh 🟢 *"Đã lưu lên đám mây"*.

### 🧪 Kịch bản 5: Đăng xuất an toàn trên máy công cộng
1. Bấm nút **Đăng xuất (Sign out)**.
2. Trình duyệt được dọn sạch bóng: Mọi ghi chú và danh sách việc cần làm biến mất, đưa web về trạng thái mặc định ban đầu.
3. Người ngồi sau vào máy tính đó sẽ không thể đọc được bất kỳ ghi chú riêng tư nào của bạn.
4. Khi bạn đăng nhập lại: Toàn bộ dữ liệu được tải lại từ D1 về máy an toàn.

---

## 4. Các Trạng Thái Icon Trên Giao Diện

| Biểu tượng | Trạng thái hiển thị | Ý nghĩa cho người dùng |
|---|---|---|
| 🟢 | **Đã lưu lên đám mây** | Dữ liệu mới nhất đã được lưu an toàn trên Cloudflare D1. |
| 🔵 (Xoay) | **Đang lưu...** | Đang gửi dữ liệu lên đám mây. |
| 🟡 | **Đang offline (Đã lưu trên máy)** | Mất mạng; dữ liệu vẫn an toàn trên máy và sẽ tự sao lưu khi có mạng. |
| 🔴 | **Chưa kết nối** | Đăng nhập để kích hoạt tính năng sao lưu đám mây. |
