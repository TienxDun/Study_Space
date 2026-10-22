# Task Phase 1 — Trải nghiệm phòng học nhóm

## Bối cảnh

Phase 0 đã được nghiệm thu: giới hạn 6 người/phòng, hạn mức 4.500 phút/tháng, đồng hồ phiên 120 phút, webhook đếm phút chống trùng, fail-open khi D1 lỗi.

Phase 1 chỉ làm trải nghiệm vào phòng. Không sửa lại logic Phase 0 nếu không cần thiết.

## Mục tiêu

1. Có link mời phòng.
2. Có bước xem trước mic/cam trước khi vào phòng.
3. Hiển thị chất lượng kết nối và trạng thái đang kết nối lại.
4. Mobile có thể chia sẻ màn hình nếu trình duyệt hỗ trợ.
5. Hiển thị thời lượng đã học trong phòng.

## Không làm trong task này

- Không làm host/khóa phòng/phòng chờ.
- Không làm reaction, Pomodoro, trạng thái học tập.
- Không làm trang admin/điểm danh.
- Không thêm thư viện mới; dùng những gì `@livekit/components-react` đã có.
- Không đổi key localStorage, trừ khi thật cần và phải thêm vào `src/lib/storage-keys.ts`.

## P1-1. Link mời phòng

### Hàm dùng chung

Tạo file `src/lib/meet-invite.ts` với các hàm thuần:

```ts
export function buildInviteLink(room: string, baseUrl?: string): string;
export function readInviteRoom(search: string): string | null;
```

Yêu cầu:

- `buildInviteLink` giữ nguyên origin + pathname (để chạy đúng base path của GitHub Pages), xóa query/hash cũ, thêm `?room=<room>`.
- `readInviteRoom` đọc `room` từ query string, trim, giới hạn 32 ký tự, trả `null` nếu rỗng.
- Không hardcode `https://zenstudy.space`.
- Có test `src/__tests__/unit/study/meet-invite-link.test.ts` cho:
  - Tạo link từ URL có sẵn query/hash.
  - Giữ đúng pathname có base path.
  - Đọc được `?room=phong-toan`.
  - Trả `null` khi thiếu hoặc rỗng.

### Nút copy link

Thêm nút "Copy link mời" ở:

- Sảnh phòng desktop.
- Sảnh phòng mobile.
- Header trong phòng desktop và mobile.

Hành vi:

- Nếu chưa nhập tên phòng ở sảnh, nút disabled hoặc báo "Nhập tên phòng trước".
- Trong phòng thì copy link của phòng đang học.
- Dùng `navigator.clipboard.writeText`, thành công hiện toast "Đã copy link mời", lỗi hiện toast báo không copy được.

### Khi mở app có `?room=`

- Đọc query khi component phòng học mount.
- Nếu có phòng hợp lệ: mở panel phòng học và điền sẵn tên phòng.
- **Không tự động vào phòng.** Người dùng vẫn phải bấm "Vào phòng".
- Nếu chưa đăng nhập: vẫn mở panel, hiện màn hình đăng nhập như hiện tại.
- Chỉ xử lý một lần, tránh mở panel lặp lại mỗi lần re-render.
- Không làm lỗi hydration ở Next.js: đọc URL trong `useEffect`.

## P1-2. Pre-join

### Luồng

Hiện tại bấm "Vào phòng" là gọi API lấy token và kết nối luôn. Đổi thành:

1. Bấm "Vào phòng" → mở bước xem trước.
2. Người dùng xem camera, chọn mic/cam, bật/tắt.
3. Bấm "Vào phòng" lần nữa → mới gọi API lấy token và kết nối.
4. Bấm "Hủy" → đóng bước xem trước, không gọi API, không tạo token.

### Giao diện

- Dùng `usePreviewTracks` và `MediaDeviceMenu` của `@livekit/components-react`.
- Không dùng `PreJoin` prefab nếu không style được theo theme hiện tại.
- Có video preview camera.
- Có chọn microphone và camera.
- Có nút bật/tắt mic, bật/tắt camera trước khi vào.
- Có tên phòng và tên người dùng.
- Nếu người dùng từ chối quyền mic/cam: hiện thông báo nhẹ, vẫn cho bấm vào phòng với mic/cam tắt.

### Kết nối

- Truyền lựa chọn mic/cam ban đầu vào `LiveKitRoom` (đang để `audio={false} video={false}`).
- Không lưu lựa chọn thiết bị vào localStorage trong task này.
- Khi hủy pre-join phải tắt camera preview, không để đèn camera sáng.

## P1-3. Chất lượng kết nối và reconnect

### Chất lượng

- Thêm `ConnectionQualityIndicator` nhỏ trên mỗi tile người tham gia.
- Không che tên hoặc trạng thái mic/cam.

### Reconnect

- Lắng nghe `RoomEvent.Reconnecting`, `RoomEvent.Reconnected`, `RoomEvent.Disconnected`.
- Khi đang kết nối lại: hiện banner "Đang kết nối lại..." ở đầu phòng.
- Khi kết nối lại thành công: ẩn banner.
- Chỉ gọi `onLeave` khi thực sự `Disconnected`, không gọi khi đang reconnect.

### Thời lượng đã học

- Header trong phòng hiển thị thêm thời gian đã học, ví dụ `Đã học 12:34`.
- Giữ nguyên đồng hồ đếm ngược 120 phút hiện có.
- Cả desktop và mobile đều thấy.

## P1-4. Chia sẻ màn hình trên mobile

- Thêm nút chia sẻ màn hình vào `MobileRoomView`.
- Chỉ hiện nút nếu `navigator.mediaDevices?.getDisplayMedia` tồn tại.
- iOS Safari không hỗ trợ thì ẩn nút, không hiện nút bấm vào bị lỗi.
- Dùng `TrackToggle` với `Track.Source.ScreenShare`.
- Không làm thay đổi nút mic/cam/chat hiện có.

## Ràng buộc kỹ thuật

- UI tiếng Việt có dấu.
- Không dùng `!important`.
- Không thêm dependency.
- Không hardcode secret.
- Không phá các tính năng Phase 0: giới hạn 6 người, quota, đồng hồ 120 phút, webhook.
- Mobile và desktop dùng chung logic ở `StudyRoomsWidget`; không tạo state machine mobile thứ hai.
- Nếu thêm state mới vào luồng chung, đi qua `useStudySpaceState` khi cần.

## Kiểm tra trước khi báo xong

Chạy:

```bash
npm test
npx tsc --noEmit
npm run lint
git status --short
```

Yêu cầu:

- Toàn bộ test cũ vẫn pass.
- Có test mới cho `meet-invite-link`.
- Không có lỗi TypeScript.
- Lint 0 error.
- Báo đúng trạng thái git, không ghi "sạch" nếu còn file thay đổi.
- Không commit trừ khi được yêu cầu.

## Nghiệm thu thủ công

1. Mở `http://localhost:3001/?room=phong-test`:
   - Panel phòng học mở.
   - Ô tên phòng điền `phong-test`.
   - Chưa tự vào phòng.
2. Chưa đăng nhập:
   - Panel hiện màn hình đăng nhập.
   - Sau khi đăng nhập, tên phòng vẫn còn.
3. Copy link:
   - Copy từ sảnh, dán vào tab ẩn danh → mở đúng phòng, điền sẵn tên.
   - Copy trong phòng → mở đúng phòng đang học.
4. Pre-join:
   - Thấy preview camera.
   - Tắt mic/cam trước khi vào → vào phòng đúng trạng thái.
   - Hủy → không vào phòng, camera tắt.
   - Từ chối quyền camera/mic → vẫn vào phòng được với mic/cam tắt.
5. Trong phòng:
   - Có chỉ báo chất lượng mạng.
   - Ngắt mạng khoảng 5 giây → hiện "Đang kết nối lại...", có mạng lại → banner biến mất, không bị đá ra.
   - Header hiện thời gian đã học.
   - Đồng hồ 120 phút vẫn chạy.
6. Mobile:
   - Android Chrome có nút chia sẻ màn hình.
   - iOS Safari ẩn nút chia sẻ màn hình.
7. Phase 0 vẫn đúng:
   - Người thứ 7 bị báo phòng đủ.
   - Hạn mức và đếm phút không thay đổi.

## Mẫu báo cáo

Báo theo bảng:

| Mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P1-1 Link mời |  | file:line, tên test |
| P1-2 Pre-join |  | file:line |
| P1-3 Chất lượng/reconnect |  | file:line |
| P1-4 Screen share mobile |  | file:line |
| Test + build |  | output lệnh |

Kèm danh sách file đã sửa và rủi ro còn lại.
