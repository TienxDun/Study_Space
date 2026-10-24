# Kế Hoạch: Người Bị Mời Khỏi Phòng Phải Biết Rõ Chuyện Gì Xảy Ra

- **Ngày lập:** 2026-10-24
- **Phạm vi:** client phòng học (`src/components/study/rooms/**`, `src/components/study/mobile/rooms/**`, `src/components/study/mobile/sheets/MobileRoomsSheet.tsx`). Backend **không bắt buộc** phải đổi.
- **Mục tiêu:** khi bị host/phó phòng kick, người dùng thấy ngay một thông báo bằng tiếng Việt giải thích vì sao phòng biến mất, thay vì bị "đổ" về màn hình học tập mà không hiểu gì.
- **Không làm:** không thêm danh sách cấm vào phòng (ban list); không đổi schema D1; không đụng Luồng Pre-join đã có.

---

## 1. Vấn đề

Log của người bị kick chỉ có 2 dòng vô hồn:

```
client leave request received (action=0)
connection state changed: connected -> disconnected
```

`action=0` là `LeaveRequest_Action.DISCONNECT`, tức **máy chủ ra lệnh rời phòng**, không phải tự nguyện. Nhưng app xử lý y hệt lúc bấm "Rời phòng": dọn state, đóng panel, về màn hình chính. Người dùng chỉ có thể đoán.

---

## 2. Nguyên nhân kỹ thuật

| Chỗ | Hiện trạng | Hệ quả |
| --- | --- | --- |
| `StudyRoomsWidget.tsx:979` và `MobileRoomsSheet.tsx:152` | `onDisconnected={handleLeave}` | Lý do rời phòng bị vứt ngay at cửa. |
| `StudyRoomsWidget.tsx:511` | `handleLeave = useCallback(() => {...})` không nhận tham số | Mọi đường ra đều giống nhau. |
| `StudyRoomView.tsx:438` / `MobileRoomView.tsx:380` | `handleDisconnected = () => setIsReconnecting(false)` | Bỏ qua tham số `reason`. |
| `workers/livekit-rooms/worker.js:437-459` | `kickParticipant` gọi `RemoveParticipant` với `{ room, identity }` | Máy chủ có gửi lý do, chỉ là client không đọc. |

Không có bất kỳ chuỗi "bị mời / kicked / removed" nào trong mã client (đã rà toàn bộ `src/components/study/rooms` và `mobile/rooms`).

---

## 3. Chìa khóa: lý do đã có sẵn trong event, không cần đổi backend

`livekit-client@2.22.4` đã truyền lý do đi suốt:

- `RTCEngine` nhận `LeaveRequest` rồi `emit(EngineEvent.Disconnected, leave.reason)` (bundle `livekit-client.esm.mjs:25408`).
- `Room` phát lại `RoomEvent.Disconnected(reason)` (`:35768`), khi tự rời thì `reason = CLIENT_INITIATED` (`:34317`).
- `@livekit/components-react` khai báo `onDisconnected?: (reason?: DisconnectReason) => void` (`dist/components-react.d.ts:960`).

Bảng `DisconnectReason` (enum `livekit.DisconnectReason` trong `@livekit/protocol`):

| Giá trị | Tên | Tình huống thực tế trong ZenStudy | Xử lý |
| --- | --- | --- | --- |
| `undefined` | — | rớt mạng, tab reload, signal socket chết | "Mất kết nối với phòng học" |
| 1 | `CLIENT_INITIATED` | tự bấm Rời phòng, pill "Rời", unmount | **Giữ nguyên như hôm nay** |
| 2 | `DUPLICATE_IDENTITY` | mở 2 tab / 2 máy cùng một tài khoản Google | "Tên này đang dùng ở nơi khác" |
| 3 | `SERVER_SHUTDOWN` | LiveKit node bảo trì | "Máy chủ phòng học đang bảo trì" |
| 4 | `PARTICIPANT_REMOVED` | **Host/phó phòng bấm mời rời phòng** (`RemoveParticipant`) | **Thông báo chính của plan này** |
| 5 | `ROOM_DELETED` | phòng bị xóa qua API/dashboard | "Phòng học đã bị đóng" |
| 6 | `STATE_MISMATCH` | server không còn nhận phiên (resume thất bại) | "Phiên phòng học không còn hợp lệ" |
| 7 | `JOIN_FAILURE` | kết nối chưa hoàn tất | "Không vào được phòng, thử lại nhé" |
| 8 | `MIGRATION` | Cloud chuyển phiên sang node khác | coi như reconnect, không báo lỗi |
| 9 | `SIGNAL_CLOSE` | websocket tín hiệu đóng | gộp vào "Mất kết nối" |
| 10 | `ROOM_CLOSED` | phòng tự đóng vì hết người | "Phòng học đã đóng vì không còn ai" |
| 11–13 | SIP/`USER_*` | không dùng trong app | bỏ qua |
| 14 | `CONNECTION_TIMEOUT` | server timeout phiên | "Kết nối quá lâu không phản hồi" |
| 15 | `MEDIA_FAILURE` | lỗi media | "Mất đường truyền âm thanh/hình ảnh" |
| 16 | `AGENT_ERROR` | không dùng | bỏ qua |

**Ràng buộc quan trọng:** `@livekit/protocol` **không phải dependency trực tiếp** của repo (`package.json` chỉ có `livekit-client`, `@livekit/components-react`). Vì vậy **không** `import { DisconnectReason } from "@livekit/protocol"`. Thay vào đó khai báo hằng số số học trong file util mới, kèm comment trỏ tới tên enum. `handleLeave` nhận `reason?: number`.

---

## 4. Thiết kế luồng xử lý (chỉ client)

### 4.1. File mới: `src/components/study/rooms/utils/room-exit.ts`

Hàm thuần, không React, test được bằng Node:

```ts
export type RoomExitKind =
  | "kicked" | "room_deleted" | "room_idle_closed" | "duplicate_identity"
  | "network" | "server" | "invalid_session" | "voluntary" | "unknown";

export interface RoomExitNotice {
  kind: RoomExitKind;
  title: string;        // copy tiếng Việt
  description: string;  // copy tiếng Việt, có chỗ chèn tên phòng
  tone: "amber" | "slate";
  allowRejoin: boolean;
  showNotice: boolean;  // false với voluntary
}

export function getRoomExitNotice(
  reason: number | undefined,
  roomName: string
): RoomExitNotice;
```

- `reason === 1 || reason === undefined` khi có cờ tự nguyện ⇒ `showNotice: false`.
- `reason === 4` ⇒ `kind: "kicked"`, `tone: "amber"`, `allowRejoin: true`.
- Hàm **không** import gì từ `livekit-client` để giữ nhẹ và test Node được.

### 4.2. `StudyRoomsWidget.tsx` — chủ sở hữu state

1. `handleLeave` đổi chữ ký: `handleLeave(reason?: number)`. Gọi từ `onDisconnected` sẽ có số; gọi từ nút "Rời phòng" / pill / hết phiên vẫn không tham số ⇒ coi là tự nguyện. Không cần cờ mới, vì `room.disconnect()` luôn phát `CLIENT_INITIATED` **sau** khi `onLeave()` đã chạy và bị `leavingRef` (`:512`) chặn.
2. Thêm state `const [exitNotice, setExitNotice] = useState<RoomExitNotice | null>(null)`. `StudyRoomsWidget` được `page.tsx:207` render thường trực nên state **sống sót** sau khi panel đóng ⇒ mở lại phòng học vẫn thấy thẻ.
3. Trong `handleLeave`, trước khi dọn state: `const notice = getRoomExitNotice(reason, joinedRoom)`; nếu `notice.showNotice` thì `setExitNotice(notice)` và bắn toast.
4. **Toast** (Sonner, hoạt động cả khi sheet mobile đã đóng):
   ```ts
   toast.warning(notice.title, {
     id: "room-exit-notice",          // kick liên tiếp không cộng dồn
     description: notice.description,
     duration: 10000,
     action: notice.allowRejoin
       ? { label: "Vào lại", onClick: () => handleStartJoin(room, name, mode) }
       : undefined,
   });
   ```
   `handleStartJoin` đã có sẵn ở `StudyRoomsWidget.tsx:410-437`, tự suy ra `passwordMode` từ `openRooms`.
5. Không đụng `handleSessionExpire` (`StudyRoomView.tsx:463-471`) — đã có toast riêng và gọi `onLeave()` không tham số.

### 4.3. Thẻ thông báo trong sảnh (lobby)

Render **cùng vị trí với khối `error` hiện tại**: desktop `StudyRoomsWidget.tsx:934`, mobile `MobileRoomsSheet.tsx:501`.

- Component mới `src/components/study/rooms/components/RoomExitNotice.tsx`, props `{ notice, onRejoin, onDismiss }`, dùng ở cả 2 layout (tránh phân nhánh mobile ở file lớn).
- Nội dung: icon cảnh báo, `notice.title`, `notice.description`, 2 nút: **"Đã hiểu"** (xóa notice) và **"Vào lại phòng"** (chỉ khi `allowRejoin`).
- Xóa notice khi: bấm "Đã hiểu", hoặc vào phòng thành công (`doJoin` thành công ở `:302-391`), hoặc notice mới thay thế.

### 4.4. Style — bắt buộc theo chuẩn phòng học đã chốt

- Nền **glass** (`glass-panel`), chữ sáng; **chỉ dùng accent emerald** cho hành động chính và **amber** cho cảnh báo. **Không** dùng đỏ/rose cho thẻ này (rose đang dành riêng cho modal xác nhận phá hủy).
- Shell phòng học giữ **đục**, không trong suốt — thẻ nằm ở sảnh nên dùng glass là đúng.
- Không `!important` (lint `scripts/check-important.mjs` sẽ fail).
- Mobile: theo `docs/guides/mobile-style-guide.md`, nút cao tối thiểu 44px, thẻ không che mất danh sách phòng.

---

## 5. Copy tiếng Việt (đề xuất, cần duyệt)

| kind | title | description |
| --- | --- | --- |
| `kicked` | Bạn được mời ra khỏi phòng | "Trưởng phòng hoặc phó phòng đã mời bạn rời khỏi “X”. Bạn vẫn có thể vào lại nếu phòng còn mở." |
| `room_deleted` | Phòng học đã bị đóng | "Phòng “X” vừa bị đóng. Dữ liệu phiên học của bạn đã được lưu trên máy." |
| `room_idle_closed` | Phòng học đã đóng | "Không còn ai trong phòng “X” nên phòng đã tự đóng." |
| `duplicate_identity` | Tên này đang dùng ở nơi khác | "Một tab hoặc thiết bị khác đang vào phòng bằng danh tính của bạn. Đóng tab đó rồi vào lại." |
| `network` | Mất kết nối với phòng học | "Không giữ được kết nối với phòng “X”. Kiểm tra mạng rồi vào lại nhé." |
| `server` | Máy chủ phòng học đang bảo trì | "Thử vào lại sau ít phút." |
| `invalid_session` | Phiên phòng học không còn hợp lệ | "Máy chủ không còn nhận phiên này. Vào lại phòng để tiếp tục." |

---

## 6. Giai đoạn 2 (tùy chọn): cho biết **ai** đã kick

`DisconnectReason` chỉ nói "bị đá", không nói bởi ai. Nếu muốn hiện "Trưởng phòng **Minh Anh** đã mời bạn rời phòng":

1. `workers/livekit-rooms/worker.js` — trong `kickParticipant` (`:437-459`), **trước** khi gọi `RemoveParticipant`, gọi Twirp `livekit.RoomService/SendData`:
   - `topic: "zen:moderation"`, `kind: reliable`, `destination_identities: [targetIdentity]`, payload `{ action: "kick", room, by: { identity, name } }`.
   - Tên người kick lấy từ `env`/body của route `POST /rooms/:name/kick` (`:1185-1202`) — hiện route đã biết `actor` vì đang ghi audit log (`:424-435`).
2. Client — `useMeetStudyState.ts:202-235` hiện `if (topic !== MEET_REACTION_TOPIC) return;` ⇒ thêm nhánh `zen:moderation`, lưu vào `lastExitByRef` để `handleLeave` chèn vào `description`.
3. **Độ tin cậy:** `SendData` và `RemoveParticipant` là hai lời gọi HTTP riêng biệt, message **có thể** tới sau khi client đã đóng data channel ⇒ đây chỉ là thông tin tăng cường, phần lõi vẫn là `DisconnectReason`. Nếu message không tới thì fallback về "Trưởng phòng hoặc phó phòng".

Quyết định: **không làm giai đoạn 2 trong đợt đầu** nếu bạn chỉ cần người dùng hiểu "mình bị mời ra".

---

## 7. File cần sửa (giai đoạn 1)

| File | Thay đổi |
| --- | --- |
| `src/components/study/rooms/utils/room-exit.ts` | **Mới** — bảng ánh xạ `reason → notice`, không import livekit. |
| `src/components/study/rooms/components/RoomExitNotice.tsx` | **Mới** — thẻ thông báo dùng chung 2 layout. |
| `src/components/study/rooms/StudyRoomsWidget.tsx` | `handleLeave(reason?)` (`:511`), state `exitNotice`, toast, `onDisconnected` (`:979`), render thẻ ở sảnh (`:934`), truyền props xuống sheet. |
| `src/components/study/mobile/sheets/MobileRoomsSheet.tsx` | `onDisconnected={handleLeave}` (`:152`) đã tự nhận reason; thêm props `exitNotice` + render thẻ cạnh khối `error` (`:501`). |
| `src/components/study/rooms/types.ts` (hoặc khai báo props tại chỗ) | Kiểu cho props mới. |

Không sửa: `StudyRoomView.tsx`, `MobileRoomView.tsx`, worker, schema.

---

## 8. Test

### 8.1. `src/__tests__/unit/study/room-exit.test.ts` (Mới, Node thuần)

1. `reason=4` → `kind "kicked"`, `showNotice true`, `tone "amber"`, `allowRejoin true`, description chứa tên phòng.
2. `reason=1` và `reason=undefined` → `showNotice false` (không làm phiền người tự rời).
3. `reason=5` → `room_deleted`; `reason=10` → `room_idle_closed`; `reason=2` → `duplicate_identity`; `reason=9`/`undefined` → `network`; `reason=3`/`8` → `server`/im lặng; `reason=14`/`15` → `network`.
4. Giá trị lạ (99) → `unknown`, không crash, vẫn có title tiếng Việt.
5. Không có chuỗi tiếng Anh nào lọt ra ngoài.

### 8.2. `src/__tests__/unit/study/room-exit-notice.test.tsx` (Mới, `// @vitest-environment happy-dom`)

- Render `RoomExitNotice` với notice `kicked` → thấy title, 2 nút; bấm "Đã hiểu" gọi `onDismiss`, bấm "Vào lại" gọi `onRejoin`.
- `allowRejoin: false` → không render nút "Vào lại".

### 8.3. Test hiện có phải giữ nguyên màu xanh

`study-mobile-rooms.test.ts`, `study-rooms-auth.test.ts`, `meet-host-moderation.test.ts`, `study-mobile-sheets.test.ts`.

---

## 9. Kiểm tra thủ công (cần 2 trình duyệt, có đăng nhập Google)

| # | Kịch bản | Cách làm | Kỳ vọng |
| --- | --- | --- | --- |
| 1 | Bị kick khi đang mở phòng | A (host) tạo phòng → B vào → A rê chuột ô video B, bấm icon mời ra → xác nhận | B thấy toast "Bạn được mời ra khỏi phòng" + panel đóng; mở lại sảnh thấy thẻ, còn nút "Vào lại". |
| 2 | Bị kick khi sheet mobile đang đóng | B ở mobile, thu về pill "Đang học" → A kick | Toast vẫn hiện (Sonner render ở gốc trang), pill biến mất. |
| 3 | Vào lại sau khi bị kick | B bấm "Vào lại" | Pre-join mở; nếu A đã khóa phòng thì nhận `ROOM_LOCKED` (worker.js:888-893) → đã có báo lỗi sẵn ở pre-join. |
| 4 | Tự rời phòng | B bấm "Rời phòng" → Xác nhận | Chỉ toast "Đã rời phòng học nhóm" như cũ, **không** có thẻ cảnh báo. |
| 5 | Hai tab cùng tài khoản | Mở 2 tab cùng login, cùng vào 1 phòng | reason=2 → "Tên này đang dùng ở nơi khác". |
| 6 | Rớt mạng | B tắt WiFi trong phòng | Reconnecting banner trước, nếu fail mới ra "Mất kết nối". |
| 7 | Hết phiên Pomodoro phòng | Chờ `handleSessionExpire` | Chỉ toast giới hạn phút, không chồng cảnh báo kick. |

Giới hạn: trình duyệt headless trong phiên làm việc không đăng nhập Google được, nên mục 1–6 phải bấm tay trên máy bạn.

---

## 10. Edge cases

| Tình huống | Kết quả |
| --- | --- |
| Bị kick đang ở fullscreen | `handleLeave` đã exit fullscreen trước (`StudyRoomsWidget.tsx:514-528`), thẻ hiện ở sảnh khi mở lại. |
| Host kick liên tiếp 2 lần (vào lại rồi bị lại) | Toast dùng `id` chung nên replace, không xếp chồng; `exitNotice` ghi đè. |
| Bị kick rồi đổi sang tab khác của app | Toast vẫn thấy; thẻ chờ trong sảnh phòng học. |
| `joinedRoom` đã rỗng lúc tính notice | Đọc `joinedRoom` **trước** `setJoinedRoom("")` trong `handleLeave`. |
| Reconnect ngắn hạn | `RoomEvent.Reconnecting` không phát `Disconnected` ⇒ không báo oan. |
| `LeaveRequest.action = RECONNECT/RESUME` | Client không emit `Disconnected` (bundle `:25411-25417`) ⇒ không liên quan. |
| Người dùng tắt tab ngay khi bị kick | Không có gì để lưu; notice chỉ là UI, không phải dữ liệu. |

---

## 11. Đánh đổi đã biết

- **Người bị kick vào lại được ngay.** Worker không có ban list, nên "Vào lại" luôn hợp lệ (trừ khi phòng bị khóa). Muốn chặn thật sự phải thêm cột `kicked_until` vào `meet_rooms` và kiểm ở `/token` — tách thành plan riêng.
- **Không nói được tên người kick** ở giai đoạn 1 (mục 6 giải quyết, đánh đổi bằng 1 lần `SendData` có thể trượt).
- Toast biến mất sau 10 giây; nếu user đang ở tab khác thì chỉ còn thẻ trong sảnh — chấp nhận được vì không phải dữ liệu mất.

---

## 12. Câu hỏi cần chốt trước khi code

1. **Mức độ báo:** (A) toast + thẻ trong sảnh — đề xuất; (B) thêm modal bắt bấm "Đã hiểu"; (C) chỉ toast.
2. **Nút "Vào lại":** (A) cho vào lại ngay — đề xuất; (B) ẩn nút này với `kicked`, chỉ để "Đã hiểu"; (C) cho vào lại nhưng đợi 30 giây.
3. **Giai đoạn 2 (hiện tên người kick, cần sửa worker):** làm luôn hay để sau?

---

## 13. Lệnh kiểm tra

```bash
npx vitest run src/__tests__/unit/study/room-exit.test.ts src/__tests__/unit/study/room-exit-notice.test.tsx
npm test
npx tsc --noEmit
npm run lint
```

---

## 14. Tiêu chí hoàn thành

- Người bị kick thấy **một câu tiếng Việt** nói rõ "bạn được mời ra khỏi phòng", cả desktop lẫn mobile, kể cả khi sheet đang đóng.
- Mở lại mục "Phòng học nhóm" vẫn còn thẻ thông báo, bấm "Đã hiểu" thì mất.
- Tự bấm "Rời phòng" **không** hiện cảnh báo nào khác so với hôm nay.
- Các lý do rời phòng khác (mất mạng, trùng danh tính, phòng đóng) được gọi tên đúng, không dùng chung một câu.
- Không thêm dependency, không sửa worker, không sửa schema D1, lint/tsc/test sạch.
