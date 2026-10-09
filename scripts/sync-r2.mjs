import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// Đọc file .env.local nếu có
async function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = await fs.readFile(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        const val = rest.join("=").replace(/^["']|["']$/g, "").trim();
        process.env[key.trim()] = val;
      }
    }
  } catch {}
}

await loadEnv();

const R2_ENDPOINT = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "study-space";

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("❌ Lỗi: Thiếu thông tin R2_ACCESS_KEY_ID hoặc R2_SECRET_ACCESS_KEY trong .env.local");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".webp": return "image/webp";
    case ".avif": return "image/avif";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".svg": return "image/svg+xml";
    case ".mp3": return "audio/mpeg";
    default: return "application/octet-stream";
  }
}

async function isObjectOnR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    // Lỗi khác coi như chưa có
    return false;
  }
}

async function uploadFileToR2(localPath, key) {
  const fileBuffer = await fs.readFile(localPath);
  const mimeType = getMimeType(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return fileBuffer.length;
}

async function main() {
  console.log("🚀 Bắt đầu quá trình đồng bộ asset lên Cloudflare R2...");
  console.log(`📦 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`🌐 Endpoint: ${R2_ENDPOINT}\n`);

  const scenesPath = path.join(process.cwd(), "src/data/assets/scenes.json");
  const scenesRaw = await fs.readFile(scenesPath, "utf-8");
  const scenes = JSON.parse(scenesRaw);

  const localBase = path.join(process.cwd(), "public/study");

  // Thu thập danh sách file duy nhất từ scenes.json
  const fileKeysSet = new Set();
  for (const scene of scenes) {
    if (scene.mediaPath && !scene.mediaPath.startsWith("http")) {
      fileKeysSet.add(scene.mediaPath.replace(/^\/+/, ""));
    }
    if (scene.thumbnailPath && !scene.thumbnailPath.startsWith("http")) {
      fileKeysSet.add(scene.thumbnailPath.replace(/^\/+/, ""));
    }
  }

  const allKeys = Array.from(fileKeysSet);
  console.log(`🔍 Tìm thấy ${allKeys.length} file asset cần đồng bộ từ ${scenes.length} background đã lọc.\n`);

  let uploadedCount = 0;
  let skippedCount = 0;
  let missingLocalCount = 0;
  let totalBytesUploaded = 0;

  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    const localFilePath = path.join(localBase, key);
    const progress = `[${i + 1}/${allKeys.length}]`;

    // Kiểm tra file local
    let fileExists = false;
    let fileStat = null;
    try {
      fileStat = await fs.stat(localFilePath);
      fileExists = true;
    } catch {
      fileExists = false;
    }

    if (!fileExists) {
      console.log(`⚠️  ${progress} Bỏ qua (không tìm thấy file local): ${key}`);
      missingLocalCount++;
      continue;
    }

    const sizeMb = (fileStat.size / (1024 * 1024)).toFixed(2);

    // Kiểm tra đã có trên R2 chưa
    const alreadyExists = await isObjectOnR2(key);
    if (alreadyExists) {
      console.log(`⏭️  ${progress} Đã có trên R2 (Bỏ qua): ${key} (${sizeMb} MB)`);
      skippedCount++;
      continue;
    }

    // Tải lên
    process.stdout.write(`⬆️  ${progress} Đang upload: ${key} (${sizeMb} MB)... `);
    try {
      const bytes = await uploadFileToR2(localFilePath, key);
      totalBytesUploaded += bytes;
      uploadedCount++;
      console.log("✅ Xong!");
    } catch (err) {
      console.log(`❌ Lỗi: ${err.message}`);
    }
  }

  console.log("\n==================================================");
  console.log("🎉 KẾT QUẢ ĐỒNG BỘ CLOUDFLARE R2:");
  console.log(`- Đã tải lên mới: ${uploadedCount} file (${(totalBytesUploaded / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`- Bỏ qua (đã có sẵn): ${skippedCount} file`);
  if (missingLocalCount > 0) {
    console.log(`- File không tìm thấy ở local: ${missingLocalCount} file`);
  }
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Lỗi thực thi:", err);
  process.exit(1);
});
