/**
 * Tràn màn hình + màu chữ thanh trạng thái trên app Android (Capacitor).
 * WebView mặc định để thanh trạng thái chiếm một dải riêng; bật overlay để nội dung
 * trải ra phía sau thanh trạng thái, và dùng chữ sáng vì nền app tối.
 */
import { isNativeApp } from "@/lib/google-sign-in";

let started = false;

export function initNativeStatusBar(): void {
  if (started || !isNativeApp()) return;
  started = true;
  void (async () => {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    // Style.Dark = chữ/icon sáng (dành cho nền tối), Style.Light = icon tối.
    await StatusBar.setStyle({ style: Style.Dark });
  })();
}
