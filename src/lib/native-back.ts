import { isNativeApp } from "@/lib/google-sign-in";

/**
 * Nối nút Back của Android vào History API của WebView.
 *
 * Trong app native, Back hệ thống không tự phát popstate. Nếu không đăng ký
 * listener, plugin App sẽ lùi WebView (khi còn history) rồi thoát Activity,
 * bỏ qua stack điều hướng của app. Listener này để mọi lần Back đi qua đúng
 * một đường xử lý như trên web.
 */
export function registerNativeBackHandler(onBack: () => void): () => void {
  if (!isNativeApp()) return () => {};

  let disposed = false;
  let removeListener: (() => void) | null = null;

  void import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("backButton", () => {
        if (!disposed) onBack();
      })
    )
    .then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      removeListener = () => void handle.remove();
    })
    .catch(() => {});

  return () => {
    disposed = true;
    removeListener?.();
    removeListener = null;
  };
}

/** Thoát app Android sau khi người dùng bấm Back 2 lần ở màn hình chính. */
export async function exitNativeApp(): Promise<void> {
  try {
    const { App } = await import("@capacitor/app");
    await App.exitApp();
  } catch {
    /* Trình duyệt không hỗ trợ thì bỏ qua, web đã xử lý bằng history.back() */
  }
}
