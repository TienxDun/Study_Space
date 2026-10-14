# ZenStudy Space 🎧📚

> **Không gian học tập và làm việc nhập vai (Immersive Productivity Space) trực tuyến tại [zenstudy.space](https://zenstudy.space)**
> Loại bỏ xao nhãng, đưa tâm trí vào trạng thái dòng chảy tư duy (Flow State) với bối cảnh 4K, âm thanh thiên nhiên thư giãn và các công cụ quản lý thời gian khoa học.

[![Website](https://img.shields.io/badge/Website-zenstudy.space-6366f1?style=for-the-badge&logo=google-chrome&logoColor=white)](https://zenstudy.space)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-99_Tests_Passing-6ee7b7?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=for-the-badge)](LICENSE)

---

## 🌟 Giới Thiệu

**ZenStudy Space** là ứng dụng web không gian học tập nhập vai một màn hình (All-in-One Immersive Workspace). Ứng dụng kết hợp giữa nghệ thuật thị giác (visuals), âm học thư giãn (ambient soundscape) và các công cụ năng suất thiết yếu (Pomodoro, Kanban, Notes, Music Player) để giúp học sinh, sinh viên và người làm việc từ xa tập trung tối đa mà không bị gián đoạn hay phân tâm.

✨ **Đặc điểm nổi bật:**

- **Không cần tài khoản:** Mở trình duyệt là học ngay, 100% dữ liệu được lưu an toàn trên máy bạn (`LocalStorage`).
- **Giao diện Floating Ghost HUD:** Thiết kế không gian nổi chuẩn điện ảnh, loại bỏ viền đen nặng nề, hòa quyện tuyệt đối vào từng bối cảnh 4K.
- **Tập trung tuyệt đối:** Tích hợp phím tắt toàn năng và chế độ Zen Mode ẩn toàn bộ giao diện chỉ với 1 phím bấm.

---

## 🚀 Tính Năng Trọng Tâm

### 🎬 1. Bối Cảnh Video 4K & Ảnh Nền Sống Động

- Kho hơn 30+ bối cảnh chuẩn điện ảnh: Quán cà phê mưa, thư viện cổ điển, phong cảnh anime chill, vũ trụ kỳ ảo, ban công ngắm mưa đêm, rừng cây thanh bình...
- Tìm kiếm nhanh chóng, lọc theo chủ đề (lofi, cozy, nature, anime, cafe, room...) và đánh dấu yêu thích (**Favorites**).
- Chuyển đổi linh hoạt giữa Video chuyển động mượt mà và Ảnh tĩnh tối ưu dung lượng pin/RAM.
- Tích hợp trang quản trị bối cảnh độc lập (`/admin/scenes`) và đồng bộ tài nguyên qua Cloudflare R2 / AWS S3.

### 🌧️ 2. Bộ Trộn Âm Thanh Thiên Nhiên (Ambient Sound Mixer)

- Hơn 20 âm thanh môi trường độc bản: Tiếng mưa rào, mưa mái tôn, sấm rền dịu êm, sóng biển vỗ bờ, gió luồn qua rặng cây, tiếng lật sách thư viện, bếp lửa tí tách, chim hót bình minh, tiếng ồn trắng (White Noise), sóng não Theta...
- Bộ trộn đa tầng: Tùy ý điều chỉnh âm lượng độc lập cho từng âm thanh để tạo ra soundscape độc nhất cho riêng bạn.
- Tự động ghi nhớ cấu hình âm lượng cho các phiên làm việc tiếp theo.

### 🎵 3. Trình Phát Nhạc Lo-fi, Jazz & Embed Player Đa Năng

- Tích hợp sẵn các danh sách nhạc được tuyển chọn kỹ lưỡng: **Lo-fi Chill**, **Acoustic / Piano** và **Classic Jazz**.
- Đĩa than hoạt họa (**Vinyl Artwork**) xoay nhịp nhàng theo giai điệu cùng bảng thông tin bài hát.
- **Đài phát Embed Player**: Hỗ trợ nhúng trực tiếp livestream YouTube, playlist Spotify hoặc radio trực tuyến.
- Chế độ **Picture-in-Picture (PiP)**: Thu nhỏ trình phát video nổi trên màn hình để vừa xem vừa ghi chú.
- Điều khiển thông minh: Tự động phối hợp luồng âm thanh giữa nhạc nội bộ và đài phát ngoài mà không gây xung đột.

### ⏱️ 4. Bộ Công Cụ Thời Gian Pomodoro, Clock & Stopwatch

- **Pomodoro Timer**: Cấu hình chuẩn 25-5-15 hoặc tùy chỉnh theo sở thích cá nhân. Chuông báo Web Audio du dương (chuông thiền Zen, chuông cổ điển, chim hót).
- **Đồng hồ số thời gian thực (Real-time Clock)**: Hiển thị lớn, rõ nét với định dạng 12h/24h và tùy chọn hiển thị giây.
- **Đồng hồ bấm giờ (Stopwatch)**: Bấm giờ chính xác từng mili-giây, hỗ trợ ghi lại các mốc thời gian (Lap).
- **Liên kết mục tiêu tập trung**: Hiển thị thẻ mục tiêu Task đang làm việc ngay trên thanh trạng thái Pomodoro.

### 📋 5. Bảng Quản Lý Công Việc Kanban & To-do List

- Kéo thả thẻ mượt mà qua các cột **Todo**, **In Progress**, **Done**.
- Phân loại theo độ ưu tiên (Khẩn cấp, Cao, Trung bình, Thấp), gắn hạn chót (Deadline) và danh mục.
- Chuyển đổi linh hoạt giữa giao diện Bảng (Kanban Board) và Danh sách (Task List).
- **Nút "Bắt đầu tập trung" (Play Focus)**: 1 chạm kích hoạt ngay phiên Pomodoro liên kết với Task đã chọn.
- Hiệu ứng pháo hoa **Canvas Confetti** khích lệ tinh thần khi hoàn thành công việc.

### 📝 6. Sổ Ghi Chú Nhanh (Quick Notes)

- Trình soạn thảo văn bản phong phú hỗ trợ Markdown, đề mục, danh sách công việc, trích dẫn, khối mã nguồn.
- Tùy chọn nhiều chủ đề giao diện màu sắc (Amber, Sky, Rose, Slate...) phù hợp tâm trạng.
- Chế độ **Sticky Note** thu gọn cho phép ghim ghi chú nổi gọn gàng ở góc màn hình.

### 🧭 7. Tour Hướng Dẫn & Phím Tắt Tiện Lợi

- Hệ thống Onboarding Tour tương tác trực quan cho người dùng mới làm quen mọi tính năng chỉ trong 30 giây.
- Tra cứu nhanh toàn bộ phím tắt bằng phím <kbd>?</kbd> hoặc <kbd>H</kbd>.

---

## ⌨️ Bảng Phím Tắt Nhanh (Keyboard Shortcuts)

Mọi thao tác đều có thể thực hiện nhanh chóng thông qua bàn phím:

### 🎵 Điều Khiển Âm Nhạc

|             Phím             | Chức năng                                                              |
| :---------------------------: | :----------------------------------------------------------------------- |
|       <kbd>Space</kbd>       | Bật / Tạm dừng phát nhạc (hỗ trợ cả Player nội bộ và YouTube) |
|         <kbd>→</kbd>         | Chuyển sang bài tiếp theo                                             |
|         <kbd>←</kbd>         | Quay lại bài trước đó                                              |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Tăng / Giảm âm lượng nhạc (bước 5%)                              |
|         <kbd>M</kbd>         | Bật / Tắt toàn bộ âm thanh (Mute / Unmute)                          |
|         <kbd>S</kbd>         | Bật / Tắt phát ngẫu nhiên bài hát (Shuffle)                       |
|         <kbd>L</kbd>         | Bật / Tắt lặp lại bài hát hiện tại (Loop)                        |

### 🛠️ Không Gian & Công Cụ Làm Việc

|              Phím              | Chức năng                                                             |
| :-----------------------------: | :---------------------------------------------------------------------- |
|          <kbd>Z</kbd>          | **Chế độ Zen**: Ẩn / Hiện toàn bộ giao diện điều khiển |
|          <kbd>F</kbd>          | Bật / Thoát chế độ toàn màn hình (Fullscreen)                   |
|          <kbd>T</kbd>          | Bật / Ẩn widget Đồng hồ / Pomodoro / Stopwatch                     |
|          <kbd>K</kbd>          | Mở / Đóng bảng quản lý công việc (Kanban Tasks)                 |
|          <kbd>N</kbd>          | Mở / Đóng sổ ghi chú nhanh (Quick Notes)                           |
|          <kbd>B</kbd>          | Mở / Đóng kho bối cảnh hình nền (Scenes)                         |
|          <kbd>P</kbd>          | Mở / Đóng bộ trộn âm thanh môi trường (Sound Mixer)            |
|          <kbd>E</kbd>          | Mở / Đóng đài phát nhúng (Embed Player YouTube / Spotify)        |
|          <kbd>G</kbd>          | Mở / Đóng phòng học nhóm trực tuyến (Study Rooms)               |
|          <kbd>C</kbd>          | Mở / Đóng Trợ lý học tập AI (Study Chatbot)                     |
| <kbd>?</kbd> hoặc <kbd>H</kbd> | Mở bảng tra cứu phím tắt                                           |
|         <kbd>Esc</kbd>         | Đóng mọi cửa sổ modal đang mở / Thoát Zen mode                  |

> 💡 *Lưu ý: Phím tắt sẽ tự động tạm ngưng khi bạn đang nhập văn bản trong ô tìm kiếm, ghi chú hoặc form công việc.*

---

## 🛠️ Công Nghệ Phát Triển (Tech Stack)

| Lớp                       | Công nghệ & Thư viện                                                                          | Vai trò                                                                     |
| :------------------------- | :------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------- |
| **Framework**        | [Next.js 16 (App Router)](https://nextjs.org/)                                                     | Kiến trúc hiện đại, Turbopack, hỗ trợ Static Export tối ưu          |
| **UI Core**          | [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)                     | Giao diện khai báo thành phần, kiểm soát kiểu dữ liệu nghiêm ngặt |
| **Styling**          | [Tailwind CSS v4](https://tailwindcss.com/)                                                        | Hệ thống tiện ích CSS tối tân, thiết kế Floating Ghost HUD           |
| **Motion**           | [Framer Motion](https://www.framer.com/motion/)                                                    | Chuyển động mượt mà cho cửa sổ, modal và dock điều khiển         |
| **Icons**            | [Lucide React](https://lucide.dev/)                                                                | Bộ icon vector sắc nét, tối giản và đồng bộ                         |
| **Audio**            | HTML5 Audio & Web Audio API                                                                       | Xử lý đa luồng âm thanh môi trường và chuông báo tần số cao     |
| **Toast & Confetti** | [Sonner](https://sonner.emilkowal.ski/), [Canvas Confetti](https://www.kirilv.com/canvas-confetti/) | Thông báo toast hiện đại và hiệu ứng ăn mừng sinh động           |
| **Storage & CDN**    | LocalStorage,[Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/)                    | Lưu trữ an toàn trên máy khách & phân phối video 4K siêu tốc       |
| **Testing**          | [Vitest](https://vitest.dev/)                                                                      | Bộ kiểm thử đơn vị tốc độ cao (14 test suites, 99 tests passing)    |
| **SEO & Social**     | [Sharp](https://sharp.pixelplumbing.com/), JSON-LD, OpenGraph                                      | Tối ưu hóa công cụ tìm kiếm và chia sẻ mạng xã hội               |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu cầu môi trường

- **Node.js**: Phiên bản 20.x trở lên (khuyên dùng Node.js 22 LTS).
- **NPM**: Phiên bản 10.x trở lên.

### 2. Cài đặt mã nguồn

```bash
git clone https://github.com/TienxDun/Study_Space.git
cd Study_Space
npm install
```

### 3. Khởi chạy máy chủ phát triển (Development)

```bash
npm run dev
```

Mở trình duyệt tại địa chỉ: `http://localhost:3001` (khởi chạy với chế độ Turbopack siêu tốc).

### 4. Chạy bộ kiểm thử (Unit Tests)

```bash
npm test
```

Thực thi 14 test suites với 99 bài kiểm tra tự động bao phủ logic Pomodoro, Music Player, Sound Mixer, Tasks, Notes, Embed Stream, SEO Schemas...

### 5. Kiểm tra mã nguồn (Linting)

```bash
npm run lint
```

Kiểm tra cú pháp với ESLint và kiểm tra ràng buộc không lạm dụng `!important` trong CSS.

### 6. Build bản phát hành (Production)

```bash
npm run build
```

Biên dịch dự án thành bản build tối ưu hóa cho Production.

---

## ⚙️ Biến Môi Trường (Environment Variables)

Tạo file `.env.local` tại thư mục gốc nếu bạn cần cấu hình các dịch vụ nâng cao:

```env
# URL website chính thức (dùng để sinh sitemap và metadata SEO)
NEXT_PUBLIC_SITE_URL=https://zenstudy.space

# URL CDN phân phối asset bối cảnh & âm thanh (Cloudflare R2 / Worker)
NEXT_PUBLIC_STUDY_CDN_URL=https://study-space-shield.leutiendung-hht.workers.dev

# Cấu hình đồng bộ Cloudflare R2 (dành cho scripts/sync-r2.mjs)
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET_NAME=your_bucket_name
```

---

## 📄 Bản Quyền & Tác Giả

- Dự án được phát triển và duy trì bởi **[TienxDun](https://github.com/TienxDun)**.
- Tên miền chính thức: **[zenstudy.space](https://zenstudy.space)**.
