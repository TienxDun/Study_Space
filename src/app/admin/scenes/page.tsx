"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Scene, STUDY_CDN_URL, STUDY_SCENES } from "@/components/study/study-types";
import { STORAGE_KEYS } from "@/lib/storage-keys";

// Trang staging quản lý background (chạy local, chưa cần BE).
// Quy trình: copy file vào public/study/scenes|thumbnails → tạo/sửa/xóa ở đây
// (lưu nháp localStorage) → Export lấy code STUDY_SCENES + checklist upload Releases.

const LS_CUSTOM = STORAGE_KEYS.adminCustomScenes;
const LS_EDITED = STORAGE_KEYS.adminEditedScenes;
const LS_DELETED = STORAGE_KEYS.adminDeletedScenes;

interface SceneDraft {
  id: string;
  name: string;
  category: string;
  type: "VIDEO" | "IMAGE";
  bgFolder: string;
  bgFile: string;
  thumbFolder: string;
  thumbFile: string;
}

const toDraft = (s: Scene): SceneDraft => {
  const bg = s.bgUrl.match(/\/(scenes|thumbnails)\/(.+)$/);
  const th = s.thumbnailUrl.match(/\/(scenes|thumbnails)\/(.+)$/);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    type: s.type,
    bgFolder: bg?.[1] ?? "scenes",
    bgFile: bg?.[2] ?? "",
    thumbFolder: th?.[1] ?? "scenes",
    thumbFile: th?.[2] ?? "",
  };
};

const toScene = (d: SceneDraft): Scene => ({
  id: d.id,
  name: d.name,
  category: d.category,
  type: d.type,
  bgUrl: `${STUDY_CDN_URL}/${d.bgFolder}/${d.bgFile}`,
  thumbnailUrl: `${STUDY_CDN_URL}/${d.thumbFolder}/${d.thumbFile}`,
});

// URL preview local (dev): thay ${STUDY_CDN_URL} bằng giá trị runtime.
const previewUrl = (s: Scene, field: "bgUrl" | "thumbnailUrl") => s[field];

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key: string, val: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

const emptyDraft = (): SceneDraft => ({
  id: `scene-custom-${Date.now()}`,
  name: "",
  category: "chill",
  type: "VIDEO",
  bgFolder: "scenes",
  bgFile: "",
  thumbFolder: "thumbnails",
  thumbFile: "",
});

export default function AdminScenesPage() {
  const [customs, setCustoms] = useState<SceneDraft[]>([]);
  const [edited, setEdited] = useState<Record<string, SceneDraft>>({});
  const [deleted, setDeleted] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "VIDEO" | "IMAGE">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SceneDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    setCustoms(load<SceneDraft[]>(LS_CUSTOM, []));
    setEdited(load<Record<string, SceneDraft>>(LS_EDITED, {}));
    setDeleted(load<string[]>(LS_DELETED, []));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(LS_CUSTOM, customs);
  }, [customs, ready]);
  useEffect(() => {
    if (ready) save(LS_EDITED, edited);
  }, [edited, ready]);
  useEffect(() => {
    if (ready) save(LS_DELETED, deleted);
  }, [deleted, ready]);

  const scenes: Scene[] = useMemo(() => {
    const seeds = STUDY_SCENES.filter((s) => !deleted.includes(s.id)).map((s) =>
      edited[s.id] ? toScene(edited[s.id]) : s
    );
    return [...seeds, ...customs.map(toScene)];
  }, [customs, edited, deleted]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scenes.filter((s) => {
      if (filter !== "all" && s.type !== filter) return false;
      return (
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [scenes, query, filter]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  const guessType = (file: string): "VIDEO" | "IMAGE" =>
    file.toLowerCase().endsWith(".mp4") ? "VIDEO" : "IMAGE";

  const openAdd = () => {
    setForm(emptyDraft());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (s: Scene) => {
    const base = toDraft(s);
    setForm(edited[s.id] ?? base);
    setEditingId(s.id);
    setShowForm(true);
  };

  const submitForm = () => {
    if (!form.name.trim()) return flash("Thiếu tên background.");
    if (!form.bgFile.trim()) return flash("Thiếu tên file background.");
    const thumbFile = form.thumbFile.trim() || form.bgFile.trim();
    const thumbFolder =
      form.thumbFile.trim() === ""
        ? form.bgFolder
        : form.thumbFolder;
    const draft: SceneDraft = {
      ...form,
      name: form.name.trim(),
      bgFile: form.bgFile.trim(),
      thumbFile,
      thumbFolder,
      type: guessType(form.bgFile),
    };
    if (editingId && !editingId.startsWith("scene-custom-")) {
      setEdited((p) => ({ ...p, [editingId]: draft }));
    } else if (editingId) {
      setCustoms((p) => p.map((c) => (c.id === editingId ? draft : c)));
    } else {
      setCustoms((p) => [...p, draft]);
    }
    setShowForm(false);
    flash(editingId ? "Đã lưu sửa đổi (nháp)." : "Đã thêm background (nháp).");
  };

  const removeScene = (id: string) => {
    if (!confirm("Xóa background này khỏi danh sách xuất?")) return;
    if (id.startsWith("scene-custom-")) {
      setCustoms((p) => p.filter((c) => c.id !== id));
    } else {
      setDeleted((p) => [...p, id]);
      setEdited((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
    flash("Đã xóa (nháp).");
  };

  const restoreSeed = (id: string) => {
    setDeleted((p) => p.filter((x) => x !== id));
    setEdited((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const buildExport = () => {
    const lines = scenes.map((s) => {
      const d = toDraft(s);
      return `  {
    "id": "${d.id}",
    "name": "${d.name.replace(/"/g, '\\"')}",
    "category": "${d.category}",
    "type": "${d.type}",
    "bgUrl": \`\${STUDY_CDN_URL}/${d.bgFolder}/${d.bgFile}\`,
    "thumbnailUrl": \`\${STUDY_CDN_URL}/${d.thumbFolder}/${d.thumbFile}\`
  }`;
    });
    const ts = `export const STUDY_SCENES: Scene[] = [\n${lines.join(",\n")}\n];`;
    const newFiles = customs.flatMap((c) => [
      `${c.bgFolder}/${c.bgFile}`,
      `${c.thumbFolder}/${c.thumbFile}`,
    ]);
    const checklist = [
      `// Tổng scene xuất: ${scenes.length} (gốc ${STUDY_SCENES.length}, thêm ${customs.length}, xóa ${deleted.length})`,
      ...Array.from(new Set(newFiles)).map(
        (f) => `// UPLOAD Releases: public/study/${f}`
      ),
      ...(newFiles.length > 0
        ? [
            `// Lệnh mẫu: gh release upload v1.0.0-assets ${Array.from(
              new Set(newFiles)
            )
              .map((f) => `public/study/${f}`)
              .join(" ")}`,
          ]
        : []),
      ts,
    ].join("\n");
    setExportText(checklist);
    flash("Đã tạo bản xuất — copy/ốp vào study-types.ts.");
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      flash("Đã copy bản xuất.");
    } catch {
      flash("Copy thất bại — bôi đen tay trong ô export.");
    }
  };

  const downloadExport = () => {
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "study-scenes-export.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const resetAll = () => {
    if (!confirm("Xóa toàn bộ nháp admin (thêm/sửa/xóa)?")) return;
    setCustoms([]);
    setEdited({});
    setDeleted([]);
    setExportText("");
    flash("Đã reset về danh sách gốc.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold">Quản lý Background (staging)</h1>
            <p className="text-xs text-slate-400">
              {scenes.length} scene (gốc {STUDY_SCENES.length} + thêm{" "}
              {customs.length} − xóa {deleted.length}) · Nháp lưu localStorage ·
              Âm thanh chưa quản lý ở đây
            </p>
          </div>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15"
          >
            ← Về StudySpace
          </Link>
        </div>

        {notice && (
          <div className="text-xs px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200">
            {notice}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên / category / id..."
            className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-400/50"
          />
          {(["all", "VIDEO", "IMAGE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs border cursor-pointer ${
                filter === t
                  ? "bg-emerald-600 border-emerald-400"
                  : "bg-white/5 border-white/10 text-slate-300"
              }`}
            >
              {t === "all" ? `Tất cả (${scenes.length})` : t}
            </button>
          ))}
          <button
            onClick={openAdd}
            className="px-3 py-1.5 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 font-bold cursor-pointer"
          >
            + Thêm background
          </button>
          <button
            onClick={buildExport}
            className="px-3 py-1.5 rounded-xl text-xs bg-sky-600 hover:bg-sky-500 font-bold cursor-pointer"
          >
            Export TS + checklist
          </button>
          <button
            onClick={resetAll}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
          >
            Reset nháp
          </button>
        </div>

        {showForm && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/15 space-y-3">
            <h2 className="text-sm font-bold">
              {editingId ? "Sửa background" : "Thêm background mới"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-400">Tên hiển thị *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400/50"
                  placeholder="VD: Mưa đêm Tokyo"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Category</span>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400/50"
                  placeholder="chill / anime / nature / urban / cute / dark..."
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">
                  File background * (đã copy vào public/study/scenes/)
                </span>
                <input
                  value={form.bgFile}
                  onChange={(e) => setForm({ ...form, bgFile: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-emerald-400/50"
                  placeholder="tokyo-rain-night.mp4 hoặc .avif"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">
                  File thumbnail (để trống = dùng file background)
                </span>
                <input
                  value={form.thumbFile}
                  onChange={(e) => setForm({ ...form, thumbFile: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-emerald-400/50"
                  placeholder="tokyo-rain-night.webp (trong public/study/thumbnails/)"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Type tự đoán theo đuôi file (.mp4 → VIDEO, còn lại → IMAGE).
              Nhớ copy file thật vào public/study trước khi Export.
            </p>
            <div className="flex gap-2">
              <button
                onClick={submitForm}
                className="px-4 py-1.5 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 font-bold cursor-pointer"
              >
                Lưu nháp
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((s) => {
            const isCustom = s.id.startsWith("scene-custom-");
            const isEdited = !!edited[s.id];
            return (
              <div
                key={s.id}
                className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900/70"
              >
                <div className="relative aspect-[16/10] bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl(s, "thumbnailUrl")}
                    alt={s.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0.25";
                    }}
                  />
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-lg bg-black/70 border border-white/20">
                    {s.type}
                  </span>
                  {(isCustom || isEdited) && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-500/80 text-black">
                      NHÁP
                    </span>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-bold truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {s.category} · {toDraft(s).bgFile || "(thiếu file)"}
                  </p>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={() => openEdit(s)}
                      className="flex-1 text-[11px] py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 cursor-pointer"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => removeScene(s.id)}
                      className="flex-1 text-[11px] py-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-300 border border-red-500/30 cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {visible.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-10">
            Không có scene nào khớp tìm kiếm.
          </p>
        )}

        {deleted.length > 0 && (
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-1">
            <p className="font-bold text-slate-300">
              Đã xóa khỏi bản xuất ({deleted.length}):
            </p>
            {deleted.map((id) => (
              <div key={id} className="flex items-center justify-between">
                <span className="font-mono text-slate-400">{id}</span>
                <button
                  onClick={() => restoreSeed(id)}
                  className="text-emerald-300 hover:underline cursor-pointer"
                >
                  Khôi phục
                </button>
              </div>
            ))}
          </div>
        )}

        {exportText && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-sky-400/30 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Bản xuất</h2>
              <div className="flex gap-2">
                <button
                  onClick={copyExport}
                  className="px-3 py-1 rounded-lg text-xs bg-sky-600 hover:bg-sky-500 font-bold cursor-pointer"
                >
                  Copy
                </button>
                <button
                  onClick={downloadExport}
                  className="px-3 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 border border-white/15 cursor-pointer"
                >
                  Tải .txt
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={exportText}
              rows={14}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-[11px] text-slate-200 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              Ốp đoạn TS vào <span className="font-mono">study-types.ts</span>{" "}
              (thay mảng STUDY_SCENES), upload các file trong checklist lên
              Releases rồi push deploy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
