import type { ChatV2Model } from "../types";

export type PriceSort = "default" | "asc" | "desc";

export const PRICE_SORT_OPTIONS: Array<{ key: PriceSort; label: string }> = [
  { key: "default", label: "Mặc định" },
  { key: "asc", label: "Giá thấp → cao" },
  { key: "desc", label: "Giá cao → thấp" },
];

type PricedModel = Pick<ChatV2Model, "id" | "priceIn" | "priceOut">;

function isPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function formatPrice(value: number | null | undefined): string {
  if (!isPrice(value)) return "—";
  return `$${Number(value.toFixed(3))}`;
}

/** "vào/ra" mỗi 1M token, ví dụ "$0.07/$0.14". */
export function formatPricePair(model: Pick<ChatV2Model, "priceIn" | "priceOut">): string {
  if (!isPrice(model.priceIn) || !isPrice(model.priceOut)) return "—";
  return `${formatPrice(model.priceIn)}/${formatPrice(model.priceOut)}`;
}

/** Chi phí ước tính cho 1 lượt dùng: 3 phần token vào + 1 phần token ra. */
export function blendedPrice(model: Pick<ChatV2Model, "priceIn" | "priceOut">): number | null {
  if (!isPrice(model.priceIn) || !isPrice(model.priceOut)) return null;
  return model.priceIn * 3 + model.priceOut;
}

export function sortModelsByPrice<T extends PricedModel>(models: T[], sort: PriceSort): T[] {
  if (sort === "default") return models;
  const direction = sort === "asc" ? 1 : -1;
  return [...models].sort((a, b) => {
    const priceA = blendedPrice(a);
    const priceB = blendedPrice(b);
    // Model chưa có giá luôn nằm cuối, bất kể chiều sắp xếp.
    if (priceA === null && priceB === null) return a.id.localeCompare(b.id);
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return (priceA - priceB) * direction || a.id.localeCompare(b.id);
  });
}

export function priceSortLabel(sort: PriceSort): string {
  if (sort === "asc") return "Giá ↑";
  if (sort === "desc") return "Giá ↓";
  return "Mặc định";
}
