# Kế hoạch đưa ZenStudy Space lên Google Play (CH Play)

> Cập nhật: 2026-11-03 — P0.5 xong hoàn toàn (Phase 7 QA tay pass toàn bộ trên production). P0.6 xong: code/copy 16+ đã push web và `chat-proxy` bản 16+ đã dán production. Còn khai Play Console (tay) và P1–P4. Mốc 16+ chốt 2026-11-01.
> Hướng dẫn kỹ thuật chi tiết (Capacitor, keystore, OTA): [ANDROID_CHPLAY_OTA_GUIDE.md](./ANDROID_CHPLAY_OTA_GUIDE.md)

**Tiến độ tổng:** P0 đã xong code + hạ tầng + pháp lý (privacy, terms, xóa tài khoản đều live). P0.5 **xong hoàn toàn 2026-11-03**: Phase 1–6 lên production, Phase 7 QA tay 2 tài khoản A/B pass toàn bộ (guardrail 16+, báo cáo AI + phòng, chặn 2 chiều, khóa/mở AI, xóa tài khoản thử, mobile spot-check). P0.6 (16+) **đóng 2026-11-03**: terms/privacy live mốc 16+, `chat-proxy` production chạy guardrail 16+. Việc còn lại của P0 là khai tay trên Play Console. P1–P4 chưa bắt đầu.

## Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Tài khoản Google Play Developer | **Đã có** (không cần tạo mới, không cần trả lại phí 25 USD) |
| Trang chính sách quyền riêng tư (web) | Đã live: `/privacy/` (lịch sử chat Firestore + GoatCounter) |
| Link policy trong app | Đã làm: About modal (desktop) + sheet "Thêm" (mobile) — cả privacy và terms |
| Xóa tài khoản trong app + link web | **Đã hoạt động** (xác nhận 2026-10-29); còn khai URL trong Play Console |
| Trang xóa tài khoản công khai | Đã live: `/account-deletion/` |
| Trang điều khoản sử dụng | **Đã live: `/terms/`** (độ tuổi 16, quyền sử dụng nội dung đã rõ) |
| Capacitor / thư mục `android/` | Chưa có |
| Keystore (.jks) | Chưa có |
| Package name | **Đã chốt: `space.zenstudy.app`** |
| Target audience | **Đã chốt lại: 16+** (chọn 16–17, 18+; không chọn 13–15). Trước 2026-11-01 tạm chốt 13+. |
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
- [x] Sửa nội dung chat cho đúng: lịch sử lưu Firestore (`conversations/{uid}/sessions/{sid}/messages`), kèm tên tệp + ảnh thu nhỏ; ảnh gốc chỉ lưu trên máy.
- [x] Kiểm tra cục bộ: `tsc`, `lint`, trang render đúng.
- [x] Kiểm tra URL công khai sau khi deploy web: `https://zenstudy.space/privacy/` — 200, nội dung đã gồm mục chat lưu Firestore.
- [ ] Dán URL này vào Play Console → Policy and programs → App content → Privacy policy.

### P0.2 Xóa tài khoản (bắt buộc với app có tạo tài khoản)
Google Play yêu cầu **cả hai**: đường dẫn xóa trong app và một URL web mô tả cách xóa. Phần code **đã xong và commit `da91273`**; trạng thái từng việc:
- [x] Endpoint xóa trong `data-api`: `DELETE /account` xóa `user_data`, `chat_usage` và dữ liệu phòng học (`meet_sessions`, `meet_rooms`, `meet_audit_logs`) theo UID, kèm xác thực Firebase ID token.
- [x] Xóa tài khoản Firebase bằng **service account** (Admin API `accounts:delete`) ngay trong cùng request — không cần reauth, không cần popup Google. Worker lấy UID từ vé đã verify.
- [x] Chốt `deleted_accounts`: UID đã xóa bị chặn 403 ở `GET/POST /data` để thiết bị còn token cũ không đẩy dữ liệu trở lại.
- [x] Xóa Firestore phía client trước khi gọi endpoint: `conversations/{uid}` (kèm `sessions` + `messages`), bản cũ theo `ownerUid`, và `users/{uid}`.
- [x] Xóa `meet_sessions`/`meet_rooms`/`meet_audit_logs` liên quan (phòng do mình làm host, gỡ mình khỏi đồng host).
- [x] Xóa `chat_usage` (đếm lượt hỏi).
- [x] Nút "Xoá tài khoản" trong UI (hồ sơ desktop + thẻ tài khoản mobile), xác nhận bằng ô tick.
- [x] Trang web công khai `/account-deletion/` mô tả luồng xóa và cho đăng nhập Google để xóa ngay; `/privacy` mục 9 trỏ sang trang này, vẫn giữ email dự phòng.
- [x] Tạo service account (role Firebase Authentication Admin) và đặt secret `FIREBASE_SERVICE_ACCOUNT` cho Worker `data-api`; `/health` có `authAdmin: true`.
- [x] Deploy Worker `data-api` bản mới; `DELETE /account` không token trả 401.
- [x] Publish `firestore.rules` (đã thêm quyền xoá `conversations`).
- [x] Test end-to-end: đăng nhập → xóa tài khoản → dữ liệu D1 + Firestore + tài khoản Firebase bị xóa (xác nhận 2026-10-29).
- [ ] Khai URL xóa tài khoản trong Play Console (Data safety → Account deletion): `https://zenstudy.space/account-deletion/`.

### P0.3 Data Safety (khai báo trong Play Console)
Bản nháp — đối chiếu lại với code trước khi bấm gửi:

| Loại dữ liệu | Thu thập | Chia sẻ | Mục đích | Bắt buộc? |
|---|---|---|---|---|
| Email, tên, ảnh đại diện (Google/Firebase Auth) | Có | Không (Firebase là bên xử lý) | Đăng nhập, đồng bộ tài khoản | Bắt buộc nếu muốn đồng bộ |
| Nội dung người dùng: ghi chú, việc cần làm, cài đặt không gian học | Có (khi đăng nhập) | Không | Tính năng app + đồng bộ | Tùy chọn (chỉ khi đăng nhập) |
| Nội dung chat AI: tin nhắn, tên đoạn chat, tên tệp + ảnh thu nhỏ | Có (Firestore) | Có — chuyển tới nhà cung cấp AI (Cloudflare Workers AI / Gemini / OpenAI-compatible) để trả lời | Tính năng trợ lý AI | Tùy chọn |
| Âm thanh, video phòng học (LiveKit) | Không lưu bản ghi | Có — truyền thời gian thực qua LiveKit | Tính năng phòng học nhóm | Tùy chọn |
| Metadata phiên học (tên hiển thị, thời lượng, phòng) | Có | Không | Giới hạn sử dụng, vận hành | Có khi vào phòng |
| Số lượt hỏi AI/ngày (UID + ngày + số câu) | Có | Không | Giới hạn quota | Có khi dùng AI |
| Báo cáo nội dung & danh sách chặn: UID + tên hiển thị, câu trả lời/câu hỏi bị báo cáo, lý do, ghi chú, tên phòng | Có (khi dùng công cụ báo cáo/chặn trong app) | Không | An toàn cộng đồng, xử lý vi phạm | Tùy chọn |

Các mục cần khai thêm:
- [ ] Dữ liệu truyền tải được mã hóa (TLS) — Có.
- [ ] Người dùng có thể yêu cầu xóa dữ liệu — Có (nút trong app + trang `/account-deletion/` + email dự phòng).
- [ ] Không có quảng cáo. Analytics chỉ có GoatCounter (không cookie, không theo dõi xuyên trang, số liệu tổng hợp) — khai mục "App activity / Analytics" nếu Play Console hỏi.
- [ ] Vị trí, danh bạ, lịch, sức khỏe, tài chính: Không.

### P0.4 App content khác
- [ ] **App access**: app dùng được không cần đăng nhập; riêng AI cần đăng nhập Google → cung cấp hướng dẫn test (tester dùng tài khoản Google của họ).
- [ ] **Ads**: Không có quảng cáo.
- [ ] **Content rating (IARC)**: ứng dụng học tập/năng suất, không bạo lực/nội dung người lớn.
- [ ] **Target audience**: **16+** (chọn 16–17, 18+; không chọn 13–15).
- [ ] **Data deletion URL** (P0.2).
- [ ] **Khai báo AI + UGC** trong App content: app có dùng AI tạo nội dung, có nội dung người dùng (phòng học).
- [ ] **Chính sách OTA**: chỉ cập nhật JS/HTML/CSS, không đổi mục đích app (đã ghi trong guide).

### P0.5 Báo cáo nội dung, Terms và an toàn cho 16+ (làm trước khi bọc app)

Kế hoạch chi tiết + thứ tự thực hiện: [P0_5_REPORTING_PLAN.md](../features/P0_5_REPORTING_PLAN.md).

Theo chính sách AI-Generated Content và UGC của Google Play:
- [x] Phase 1 code: bảng `content_reports`/`user_blocks`/`user_restrictions`, API `/report` + `/blocks`, xóa tài khoản xóa kèm, 617 test xanh (2026-10-29).
- [x] Phase 2 code (P2e): admin xem lọc/chi tiết, resolve/dismiss + ghi chú, khóa AI/phòng; 11 ca test mới; chạy thử local (2026-10-30).
- [ ] Deploy Phase 1 + 2: chạy `workers/report-schema.sql` trên D1, dán `data-api`, build + deploy admin worker.
- [x] Trang `/terms` (điều khoản sử dụng) mô tả quy tắc dùng AI và phòng học; link trong app + footer các trang pháp lý. **Đã live**, đã sửa độ tuổi 16 và làm rõ quyền sử dụng nội dung.
- [x] Nút **"Báo cáo câu trả lời"** trên từng tin nhắn AI (Phase 3, 2026-10-30).
- [x] Lưu báo cáo AI vào D1 qua Worker: UID, nội dung tin bị báo cáo, lý do, thời gian; xem và xử lý trong admin console (Phase 2–3, đã kiểm trên production 2026-10-30).
- [x] Nút **báo cáo + chặn người dùng** trong phòng học — menu ⋮ trên tile (Phase 4, 2026-10-30).
- [x] Chốt hành vi "chặn": chặn 2 chiều việc vào chung phòng; đang chung thì tự rời (Phase 4, đã kiểm A/B trên production).
- [x] Cập nhật `/privacy` + Data Safety: dữ liệu báo cáo/chặn (tên hiển thị, nội dung, 180 ngày) — privacy mục 7, Data Safety thêm dòng, Terms mục 7 mô tả công cụ trong app (2026-10-30).
- [x] Guardrail AI (bản đầu build cho 13+): prompt an toàn cố định + lọc đầu vào/ra 5 nhóm; 25 test (`chat-proxy-guardrail.test.ts`); hiện quy tắc trong admin. **Đã dán `chat-proxy` lên production 2026-11-03** (cùng lần dán bỏ cấu hình gen temperature/max_tokens; `/health`, `/config` trả 200). **Khi triển khai 16+ phải nâng prompt/copy và bộ test lên mốc 16+ (P0.6).**
- [x] Thời hạn xử lý báo cáo: ghi **7 ngày** trong Terms mục 7; MVP **không thông báo ngược** cho người báo cáo (quyết định Phase 0).

### P0.6 Chuyển mốc mục tiêu sang 16+ (code xong 2026-11-03)

Chốt 2026-11-01: sản phẩm chính thức hướng tới **16+**, không phục vụ 13–15 trong giai đoạn này.

- [ ] **Play Console → Target audience**: chỉ chọn **16–17** và **18+**; bỏ 13–15. *(khai báo tay, làm lúc tạo app trên Console)*
- [x] **`/terms` + `/privacy`**: đổi mốc "từ 13 tuổi" thành "từ 16 tuổi"; bỏ đoạn đồng ý phụ huynh cho 13–15; ghi rõ 16–17 vẫn là người chưa thành niên và vẫn bị giới hạn nội dung (2026-11-03; ngày cập nhật trang: 03/11/2026; **đã push web, Pages deploy từ `main`**).
- [x] **Guardrail chat-proxy**: nâng `SAFETY_PREFIX` từ mốc 13+ lên 16+, cập nhật bộ test `chat-proxy-guardrail.test.ts` (26 test) và câu mẫu (2026-11-03; **đã dán `chat-proxy` bản 16+ lên Cloudflare production**).
- [x] **Chat v2**: system prompt server-side 16+ (Safety core + age band `16-17`/`18+`), minh bạch AI — đã có ngay từ S1 (2026-11-01); nút báo cáo sẽ thêm ở S5.
- [x] **Phòng học nhóm**: giữ nguyên báo cáo/chặn/UGC; không thêm quy định tài khoản dưới 16 (không cần đổi code).
- [ ] **Dữ liệu**: cập nhật Data Safety/privacy; 16+ không còn nghĩa vụ đồng ý cha mẹ theo luật dữ liệu trẻ, nhưng vẫn cần đánh giá tác động và hồ sơ chuyển dữ liệu ra nước ngoài. *(khai báo tay trên Play Console)*
- [ ] **Luật AI**: minh bạch "đang tương tác với AI", nhãn nội dung AI, tự phân loại rủi ro; nếu chatbot tự chấm điểm/xếp loại học sinh thì xử lý như rủi ro cao. *(đánh giá khi khai Console)*
- [ ] **Store listing**: nội dung, ảnh, mô tả không hướng tới học sinh 13–15.
- [ ] **Không mở lại 13–15** cho tới khi có plan "chế độ phụ huynh" riêng (tài khoản phụ huynh, đồng ý kép, tắt phòng nhóm, giới hạn ảnh).

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

## Quyết định đã chốt

- **Xóa tài khoản tự phục vụ**: đã chọn làm ngay và đã implement trong commit `da91273` (bắt buộc để nộp app).
- **Package name**: `space.zenstudy.app` (chốt 2026-10-29).
- **Target audience**: **16+** (chốt lại 2026-11-01; trước đó tạm chốt 13+).

## Quyết định cần chốt trước P1

1. **Google Sign-In**: giữ GIS trong WebView hay chuyển native plugin ngay từ đầu (an toàn hơn cho app).

---

## Nhật ký tiến độ

| Ngày | Việc | Trạng thái |
|---|---|---|
| 2026-10-28 | Lập plan, ghi nhận đã có tài khoản Google Play Developer | Xong |
| 2026-10-28 | Tạo `/privacy`, thêm vào sitemap, gắn link trong About modal (desktop) + sheet "Thêm" (mobile) | Xong |
| 2026-10-28 | Sửa mục chatbot theo thực tế Firestore; cập nhật bảng Data Safety | Xong |
| 2026-10-28 | Xóa tài khoản tự phục vụ: `DELETE /account`, Admin API, UI desktop/mobile, `/account-deletion/` | Code + commit `da91273`; đã deploy |
| 2026-10-29 | Rà soát lại plan, đối chiếu trạng thái repo và cập nhật tiến độ | Xong |
| 2026-10-29 | Xác minh bản live: `/privacy/` 200 (có mục chat Firestore), `/account-deletion/` 200, sitemap có cả 2 URL | Xong |
| 2026-10-29 | Xóa tài khoản hoạt động end-to-end (Worker + service account + rules) | Xong — P0 kỹ thuật đóng |
| 2026-10-29 | Rà chính sách Play 2026: đăng ký package name, chọn độ tuổi, yêu cầu báo cáo AI/UGC | Xong |
| 2026-10-29 | Chốt `space.zenstudy.app` + target 13+; thêm P0.5 (báo cáo AI/phòng học, Terms, an toàn 13+) | Xong |
| 2026-10-29 | Tạo `/terms`, thêm sitemap, link trong About modal + sheet "Thêm" + footer privacy/account-deletion | Xong |
| 2026-10-29 | Hoàn thiện nội dung `/terms`: đổi "dưới 18" thành "dưới 16", làm rõ quyền sử dụng nội dung, đồng bộ privacy | Xong |
| 2026-10-29 | Deploy web + xác minh `/terms/` 200 với nội dung mới; GoatCounter đã vào privacy/Data Safety (commit `f823a7b`) | Xong |
| 2026-10-29 | Phân tích hệ thống chat/phòng/admin + lập plan P0.5 với thứ tự 7 phase | Xong — chờ chốt quyết định |
| 2026-10-29 | Cập nhật admin plan: thêm P2e (hộp thư báo cáo + hạn chế tài khoản), đặt trước P2d | Xong |
| 2026-10-29 | Chốt 6 quyết định P0.5 (chặn 2 chiều, lưu 180 ngày, admin khóa AI/phòng, lý do cố định, không thông báo ngược, bỏ chặn trong Cài đặt) | Xong |
| 2026-10-29 | P0.5 Phase 1: schema D1 + API `/report`, `/blocks` + xóa tài khoản xóa kèm + test | Code xong; chờ deploy D1/data-api |
| 2026-10-30 | P0.5 Phase 2 (P2e): API admin reports/restrictions + panel "Báo cáo" trong shell; 11 test mới, 628 test xanh; thử local | Code xong; chờ deploy |
| 2026-11-01 | Chốt lại target **16+** (bỏ 13–15); thêm P0.6 checklist chuyển mốc terms/privacy/guardrail/chat v2/store | Plan xong; code để sau |
| 2026-11-03 | Dán `chat-proxy` bản mới lên Cloudflare (Phase 5 guardrail + bỏ cấu hình gen temperature/max_tokens); `/health`, `/config` trả 200 | Deploy xong; QA tay để Phase 7 |
| 2026-11-03 | P0.6: nâng `SAFETY_PREFIX` + test guardrail (26 test) + `/terms` + `/privacy` sang mốc 16+; 684 test xanh, `tsc` + `lint` sạch, đã kiểm hiển thị local | Code xong; chờ dán lại `chat-proxy` + push web |
| 2026-11-03 | Dán `chat-proxy` bản 16+ lên Cloudflare + push `main` (Pages build web 16+) | Xong — P0.6 đóng |
| 2026-11-03 | Phase 7 QA tay 2 tài khoản (Jim + Dinh) pass toàn bộ: guardrail 16+, không chặn oan, báo cáo AI + phòng, chặn 2 chiều, khóa/mở AI, xóa tài khoản, mobile spot-check; khối quy tắc an toàn trong admin hiện đúng 16+ | Xong — P0.5 đóng |

## Việc tiếp theo (theo thứ tự)

1. Khai báo Play Console theo P0.6: Target audience 16–17 + 18+ (lúc tạo app), Data Safety, đánh giá AI-law.
2. P1: dựng Capacitor shell + script `build:mobile`; chạy trên máy thật (Google Sign-In WebView, LiveKit mic/cam, asset CDN, link `/privacy/`).
3. P2: tạo keystore, cấu hình ký, build `.aab` và cài thử bản release.
4. P3: tạo app trên Play Console, khai Privacy URL + Account deletion URL + Data Safety + App content; chuẩn bị store listing và 20 tester.
