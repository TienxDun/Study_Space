/**
 * Cấu hình Firebase tối giản, KHÔNG import SDK.
 *
 * Nhiều component chỉ cần biết "Firebase đã được cấu hình chưa?" để ẩn/hiện
 * nút đăng nhập. Nếu đọc cờ này từ `@/lib/firebase` thì cả SDK Firebase
 * (~670KB) bị kéo vào bundle đầu trang. Tách riêng module này giữ cờ là
 * hằng số đồng bộ gọn nhẹ, SDK chỉ tải khi thực sự dùng (qua import động).
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const firebaseConfig = config;

export const firebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.appId
);
