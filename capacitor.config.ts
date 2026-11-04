import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "space.zenstudy.app",
  appName: "ZenStudy Space",
  webDir: "out",
  // Màu nền WebView khớp màu splash để không lóe trắng khi bàn giao từ splash native sang web
  backgroundColor: "#05070D",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Áp dụng ngay từ lúc native khởi động, trước khi WebView vẽ: chữ/icon thanh
    // trạng thái sáng trên nền tối, không đợi JS gọi lại sau khi app đã hiện.
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
    },
    FirebaseAuthentication: {
      providers: ["google.com"],
    },
  },
};

export default config;
