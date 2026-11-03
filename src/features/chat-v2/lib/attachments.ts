import type {
  ChatV2AttachmentMeta,
  ChatV2FilePayload,
  ChatV2ImagePayload,
} from "../types";

export interface ChatV2Attachment {
  id: string;
  name: string;
  size: number;
  kind: "image" | "text";
  dataUrl?: string;
  text?: string;
  thumb?: string;
}

export const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_BYTES = 1024 * 1024;
const MAX_TEXT_CHARS = 20000;
const IMAGE_MAX_DIM = 1280;
// Ảnh xem lại sau khi gửi dùng chính bản này (localStorage chỉ giữ bản xem trước).
const PREVIEW_MAX_DIM = 800;
const PREVIEW_MAX_CHARS = 140000;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const TEXT_EXTS = [
  "txt", "md", "markdown", "csv", "json",
  "py", "js", "jsx", "ts", "tsx", "java", "html", "css",
  "c", "h", "cpp", "go", "rs", "sql", "xml", "yml", "yaml", "log",
];

let seq = 0;
function nextId(): string {
  seq += 1;
  return `att-${Date.now()}-${seq}`;
}

function extOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không giải mã được ảnh."));
    image.src = src;
  });
}

function resizeToDataUrl(image: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Bản xem trước lưu máy: đủ nét để mở lại, có hạ cấp khi ảnh quá nặng. */
function buildPreview(image: HTMLImageElement): string {
  let dataUrl = resizeToDataUrl(image, PREVIEW_MAX_DIM, 0.72);
  if (dataUrl.length <= PREVIEW_MAX_CHARS) return dataUrl;
  dataUrl = resizeToDataUrl(image, 640, 0.68);
  if (dataUrl.length <= PREVIEW_MAX_CHARS) return dataUrl;
  return resizeToDataUrl(image, 480, 0.65);
}

export async function prepareAttachments(
  files: FileList | File[],
  maxCount = MAX_ATTACHMENTS
): Promise<{ items: ChatV2Attachment[]; errors: string[] }> {
  const all = Array.from(files);
  const items: ChatV2Attachment[] = [];
  const errors: string[] = [];
  const room = Math.max(0, maxCount);
  if (room === 0) {
    return { items, errors: [`Tối đa ${MAX_ATTACHMENTS} file một câu.`] };
  }

  for (const file of all.slice(0, room)) {
    const isImage = IMAGE_TYPES.includes(file.type);
    const isText = TEXT_EXTS.includes(extOf(file.name));
    if (!isImage && !isText) {
      errors.push(`${file.name}: chỉ nhận ảnh png/jpeg/webp hoặc file chữ.`);
      continue;
    }
    if (isImage) {
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`${file.name}: ảnh quá 5MB.`);
        continue;
      }
      try {
        const raw = await readDataUrl(file);
        const image = await loadImage(raw);
        const dataUrl = resizeToDataUrl(image, IMAGE_MAX_DIM, 0.82);
        const thumb = buildPreview(image);
        items.push({ id: nextId(), name: file.name, size: file.size, kind: "image", dataUrl, thumb });
      } catch (cause) {
        errors.push(`${file.name}: ${cause instanceof Error ? cause.message : "không xử lý được ảnh."}`);
      }
      continue;
    }
    if (file.size > MAX_TEXT_BYTES) {
      errors.push(`${file.name}: file quá 1MB.`);
      continue;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        errors.push(`${file.name}: file rỗng.`);
        continue;
      }
      if (text.length > MAX_TEXT_CHARS) {
        errors.push(`${file.name}: nội dung quá ${MAX_TEXT_CHARS} ký tự.`);
        continue;
      }
      items.push({ id: nextId(), name: file.name, size: file.size, kind: "text", text });
    } catch {
      errors.push(`${file.name}: không đọc được file.`);
    }
  }

  if (all.length > room) errors.push(`Chỉ lấy ${room} file đầu, tối đa ${MAX_ATTACHMENTS} file.`);
  return { items, errors };
}

export function toAttachmentMeta(item: ChatV2Attachment): ChatV2AttachmentMeta {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    ...(item.thumb ? { thumb: item.thumb } : {}),
  };
}

export function toAttachmentPayloads(items: ChatV2Attachment[]): {
  images: ChatV2ImagePayload[];
  files: ChatV2FilePayload[];
} {
  return {
    images: items
      .filter((item) => item.kind === "image" && item.dataUrl)
      .map((item) => ({ name: item.name, data: item.dataUrl as string })),
    files: items
      .filter((item) => item.kind === "text" && item.text)
      .map((item) => ({ name: item.name, text: item.text as string })),
  };
}
