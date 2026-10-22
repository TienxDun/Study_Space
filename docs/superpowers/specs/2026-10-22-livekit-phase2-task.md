# Task Phase 2 — Trạng thái học tập, Pomodoro đồng bộ, reaction

- **Ngày:** 2026-10-22
- **Người thực hiện:** Gemini
- **Người nghiệm thu:** opencode
- **Trạng thái:** Code + unit test đạt; P2-6 chờ kiểm thử thủ công

## Bối cảnh

Phase 0 và Phase 1 đã được nghiệm thu phần code/test:

- Giới hạn 6 người/phòng, quota 4.500 phút/tháng, phiên tối đa 120 phút.
- Webhook đếm phút, chống trùng, fail-open khi D1 lỗi.
- Link mời, pre-join, reconnect, chất lượng kết nối, screen share mobile.
- Production `/usage` đã trả đúng baseline `190` phút, còn `4.310` phút.

Phase 2 **chỉ làm phía client**. Không sửa Worker, D1, schema hay logic quota.

## Mục tiêu

1. Đồng bộ trạng thái học tập giữa các thành viên: Tập trung / Nghỉ / Cần giúp.
2. Giơ tay và hiển thị người đang giơ tay.
3. Pomodoro đồng bộ bằng participant attributes, có preset 15/3, 25/5, 50/10.
4. Reaction bay lên bằng LiveKit data channel, không lưu lịch sử.
5. Mục tiêu học tập cá nhân, tối đa 120 ký tự.
6. Desktop và mobile dùng chung logic, chỉ khác cách bày UI.

## Không làm trong task này

- Không làm host, khóa phòng, kick/mute, phòng chờ, moderation.
- Không làm trang admin, lịch sử điểm danh, thống kê cá nhân.
- Không sửa `workers/livekit-rooms/worker.js`, `workers/livekit-schema.sql`, D1 hoặc webhook.
- Không thêm dependency mới. Dùng `livekit-client`, `@livekit/components-react`, `framer-motion`, `sonner`, `@phosphor-icons/react` đã có.
- Không thêm key localStorage mới. Trạng thái Phase 2 là tạm thời trong phiên.
- Không dùng room metadata; chỉ dùng participant attributes.
- Không tự bật/tắt mic hoặc camera của người khác.
- Không lưu reaction vào D1/localStorage.
- Không sửa `src/components/study/hooks/useStudySpaceState.ts` nếu không thật sự cần.
- Không dùng `!important`.
- Không commit trước khi được yêu cầu.

## Ràng buộc kỹ thuật

- UI copy tiếng Việt có dấu; comment mới viết tiếng Việt khi cần giải thích logic khó.
- Mobile theo `docs/mobile-style-guide.md`; dùng màu/kích thước hiện có của phòng học.
- Desktop và mobile dùng chung `meet-protocol.ts` + `useMeetStudyState` + `RoomStudyBar`.
- Không tạo state machine mobile thứ hai.
- Mọi thao tác ghi attribute phải bọc `try/catch`, lỗi không làm sập phòng.
- Data channel chỉ dùng cho reaction; chat vẫn dùng `useChat`.
- Không gửi dữ liệu nhạy cảm qua attribute/data channel.

## P2-1. Protocol thuần + test

### File mới

`src/components/study/rooms/meet-protocol.ts`

### Hằng số và type

```ts
export const MEET_ATTR = {
  status: "zen.status",
  hand: "zen.hand",
  timerPhase: "zen.timer.phase",
  timerEndsAt: "zen.timer.endsAt",
  timerDuration: "zen.timer.duration",
  timerStartedAt: "zen.timer.startedAt",
  goal: "zen.goal",
} as const;

export const MEET_PRESETS = [
  { focus: 15, break: 3 },
  { focus: 25, break: 5 },
  { focus: 50, break: 10 },
] as const;

export const MEET_REACTION_TOPIC = "zenstudy.reaction.v1";
export const MEET_REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "🔥"] as const;
```

Type tối thiểu:

```ts
export type MeetStatus = "focus" | "break" | "help" | "";
export type MeetPhase = "focus" | "break" | "";
export type MeetPreset = (typeof MEET_PRESETS)[number];
export type MeetReaction = (typeof MEET_REACTIONS)[number];

export interface MeetLocalState {
  status: MeetStatus;
  handRaised: boolean;
  goal: string;
}

export interface MeetTimerData {
  phase: "focus" | "break";
  startedAt: number;
  durationSec: number;
  endsAt: number;
}

export interface ActiveMeetTimer extends MeetTimerData {
  identity: string;
  name: string;
}

export interface MeetReactionEvent {
  id: string;
  emoji: MeetReaction;
  senderName: string;
  createdAt: number;
}
```

### Hàm thuần cần có

- `parseLocalAttributes(attrs): MeetLocalState`
- `parseTimerAttributes(attrs): MeetTimerData | null`
- `pickActiveTimer(participants): ActiveMeetTimer | null`
- `remainingTimerSeconds(timer, nowMs): number`
- `nextPhasePreset(timer): { phase: "focus" | "break"; minutes: number } | null`
- `formatMeetCountdown(seconds): string`
- `isAllowedReaction(value): value is MeetReaction`
- `parseReactionPayload(raw): MeetReaction | null`

### Quy tắc

- `status` chỉ nhận `focus`, `break`, `help`; giá trị khác trả `""`.
- `hand` chỉ coi là bật khi đúng chuỗi `"1"`.
- `goal` trim, rỗng thành `""`, cắt tối đa 120 ký tự.
- Timer hợp lệ khi:
  - `timerPhase` là `focus` hoặc `break`.
  - `timerStartedAt` là số dương.
  - `timerDuration` nằm trong khoảng 60–3600 giây.
- Nguồn thật của timer là `timerStartedAt + timerDuration`; `timerEndsAt` chỉ là giá trị tiện dụng. Khi đọc, tính lại `endsAt` từ `startedAt + duration * 1000` để tránh lệch.
- `pickActiveTimer` chọn `timerStartedAt` lớn nhất. Nếu bằng nhau, tie-break theo `identity` tăng dần để mọi client chọn cùng một timer.
- `remainingTimerSeconds` dùng `Math.ceil`, clamp trong `0..durationSec`.
- Preset chuyển phase:
  - focus 15 → break 3
  - focus 25 → break 5
  - focus 50 → break 10
  - break 3 → focus 15
  - break 5 → focus 25
  - break 10 → focus 50
  - Không khớp preset nào → mặc định 25/5.
- Reaction payload dạng `{ "v": 1, "emoji": "👍" }`; chỉ nhận emoji trong whitelist.

### Test

Tạo `src/__tests__/unit/study/meet-protocol.test.ts`:

- Parse attribute rỗng/không hợp lệ.
- Parse status, hand, goal; goal bị cắt 120 ký tự.
- Timer hợp lệ/không hợp lệ.
- Chọn timer mới nhất; tie-break theo identity.
- `remainingTimerSeconds` không âm, đúng khi hết giờ.
- `nextPhasePreset` đúng cho cả 6 chiều.
- Reaction hợp lệ/bị chặn.
- `parseReactionPayload` chặn JSON hỏng, version sai, emoji lạ.

Tạo `src/__tests__/unit/study/meet-timer.test.ts`:

- Countdown 25:00 → 24:59 → 00:00.
- Timer hết hạn vẫn trả `0`, không âm.
- Timer thiếu `startedAt` hoặc duration sai bị bỏ qua.
- Hai timer cùng `startedAt` chọn theo identity.

## P2-2. Hook trạng thái + layer dùng chung

### File mới

- `src/components/study/rooms/useMeetStudyState.ts`
- `src/components/study/rooms/RoomStudyBar.tsx`
- `src/components/study/rooms/RoomStudyLayer.tsx`

Có thể tách `RoomReactionsOverlay.tsx` nếu file layer quá dài.

### Hook `useMeetStudyState`

Dùng:

- `useRoomContext()`
- `useParticipants()`
- `useLocalParticipant()`

Trạng thái trả về:

```ts
{
  local: MeetLocalState;
  timer: ActiveMeetTimer | null;
  remainingSec: number;
  isTimerOwner: boolean;
  handRaisedCount: number;
  reactions: MeetReactionEvent[];
  setStatus(status: MeetStatus): void;
  toggleHand(): void;
  setGoal(goal: string): void;
  startTimer(preset: MeetPreset): void;
  stopTimer(): void;
  startNextPhase(): void;
  sendReaction(emoji: string): void;
}
```

Yêu cầu hành vi:

- Giữ `localAttrs` state, khởi tạo từ `localParticipant.attributes`.
- Khi local đổi status/hand/goal/timer:
  - Cập nhật state local ngay để UI phản hồi.
  - Gọi `localParticipant.setAttributes(nextAttrs)` một lần với đầy đủ key thay đổi.
  - Nếu lỗi: khôi phục từ `localParticipant.attributes` và toast lỗi tiếng Việt.
- Lắng nghe `RoomEvent.ParticipantAttributesChanged`:
  - Tăng `attrVersion` để tính lại timer/status.
  - Nếu là local, đồng bộ `localAttrs`.
  - Nếu remote chuyển hand từ chưa giơ sang `"1"`, toast `"<tên> đang giơ tay"`.
  - Dùng `seenHandsRef` để không toast lặp; xóa identity khi hạ tay.
- Timer:
  - `setInterval` 1 giây khi có timer để cập nhật `remainingSec`.
  - Hết giờ: toast một lần, phát âm thanh theo setting và gọi `navigator.vibrate?.([80, 40, 80])` nếu có.
  - Không tự xóa timer khi hết giờ.
  - Owner tự động chuyển sang phase kế tiếp khi hết giờ; chỉ owner ghi attributes để tránh trùng.
  - `stopTimer()` và `startNextPhase()` phải tự kiểm tra owner; nếu không phải owner thì no-op.
  - `startNextPhase()` chỉ chạy khi timer đã hết giờ; nếu còn thời gian thì no-op.
  - Chống gọi auto lặp bằng ref theo `timer.startedAt` + phase.
  - Owner rời phòng: timer vẫn hiển thị; người khác được phép bắt đầu timer mới để ghi đè.
- Reaction:
  - Lắng nghe `RoomEvent.DataReceived`.
  - Bỏ qua nếu `topic !== MEET_REACTION_TOPIC`.
  - Parse bằng `parseReactionPayload`; lỗi thì bỏ qua.
  - Thêm reaction vào state, tự xóa sau 2.5 giây.
  - Gửi local bằng `publishData(new TextEncoder().encode(...), { reliable: false, topic: MEET_REACTION_TOPIC })`.
  - Throttle 700ms mỗi client.
- Cleanup toàn bộ listener, interval, timeout khi unmount.

### `RoomStudyBar`

Component trình bày thuần, không gọi LiveKit hook. Prop tối thiểu:

```ts
interface RoomStudyBarProps {
  local: MeetLocalState;
  timer: ActiveMeetTimer | null;
  remainingSec: number;
  isTimerOwner: boolean;
  handRaisedCount: number;
  compact?: boolean;
  onSetStatus: (status: MeetStatus) => void;
  onToggleHand: () => void;
  onEditGoal: () => void;
  onStartTimer: (preset: MeetPreset) => void;
  onStopTimer: () => void;
  onStartNextPhase: () => void;
  onReaction: (emoji: string) => void;
}
```

Nội dung:

- Chip Pomodoro: phase + `mm:ss`; chưa có timer thì hiện nút bắt đầu.
- Menu preset 15/3, 25/5, 50/10.
- Nút trạng thái: Tập trung / Nghỉ / Cần giúp / Bình thường.
- Nút giơ tay; hiện số người đang giơ tay nếu > 0.
- Chip mục tiêu: hiện mục tiêu local hoặc “Đặt mục tiêu”.
- Nút reaction mở hàng emoji whitelist.
- Owner controls:
  - Đang chạy: nút “Dừng”.
  - Đã hết giờ: tự động chuyển phase; nút “Bắt đầu nghỉ”/“Bắt đầu tập trung” chỉ là fallback.
  - Không phải owner: không hiện nút dừng/chuyển phase.
- `compact`: ẩn bớt label, giữ icon + tooltip/aria-label; vẫn đủ thao tác.
- Tất cả nút có `aria-label` hoặc `title`; không chỉ dựa vào màu.

### `RoomStudyLayer`

- Gọi `useMeetStudyState`.
- Render `RoomStudyBar`, overlay reaction và modal sửa mục tiêu.
- Dùng `ModalShell` có sẵn cho modal mục tiêu; không tạo modal mới.
- Trả về fragment:
  - Bar nằm trong luồng bình thường.
  - Overlay reaction đặt `absolute inset-0 pointer-events-none z-20`.
- Không dùng portal cho bar; chỉ modal dùng `ModalShell`.

## P2-3. Tích hợp UI desktop + mobile

### Desktop — `StudyRoomView.tsx`

- Thêm `relative` vào root.
- Đặt `<RoomStudyLayer />` sau header phòng, trước phần thân video.
- Không thay đổi bố cục chat/video hiện có.
- Thêm badge trạng thái + giơ tay vào `RoomParticipantTile`:
  - Góc trên trái, không che tên/mic/cam hoặc chỉ báo chất lượng góc trên phải.
  - Đọc trực tiếp `trackRef.participant.attributes`.
  - `title` có thể chứa mục tiêu của người đó.
- Badge:
  - `focus`: “Tập trung”, emerald.
  - `break`: “Nghỉ”, amber.
  - `help`: “Cần giúp”, rose.
  - hand: icon bàn tay, amber.
  - Không có trạng thái thì không render badge.

### Mobile — `MobileRoomView.tsx`

- Thêm `<RoomStudyLayer compact />` ngay dưới thanh trạng thái phòng hiện có.
- Badge trên `MobileParticipantTile` giống desktop nhưng nhỏ hơn.
- Không làm mất nút mic/cam/screen share/chat hiện có.
- Thanh compact không được chiếm quá nhiều chiều cao; label dài phải `truncate`.
- Nút chạm tối thiểu 32px; nút chính 44px nếu có.

### Không thay đổi

- Không sửa `StudyRoomsWidget` trừ khi bắt buộc phải truyền prop mới.
- Không đổi `LiveKitRoom`, token, pre-join, reconnect, session timer.
- Không đổi `MobileRoomsSheet` ngoài việc nhận UI mới từ `MobileRoomView`.

## P2-4. Hành vi chi tiết

### Pomodoro

- Bất kỳ ai cũng bắt đầu được.
- Người bắt đầu là owner của timer hiện tại.
- Chỉ owner được dừng; owner tự động chuyển phase khi hết giờ.
- Hết giờ hiển thị `00:00`, toast + âm thanh + rung một lần cho tất cả thành viên.
- Tự động chuyển focus → break → focus cho đến khi owner bấm “Dừng”.
- Nút “Bắt đầu nghỉ”/“Bắt đầu tập trung” chỉ là fallback thủ công.
- Timer dùng `Date.now()` và `endsAt`; chuyển tab/ngủ máy không làm sai quá nhiều.

### Trạng thái

- Mỗi người chỉ ghi attribute của mình.
- Không tự đổi mic/cam khi chọn Tập trung/Nghỉ.
- Badge cập nhật trong khoảng 1 giây ở client khác.

### Giơ tay

- Bật: `zen.hand = "1"`.
- Tắt: `zen.hand = ""`.
- Client khác thấy badge và toast một lần khi bật.
- Không toast khi chính mình giơ tay.

### Mục tiêu

- Là mục tiêu cá nhân, không phải mục tiêu chung của phòng.
- Lưu trong attribute `zen.goal` của từng người.
- Bar hiển thị mục tiêu local; badge/tile có thể dùng `title` để hiện mục tiêu.
- Không thêm room metadata hoặc host để đồng bộ mục tiêu chung.

### Reaction

- Chỉ dùng 6 emoji trong whitelist.
- Không lưu lịch sử; không gửi qua chat.
- Reaction bay lên từ đáy khu vực video, tự biến mất sau 2.5 giây.
- Data channel là lossy; mất packet không ảnh hưởng phòng học.
- Không gửi quá 1 reaction/700ms/client.

## P2-5. Test, mock và tài liệu

### Test mới

- `meet-protocol.test.ts`
- `meet-timer.test.ts`
- `room-study-bar.test.tsx` (render tĩnh các trạng thái chính; không cần thư viện testing mới)

### Cập nhật mock cũ

Các file mock `@livekit/components-react` phải bổ sung:

- `useParticipants`
- `useLocalParticipant`

Ít nhất:

- `src/__tests__/unit/study/study-room-audio.test.ts`
- `src/__tests__/unit/study/study-mobile-rooms.test.ts`

Mock `useLocalParticipant` trả về object có:

```ts
{
  localParticipant: {
    identity: "user-test",
    name: "Học viên",
    attributes: {},
    setAttributes: async () => {},
  },
}
```

Nếu test render component có `RoomStudyLayer`, mock `useParticipants` trả về mảng participant tối thiểu hoặc `[]`.

### Tài liệu

Cập nhật `docs/PHONG_HOC_NHOM.md`:

- Thêm mục “Trạng thái học tập, giơ tay, Pomodoro đồng bộ, reaction”.
- Ghi rõ đây là tính năng client-only, không tốn thêm phút LiveKit.
- Ghi rõ reaction không lưu lịch sử; mục tiêu là cá nhân.
- Không sửa plan tổng hoặc trạng thái nghiệm thu; opencode sẽ cập nhật sau khi nghiệm thu.

### Lệnh kiểm tra bắt buộc

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git status --short
```

Yêu cầu:

- Toàn bộ test cũ + mới pass.
- Không lỗi TypeScript.
- Lint 0 error; warning cũ không tăng.
- Build pass.
- Không có file secret hay `.env.local` bị stage.

## P2-6. Nghiệm thu thủ công

Chuẩn bị 2 tài khoản, cùng vào một phòng.

1. **Trạng thái**
   - A chọn “Tập trung” → B thấy badge “Tập trung” trên tile của A.
   - B chọn “Cần giúp” → A thấy badge “Cần giúp”.
   - A chọn “Bình thường” → badge biến mất.

2. **Giơ tay**
   - B giơ tay → A thấy badge bàn tay và toast “B đang giơ tay”.
   - B hạ tay → badge biến mất.
   - B giơ tay lại → A thấy toast lại một lần, không spam.

3. **Pomodoro**
   - A bắt đầu 25/5 → cả hai thấy 25:00 và đếm ngược.
   - B không thấy nút dừng; A thấy nút dừng.
   - A dừng → cả hai về trạng thái chưa có timer.
   - A bắt đầu lại, chờ hết giờ (có thể test nhanh bằng preset 15/3 hoặc sửa tạm thời gian trong code nháp, không commit) → cả hai thấy 00:00, toast + âm thanh + rung.
   - Không cần bấm gì: cả hai tự chuyển sang phase nghỉ đúng số phút, sau đó hết nghỉ tự về tập trung.
   - A bấm “Dừng” → cả hai dừng chuỗi tự động.

4. **Mục tiêu**
   - A đặt mục tiêu “Ôn chương 3” → bar của A hiện mục tiêu.
   - Sửa thành mục tiêu dài quá 120 ký tự → bị cắt.
   - Xóa mục tiêu → bar trở lại “Đặt mục tiêu”.

5. **Reaction**
   - A bấm 👍 → cả A và B thấy reaction bay lên.
   - B bấm 🔥 → cả hai thấy.
   - Spam nhanh → không vượt quá 1 reaction/700ms.
   - Reaction tự biến mất, không lưu lịch sử.

6. **Mobile**
   - Mở phòng trên mobile, thanh compact hiển thị đủ timer, trạng thái, giơ tay, reaction.
   - Badge trên tile không che tên hoặc nút mic/cam.
   - Không có tràn ngang, không che nút chat/rời phòng.

7. **Không hồi quy Phase 0/1**
   - Giới hạn 6 người vẫn hoạt động.
   - Session timer 120 phút vẫn chạy.
   - Reconnect banner vẫn hoạt động.
   - Quota/usage không thay đổi.

## Checklist trước khi báo xong

- [x] P2-1 protocol + test xong.
- [x] P2-2 hook/layer dùng chung xong.
- [x] P2-3 desktop + mobile xong.
- [x] P2-4 Pomodoro/trạng thái/giơ tay/reaction xong.
- [x] P2-5 test + mock + docs xong.
- [x] `npm test` pass: 48 test files, 311 test.
- [x] `npx tsc --noEmit` pass.
- [x] `npm run lint` 0 error, 10 warning.
- [x] `npm run build` pass.
- [x] Không thêm dependency.
- [x] Không sửa Worker/D1/schema.
- [x] Không thêm localStorage key.
- [x] Không commit.
- [x] P2-6 kiểm thử thủ công với 2 tài khoản thật.

## Mẫu báo cáo

Gửi lại theo bảng:

| Mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P2-1 Protocol + test |  | file:line, tên test |
| P2-2 Hook/layer |  | file:line |
| P2-3 Desktop/mobile UI |  | file:line |
| P2-4 Hành vi Pomodoro/trạng thái/reaction |  | file:line |
| P2-5 Test + docs |  | output lệnh |
| P2-6 Nghiệm thu thủ công |  | kết quả từng bước |

Kèm:

- Danh sách file đã sửa/thêm.
- Output `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Rủi ro còn lại hoặc điểm lệch kế hoạch.
- Không ghi “sạch” nếu còn file thay đổi chưa giải thích.

## Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
| --- | --- |
| `useParticipants` không cập nhật khi attributes đổi | Tăng `attrVersion` trong `ParticipantAttributesChanged` để buộc tính lại |
| Toast giơ tay bị spam | `seenHandsRef` + chỉ toast khi remote chuyển sang `"1"` |
| Đồng hồ lệch giữa client | Tính từ `startedAt + duration`, không tin `timerEndsAt` |
| Owner rời phòng | Timer vẫn hiện; người khác được bắt đầu timer mới |
| Reaction làm nặng UI | Lossy, throttle 700ms, tự xóa sau 2.5s, tối đa 6 emoji |
| Bar mobile chiếm chỗ | `compact`, label truncate, ưu tiên icon + tooltip |
| Test cũ vỡ do thiếu mock | Cập nhật mock `useParticipants`/`useLocalParticipant` ngay khi thêm layer |
| Modal mục tiêu gây lỗi SSR | `ModalShell` đã xử lý portal/mounted; chỉ mở khi client |
| Vô tình sửa Phase 0/1 | Chỉ sửa file UI Phase 2; không chạm Worker/D1 |
