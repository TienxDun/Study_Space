# Lộ trình phòng học nhóm LiveKit

- **Cập nhật:** 22/10/2026
- **Trạng thái:** Phase 0 và Phase 1 đạt code/test; Phase 2 đạt code/unit test và P2-6 đã kiểm thử thủ công; Phase 3 chưa bắt đầu.
- **Nguồn thông tin vận hành:** [`PHONG_HOC_NHOM.md`](./PHONG_HOC_NHOM.md)

## 1. Mục tiêu

Giữ chi phí LiveKit ở mức 0đ với gói Build, đồng thời:

- Không vượt 4.500 phút-người/tháng.
- Không cộng trùng phút khi reconnect hoặc webhook retry.
- Giới hạn 6 người/phòng và phiên tối đa 120 phút.
- Thêm tính năng học nhóm không làm tăng phút-người.

## 2. Giới hạn đang áp dụng

| Tài nguyên | Giá trị |
|---|---|
| Người/phòng | 6 |
| Phiên tối đa | 120 phút |
| Ngưỡng chặn tháng | 4.500 phút-người |
| Hạn mức thật gói Build | 5.000 phút/tháng |
| Token vào phòng | 2 giờ |
| Phòng trống tự đóng | 300 giây |

Các giá trị cấu hình được bằng biến môi trường của Worker, không cần sửa code.

## 3. Trạng thái các phase

| Phase | Nội dung | Trạng thái |
|---|---|---|
| Phase 0 | Quota, giới hạn phòng, webhook đếm phút, fail-open | Đạt code/test |
| Phase 1 | Link mời, pre-join, reconnect, screen share mobile | Đạt code/test |
| Phase 2 | Trạng thái học tập, giơ tay, Pomodoro đồng bộ, reaction | Hoàn thành |
| Phase 3 | Host, moderation, admin, lịch sử giờ học | Chưa bắt đầu |

### Phase 2 — phần còn lại

- Chạy checklist P2-6 trong [`PHONG_HOC_NHOM.md`](./PHONG_HOC_NHOM.md#manual-test-p2-6--chờ-test) với 2 tài khoản thật.
- Xác nhận Pomodoro tự chuyển `focus → nghỉ → focus`, toast + âm thanh + rung ở cả hai client.
- Xác nhận owner rời phòng thì timer được adopt, không mất trạng thái.
- Xác nhận mobile 320/375/390px không tràn ngang và menu reaction không bị cắt.

Chi tiết task và checklist kỹ thuật: [`superpowers/specs/2026-10-22-livekit-phase2-task.md`](../superpowers/specs/2026-10-22-livekit-phase2-task.md).

## 4. Quyết định kỹ thuật

- Phase 2 là **client-only**: dùng participant attributes và LiveKit Data Channel; không sửa Worker, D1, schema hoặc quota.
- Pomodoro lấy `startedAt + duration` làm nguồn thật; `endsAt` chỉ là giá trị tiện dụng.
- Chỉ owner hiện tại được ghi phase kế tiếp; mọi client nhận toast/âm thanh khi hết giờ.
- Owner rời phòng: client còn lại có identity nhỏ nhất adopt timer, giữ nguyên phase và mốc thời gian.
- Reaction là lossy, throttle 700ms, tự xóa sau 2,5 giây, không lưu lịch sử.
- Không thêm dependency, không thêm key localStorage, không commit secret.

## 5. Không làm trong đợt này

- Ghi hình, livestream, HLS/RTMP, AI agent, transcript, SIP.
- Breakout room.
- Host/kick/mute, phòng chờ, moderation.
- Trang admin điểm danh và lịch sử giờ học.
- Chặn cứng 120 phút phía server; hiện vẫn là chặn phía client.

## 6. File chính

| Khu vực | File |
|---|---|
| Worker quota/token/webhook | `workers/livekit-rooms/worker.js` |
| Schema D1 | `workers/livekit-schema.sql` |
| Protocol Phase 2 | `src/components/study/rooms/meet-protocol.ts` |
| Hook Phase 2 | `src/components/study/rooms/useMeetStudyState.ts` |
| Thanh công cụ | `src/components/study/rooms/RoomStudyBar.tsx` |
| Lớp tích hợp | `src/components/study/rooms/RoomStudyLayer.tsx` |
| Desktop | `src/components/study/rooms/StudyRoomView.tsx` |
| Mobile | `src/components/study/mobile/rooms/MobileRoomView.tsx` |
| Deploy | `docs/deployment/DEPLOY.md` |

Kế hoạch chi tiết cũ được giữ tại [`archive/livekit-free-meeting-plan.md`](../archive/livekit-free-meeting-plan.md). Không dùng file archive làm nguồn trạng thái hiện tại.
