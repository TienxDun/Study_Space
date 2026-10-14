"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ImageAttachment {
  id: string;
  name: string;
  size: number;
  kind: "image" | "text";
  dataUrl?: string;
  text?: string;
  thumb?: string;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const TEXT_EXTS = [
  "txt", "md", "markdown", "csv", "json",
  "py", "js", "jsx", "ts", "tsx", "java", "html", "css",
  "c", "h", "cpp", "go", "rs", "sql", "xml", "yml", "yaml", "log",
];
const MAX_COUNT = 3;
const MAX_IMAGE_SIZE = 7 * 1024 * 1024; // 7MB một ảnh
const MAX_TEXT_SIZE = 1024 * 1024; // 1MB một file chữ

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

// Thu nhỏ ảnh để lưu lịch sử (độ phân giải 600px sắc nét cho tài liệu/câu hỏi mà vẫn nhẹ).
// Ảnh gốc gửi cho model, không lưu vào kho.
function makeThumb(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const max = 600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("");
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      } catch {
        resolve("");
      }
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

// Giữ file đính kèm: ảnh + file chữ, chọn, dán, xem trước, xóa.
// Ảnh đọc thành chữ dài (dataURL), file chữ đọc thành chữ thường ngay khi
// chọn để lúc gửi chỉ việc gửi đi.
export function useImageAttachments(onError: (msg: string) => void) {
  const [items, setItems] = useState<ImageAttachment[]>([]);
  const seqRef = useRef(0);
  const errRef = useRef(onError);
  useEffect(() => {
    errRef.current = onError;
  }, [onError]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const all = Array.from(files);
    const known = all.filter(
      (f) => IMAGE_TYPES.includes(f.type) || TEXT_EXTS.includes(extOf(f.name))
    );
    if (known.length < all.length) {
      errRef.current("Chỉ nhận ảnh png, jpg, webp và file chữ txt, md, csv, json, mã nguồn nhé.");
    }
    if (known.length === 0) return;
    setItems((prev) => {
      const room = MAX_COUNT - prev.length;
      if (room <= 0) {
        errRef.current(`Tối đa ${MAX_COUNT} file một câu nhé.`);
        return prev;
      }
      const picked = known.slice(0, room);
      if (known.length > room) {
        errRef.current(`Tối đa ${MAX_COUNT} file một câu, đã lấy ${room} file đầu.`);
      }
      for (const f of picked) {
        const isImage = IMAGE_TYPES.includes(f.type);
        const limit = isImage ? MAX_IMAGE_SIZE : MAX_TEXT_SIZE;
        if (f.size > limit) {
          errRef.current(
            isImage
              ? `Ảnh ${f.name} quá 7MB, bỏ qua nhé.`
              : `File ${f.name} quá 1MB, copy nội dung dán vào ô chat nhé.`
          );
          continue;
        }
        seqRef.current += 1;
        const id = `file-${Date.now()}-${seqRef.current}`;
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || "");
          if (!raw) return;
          if (!isImage) {
            setItems((cur) => {
              if (cur.some((x) => x.id === id)) return cur;
              return [...cur, { id, name: f.name, size: f.size, kind: "text" as const, text: raw }];
            });
            return;
          }
          // Ảnh: thu nhỏ 1 bản để lưu lịch sử, bản gốc để gửi model.
          void makeThumb(raw).then((thumb) => {
            setItems((cur) => {
              if (cur.some((x) => x.id === id)) return cur;
              return [...cur, { id, name: f.name, size: f.size, kind: "image" as const, dataUrl: raw, thumb: thumb || undefined }];
            });
          });
        };
        if (isImage) reader.readAsDataURL(f);
        else reader.readAsText(f);
      }
      return prev;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, addFiles, remove, clear, maxCount: MAX_COUNT };
}
