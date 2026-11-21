"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CheckIcon,
  CpuIcon,
  EyeIcon,
  LightningIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  TextAlignLeftIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ChatV2Model } from "../types";
import { NON_CHAT_MODEL_RE } from "../lib/config";
import {
  PRICE_SORT_OPTIONS,
  formatPricePair,
  priceSortLabel,
  sortModelsByPrice,
  type PriceSort,
} from "../lib/pricing";
import { OTHER_PROVIDER, PROVIDER_FAMILIES, providerOf } from "../lib/providers";
import { formatContextSize } from "../lib/tokens";

interface ModelPickerProps {
  models: ChatV2Model[];
  value: string;
  valueInfo?: ChatV2Model;
  onChange: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

interface FilterChip {
  key: string;
  label: string;
  count: number;
  icon?: typeof SparkleIcon;
}

function isLocked(model: ChatV2Model): boolean {
  return model.available !== true;
}

function lockLabel(model: ChatV2Model): string | null {
  if (model.available === false) return "Tạm không khả dụng";
  if (model.available === null) return "Đang xác minh";
  return null;
}

function visionLabel(vision: boolean | null): string {
  if (vision === true) return "đọc ảnh";
  if (vision === false) return "chỉ chữ";
  return "chưa rõ ảnh";
}

function checkedLabel(model: ChatV2Model): string | null {
  if (!model.checkedAt) return null;
  const date = new Date(model.checkedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function verifyTitle(model: ChatV2Model): string {
  if (model.available === false) return `Đang hỏng: ${model.id}`;
  if (model.available !== true) return `Chưa xác minh: ${model.id}`;
  const checked = model.checkedAt ? new Date(model.checkedAt) : null;
  const when = checked && !Number.isNaN(checked.getTime()) ? checked.toLocaleString("vi-VN") : "chưa rõ";
  const parts = [`Đã xác minh lúc ${when}`];
  if (model.specSource) parts.push(`Ngữ cảnh: ${model.specSource}`);
  if (model.visionSource) parts.push(`Đọc ảnh: ${model.visionSource}`);
  return parts.join(" · ");
}

function matchesFilter(model: ChatV2Model, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "free") return model.free;
  if (filter === "vision") return model.vision === true;
  return providerOf(model).key === filter;
}

export function ModelPicker({
  models,
  value,
  valueInfo,
  onChange,
  disabled = false,
  compact = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [priceSort, setPriceSort] = useState<PriceSort>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Loại bỏ triệt để các model tạo ảnh, video, audio
  const cleanModels = useMemo(() => {
    return models.filter((model) => !NON_CHAT_MODEL_RE.test(model.id));
  }, [models]);

  // Đếm số lượng model theo từng bộ lọc
  const { typeChips, providerChips, usableCount } = useMemo<{
    typeChips: FilterChip[];
    providerChips: FilterChip[];
    usableCount: number;
  }>(() => {
    let free = 0;
    let vision = 0;
    let usable = 0;
    const providerCounts = new Map<string, number>();
    for (const model of cleanModels) {
      if (model.free) free++;
      if (model.vision === true) vision++;
      if (!isLocked(model)) usable++;
      const key = providerOf(model).key;
      providerCounts.set(key, (providerCounts.get(key) || 0) + 1);
    }

    const types: FilterChip[] = [
      { key: "all", label: "Tất cả", count: cleanModels.length },
    ];
    if (free > 0) types.push({ key: "free", label: "Miễn phí", icon: LightningIcon, count: free });
    if (vision > 0) types.push({ key: "vision", label: "Đọc ảnh", icon: EyeIcon, count: vision });

    const providers: FilterChip[] = [];
    for (const family of PROVIDER_FAMILIES) {
      const count = providerCounts.get(family.key) || 0;
      if (count > 0) providers.push({ key: family.key, label: family.label, count });
    }
    const otherCount = providerCounts.get(OTHER_PROVIDER.key) || 0;
    if (otherCount > 0) {
      providers.push({ key: OTHER_PROVIDER.key, label: OTHER_PROVIDER.label, count: otherCount });
    }

    return { typeChips: types, providerChips: providers, usableCount: usable };
  }, [cleanModels]);

  const allFilterKeys = useMemo(
    () => new Set([...typeChips, ...providerChips].map((chip) => chip.key)),
    [typeChips, providerChips]
  );

  // Model đổi theo key tier có thể làm bộ lọc đang chọn biến mất
  const effectiveFilter = allFilterKeys.has(activeFilter) ? activeFilter : "all";
  const activeProvider = providerChips.find((chip) => chip.key === effectiveFilter) || null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = cleanModels.filter((model) => {
      if (!matchesFilter(model, effectiveFilter)) return false;
      if (!needle) return true;
      return (
        model.id.toLowerCase().includes(needle) ||
        providerOf(model).label.toLowerCase().includes(needle)
      );
    });
    return sortModelsByPrice(matched, priceSort);
  }, [cleanModels, effectiveFilter, query, priceSort]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveFilter("all");
    setPriceSort("default");
    setSortOpen(false);
    setProviderOpen(false);
    setActiveIndex(0);
    const timer = window.setTimeout(() => {
      // Mobile: không tự focus để bàn phím ảo không bật lên che ngay bảng chọn.
      if (window.matchMedia("(min-width: 640px)").matches) searchRef.current?.focus();
    }, 40);
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Đánh dấu đã xử lý để phím tắt toàn cục không đóng luôn cả khung chat.
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [query, effectiveFilter, priceSort, open]);

  useEffect(() => {
    if (!sortOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sortOpen]);

  useEffect(() => {
    if (!providerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (providerRef.current && !providerRef.current.contains(event.target as Node)) {
        setProviderOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [providerOpen]);

  const choose = (id: string) => {
    const target = models.find((item) => item.id === id);
    if (target && isLocked(target)) return;
    onChange(id);
    setOpen(false);
  };

  const contextLabel = valueInfo ? formatContextSize(valueInfo.contextTokens) : "";
  const priceLabel = valueInfo ? formatPricePair(valueInfo) : "";
  const triggerPrice = priceLabel && priceLabel !== "—" ? priceLabel : "";
  const isSelectedFree = valueInfo?.free === true;
  const valueLock = valueInfo ? lockLabel(valueInfo) : null;
  const triggerTitle = valueInfo
    ? [
        value,
        contextLabel && contextLabel !== "-" ? `${contextLabel} context` : null,
        visionLabel(valueInfo.vision),
        triggerPrice || null,
        compact ? null : "motapis",
      ]
        .filter(Boolean)
        .join(" · ")
    : value;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chọn model, đang dùng ${value}`}
        title={triggerTitle}
        className="group flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full pl-2 pr-1.5 text-chat-muted transition hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:pl-1.5"
      >
        <CpuIcon
          size={14}
          weight="duotone"
          className="shrink-0 text-chat-accent/80 transition group-hover:text-chat-accent"
          aria-hidden="true"
        />
        <span className="min-w-0 truncate text-[12px] font-semibold text-chat-ink max-w-[108px] sm:max-w-[220px]">
          {value}
        </span>
        {valueLock ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold ${
              valueInfo?.available === false
                ? "bg-chat-rose-soft text-chat-rose"
                : "bg-chat-amber-soft text-chat-amber"
            }`}
          >
            {valueInfo?.available === false ? "HỎNG" : "CHƯA KIỂM"}
          </span>
        ) : isSelectedFree ? (
          <span className="hidden shrink-0 rounded bg-chat-accent-soft px-1 py-0.5 text-[8px] font-bold tracking-wide text-chat-accent sm:inline-block">
            FREE
          </span>
        ) : null}
        <CaretDownIcon
          size={11}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="chat-v2-anim-fade fixed inset-0 z-[59] bg-black/50 sm:hidden"
          />
          <div
            role="listbox"
            aria-label="Danh sách model"
            data-escape-guard=""
            className="chat-v2-anim-sheet fixed inset-x-3 bottom-[calc(var(--app-safe-bottom)+0.75rem)] z-[60] flex max-h-[min(78dvh,680px)] flex-col overflow-hidden rounded-[24px] border border-chat-border-strong bg-chat-elevated shadow-[var(--chat-shadow-popover)] sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:z-50 sm:mb-2 sm:max-h-none sm:w-[410px] sm:rounded-2xl sm:bg-chat-elevated/97 sm:backdrop-blur-2xl"
          >
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-chat-border-strong sm:hidden" />
            {/* Header tìm kiếm */}
            <div className="shrink-0 border-b border-chat-border p-2.5 pb-2">
              <div className="flex items-center gap-1.5">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-chat-border bg-chat-surface px-2.5 py-2 focus-within:border-chat-accent-border">
                  <MagnifyingGlassIcon size={14} className="shrink-0 text-chat-muted" aria-hidden="true" />
                  <span className="sr-only">Tìm model</span>
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setActiveIndex((index) => Math.max(index - 1, 0));
                      } else if (event.key === "Enter" && filtered[activeIndex]) {
                        event.preventDefault();
                        choose(filtered[activeIndex].id);
                      }
                    }}
                    placeholder="Tìm model theo tên, nhà phát hành…"
                    className="min-w-0 flex-1 bg-transparent text-xs text-chat-ink outline-none placeholder:text-chat-faint"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="text-[10px] text-chat-muted hover:text-chat-ink"
                    >
                      Xoá
                    </button>
                  ) : null}
                </label>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng bảng chọn model"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-chat-muted transition hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 sm:hidden"
              >
                <XIcon size={15} weight="bold" aria-hidden="true" />
              </button>
              </div>

            {/* Hàng lọc: loại model + hãng */}
            <div ref={providerRef} className="relative mt-2 flex flex-wrap items-center gap-1.5">
              {typeChips.map((chip) => {
                const active = effectiveFilter === chip.key;
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      setActiveFilter(chip.key);
                      setProviderOpen(false);
                    }}
                    aria-pressed={active}
                    title={`${chip.count} model`}
                    className={`inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                      active
                        ? "border-chat-accent-border bg-chat-accent-soft text-chat-accent shadow-xs"
                        : "border-chat-border bg-chat-surface text-chat-muted hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink"
                    }`}
                  >
                    {Icon ? (
                      <Icon size={11} weight={active ? "fill" : "regular"} aria-hidden="true" />
                    ) : null}
                    <span>{chip.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setProviderOpen((current) => !current);
                  setSortOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={providerOpen}
                aria-label={`Lọc theo hãng: ${activeProvider ? activeProvider.label : "Tất cả hãng"}`}
                title="Lọc theo hãng"
                className={`inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                  activeProvider
                    ? "border-chat-accent-border bg-chat-accent-soft text-chat-accent shadow-xs"
                    : "border-chat-border bg-chat-surface text-chat-muted hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink"
                }`}
              >
                <span className="max-w-[88px] truncate">
                  {activeProvider ? activeProvider.label : "Hãng"}
                </span>
                <CaretDownIcon
                  size={9}
                  weight="bold"
                  aria-hidden="true"
                  className={`transition-transform motion-reduce:transition-none ${providerOpen ? "rotate-180" : ""}`}
                />
              </button>

              {providerOpen ? (
                <div
                  role="menu"
                  aria-label="Lọc theo hãng"
                  className="absolute right-0 top-full z-30 mt-1 max-h-[232px] w-52 overflow-y-auto rounded-xl border border-chat-border-strong bg-chat-elevated p-1 shadow-[var(--chat-shadow-popover)] custom-study-scroll"
                >
                  {[{ key: "all", label: "Tất cả hãng", count: cleanModels.length }, ...providerChips].map(
                    (chip) => {
                      const active = effectiveFilter === chip.key;
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setActiveFilter(chip.key);
                            setProviderOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
                            active
                              ? "bg-chat-accent-soft text-chat-accent"
                              : "text-chat-muted hover:bg-chat-hover hover:text-chat-ink"
                          }`}
                        >
                          <span className="truncate">{chip.label}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="tabular-nums text-chat-faint">{chip.count}</span>
                            {active ? <CheckIcon size={12} weight="bold" aria-hidden="true" /> : null}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Danh sách model */}
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 custom-study-scroll sm:max-h-[330px] sm:flex-none">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-chat-muted">
                {cleanModels.length === 0
                  ? "Chưa tải được danh mục model đã xác minh."
                  : "Không tìm thấy model nào phù hợp."}
              </p>
            ) : (
              filtered.map((model, index) => {
                const selected = model.id === value;
                const active = index === activeIndex;
                const isFree = model.free;
                const lock = lockLabel(model);
                const checked = model.available === true ? checkedLabel(model) : null;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={lock ? true : undefined}
                    disabled={!!lock}
                    title={verifyTitle(model)}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(model.id)}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition sm:py-2 ${
                      lock
                        ? "cursor-not-allowed opacity-60"
                        : active
                          ? "bg-chat-hover"
                          : "hover:bg-chat-hover"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                        selected && !lock
                          ? "border-chat-accent-border bg-chat-accent-soft text-chat-accent"
                          : "border-chat-border bg-chat-surface text-chat-muted group-hover:text-chat-ink"
                      }`}
                    >
                      {lock ? (
                        <LockSimpleIcon size={13} aria-hidden="true" />
                      ) : model.vision === true ? (
                        <EyeIcon size={13} aria-hidden="true" />
                      ) : (
                        <TextAlignLeftIcon size={13} aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-semibold text-chat-ink">
                          {model.id}
                        </span>
                        {lock ? (
                          <span
                            className={`shrink-0 rounded-md border px-1.5 py-0.2 text-[9px] font-semibold tracking-wide ${
                              model.available === false
                                ? "border-chat-rose-border bg-chat-rose-soft text-chat-rose"
                                : "border-chat-amber-border bg-chat-amber-soft text-chat-amber"
                            }`}
                          >
                            {lock}
                          </span>
                        ) : isFree ? (
                          <span className="shrink-0 rounded-md border border-chat-accent-border bg-chat-accent-soft px-1.5 py-0.2 text-[9px] font-semibold tracking-wide text-chat-accent">
                            Miễn phí
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[10px] text-chat-muted">
                        {providerOf(model).label} · {formatContextSize(model.contextTokens)} ·{" "}
                        {visionLabel(model.vision)}
                        {checked ? ` · ✓ ${checked}` : ""}
                      </span>
                    </span>
                    <span
                      title={
                        isFree
                          ? "Giá vào/ra mỗi 1M token (USD) khi hết quota miễn phí"
                          : "Giá vào/ra mỗi 1M token (USD)"
                      }
                      className="shrink-0 text-[10px] font-medium tabular-nums text-chat-muted"
                    >
                      {formatPricePair(model)}
                    </span>
                    {selected && !lock ? (
                      <CheckIcon
                        size={14}
                        weight="bold"
                        className="shrink-0 text-chat-accent"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer: số lượng + sắp xếp theo giá */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-chat-border px-3 py-1.5 text-[10px] text-chat-faint">
            <span>
              {filtered.length}/{cleanModels.length} model · {usableCount} dùng được
            </span>

            <div ref={sortRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSortOpen((current) => !current);
                  setProviderOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                aria-label={`Sắp xếp theo giá: ${priceSortLabel(priceSort)}`}
                title="Xếp theo chi phí ước tính (vào × 3 + ra), USD / 1M token"
                className={`inline-flex h-[26px] items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition ${
                  priceSort !== "default"
                    ? "border-chat-accent-border bg-chat-accent-soft text-chat-accent shadow-xs"
                    : "border-chat-border bg-chat-surface text-chat-muted hover:border-chat-border-strong hover:bg-chat-hover hover:text-chat-ink"
                }`}
              >
                <ArrowsDownUpIcon size={11} weight="bold" aria-hidden="true" />
                <span>{priceSortLabel(priceSort)}</span>
                <CaretDownIcon
                  size={9}
                  weight="bold"
                  aria-hidden="true"
                  className={`transition-transform motion-reduce:transition-none ${sortOpen ? "rotate-180" : ""}`}
                />
              </button>

              {sortOpen ? (
                <div
                  role="menu"
                  aria-label="Sắp xếp theo giá"
                  className="absolute bottom-full right-0 z-30 mb-1 w-52 rounded-xl border border-chat-border-strong bg-chat-elevated p-1 shadow-[var(--chat-shadow-popover)]"
                >
                  <p className="px-2 pb-1 pt-0.5 text-[9px] text-chat-faint">
                    Giá vào/ra · USD / 1M token
                  </p>
                  {PRICE_SORT_OPTIONS.map((option) => {
                    const active = priceSort === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setPriceSort(option.key);
                          setSortOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition ${
                          active
                            ? "bg-chat-accent-soft text-chat-accent"
                            : "text-chat-muted hover:bg-chat-hover hover:text-chat-ink"
                        }`}
                      >
                        <span>{option.label}</span>
                        {active ? <CheckIcon size={12} weight="bold" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
