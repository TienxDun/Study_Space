# Firestore Rules — Bắt buộc tuân theo khi triển khai DB cho ZenSpace

> Nguồn: Firebase Pricing + Firestore Quotas (docs chính thức, chốt 13/10/2026).
> Gói Spark (free). File này là chuẩn cho mọi code đọc/ghi DB.
> File cũ `docs/gemini-proxy-rules.md` (thời Gemini) đã bỏ, không áp dụng nữa.

## 0. Hạn mức free phải nhớ (Spark)

| Tài nguyên | Free | Vượt thì sao |
|---|---|---|
| Auth (Google/email) | 50.000 MAU/tháng | Vượt mới tính tiền |
| Firestore đọc | 50.000 lượt/ngày | Đứng hình tới hôm sau |
| Firestore ghi | 20.000 lượt/ngày | Đứng hình tới hôm sau |
| Firestore xóa | 20.000 lượt/ngày | Đứng hình tới hôm sau |
| Firestore chứa | 1 GB | Không ghi thêm được |
| Firestore tải về | 10 GB/tháng | Đứng hình tới tháng sau |
| Storage | 5 GB chứa, 1 GB tải/ngày | Đứng hình |
| Cloud Functions outbound | Chỉ được gọi dịch vụ Google | Không gọi được Groq/API ngoài |

## 1. Rules đọc (vì lượt đọc hết nhanh nhất)

- [R1.1] Mọi list (lịch sử chat, tài liệu) phải có `limit()` 20–50, kéo tới đâu tải tới đó. Cấm `get()` cả collection.
- [R1.2] Hồ sơ + cài đặt user cache ở trình duyệt (localStorage), chỉ hỏi Firestore khi đổi máy hoặc sau 24h.
- [R1.3] Không gắn realtime listener (`onSnapshot`) lên collection lớn. Chỉ listen đúng 1 document đang mở (vd phiên chat hiện tại).
- [R1.4] Bật offline persistence của Firestore SDK để đọc lại không tốn lượt.
- [R1.5] Hiển thị preview (tin nhắn cuối, tên đoạn chat) phải đọc từ 1 document cha đã denormalize, không đọc thêm document con.

## 2. Rules ghi (20K/ngày ≈ 20K câu chat/ngày)

- [R2.1] Đếm lượt chat: đúng 1 `increment(1)` vào `usage/{uid}/{yyyy-mm-dd}` mỗi câu hỏi. Không ghi log dư.
- [R2.2] Lưu tin nhắn: 1 write/tin (user + assistant = 2 writes/câu). Không tách nhỏ document.
- [R2.3] Gom nhiều ghi cùng lúc bằng `writeBatch()` khi được (vd tạo phiên + tin đầu).
- [R2.4] Không dùng document làm log tần suất cao (typing, view). Lưu ở memory/client.

## 3. Rules chứa (1 GB)

- [R3.1] Ảnh/file học tập nặng ở R2 như hiện tại, Firestore chỉ lưu URL + metadata.
- [R3.2] Tin nhắn dài cắt ở ~8000 ký tự trước khi lưu (đồng bộ với MAX_TEXT của Worker).
- [R3.3] Lịch sử quá 90 ngày: cho phép user xóa tay, không auto-xóa bằng Cloud Functions (tránh tốn write + function).

## 4. Rules bảo mật (Firestore Rules)

- [R4.1] Mọi document user chỉ chính chủ đọc/ghi: `allow read, write: if request.auth.uid == userId`.
- [R4.1b] Subcollection `messages`: cho phép khi `cid == uid` (luồng chính), hoặc document cha tồn tại (`exists()`) và ghi đúng `ownerUid`. Bắt buộc có `exists()` vì người mới chưa có document cha — thiếu là bị từ chối oan. Cho phép `update` (làm lại câu trả lời, không được đổi `role`, text ≤ 8000) và `delete` (xóa đoạn chat) — thiếu là bấm Làm lại/Xóa đoạn sẽ báo lỗi mạng oan. Phiên riêng `sessions/{sid}` + tin trong phiên áp dụng đúng mẫu này (đường dẫn `conversations/{cid}/sessions/{sid}/messages/{mid}`), document phiên mới bắt buộc có `ownerUid == uid`.
- [R4.1c] Đọc document cha `conversations/{cid}`: cho phép khi `cid == uid` kể cả document chưa tồn tại (người mới) — vì `resource.data` của document chưa có sẽ lỗi và Rules từ chối oan, gây `permission-denied` trong `onSnapshot`.
- [R4.2] Collection `usage/*`: client chỉ được đọc của mình, **cấm ghi trực tiếp** (số lượt do Worker cộng bằng Admin SDK hoặc increment có validate).
- [R4.3] Validate kiểu dữ liệu ở Rules (text là string, ≤ 8000 ký tự).
- [R4.4] Không bao giờ để rule `allow read, write: if true`.
- [R4.5] Xoá tài khoản cần xoá cả document cha `conversations/{cid}`: cho phép `delete` khi `cid == uid` hoặc `ownerUid == uid`. Subcollection `sessions`/`messages` xoá trước, document cha xoá sau (client bỏ qua `permission-denied` ở document cha nếu rules chưa publish).

## 5. Rules cấm

- [R5.1] Cấm đăng nhập SMS (tốn tiền/tin). Chỉ Google + email.
- [R5.2] Cấm chuyển proxy chatbot sang Firebase Functions gói Spark (không gọi được Groq). Proxy ở Cloudflare Worker.
- [R5.3] Cấm query không có index/composite index báo lỗi — fix bằng link tạo index của Firebase, không lách bằng đọc thừa.

## 6. Mô hình dữ liệu chuẩn

```
users/{uid}              { displayName, photoURL, createdAt, plan: "free" }
conversations/{cid}      { ownerUid, title, lastText, updatedAt, activeSid? }
conversations/{cid}/sessions/{sid}  { ownerUid, title, createdAt }
conversations/{cid}/sessions/{sid}/messages/{mid}  { role, text, createdAt, thoughtSecs? }
usage/{uid}/{yyyy-mm-dd} { count }   // 30 câu/ngày, do Worker kiểm
```

## 7. Checklist trước khi merge code DB

- [ ] Mọi query có `limit()`, không `onSnapshot` collection lớn.
- [ ] Rules R4.1–R4.4 đã deploy (`firebase deploy --only firestore:rules`).
- [ ] Test bằng 2 acc khác nhau: acc A không đọc được dữ liệu acc B.
- [ ] Vào console Usage kiểm tra % đọc/ghi sau ngày đầu chạy.
