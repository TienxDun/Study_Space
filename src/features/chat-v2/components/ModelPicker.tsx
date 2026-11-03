"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsDownUpIcon,
  CaretDownIcon,
  CheckIcon,
  CpuIcon,
  EyeIcon,
  LightningIcon,
  MagnifyingGlassIcon,
  SparkleIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react";
import type { ChatV2Model } from "../types";
import { CHAT_V2_FREE_MODELS, NON_CHAT_MODEL_RE } from "../lib/config";
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

function matchesFilter(model: ChatV2Model, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "free") return CHAT_V2_FREE_MODELS.has(model.id);
  if (filter === "vision") return !!model.vision;
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
  const { typeChips, providerChips } = useMemo<{
    typeChips: FilterChip[];
    providerChips: FilterChip[];
  }>(() => {
    let free = 0;
    let vision = 0;
    const providerCounts = new Map<string, number>();
    for (const model of cleanModels) {
      if (CHAT_V2_FREE_MODELS.has(model.id)) free++;
      if (model.vision) vision++;
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

    return { typeChips: types, providerChips: providers };
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
    const timer = window.setTimeout(() => searchRef.current?.focus(), 40);
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
    onChange(id);
    setOpen(false);
  };

  const contextLabel = valueInfo ? formatContextSize(valueInfo.contextTokens) : "";
  const priceLabel = valueInfo ? formatPricePair(valueInfo) : "";
  const triggerPrice = priceLabel && priceLabel !== "—" ? priceLabel : "";
  const isSelectedFree = CHAT_V2_FREE_MODELS.has(value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chọn model, đang dùng ${value}`}
        className="group flex min-h-10 items-center gap-2 rounded-full border border-chat-border bg-chat-surface py-1 pl-1 pr-2.5 text-left transition hover:border-chat-border-strong hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chat-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-chat-accent-border bg-chat-accent-soft text-chat-accent">
          <CpuIcon size={15} weight="duotone" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="flex max-w-[140px] items-center gap-1.5 sm:max-w-[200px]">
            <span className="truncate text-[12px] font-semibold text-chat-ink">
              {value}
            </span>
            {isSelectedFree ? (
              <span className="hidden shrink-0 rounded-md border border-chat-accent-border bg-chat-accent-soft px-1 py-0.2 text-[8px] font-bold text-chat-accent sm:inline-block">
                FREE
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-chat-muted">
            {contextLabel ? <span>{contextLabel} context</span> : null}
            {valueInfo ? (
              <span className="inline-flex items-center gap-0.5">
                {valueInfo.vision ? <EyeIcon size={10} aria-hidden="true" /> : <TextAlignLeftIcon size={10} aria-hidden="true" />}
                {valueInfo.vision ? "ảnh" : "chữ"}
              </span>
            ) : null}
            {triggerPrice ? (
              <span className="hidden sm:inline" title="Giá vào/ra mỗi 1M token (USD)">
                · {triggerPrice}
              </span>
            ) : compact ? null : (
              <span className="hidden sm:inline">· motapis</span>
            )}
          </span>
        </span>
        <CaretDownIcon
          size={13}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 text-chat-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Danh sách model"
          className="chat-v2-anim-pop fixed inset-x-3 top-[7.25rem] z-50 w-auto overflow-hidden rounded-2xl border border-chat-border-strong bg-chat-elevated/97 shadow-[var(--chat-shadow-popover)] backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[410px]"
        >
          {/* Header tìm kiếm */}
          <div className="border-b border-chat-border p-2.5 pb-2">
            <label className="flex items-center gap-2 rounded-xl border border-chat-border bg-chat-surface px-2.5 py-2 focus-within:border-chat-accent-border">
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
          <div className="max-h-[330px] overflow-y-auto p-1.5 custom-study-scroll">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-chat-muted">
                Không tìm thấy model nào phù hợp.
              </p>
            ) : (
              filtered.map((model, index) => {
                const selected = model.id === value;
                const active = index === activeIndex;
                const isFree = CHAT_V2_FREE_MODELS.has(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(model.id)}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                      active ? "bg-chat-hover" : "hover:bg-chat-hover"
                    }`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                        selected
                          ? "border-chat-accent-border bg-chat-accent-soft text-chat-accent"
                          : "border-chat-border bg-chat-surface text-chat-muted group-hover:text-chat-ink"
                      }`}
                    >
                      {model.vision ? (
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
                        {isFree ? (
                          <span className="shrink-0 rounded-md border border-chat-accent-border bg-chat-accent-soft px-1.5 py-0.2 text-[9px] font-semibold tracking-wide text-chat-accent">
                            Miễn phí
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[10px] text-chat-muted">
                        {providerOf(model).label} · {formatContextSize(model.contextTokens)} ·{" "}
                        {model.vision ? "đọc ảnh" : "chỉ chữ"}
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
                    {selected ? (
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
          <div className="flex items-center justify-between gap-2 border-t border-chat-border px-3 py-1.5 text-[10px] text-chat-faint">
            <span>
              {filtered.length}/{cleanModels.length} model khả dụng
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
      ) : null}
    </div>
  );
}
