# Kế hoạch đưa ZenStudy Space lên Google Play (CH Play)

> Cập nhật: 2026-10-28
> Hướng dẫn kỹ thuật chi tiết (Capacitor, keystore, OTA): [ANDROID_CHPLAY_OTA_GUIDE.md](./ANDROID_CHPLAY_OTA_GUIDE.md)

## Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Tài khoản Google Play Developer | **Đã có** (không cần tạo mới, không cần trả lại phí 25 USD) |
| Trang chính sách quyền riêng tư (web) | Đã làm trong đợt này: `/privacy` (gồm lịch sử chat lưu trên Firestore) |
| Link policy trong app | Đã làm: About modal (desktop) + sheet "Thêm" (mobile) |
| Xóa tài khoản trong app + link web | Đã làm (chờ deploy Worker + khai URL trong Play Console) |
| Capacitor / thư mục `android/` | Chưa có |
| Keystore (.jks) | Chưa có |
| Package name | Chưa chốt (mặc định đề xuất: `space.zenstudy.app`) |
| `.aab` bản release | Chưa có |
| Store listing (icon 512, feature graphic, screenshot) | Chưa chuẩn bị |

## Thứ tự ưu tiên

**P0 Policy → P1 Shell Android → P2 Build ký → P3 Play Console → P4 OTA**

Lý do policy đứng trước: Play Console chặn nộp app khi thiếu Privacy Policy URL, Data Safety, và (vì app có đăng nhập) cơ chế xóa tài khoản. Làm sớm để không phải quay lại sửa store listing và bản build.

---

## P0 — Policy & tuân thủ (ưu tiên cao nhất)

### P0.1 Privacy Policy công khai
- [x] Trang `/privacy` (tiếng Việt, tĩnh) — nội dung bám dữ liệu thực tế của app.
- [x] Thêm vào `sitemap.xml`.
- [x] Link trong app (desktop About modal, mobile sheet "Thêm").
- [ ] Kiểm tra URL công khai sau khi deploy web: `https://zenstudy.space/privacy/`
- [ ] Dán URL này vào Play Console → Policy and programs → App content → Privacy policy.

### P0.2 Xóa tài khoản (bắt buộc với app có tạo tài khoản)
Google Play yêu cầu **cả hai**: đường dẫn xóa trong app và một URL web mô tả cách xóa. Hiện app chỉ đăng xuất (xóa dữ liệu trên máy), dữ liệu đã đồng bộ trên D1 vẫn còn.

Cần làm trước khi nộp:
- [x] Endpoint xóa trong `data-api`: `DELETE /account` xóa `user_data`, `chat_usage` và dữ liệu phòng học (`meet_sessions`, `meet_rooms`, `meet_audit_logs`) theo UID, kèm xác thực Firebase ID token.
- [x] Xóa tài khoản Firebase bằng **service account** (Admin API `accounts:delete`) ngay trong cùng request — không cần reauth, không cần popup Google. Worker lấy UID từ vé đã verify.
- [x] Chốt `deleted_accounts`: UID đã xóa bị chặn 403 ở `GET/POST /data` để thiết bị còn token cũ không đẩy dữ liệu trở lại.
- [x] Xóa Firestore phía client trước khi gọi endpoint: `conversations/{uid}` (kèm `sessions` + `messages`), bản cũ theo `ownerUid`, và `users/{uid}`.
- [x] Xóa `meet_sessions`/`meet_rooms`/`meet_audit_logs` liên quan (phòng do mình làm host, gỡ mình khỏi đồng host).
- [x] Xóa `chat_usage` (đếm lượt hỏi).
- [x] Nút "Xoá tài khoản" trong UI (hồ sơ desktop + thẻ tài khoản mobile), xác nhận bằng ô tick.
- [x] Trang web công khai `/account-deletion/` mô tả luồng xóa và cho đăng nhập Google để xóa ngay; `/privacy` mục 9 trỏ sang trang này, vẫn giữ email dự phòng.
- [ ] Tạo service account (role Firebase Authentication Admin) và đặt secret `FIREBASE_SERVICE_ACCOUNT` cho Worker `data-api`; kiểm tra `/health` có `authAdmin: true`.
- [ ] Deploy Worker `data-api` bản mới, kiểm tra `DELETE .../account` không token trả 401.
- [ ] Publish `firestore.rules` (đã thêm quyền xoá `conversations`): dán vào Firebase Console → Rules → Publish, hoặc `firebase deploy --only firestore:rules`.
- [ ] Khai URL xóa tài khoản trong Play Console (Data safety → Account deletion): `https://zenstudy.space/account-deletion/`.

### P0.3 Data Safety (khai báo trong Play Console)
Bản nháp — đối chiếu lại với code trước khi bấm gửi:

| Loại dữ liệu | Thu thập | Chia sẻ | Mục đích | Bắt buộc? |
|---|---|---|---|---|
| Email, tên, ảnh đại diện (Google/Firebase Auth) | Có | Không (Firebase là bên xử lý) | Đăng nhập, đồng bộ tài khoản | Bắt buộc nếu muốn đồng bộ |
| Nội dung người dùng: ghi chú, việc cần làm, cài đặt không gian học | Có (khi đăng nhập) | Không | Tính năng app + đồng bộ | Tùy chọn (chỉ khi đăng nhập) |
| Nội dung chat AI (text/ảnh/tệp người dùng gửi) | Có (Firestore) | Có — chuyển tới nhà cung cấp AI (Cloudflare Workers AI / Gemini / OpenAI-compatible) để trả lời | Tính năng trợ lý AI | Tùy chọn |
| Âm thanh, video phòng học (LiveKit) | Không lưu bản ghi | Có — truyền thời gian thực qua LiveKit | Tính năng phòng học nhóm | Tùy chọn |
| Metadata phiên học (tên hiển thị, thời lượng, phòng) | Có | Không | Giới hạn sử dụng, vận hành | Có khi vào phòng |
| Số lượt hỏi AI/ngày (UID + ngày + số câu) | Có | Không | Giới hạn quota | Có khi dùng AI |

Các mục cần khai thêm:
- [ ] Dữ liệu truyền tải được mã hóa (TLS) — Có.
- [ ] Người dùng có thể yêu cầu xóa dữ liệu — Có (email + sau này nút trong app).
- [ ] Không có quảng cáo, không có analytics/tracking bên thứ ba.
- [ ] Vị trí, danh bạ, lịch, sức khỏe, tài chính: Không.

### P0.4 App content khác
- [ ] **App access**: app dùng được không cần đăng nhập; riêng AI cần đăng nhập Google → cung cấp hướng dẫn test (tester dùng tài khoản Google của họ).
- [ ] **Ads**: Không có quảng cáo.
- [ ] **Content rating (IARC)**: ứng dụng học tập/năng suất, không bạo lực/nội dung người lớn.
- [ ] **Target audience**: 13+ (không hướng tới trẻ em dưới 13).
- [ ] **Data deletion URL** (P0.2).
- [ ] **Chính sách OTA**: chỉ cập nhật JS/HTML/CSS, không đổi mục đích app (đã ghi trong guide).

---

## P1 — Shell Android (Capacitor)

Điều kiện tiên quyết: Android Studio + JDK (bản Android Studio mới đã kèm JDK), một điện thoại Android thật để thử LiveKit.

- [ ] Cài `@capacitor/core`, `@capacitor/android`; `@capacitor/cli` (dev).
- [ ] Script `build:mobile` xuất `out/` (tạm ẩn `src/app/admin`, `src/app/api` vì máy local có 2 thư mục gitignored này; `next build` thường sẽ từ chối export).
- [ ] `npx cap init "ZenStudy Space" "space.zenstudy.app" --web-dir out` (chốt package name trước khi tạo project).
- [ ] `npx cap add android` + `npx cap sync`.
- [ ] `AndroidManifest.xml`: INTERNET, ACCESS_NETWORK_STATE, CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS + `uses-feature` không bắt buộc.
- [ ] Icon/splash: `npx @capacitor/assets generate --android` (nguồn `assets/icon.png` ≥ 1024×1024, `assets/splash.png` ≥ 2732×2732).
- [ ] Chạy trên máy thật: đổi cảnh, phát nhạc, Pomodoro, ghi chú, đăng nhập Google, chat AI, phòng học (mic/cam).
- [ ] **Kiểm tra sớm**: Google Sign-In trong WebView. Nếu GIS bị chặn `disallowed_useragent`, chuyển sang plugin native (`@capacitor-firebase/authentication`) trước khi làm store listing.
- [ ] Kiểm tra asset CDN: `NEXT_PUBLIC_STUDY_CDN_URL` phải có trong bundle mobile; nếu không, ảnh/video scene sẽ trỏ sai.

## P2 — Build bản ký

- [ ] Tạo keystore: `keytool -genkey -v -keystore zenstudy-release-key.jks -alias zenstudy-key-alias -keyalg RSA -keysize 2048 -validity 10000`.
- [ ] Sao lưu `.jks` + mật khẩu ít nhất 2 nơi; thêm `*.jks` vào `.gitignore`.
- [ ] Cấu hình `signingConfigs.release` (mật khẩu đọc từ biến môi trường, không hardcode).
- [ ] `versionCode 1`, `versionName "1.0.0"`, `targetSdk` theo yêu cầu Play hiện hành.
- [ ] `./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Cài thử bản release trên máy thật (không chỉ debug).

## P3 — Play Console

- [ ] Tạo app mới, chọn ngôn ngữ mặc định Tiếng Việt, loại app "App", miễn phí.
- [ ] Store listing: tên, mô tả ngắn/dài, icon 512×512, feature graphic 1024×500, 2–8 screenshot.
- [ ] Hoàn tất P0 (privacy URL, Data Safety, xóa tài khoản, content rating, target audience).
- [ ] Internal testing trước → Closed testing 20 tester × 14 ngày liên tục (tài khoản cá nhân).
- [ ] "Apply for production" + trả lời câu hỏi phản hồi tester.
- [ ] Chờ duyệt 3–7 ngày.

## P4 — OTA (sau khi bản 1.0.0 lên store)

- [ ] Chọn Capgo (nhanh, có rollback) hoặc tự dựng trên R2 + Worker.
- [ ] Nhúng plugin updater **ngay trong bản .aab đầu tiên** để các bản sau cập nhật được.
- [ ] Quy trình: build `out/` → zip → upload channel production.
- [ ] Chỉ OTA phần web (UI, JS, CSS, nội dung). Đổi icon, quyền, plugin native → phải build `.aab` mới.

---

## Quyết định cần chốt trước P1

1. **Package name** — vĩnh viễn, không đổi được sau khi phát hành. Đề xuất `space.zenstudy.app`.
2. **Target audience** — 13+ hay 18+ (ảnh hưởng Data Safety và nội dung store listing).
3. **Có làm xóa tài khoản ngay đợt này không** — nếu không, không thể nộp app.
4. **Google Sign-In**: giữ GIS trong WebView hay chuyển native plugin ngay từ đầu (an toàn hơn cho app).
