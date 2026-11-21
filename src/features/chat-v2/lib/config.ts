export const CHAT_V2_URL = (
  process.env.NEXT_PUBLIC_CHAT_V2_URL || "http://localhost:8788"
).replace(/\/$/, "");

export const CHAT_V2_DEV_TOKEN =
  process.env.NEXT_PUBLIC_CHAT_V2_DEV_TOKEN || "chat-v2-dev-local";

export const CHAT_V2_DEFAULT_MODEL = "deepseek-v4-flash";

// Regex nhận diện các model phi hội thoại (tạo ảnh, tạo video, tts, whisper, embed)
export const NON_CHAT_MODEL_RE = /(image|video|tts|whisper|transcribe|embed|moderation)/i;

// Danh sách model, giá và năng lực do Worker chat v2 trả về từ danh mục đã xác minh
// (workers/chat-v2/model-catalog.json, sinh bởi `npm run refresh:models`).
