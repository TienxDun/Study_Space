import { StudyNote } from "../types";
import { markdownToHtml } from "../utils/note-markdown";

export const DEFAULT_NOTES: StudyNote[] = [
  {
    id: "note-study-hub",
    title: "🎯 Kế hoạch Deep Work & Mục tiêu tuần",
    category: "Học tập",
    isPinned: true,
    content: markdownToHtml(`> *"Sự tập trung sâu (Deep Work) là siêu năng lực của thời đại số. 2 giờ tập trung cao độ sẽ mang lại kết quả vượt trội hơn 8 giờ bận rộn nửa vời."*

## Mục tiêu trọng tâm tuần này
- [x] Hoàn thiện cấu trúc bài tập lập trình Web
- [x] Ôn tập 30 thuật ngữ Tiếng Anh chuyên ngành
- [x] Đọc chương 3: Thiết kế Hệ thống Cơ sở Dữ liệu
- [ ] Giải 2 bài tập thuật toán rèn luyện tư duy

## Phương pháp Pomodoro (50/10)
- **Phiên tập trung (50 phút):** Đặt điện thoại chế độ không làm phiền, tập trung ghi chép liên tục.
- **Phiên giải lao (10 phút):** Uống nước, vận động nhẹ và thư giãn mắt xa màn hình.`),
    updatedAt: Date.now() - 1800000,
  },
  {
    id: "note-project-blueprint",
    title: "🚀 Dự án StudySpace: Kiến trúc & Kế hoạch",
    category: "Dự án",
    isPinned: false,
    content: markdownToHtml(`> **StudySpace** là không gian học tập nhập vai đa giác quan kết hợp video 4K, âm thanh thư giãn 3D và trình ghi chú tối giản.

## Công nghệ cốt lõi
- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, Framer Motion
- **Âm thanh & Video:** Web Audio API, YouTube Iframe API
- **Lưu trữ dữ liệu:** LocalStorage an toàn, hoạt động offline 100%

## Tiến độ hoàn thiện tính năng
- [x] Không gian video 4K sống động (Anime, Lofi, Thiên nhiên)
- [x] Bộ trộn âm thanh môi trường 20 kênh
- [x] Bảng ghi chú tối giản phong cách Notion
- [ ] Đồng bộ hóa đám mây đa thiết bị`),
    updatedAt: Date.now() - 7200000,
  },
  {
    id: "note-cheat-sheet",
    title: "📐 Sổ tay Công thức & Ngữ pháp",
    category: "Công thức",
    isPinned: false,
    content: markdownToHtml(`## Cấu trúc Ngữ pháp (Conditionals)
- **Các trường hợp không lùi thì:**
  - Sự thật hiển nhiên (Khoa học, quy luật tự nhiên).
  - Mệnh đề \`If\` loại 2 và \`If\` loại 3 giữ nguyên thì khi chuyển đổi câu.
- **Từ nối thay thế tương đương:**
  - \`Provided (that)\` = \`As long as\` = \`In case\` (Miễn là / Trong trường hợp).
  - \`Otherwise\` = \`Or else\` (Nếu không thì).
  - \`But for\` / \`Without\` + N/V-ing: Cấu trúc rút gọn đặc biệt.

## Độ phức tạp Thuật toán (Big-O)
- \`O(1)\`: Truy xuất mảng trực tiếp (Nhanh nhất)
- \`O(log n)\` : Tìm kiếm nhị phân (Binary Search)
- \`O(n)\`: Duyệt mảng tuần tự (Linear Search)
- \`O(n log n)\`: Sắp xếp tối ưu (Merge Sort, Quick Sort)`),
    updatedAt: Date.now() - 14400000,
  },
  {
    id: "note-wellness-habits",
    title: "🌿 Thói quen Tự chăm sóc & Cân bằng",
    category: "Cá nhân",
    isPinned: false,
    content: markdownToHtml(`## Quy tắc 3-2-1 để học tập bền vững
- **3 phút:** Khởi động tinh thần, sắp xếp góc bàn học trước khi mở máy.
- **2 lít:** Uống đủ nước đều đặn trong suốt các phiên học.
- **1 giờ:** Không nhìn màn hình điện thoại trước khi đi ngủ.

## Thói quen tích cực hôm nay
- [x] Thức dậy đúng giờ và uống một cốc nước ấm
- [x] Hoàn thành trọn vẹn 2 phiên Pomodoro buổi sáng
- [ ] Đi dạo 15 phút sau giờ học căng thẳng`),
    updatedAt: Date.now() - 86400000,
  },
];
