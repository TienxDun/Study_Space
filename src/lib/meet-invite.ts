/**
 * Các hàm thuần xử lý link mời phòng học nhóm LiveKit.
 * Giữ nguyên origin + base path (GitHub Pages), không hardcode domain.
 */

export function buildInviteLink(room: string, baseUrl?: string): string {
  const cleanRoom = (room || "").trim().slice(0, 32);
  let base: URL;

  if (baseUrl) {
    base = new URL(baseUrl);
  } else if (typeof window !== "undefined" && window.location?.href) {
    base = new URL(window.location.href);
  } else {
    base = new URL("http://localhost:3000/");
  }

  // Giữ nguyên origin + pathname (để tương thích base path trên GitHub Pages), xóa toàn bộ query và hash cũ
  const url = new URL(base.origin + base.pathname);
  if (cleanRoom) {
    url.searchParams.set("room", cleanRoom);
  }
  return url.toString();
}

export function readInviteRoom(search: string): string | null {
  if (!search) return null;
  try {
    const cleanSearch = search.includes("?")
      ? search.slice(search.indexOf("?"))
      : search.startsWith("/")
      ? search
      : `?${search}`;
    const params = new URLSearchParams(cleanSearch);
    const room = params.get("room");
    if (!room) return null;
    const trimmed = room.trim().slice(0, 32);
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
