// Nén ảnh góp ý ngay trên máy: 1 ảnh, cạnh dài ≤1600px, JPEG ≤1 MB.
// Worker (workers/data-api/worker.js) kiểm lại kích thước và magic bytes nên
// không tin được phía client.

export const FEEDBACK_IMAGE_MAX_BYTES = 1024 * 1024;
const SOURCE_MAX_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 1600;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface PreparedFeedbackImage {
  blob: Blob;
  previewUrl: string;
  name: string;
}

export type PrepareImageResult =
  | { ok: true; image: PreparedFeedbackImage }
  | { ok: false; notice: string };

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decodeImage(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Trình duyệt cũ/ảnh lạ: thử đường Image bên dưới.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode"));
      element.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
}

async function renderJpeg(
  decoded: DecodedImage,
  edge: number,
  quality: number,
): Promise<Blob | null> {
  const scale = Math.min(1, edge / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // PNG trong suốt đổi sang JPEG sẽ thành nền đen nếu không tô trắng trước.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(decoded.source, 0, 0, width, height);
  return canvasToBlob(canvas, quality);
}

export async function prepareFeedbackImage(file: File): Promise<PrepareImageResult> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { ok: false, notice: "Chỉ nhận ảnh JPG, PNG hoặc WebP." };
  }
  if (file.size > SOURCE_MAX_BYTES) {
    return { ok: false, notice: "Ảnh gốc quá 20 MB, bạn chọn ảnh nhỏ hơn nhé." };
  }

  const decoded = await decodeImage(file);
  if (!decoded) {
    return { ok: false, notice: "Không đọc được ảnh này, bạn thử ảnh khác nhé." };
  }

  try {
    // Hạ dần chất lượng rồi thu nhỏ để luôn ra dưới 1 MB.
    const attempts = [
      { edge: MAX_EDGE, quality: 0.85 },
      { edge: MAX_EDGE, quality: 0.7 },
      { edge: 1200, quality: 0.7 },
      { edge: 900, quality: 0.7 },
    ];
    for (const attempt of attempts) {
      const blob = await renderJpeg(decoded, attempt.edge, attempt.quality);
      if (blob && blob.size > 0 && blob.size <= FEEDBACK_IMAGE_MAX_BYTES) {
        return {
          ok: true,
          image: { blob, previewUrl: URL.createObjectURL(blob), name: file.name },
        };
      }
    }
    return { ok: false, notice: "Ảnh vẫn quá 1 MB sau khi nén, bạn chọn ảnh khác nhé." };
  } finally {
    decoded.close();
  }
}
