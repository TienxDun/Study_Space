"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MagnifyingGlassIcon,
  TrashIcon,
  WarningIcon,
  ImageBrokenIcon,
  PlusIcon,
  UploadSimpleIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  XIcon,
  FilmStripIcon,
} from "@phosphor-icons/react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { useAdminTheme } from "@/components/admin/AdminThemeContext";

interface StudioScene {
  id: string;
  name: string;
  category: string;
  type: "VIDEO" | "IMAGE";
  mediaPath: string;
  thumbnailPath: string;
  mediaExists: boolean;
  thumbExists: boolean;
}

const CATEGORIES = ["chill", "anime", "cyberpunk", "dark", "urban", "nature", "cartoon", "cute"] as const;

export default function DevStudioPage() {
  const { isDark } = useAdminTheme();

  const [scenes, setScenes] = useState<StudioScene[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);

  // Sửa tên/nhóm của 1 cảnh
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("chill");
  const [savingEdit, setSavingEdit] = useState(false);

  // Bảng thêm cảnh mới
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("chill");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newThumb, setNewThumb] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Tiến độ đẩy: { i: file thứ mấy, n: tổng số, file: tên file, st: up | skip }
  const [syncProgress, setSyncProgress] = useState<{
    i: number;
    n: number;
    file: string;
    st: string;
  } | null>(null);
  const [syncSecs, setSyncSecs] = useState(0);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    uploaded: number;
    skipped: number;
    mb: string;
    error?: string;
  } | null>(null);

  const apiUrl = useCallback((path: string) => {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.href).toString();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const url = apiUrl("../../api/admin/scenes/");
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Máy báo lỗi ${res.status} ở địa chỉ: ${url} . Đoạn trả về: ${body.slice(0, 120)}`
        );
      }
      const data = await res.json();
      setScenes(data.scenes || []);
      setNotice(null);
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    load();
    return () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    };
  }, [load]);

  const handleDeletePress = async (scene: StudioScene) => {
    if (confirmId !== scene.id) {
      setConfirmId(scene.id);
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmId(null), 3000);
      return;
    }
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    setConfirmId(null);
    setDeletingId(scene.id);
    try {
      const res = await fetch(apiUrl("../../api/admin/scenes/"), {
        method: "DELETE",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scene.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Xóa thất bại.");
      const files =
        data.deletedFiles?.length > 0
          ? ` Đã xóa file: ${data.deletedFiles.join(", ")}.`
          : " File vốn đã mất từ trước.";
      setNotice(`Đã xóa “${data.removed}” khỏi danh sách.${files} Nhớ lưu lại (commit) rồi đăng web.`);
      await load();
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e));
    } finally {
      setDeletingId(null);
    }
  };

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const thumbUrl = (s: StudioScene) =>
    `${basePath}/study/${s.thumbnailPath}`.replace(/\/+/g, "/");

  const startEdit = (s: StudioScene) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditCategory(s.category);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) {
      setNotice("Tên cảnh không được để trống.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(apiUrl("../../api/admin/scenes/"), {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), category: editCategory }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Sửa thất bại.");
      setNotice(`Đã sửa thành “${data.scene.name}”. Nhớ lưu lại (commit) rồi đăng web.`);
      setEditingId(null);
      await load();
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e));
    } finally {
      setSavingEdit(false);
    }
  };

  const isVideoFile = (f: File | null) =>
    !!f && (f.type.startsWith("video/") || /\.(mp4|webm)$/i.test(f.name));

  const handlePickFile = (f: File | null) => {
    setNewFile(f);
    setNewThumb(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f && (f.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|avif)$/i.test(f.name))) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAddScene = async () => {
    if (!newFile) {
      setNotice("Chọn file ảnh hoặc video trước.");
      return;
    }
    if (!newName.trim()) {
      setNotice("Nhập tên cảnh.");
      return;
    }
    setAdding(true);
    try {
      const form = new FormData();
      form.append("name", newName.trim());
      form.append("category", newCategory);
      form.append("file", newFile);
      if (newThumb) form.append("thumb", newThumb);
      const res = await fetch(apiUrl("../../api/admin/scenes/"), {
        method: "POST",
        cache: "no-store",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Thêm thất bại.");
      setNotice(
        `Đã thêm “${data.scene.name}”. File nằm ở máy bạn, bấm “Đẩy lên kho mạng” để web thật thấy, rồi lưu lại (commit) và đăng web.`
      );
      setShowAdd(false);
      setNewName("");
      setNewFile(null);
      setNewThumb(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      await load();
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e));
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress({ i: 0, n: 0, file: "", st: "info" });
    setSyncResult(null);
    setSyncSecs(0);
    const startedAt = Date.now();
    const ticker = window.setInterval(
      () => setSyncSecs(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    try {
      const res = await fetch(apiUrl("../../api/admin/sync/"), {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Máy báo lỗi ${res.status}.`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const msg = JSON.parse(line.slice(6));
              if (msg.t === "p") {
                setSyncProgress({ i: msg.i, n: msg.n, file: msg.file || "", st: msg.st });
              } else if (msg.t === "done") {
                setSyncResult({
                  ok: !!msg.ok,
                  uploaded: msg.uploaded || 0,
                  skipped: msg.skipped || 0,
                  mb: msg.mb || "0",
                  error: msg.error,
                });
              }
            } catch {}
          }
        }
      }
    } catch (e) {
      setSyncResult({
        ok: false,
        uploaded: 0,
        skipped: 0,
        mb: "0",
        error: String(e instanceof Error ? e.message : e),
      });
    } finally {
      window.clearInterval(ticker);
      setSyncing(false);
    }
  };

  const missingCount = useMemo(
    () => scenes.filter((s) => !s.mediaExists || !s.thumbExists).length,
    [scenes]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scenes.length };
    CATEGORIES.forEach((c) => {
      counts[c] = scenes.filter((s) => s.category === c).length;
    });
    return counts;
  }, [scenes]);

  const visible = useMemo(() => {
    return scenes.filter((s) => {
      if (selectedCat !== "all" && s.category !== selectedCat) return false;
      if (filterMissingOnly && s.mediaExists && s.thumbExists) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return `${s.name} ${s.category} ${s.type} ${s.mediaPath}`.toLowerCase().includes(q);
    });
  }, [scenes, selectedCat, filterMissingOnly, query]);

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-200 ${
        isDark
          ? "bg-[#080b11] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200"
          : "bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-900"
      }`}
    >
      {/* Background Subtle Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {isDark ? (
          <>
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/[0.05] rounded-full blur-[120px] -translate-y-1/2" />
            <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-sky-500/[0.04] rounded-full blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-[120px] -translate-y-1/2" />
            <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-sky-100/30 rounded-full blur-[100px]" />
          </>
        )}
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Unified Admin Header */}
        <AdminHeader
          activeTab="studio"
          title="Studio Quản Lý Bối Cảnh"
          description={`Chỉ chạy trên máy local, không publish lên host admin. Xem, thêm, sửa và xóa bối cảnh học tập; xóa tại đây sẽ xóa đồng thời trong scenes.json lẫn file ảnh/video cục bộ. Đang có ${scenes.length} cảnh.`}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdd((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 ${
                  isDark
                    ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/35 text-emerald-300"
                    : "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                }`}
              >
                <PlusIcon className="w-4 h-4" />
                <span>{showAdd ? "Đóng form" : "Thêm cảnh"}</span>
              </button>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                  isDark
                    ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-200 hover:text-white"
                    : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900"
                }`}
              >
                <CloudArrowUpIcon className="w-4 h-4 text-sky-500" />
                <span>{syncing ? "Đang đẩy..." : "Đẩy lên R2"}</span>
              </button>
            </div>
          }
        />

        {/* Filter Toolbar: Search + Category Chips */}
        <div
          className={`space-y-3 p-3.5 rounded-2xl border transition-all ${
            isDark
              ? "bg-slate-900/50 backdrop-blur-xl border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
              : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <MagnifyingGlassIcon className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-500" : "text-slate-400"}`} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm cảnh theo tên, nhóm, định dạng..."
                className={`w-full pl-9 pr-8 py-1.5 rounded-xl border text-xs focus:outline-none transition-all ${
                  isDark
                    ? "bg-black/40 border-white/10 text-white placeholder:text-slate-500 focus:border-white/30"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400"
                }`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Missing Files Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMissingOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  filterMissingOnly
                    ? isDark
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border-white/[0.06]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <WarningIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>Chỉ cảnh thiếu file ({missingCount})</span>
              </button>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedCat("all")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                selectedCat === "all"
                  ? isDark
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-bold"
                  : isDark
                    ? "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent"
              }`}
            >
              Tất cả ({categoryCounts.all || 0})
            </button>
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap capitalize cursor-pointer border ${
                  selectedCat === cat
                    ? isDark
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
                      : "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs font-bold"
                    : isDark
                      ? "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent"
                }`}
              >
                {cat} ({categoryCounts[cat] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Add Scene Drawer / Modal */}
        {showAdd && (
          <div
            className={`rounded-3xl p-5 space-y-4 border transition-all ${
              isDark
                ? "bg-slate-900/80 backdrop-blur-2xl border-white/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                : "bg-white border-slate-200 shadow-xl"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                <PlusIcon className="w-4 h-4 text-emerald-500" />
                Thêm bối cảnh học tập mới
              </h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className={`p-1 rounded-lg ${isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`flex flex-col items-center justify-center gap-2 min-h-[160px] rounded-2xl border border-dashed cursor-pointer transition-colors overflow-hidden relative ${
                  isDark
                    ? "border-white/20 hover:border-emerald-400/40 bg-white/[0.02]"
                    : "border-slate-300 hover:border-emerald-500 bg-slate-50"
                }`}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Xem trước" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <UploadSimpleIcon className={`w-6 h-6 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
                    <span className={`text-xs font-semibold px-3 text-center ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {newFile ? newFile.name : "Bấm để chọn file ảnh hoặc video"}
                    </span>
                    <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      jpg, png, webp, avif, mp4, webm (tối đa 50MB)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => handlePickFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="space-y-3">
                <div>
                  <p className={`text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>Tên cảnh</p>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Thư viện mưa đêm"
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                      isDark
                        ? "bg-black/40 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600"
                    }`}
                  />
                </div>
                <div>
                  <p className={`text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>Nhóm (Category)</p>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none capitalize ${
                      isDark
                        ? "bg-black/40 border-white/10 text-white focus:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-600"
                    }`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {isVideoFile(newFile) && (
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      Ảnh nhỏ xem trước (bắt buộc đối với video)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setNewThumb(e.target.files?.[0] || null)}
                      className={`w-full text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-xl file:border file:text-xs file:cursor-pointer ${
                        isDark
                          ? "text-slate-300 file:border-white/15 file:bg-white/10 file:text-white"
                          : "text-slate-600 file:border-slate-200 file:bg-slate-100 file:text-slate-700"
                      }`}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddScene}
                  disabled={adding}
                  className={`w-full py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    isDark
                      ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/40 text-emerald-200"
                      : "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                  }`}
                >
                  {adding ? "Đang thêm cảnh..." : "Thêm vào danh sách"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Progress Bar */}
        {syncing && syncProgress && (
          <div className={`rounded-2xl border p-4 space-y-2.5 ${isDark ? "bg-slate-900/70 backdrop-blur-2xl border-sky-500/30" : "bg-white border-sky-300 shadow-sm"}`}>
            <div className="flex items-center justify-between text-xs">
              <span className={`font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                <CloudArrowUpIcon className="w-4 h-4 text-sky-500 animate-bounce" />
                Đang đẩy lên kho mạng R2{syncProgress.n > 0 && ` (${syncProgress.i}/${syncProgress.n})`}
              </span>
              <span className={`font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {syncProgress.n > 0 ? `${Math.round((syncProgress.i / syncProgress.n) * 100)}%` : "..."} • {syncSecs}s
              </span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-black/40" : "bg-slate-100"}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                style={{
                  width: syncProgress.n > 0 ? `${(syncProgress.i / syncProgress.n) * 100}%` : "8%",
                }}
              />
            </div>
            <p className={`text-[11px] truncate font-mono ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {syncProgress.file
                ? `${syncProgress.st === "up" ? "Đang tải: " : "Bỏ qua (đã có): "}${syncProgress.file}`
                : "Đang chuẩn bị..."}
            </p>
          </div>
        )}

        {/* Sync Completed Notice */}
        {syncResult && !syncing && (
          <div
            className={`rounded-2xl backdrop-blur-xl border p-4 space-y-2 ${
              syncResult.ok
                ? isDark
                  ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-200"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : isDark
                  ? "bg-rose-500/10 border-rose-400/30 text-rose-200"
                  : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {syncResult.ok ? (
                <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <WarningIcon className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold">
                  {syncResult.ok ? "Đồng bộ R2 hoàn tất" : "Đồng bộ R2 thất bại"}
                </h3>
                {syncResult.ok ? (
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Đã tải lên <strong className="text-emerald-500 font-mono">{syncResult.uploaded}</strong> file mới ({syncResult.mb} MB), bỏ qua {syncResult.skipped} file đã tồn tại trên R2.
                  </p>
                ) : (
                  <p className="text-xs text-rose-500 mt-1">{syncResult.error}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSyncResult(null)}
                className={`text-xs ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* Global Notice */}
        {notice && (
          <div className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs ${isDark ? "bg-white/[0.04] border-white/10 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-xs"}`}>
            <WarningIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line leading-relaxed">{notice}</span>
          </div>
        )}

        {/* Scenes Grid */}
        {loading ? (
          <div className={`py-16 text-center text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Đang tải dữ liệu bối cảnh...
          </div>
        ) : visible.length === 0 ? (
          <div className={`py-16 text-center text-xs rounded-2xl border ${isDark ? "bg-slate-900/40 border-white/[0.08] text-slate-400" : "bg-white border-slate-200 text-slate-500"}`}>
            Không tìm thấy bối cảnh nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((s) => {
              const missing = !s.mediaExists || !s.thumbExists;
              const confirming = confirmId === s.id;
              const deleting = deletingId === s.id;

              return (
                <div
                  key={s.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col justify-between group transition-all ${
                    isDark
                      ? "bg-slate-900/60 backdrop-blur-xl border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-white/20"
                      : "bg-white border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  {/* Thumbnail / Video 16:9 widescreen frame */}
                  <div className={`relative aspect-video w-full overflow-hidden ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                    {s.thumbExists ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl(s)}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-400">
                        <ImageBrokenIcon className="w-7 h-7 text-slate-400" />
                        <span className="text-[11px] font-semibold">Thiếu file ảnh nền</span>
                      </div>
                    )}

                    {/* Media Type Pill */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-bold text-slate-200 border border-white/15 flex items-center gap-1">
                        {s.type === "VIDEO" && <FilmStripIcon className="w-3 h-3 text-sky-400" />}
                        {s.type}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/20 capitalize">
                        {s.category}
                      </span>
                    </div>

                    {/* Missing file warning badge */}
                    {missing && (
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2 py-1 rounded-lg bg-amber-500/90 text-black text-[10px] font-bold flex items-center gap-1 shadow-md">
                        <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          Thiếu file {!s.mediaExists && "chính"} {!s.mediaExists && !s.thumbExists && "+"} {!s.thumbExists && "thumb"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Scene Card Body */}
                  <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Tên cảnh"
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-bold focus:outline-none ${
                            isDark
                              ? "bg-black/40 border-white/15 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
                              : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-emerald-600"
                          }`}
                        />
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-xs focus:outline-none capitalize ${
                            isDark
                              ? "bg-black/40 border-white/15 text-white focus:border-emerald-500/50"
                              : "bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-600"
                          }`}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c} className={isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(s.id)}
                            disabled={savingEdit}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              isDark
                                ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/30 text-emerald-200"
                                : "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                            }`}
                          >
                            {savingEdit ? "Đang lưu..." : "Lưu"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                              isDark
                                ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300"
                                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                            }`}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`} title={s.name}>
                            {s.name}
                          </h3>
                          <p className={`text-[11px] font-mono truncate mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`} title={s.mediaPath}>
                            {s.mediaPath}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className={`flex items-center gap-2 pt-1 border-t ${isDark ? "border-white/[0.06]" : "border-slate-100"}`}>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                              isDark
                                ? "text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border-white/10"
                                : "text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-200 shadow-2xs"
                            }`}
                          >
                            <PencilSimpleIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePress(s)}
                            disabled={deleting}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              confirming
                                ? isDark
                                  ? "bg-rose-500/20 text-rose-200 border-rose-500/40"
                                  : "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                                : isDark
                                  ? "text-slate-400 hover:text-rose-300 bg-white/[0.03] hover:bg-rose-500/10 border-white/10"
                                  : "text-slate-600 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border-slate-200"
                            }`}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                            <span>
                              {deleting ? "Đang xóa..." : confirming ? "Xác nhận xóa" : "Xóa"}
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
