---
name: StudySpace Mobile
description: Style guide dùng chung cho UI mobile (<640px). Mọi màn hình mobile mới phải làm theo file này.
colors:
  background: "#0B0F1A"
  panel: "#020617"
  sheet-normal: "#090C14F2"
  sheet-zen: "#090C14F0"
  text-main: "#FFFFFF"
  text-sub: "#CBD5E1"
  text-faint: "#94A3B8"
  text-label: "#FFFFFF80"
  line: "#FFFFFF26"
  accent-green: "#10B981"
  accent-green-light: "#6EE7B7"
  accent-amber: "#FBBF24"
  accent-rose: "#F43F5F"
  accent-sky: "#38BDF8"
  accent-violet: "#C084FC"
typography:
  sheet-title: { fontFamily: Be Vietnam, fontSize: 14px, fontWeight: 600 }
  card-title: { fontFamily: Be Vietnam, fontSize: 12px, fontWeight: 600 }
  body: { fontFamily: Be Vietnam, fontSize: 13px, fontWeight: 500 }
  small-label: { fontFamily: Be Vietnam, fontSize: 11px, fontWeight: 600 }
  tiny-tag: { fontFamily: Be Vietnam, fontSize: 10px, fontWeight: 500 }
  nav-label: { fontFamily: Be Vietnam, fontSize: 10px, fontWeight: 600 }
  top-time: { fontFamily: mono, fontSize: 14px, fontWeight: 600 }
rounded:
  full: 999px
  sheet-normal: 28px
  sheet-zen: 32px
  card: 16px
  button: 16px
  input: 12px
  icon-box: 12px
  avatar: 16px
spacing:
  sheet-side: 12px
  content-x: 12px
  gap: 8px
  nav-height: 58px
---

# Style Guide Mobile - StudySpace

> Chỉ dùng cho mobile (màn hình nhỏ hơn 640px).
> Không áp dụng cho desktop. Code desktop giữ nguyên.
> Agent khi làm màn hình mobile mới: đọc file này trước, copy đúng mẫu có sẵn.

## 1. Nhìn chung là kiểu gì

- Nền tối, chữ trắng. Panel là "kính tĩnh": nền cảnh được làm mờ sẵn và đặt
  phía sau, panel chỉ trong 68% chứ không mờ động (không `backdrop-filter`),
  vì blur động đè lên video đang phát là nguyên nhân tụt FPS nặng nhất trên máy.
- Viền luôn là trắng sáng (0.13 vạch chia - 0.22 thẻ - 0.30 surface - 0.38 đang
  chọn), không đổi màu theo bối cảnh.
- Tất cả bảng mobile đều trượt lên từ đáy, giống tờ giấy kéo lên trong iPhone.
- Thanh menu chính nằm đáy, hình con nhộng dài (capsule), có 5 nút: Giờ / Việc / Ghi chú / Nhạc / Thêm.
- Thanh trên cùng rất gọn: chỉ có logo bên trái, giờ ở giữa, nút phóng to bên phải.
- Chữ tiếng Việt, nói kiểu bạn bè, ngắn gọn.

## 2. Màu dùng chung

- Nền chính: `#0B0F1A` (đen hơi xanh).
- Bảng trượt lên (dùng `surface-frost`, KHÔNG tự pha nền):
  - Dạng thường: `rounded-[28px] surface-frost border` (nền `rgba(16,20,30,0.68)`
    + ánh sáng dội mép trên + viền trắng 0.30).
  - Dạng to toàn màn hình (Zen): `rounded-[32px] surface-frost border`.
  - Surface nổi trực tiếp trên video đang phát (thẻ màn chào, snackbar) thì dùng
    `surface-graphite border` - đặc hơn, không trong, viền trắng 0.34.
- Đồng hồ to giữa màn bị ẩn (`visibility: hidden`, vẫn mounted để countdown chạy
  tiếp) mỗi khi có bảng mở, khỏi rò chữ số xuyên qua kính và bớt một lớp GPU.
- Chữ:
  - Chữ chính: trắng `text-white`.
  - Chữ phụ: xám nhạt `text-slate-300`, `text-slate-400`.
  - Chữ tiêu đề nhóm nhỏ: trắng mờ 50% `text-white/50`, cỡ 11px, viết hoa.
- Nút chưa bấm: nền trắng rất nhạt `bg-white/[0.04]`, viền `border-white/[0.08]`.
- Ở layout mobile, `glass.css` tự gom các bậc màu lộn xộn về 3 bậc nền trắng
  (0.055 thẻ / 0.10 control / 0.17 đang chọn) và 3 bậc lõm than-xanh
  (0.35 / 0.55 / 0.62), đồng thời gom mọi viền trung tính về trắng 0.22
  (vạch chia mờ thì 0.13). Cứ viết class Tailwind bình thường, không cần thêm
  class riêng; surface đã tự viền (`lg-*`, `surface-*`) được loại trừ nên giữ
  bậc sáng riêng của nó.
- Nút khi chạm: nền lên `bg-white/[0.1]`, icon thu nhỏ lại `active:scale-95` hoặc `active:scale-90`.
- Màu nhấn theo việc:
  - Xanh lá (xong, an toàn): `emerald-300`, `emerald-400`, nền `emerald-500/15`.
  - Vàng (chú ý, Pomodoro): `amber-300`, nền `amber-500/15`.
  - Đỏ hồng (xóa, gấp, rời phòng): `rose-300`, `rose-500`, nền `rose-500/15`.
  - Xanh da trời (thông tin): `sky-300`.
  - Tím (nhóm): `violet-300`.

## 3. Chữ dùng chung

- Font chính là font của app (Be Vietnam). Giờ ở giữa thanh trên dùng font mono cho số ngay hàng.
- Cỡ chữ hay dùng:
  - Tiêu đề bảng: 14px, đậm vừa `text-sm font-semibold`.
  - Tên việc, tên thẻ: 12px, đậm vừa `text-xs font-semibold`.
  - Chữ thường trong nút: 13px `text-[13px] font-medium`.
  - Chữ nhóm nhỏ (Tài khoản, Học và ghi...): 11px, đậm, viết hoa, cách chữ rộng `text-[11px] font-semibold uppercase tracking-wider text-white/50`.
  - Tem nhỏ (số lượng, hạn chót): 10px `text-[10px]`.
  - Chữ dưới icon menu đáy: 10px, đậm `text-[10px] font-semibold`.
- Luôn cắt chữ dài bằng `truncate`, tiêu đề không xuống 2 dòng.

## 4. Cách xếp chỗ (chừa lề, vùng bấm)

- Chỉ hiện trên mobile: thêm `sm:hidden` vào khung ngoài cùng.
- Chừa chỗ tai thỏ iPhone:
  - Dùng sẵn các class: `pt-safe`, `pb-safe`, `bottom-nav-safe`, `mobile-content-safe`.
  - Chiều cao thanh menu đáy là 58px: `--mobile-nav-height: 58px`.
  - Bảng đáy luôn nằm trên menu: `bottom-[calc(var(--mobile-nav-height)+var(--app-safe-bottom)+var(--mobile-nav-safe-gap)+0.75rem)]`, lề 2 bên 12px (`inset-x-3`, dạng to là `inset-x-2`).
- Nút bấm cho ngón tay:
  - Nút chính, logo, nút đóng: 44px (`w-11 h-11`).
  - Nút nhỏ trong đầu bảng: 32px (`w-8 h-8`) hình tròn, nền `bg-white/10`, viền `border-white/15`.
  - Nút gọi trong phòng họp: 36px (`w-9 h-9`) hình tròn.
  - Khoảng cách giữa các nút: ít nhất 6-8px (`gap-1.5`, `gap-2`).
- Thanh cuộn: ẩn đi cho sạch, dùng class `no-scrollbar` + `custom-study-scroll` + `touch-pan-y overscroll-contain`.

## 5. Hình dáng (bo góc, bóng, kính mờ)

Dùng đúng các class có sẵn trong `src/app/styles/glass.css`, không tự chế kiểu mới:

- `lg-bar`: thanh con nhộng dài (menu đáy, cụm chuyển Đồng hồ/Pomodoro/Stopwatch). Nền tối mờ + viền sáng trên.
- `lg-pill`: viên kính của nút đang chọn trong menu đáy. Có bóng gương nửa trên.
- `lg-seg-active`: viên kính trượt của cụm chuyển tab (Đồng hồ/Pomodoro/Stopwatch).
- `lg-tab-active` / `lg-tab-inactive`: viên nhộng lọc (Tất cả / Cần làm / Xong...). Đang chọn thì sáng trắng, chưa chọn thì mờ.
- `lg-input`: ô gõ chữ. Cao 36px (`h-9`), bo 12px, chữ trắng 12px, chữ gợi ý trắng mờ 40%.
- `lg-btn-action`: nút bấm kiểu kính (Thêm, chọn Gấp/Vừa/Thấp). Bo 12px, bấm vào thu nhỏ `active:scale-95`.
- `lg-bubble`: bong bóng tròn (nút tròn nổi).
- `surface-frost`: kính tĩnh cho bảng/modal/popovers - chỉ dùng khi lớp kính
  tĩnh (`study-bg-overlay` bản mobile) đang bật phía sau.
- `surface-graphite`: than-xanh đặc cho surface nằm trực tiếp trên video.
- Công tắc phạm vi: dấu `mobile-scope` gắn lên `<html>` (do `useIsMobile`, và
  `layout.tsx` gắn sẵn cho bản shell Android `NEXT_PUBLIC_MOBILE_SHELL=1`).
  Sheet/popover portal ra `<body>` vẫn ăn rule vì dấu nằm ở `<html>`; desktop
  không có dấu nên giữ nguyên từng pixel.
- Bo góc chuẩn:
  - Menu đáy, viên lọc, nút tròn: bo tròn hết `rounded-full`.
  - Bảng thường: 28px, bảng to Zen: 32px.
  - Thẻ việc, nút danh sách, avatar: 16px (`rounded-2xl`).
  - Ô nhập, hộp icon: 12px (`rounded-xl`).

## 6. Các mảnh ghép làm sẵn (copy lại khi làm màn mới)

### 6.1. Khung bảng đáy `MobileSheetShell`

- Luôn dùng `MobileSheetShell`, không tự làm bảng mới.
- Cấu tạo chuẩn:
  - Trên cùng: thanh kéo nhỏ `h-1.5 w-12 rounded-full bg-white/30`.
  - Dưới: dòng tiêu đề 14px + cụm nút tròn 32px bên phải (nút phóng to + nút X đóng).
  - Giữa: chỗ cuộn nội dung `flex-1 overflow-y-auto`.
  - Đáy (nếu có): chỗ nút cho ngón tay cái `footer` (ví dụ thanh thêm việc nhanh).
- Chiều cao hay dùng:
  - Việc: `h-[80dvh] max-h-[85dvh]`.
  - Mặc định khác: `h-[72dvh] max-h-[72dvh]`.
- Kéo xuống để đóng, kéo lên để phóng to. Không đổi ngưỡng này: kéo lên -35px là to lên, kéo xuống 75px (dạng nhỏ) hoặc 120px (dạng to) là đóng.

### 6.2. Menu đáy `StudyMobileNav` + `MobileNavItem`

- Cao 58px (`h-[58px]`), nằm `fixed bottom-0`, lề 12px (`mx-3`), chỉ mobile `sm:hidden`.
- Icon 22px (`h-[22px] w-[22px]`). Đang chọn: trắng `text-white` + `weight="fill"`. Chưa chọn: xám mờ `text-slate-300/75` + `weight="duotone"`.
- Chữ chỉ hiện khi đang chọn, cỡ 10px trắng đậm.
- Khi bấm: rung nhẹ 10ms (`navigator.vibrate(10)`), nút lún kiểu giọt nước `scale(1.05, 0.92)`.

### 6.3. Thanh trên `MobileTopBar`

- Cao 56px (`h-14`), lề 2 bên 16px (`px-4`), ẩn khi vào Zen.
- Trái: logo 36px (`h-9 w-9`), chỗ bấm 44px.
- Giữa: giờ hiện tại, 14px mono đậm, trắng hơi bóng.
- Phải: nút toàn màn hình 44px, icon 20px (`w-5 h-5`), màu `text-slate-200`.

### 6.4. Nút danh sách trong bảng Thêm `MoreButton`

- Cao ít nhất 46px (`min-h-[46px]`), bo 16px, nền `bg-white/[0.04]`, viền `border-white/[0.08]`, lề trong `px-3`.
- Trái: hộp icon 36px (`w-9 h-9 rounded-xl bg-white/[0.08] border-white/[0.15]`), icon 20px màu nhạt theo nhóm (vàng/ xanh lá/ hồng/ xanh da trời/ tím).
- Chữ: 13px trắng 90% `text-[13px] font-medium text-white/90`.
- Nhóm có tiêu đề nhỏ 11px viết hoa trắng mờ 50% ở trên.

### 6.5. Thẻ tài khoản `MobileAccountCard`

- Cao ít nhất 48px, xếp ngang: avatar 44px bo 16px + tên + mail + nút tròn đăng xuất 40px.
- Chưa đăng nhập: nút trắng chữ đen bo 16px `rounded-2xl bg-white text-slate-950 text-sm font-bold`.
- Đang tải: 2 vạch xám nhấp nháy `animate-pulse`.

### 6.6. Cụm chuyển tab giờ `MobileTimerTabBar`

- Dùng `lg-bar` bọc ngoài + `lg-seg-active` trượt lò xo (`stiffness 420, damping 32`).
- Nút rộng 96px (`w-24`), cao ít nhất 38px (`min-h-[38px]`), chữ 11px viết hoa đậm `text-[11px] font-black uppercase tracking-wider`.
- Tự ẩn khi không dùng (`visible` false thì mờ + trượt lên).

### 6.7. Thanh thêm việc nhanh + lọc (trong `MobileTasksSheet`)

- Viên lọc: cao 28px (`h-7 px-3 rounded-full text-xs`), dùng `lg-tab-active` khi chọn, `lg-tab-inactive` khi không. Có số lượng trong ngoặc mờ 75%.
- Hàng nhập nhanh ở đáy: ô nhập `lg-input h-9 text-xs` + nút Ưu tiên + nút Thêm dùng `lg-btn-action h-9`.
- Thẻ việc: bo 16px, nền `bg-white/[0.04]` viền `border-white/[0.08]`, lề trong 12px (`p-3`). Xong rồi thì mờ + viền xanh `border-emerald-500/20 opacity-80`.
- Checkbox tròn 20px: chưa xong `CircleIcon text-white/35`, xong `CheckCircleIcon fill text-emerald-400`.
- Tem phụ 10px bo 6px, có viền mỏng theo màu (Gấp đỏ, Vừa vàng, Thấp xanh).
- Bấm giữ 450ms rung 30ms để mở menu nổi. Vuốt ngang 35px để chuyển cột lọc.

### 6.8. Nút mở nhanh + bảng chat full

- Nút mở nhanh `MobileRadialBubbleMenu`: đứng yên đáy phải, to 52px, bấm bung 4 bong bóng, không cho kéo đi chỗ khác.
- Bảng chat `MobileChatSheet`: trượt lên từ đáy dạng sheet hiện đại, tích hợp xác thực và đính kèm tệp.

### 6.9. Thanh hoàn tác `MobileUndoSnackbar`

- Nằm trên menu đáy 5.5rem, lề 12px (`inset-x-3`), cao 58px (`h-[58px]`), bo 16px, `surface-graphite border`.
- Chữ 13px đậm cắt ngắn `text-[13px] font-semibold truncate`.
- Nút Hoàn tác cao 44px (`h-11`), chữ xanh nhạt 14px đậm + vòng đếm ngược 22px. Đếm 5 giây, chạm giữ để dừng.

### 6.10. Phòng họp mobile `MobileRoomView`

- Nền `bg-slate-950`, video bo 16px viền `border-white/15`.
- Cụm nút gọi: con nhộng tròn `rounded-full bg-slate-900/95 border-white/20`, nút 36px tròn trắng mờ, nút rời phòng đỏ `bg-rose-600`.
- Tin nhắn: của mình nền `bg-emerald-500/25 border-emerald-400/30`, của bạn nền `bg-white/10 border-white/10`, bo 16px nhưng góc trên phía mình nhọn (`rounded-tr-sm` / `rounded-tl-sm`), rộng tối đa 82%.
- Nhận diện trong phòng (micro/camera emerald, tin nhắn của mình) là hệ màu
  riêng của phòng họp, không nằm trong quy tắc gom viền chung.

## 7. Icon

- Dùng bộ Phosphor (`@phosphor-icons/react`), không dùng emoji cho nút chính.
- Cỡ chuẩn: menu đáy 22px, icon danh sách 20px, nút nhỏ 16px (`w-4 h-4`), tem nhỏ 10-12px (`w-2.5 h-2.5`, `w-3 h-3`).
- Đang chọn dùng `weight="fill"`, chưa chọn dùng `duotone` hoặc `regular`, nút Thêm dùng `bold`.
- Màu icon nhạt cho dễ nhìn trên nền đen: `amber-300`, `emerald-300`, `rose-300`, `sky-300`, `violet-300`, `slate-200`.

## 8. Chuyển động

- Mở/đóng bảng: trượt lên 40px + mờ dần, 0.22 giây, đường cong `cubic-bezier(0.16, 1, 0.3, 1)`.
- Viên kính menu trượt lò xo: `stiffness 420, damping 32`.
- Bấm nút: thu nhỏ `active:scale-95` (nút tròn nhỏ là `active:scale-90`), menu là lún giọt nước.
- Chỉ animate `transform` + `opacity`. Ba thứ đã bỏ vì bắt máy vẽ lại trên nền
  video đang phát: đốm sáng đuổi theo ngón tay (`lg-spot`), glow `drop-shadow`
  ở icon đang chọn, và `layoutId` của viên kính menu đáy (phải đo lại DOM mỗi
  frame). Viên kính trượt của cụm tab giờ vẫn dùng `layoutId` vì nó thật sự trượt
  giữa 3 tab.
- Tôn trọng người say chuyển động: nếu máy bật giảm chuyển động thì bỏ hiệu ứng.

## 9. Nên làm / Không nên làm

Nên:
- Copy đúng `MobileSheetShell`, `lg-*`, `MoreButton`, viên lọc, thanh nhập nhanh khi làm màn mới.
- Giữ chữ trắng, tem 10-11px, nút cao 44px cho việc chính.
- Ẩn thanh cuộn, chừa chỗ tai thỏ, thử bằng 1 tay (nút chính ở gần ngón cái).
- Mỗi màn chỉ có 1 nút quan trọng nhất màu nổi, còn lại để trắng mờ.

Không:
- Không làm kiểu sáng (nền trắng) cho mobile, không đổi màu nền `#0B0F1A`.
- Không tự đặt bo góc, bóng, màu mới ngoài file này.
- Không để chữ quá nhỏ dưới 10px, không để 2 nút 44px sát nhau dưới 8px.
- Không dùng `ScrollView` dài cho danh sách dài mà không tối ưu, không để nút chỉ dùng cử chỉ khó hiểu mà không có nút bấm.
- Không đụng vào code desktop. Chỉ sửa file trong `src/components/study/mobile/`,
  `src/app/styles/mobile.css`, `src/app/styles/glass.css` (phần `lg-*`, `surface-*`
  và khối `.mobile-scope`). Widget chung chạy cả hai layout thì KHÔNG sửa file của
  nó - muốn đổi chất liệu cho mobile thì thêm rule `.mobile-scope ...` trong glass.css.

## 10. File liên quan để đọc khi làm

- Khung bảng: `src/components/study/mobile/sheets/MobileSheetShell.tsx`
- Menu đáy: `src/components/study/mobile/navigation/StudyMobileNav.tsx`, `MobileNavItem.tsx`
- Thanh trên: `src/components/study/mobile/top/MobileTopBar.tsx`
- Bảng Thêm/Tài khoản: `MobileMoreSheet.tsx`, `MobileAccountCard.tsx`
- Việc: `MobileTasksSheet.tsx`, `MobileTaskBubbleMenu.tsx`
- Giờ: `mobile/pomodoro/MobileTimerTabBar.tsx`, `MobilePomodoroView.tsx`
- Chat: `mobile/navigation/MobileRadialBubbleMenu.tsx`, `mobile/sheets/MobileChatSheet.tsx`
- Phòng: `mobile/rooms/MobileRoomView.tsx`, `MobileActiveRoomPill.tsx`
- Hoàn tác: `mobile/feedback/MobileUndoSnackbar.tsx`
- Kính mờ: `src/app/styles/glass.css` (các class `lg-*`)
- Lề an toàn + ẩn cuộn: `src/app/styles/mobile.css`
- Màu gốc: `src/app/styles/tokens.css`
