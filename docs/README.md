# Tài liệu ZenStudy

Chỉ mục tài liệu đang dùng. File trong [`archive/`](./archive/README.md) là lịch sử, không phải nguồn trạng thái hiện tại.

## Đang dùng

| Tài liệu | Vai trò |
|---|---|
| [`features/PHONG_HOC_NHOM.md`](./features/PHONG_HOC_NHOM.md) | Nguồn thông tin chính về phòng học nhóm LiveKit, quota, D1, cấu hình và checklist P2-6 |
| [`features/LIVEKIT_ROADMAP.md`](./features/LIVEKIT_ROADMAP.md) | Trạng thái và lộ trình Phase 0–3 |
| [`features/ADMIN_CONSOLE_PLAN.md`](./features/ADMIN_CONSOLE_PLAN.md) | Lộ trình mở rộng trang admin (theo dõi + quản lý) |
| [`features/ADMIN_P1_PLAN.md`](./features/ADMIN_P1_PLAN.md) | Kế hoạch P1: Overview shell tĩnh, endpoint, log lỗi, R2 cơ bản |
| [`deployment/DEPLOY.md`](./deployment/DEPLOY.md) | Deploy Worker, D1, quy trình seed quota |
| [`guides/CLOUD_SYNC_GUIDE.md`](./guides/CLOUD_SYNC_GUIDE.md) | Vận hành Cloud Save snapshot trên D1 |
| [`guides/SYSTEM_LIMITS.md`](./guides/SYSTEM_LIMITS.md) | Bảng hạn mức toàn hệ thống, sinh từ `src/data/admin/hit-limits.ts` |
| [`guides/mobile-style-guide.md`](./guides/mobile-style-guide.md) | Quy chuẩn giao diện mobile |
| [`guides/firestore-rules.md`](./guides/firestore-rules.md) | Firestore rules |
| [`deployment/ANDROID_CHPLAY_OTA_GUIDE.md`](./deployment/ANDROID_CHPLAY_OTA_GUIDE.md) | Hướng dẫn Android/Play/OTA |
| [`overview/SYSTEM_OVERVIEW.md`](./overview/SYSTEM_OVERVIEW.md) | Tổng quan hệ thống |

## Lưu ý

- Ưu tiên `PHONG_HOC_NHOM.md` khi có khác biệt với roadmap hoặc task.
- Phase 2 là client-only; không sửa Worker/D1/schema/quota.
- Không dùng số liệu test trong file archive để báo trạng thái hiện tại.
