/**
 * Đăng nhập Google dùng chung cho web và app Android (Capacitor).
 *
 * Trên app Android không có popup/redirect của trình duyệt, nên dùng
 * @capacitor-firebase/authentication: nó mở hộp chọn tài khoản gốc của máy,
 * lấy idToken rồi đăng nhập thẳng vào Firebase Auth bằng signInWithCredential.
 * Các hàm đều import động để bản web không kéo SDK native vào bundle đầu.
 */

export const isNativeApp = (): boolean =>
  typeof window !== "undefined" &&
  Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

/** Đăng nhập Google trên app Android. Trả về true nếu người dùng đã hủy. */
export async function signInWithGoogleNative(): Promise<{ cancelled: boolean }> {
  const [{ FirebaseAuthentication }, { GoogleAuthProvider, signInWithCredential }, fb] =
    await Promise.all([
      import("@capacitor-firebase/authentication"),
      import("firebase/auth"),
      import("@/lib/firebase"),
    ]);
  let result;
  try {
    result = await FirebaseAuthentication.signInWithGoogle();
  } catch (e) {
    const msg = String((e as Error)?.message || "");
    if (/cancel/i.test(msg)) return { cancelled: true };
    throw e;
  }
  const idToken = result?.credential?.idToken;
  if (!idToken) throw new Error("missing-id-token");
  await signInWithCredential(
    fb.getFirebaseAuth(),
    GoogleAuthProvider.credential(idToken, result.credential?.accessToken || undefined)
  );
  return { cancelled: false };
}

/** Đăng xuất khỏi cả phiên Google gốc của máy (app Android). */
export async function signOutGoogleNative(): Promise<void> {
  try {
    const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
    await FirebaseAuthentication.signOut();
  } catch {
    /* Firebase phiên chính vẫn được đăng xuất ở nơi khác */
  }
}
