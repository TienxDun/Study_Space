/**
 * Quản lý trạng thái mở rộng toàn màn hình (Zen Mode) của các bảng Sheet trên Mobile.
 *
 * Khi bất kỳ sheet nào được mở rộng, hệ thống phát sự kiện `zenstudy:mobile-sheet-expanded`
 * để MobileTopBar tự động ẩn đi, ngăn chặn hiện tượng nhìn xuyên qua lớp kính mờ thấy các nút bên dưới.
 */

const activeExpandedSheets = new Set<string>();

export function setSheetExpanded(sheetId: string, expanded: boolean): void {
  if (typeof window === "undefined") return;

  if (expanded) {
    activeExpandedSheets.add(sheetId);
  } else {
    activeExpandedSheets.delete(sheetId);
  }

  window.dispatchEvent(
    new CustomEvent("zenstudy:mobile-sheet-expanded", {
      detail: { isExpanded: activeExpandedSheets.size > 0 },
    })
  );
}

export function isAnySheetExpanded(): boolean {
  return activeExpandedSheets.size > 0;
}
