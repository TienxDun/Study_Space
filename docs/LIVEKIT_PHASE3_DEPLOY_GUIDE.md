# Hướng Dẫn Triển Khai LiveKit Phase 3 (Trưởng Phòng, Phó Phòng, Mật Khẩu & Kiểm Soát)

Tài liệu này hướng dẫn chi tiết từng bước triển khai các cập nhật của **Phase 3** lên hệ thống production (Cloudflare D1, Cloudflare Worker và Frontend Next.js).

---

## 📌 Các tính năng mới của Phase 3
1. **Phân quyền Trưởng phòng (Host)**: Gắn vĩnh viễn với người tạo phòng qua Firebase `uid`. F5 hoặc mất mạng không làm mất quyền.
2. **Bổ nhiệm Phó phòng (Co-host)**: Trưởng phòng có thể chỉ định hoặc hủy Phó phòng; cập nhật quyền real-time.
3. **Phòng có mật khẩu (Linh hoạt ngay từ Pre-Join)**: 
   - Người tạo phòng (Host) có thể **đặt luôn mật khẩu ngay ở màn hình "Kiểm tra thiết bị"** trước khi vào phòng, không cần vào phòng mở bảng cài đặt mới add được.
   - Khi vào phòng, Host vẫn có thể đổi hoặc gỡ mật khẩu bất cứ lúc nào trong bảng Quản lý 🛡️.
   - Băm bảo mật bằng Web Crypto SHA-256 kèm salt.
4. **Khóa / Mở phòng**: Chặn người ngoài vào phòng khi cần riêng tư.
5. **Kiểm soát trật tự**: Tắt micro (Twirp `MutePublishedTrack`) và mời ra khỏi phòng (Twirp `RemoveParticipant`).
6. **Lịch sử giờ học & Thống kê aggregate**: `GET /history` và `GET /admin/usage` ẩn danh 100%, không lộ dữ liệu cá nhân.

---

## 🛠️ Quy Trình Triển Khai (3 Bước)

```text
Bước 1: Cloudflare D1 ──► Chạy schema làm mới bảng meet_rooms & meet_audit_logs
          │
Bước 2: Cloudflare Worker ──► Cập nhật code workers/livekit-rooms/worker.js
          │
Bước 3: Frontend (Web tĩnh) ──► Build và Deploy frontend
```

---

### Bước 1: Cập nhật Cloudflare D1 Database

Vì cấu trúc bảng `meet_rooms` đã được mở rộng và thêm bảng `meet_audit_logs`, bạn cần thực thi file schema để làm mới bảng.

#### Cách 1: Qua giao diện Cloudflare Dashboard (Khuyên dùng)
1. Đăng nhập vào **Cloudflare Dashboard** → chọn **Storage & Databases** → **D1 SQL Database**.
2. Chọn Database đang dùng (ví dụ: `zenspace`).
3. Chuyển sang thẻ **Console**.
4. Mở file [workers/livekit-schema.sql](file:///c:/Users/leuti/Desktop/GitHub/Study_Space/workers/livekit-schema.sql) trong dự án, copy toàn bộ nội dung và dán vào ô Console:
   ```sql
   -- Tự động DROP và TẠO MỚI meet_rooms & meet_audit_logs
   DROP TABLE IF EXISTS meet_audit_logs;
   DROP TABLE IF EXISTS meet_rooms;

   CREATE TABLE meet_rooms (
     name TEXT PRIMARY KEY,
     host_uid TEXT NOT NULL,
     host_identity TEXT NOT NULL,
     co_host_uids TEXT NOT NULL DEFAULT '[]',
     locked INTEGER NOT NULL DEFAULT 0,
     password_hash TEXT DEFAULT NULL,
     created_at INTEGER NOT NULL
   );

   CREATE TABLE meet_audit_logs (
     id TEXT PRIMARY KEY,
     room_name TEXT NOT NULL,
     actor_uid TEXT NOT NULL,
     actor_role TEXT NOT NULL,
     action TEXT NOT NULL,
     target_identity TEXT,
     metadata TEXT,
     created_at INTEGER NOT NULL
   );
   ```
5. Bấm **Execute**. Kiểm tra kết quả trả về thông báo thành công.

#### Cách 2: Qua dòng lệnh Wrangler CLI (Nếu có cài đặt)
```bash
npx wrangler d1 execute zenspace --file=workers/livekit-schema.sql
```

---

### Bước 2: Cập nhật Cloudflare Worker `livekit`

1. Truy cập **Cloudflare Dashboard** → **Workers & Pages** → Chọn Worker tên **`livekit`**.
2. Bấm vào nút **Edit code** (góc trên bên phải).
3. Mở file [workers/livekit-rooms/worker.js](file:///c:/Users/leuti/Desktop/GitHub/Study_Space/workers/livekit-rooms/worker.js) trong source code dự án, copy toàn bộ nội dung và dán đè vào trình soạn thảo Cloudflare Worker.
4. Bấm **Deploy**.

> [!NOTE]
> - Các biến môi trường và secret (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `FIREBASE_PROJECT_ID`, `DB`) **được giữ nguyên**, không cần cấu hình lại.
> - Worker đã hỗ trợ method `DELETE` cho CORS (dùng khi gỡ mật khẩu hoặc gỡ phó phòng).

---

### Bước 3: Deploy Frontend Next.js

1. **Kiểm tra môi trường build**:
   Đảm bảo file `.env.local` hoặc biến môi trường build trên GitHub Actions / Cloudflare Pages có:
   ```env
   NEXT_PUBLIC_LIVEKIT_TOKEN_URL=https://livekit.<subdomain>.workers.dev
   ```
2. **Build và Deploy**:
   - Nếu bạn dùng **GitHub Pages** (tự động qua CI): Đẩy code lên nhánh `main`, quy trình GitHub Actions sẽ tự build và deploy.
   - Nếu bạn build thủ công để upload:
     ```bash
     npm run build
     ```
     Bản xuất tĩnh sẽ được xuất ra thư mục `out/`.

---

## 🔍 Danh Sách Kiểm Tra Sau Triển Khai (Smoke Test Checklist)

Sau khi deploy xong cả 3 bước, hãy thực hiện kiểm thử nhanh theo kịch bản:

- [ ] **1. Tạo phòng & Nhận vai Trưởng phòng**:
  - Dùng tài khoản A vào tạo một phòng mới (ví dụ: `toan-cao-cap`).
  - Mở phòng: Góc người dùng A phải có huy hiệu **Trưởng phòng 👑**.
  - Kiểm tra thanh công cụ: Thấy nút **Quản lý 🛡️** và **Lịch sử 📜**.

- [ ] **2. Thử nghiệm Reconnect Flapping (F5 / Mất mạng)**:
  - Tài khoản A tải lại trang (F5) hoặc ngắt kết nối mạng rồi bật lại.
  - Sau khi kết nối lại: Tài khoản A **vẫn giữ nguyên huy hiệu Trưởng phòng 👑**, quyền không bị mất.

- [ ] **3. Bổ nhiệm & Hủy Phó phòng**:
  - Cho tài khoản B tham gia phòng `toan-cao-cap`.
  - Tài khoản A bấm vào menu trên ô hình của B → chọn **Chỉ định làm Phó phòng**.
  - Tài khoản B lập tức xuất hiện huy hiệu **Phó phòng ⭐** (real-time) và xuất hiện nút **Quản lý 🛡️**.
  - Tài khoản A bấm **Hủy quyền Phó phòng** → Tài khoản B trở về thành viên thường.

- [ ] **4. Khóa phòng & Mật khẩu phòng**:
  - Bấm nút **Quản lý 🛡️**:
    - Bật công tắc **Khóa phòng (Không cho người mới vào)**.
    - Cho tài khoản C thử vào phòng → Nhận thông báo lỗi: *"Phòng học đã bị khóa bởi trưởng phòng"*.
    - Mở khóa phòng, sau đó đặt **Mật khẩu phòng** (ví dụ: `123456`).
    - Tại sảnh chờ: Thấy biểu tượng chìa khóa 🔑 cạnh tên phòng.
    - Cho tài khoản C vào phòng → Xuất hiện ô nhập mật khẩu → Nhập đúng thì vào được.

- [ ] **5. Kiểm soát trật tự (Kick & Mute)**:
  - Trưởng phòng hoặc Phó phòng bấm nút **Tắt micro** trên ô của người khác → Micro của người đó bị tắt ngay lập tức.
  - Bấm nút **Mời ra khỏi phòng** → Hiện popup xác nhận → Xác nhận → Thành viên đó bị đẩy ra sảnh chờ.

- [ ] **6. Xem lịch sử học tập**:
  - Bấm nút **Lịch sử 📜** trên thanh tiêu đề → Bảng lịch sử hiển thị tổng phút học, số phiên và số người tham gia của tháng hiện tại (ẩn danh 100%).

---

## 🆘 Xử Lý Sự Cố Thường Gặp

| Lỗi / Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **HTTP 500 khi vào phòng** | Thiếu bảng hoặc cột mới trong D1 | Chạy lại script trong `workers/livekit-schema.sql` trên Cloudflare D1 Console (Bước 1). |
| **CORS error khi gỡ mật khẩu (DELETE)** | Worker phiên bản cũ chưa cập nhật CORS | Kiểm tra lại xem đã bấm **Save and deploy** code mới trong `workers/livekit-rooms/worker.js` chưa. |
| **Không tắt được mic người khác (Mute fail)** | Chưa cấp quyền API trong LiveKit Cloud | Kiểm tra `LIVEKIT_API_KEY` và `LIVEKIT_API_SECRET` trong Worker xem có quyền thao tác Room Admin không. |
