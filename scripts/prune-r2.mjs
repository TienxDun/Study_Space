import fs from "fs/promises";
import path from "path";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

// Doc file .env.local neu co (giong sync-r2.mjs)
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

const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "study-space";

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("Thieu R2_ACCESS_KEY_ID hoac R2_SECRET_ACCESS_KEY trong .env.local");
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

const SHOULD_DELETE = process.argv.includes("--delete");

async function listAllR2Keys() {
  const keys = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const obj of res.Contents || []) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function walkDir(dir, base) {
  let files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(await walkDir(fullPath, base));
    } else if (item.isFile()) {
      files.push(path.relative(base, fullPath).replace(/\\/g, "/"));
    }
  }
  return files;
}

function collectReferencedKeys(scenes, tracks, sounds) {
  const refs = new Set();
  const add = (p) => {
    if (!p || typeof p !== "string") return;
    if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:"))
      return;
    refs.add(p.replace(/^\//, ""));
  };
  for (const s of scenes || []) {
    add(s.mediaPath);
    add(s.thumbnailPath);
  }
  // tracks.json co dang { lofi: [...], jazz: [...], relax: [...] }
  const trackLists = Array.isArray(tracks) ? [tracks] : Object.values(tracks || {});
  for (const list of trackLists) {
    for (const t of list || []) {
      add(t.audioPath);
      add(t.coverPath);
    }
  }
  const soundLists = Array.isArray(sounds) ? [sounds] : Object.values(sounds || {});
  for (const list of soundLists) {
    for (const s of list || []) {
      add(s.audioPath);
    }
  }
  // sounds.json cua ban la array 20 item
  if (Array.isArray(sounds)) {
    for (const s of sounds) add(s.audioPath);
  }
  return refs;
}

async function main() {
  console.log("Dang doc danh sach R2...");
  const r2Keys = await listAllR2Keys();
  console.log(`R2 dang co: ${r2Keys.length} file`);

  const localBase = path.join(process.cwd(), "public/study");
  const localKeys = await walkDir(localBase, localBase);
  console.log(`May ban dang co: ${localKeys.length} file`);
  const localSet = new Set(localKeys);

  const scenes = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "src/data/assets/scenes.json"), "utf-8")
  );
  const tracks = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "src/data/assets/tracks.json"), "utf-8")
  );
  const sounds = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "src/data/assets/sounds.json"), "utf-8")
  );
  const refs = collectReferencedKeys(scenes, tracks, sounds);

  // File thua tren R2 = co tren R2 nhung khong con o may + khong con JSON nao nhac toi
  const orphans = r2Keys.filter((k) => !localSet.has(k) && !refs.has(k));
  // File loi = JSON con nhac toi nhung ca may + R2 deu khong co
  const r2Set = new Set(r2Keys);
  const broken = [...refs].filter((k) => !localSet.has(k) && !r2Set.has(k));
  // File thieu tren R2 = co o may nhung chua co tren R2
  const missing = localKeys.filter((k) => !r2Set.has(k));

  console.log("\n=== FILE THUA TREN R2 (xoa o admin roi, R2 van giu) ===");
  if (orphans.length === 0) console.log("Khong co. R2 sach.");
  else orphans.forEach((k) => console.log(" - " + k));

  console.log("\n=== JSON NHAC TOI FILE KHONG CON O DAU (can sua JSON) ===");
  if (broken.length === 0) console.log("Khong co.");
  else broken.forEach((k) => console.log(" - " + k));

  console.log("\n=== CO O MAY NHUNG CHUA CO TREN R2 (chay sync-r2 de up) ===");
  if (missing.length === 0) console.log("Khong co.");
  else missing.slice(0, 50).forEach((k) => console.log(" - " + k));
  if (missing.length > 50) console.log(`... va ${missing.length - 50} file nua`);

  if (!SHOULD_DELETE) {
    console.log("\nChe do xem truoc (chua xoa gi).");
    if (orphans.length > 0) {
      console.log("De xoa cac file thua tren, chay lai voi co --delete:");
      console.log("  node scripts/prune-r2.mjs --delete");
    }
    return;
  }

  if (orphans.length === 0) {
    console.log("\nKhong co gi de xoa.");
    return;
  }

  console.log(`\nDang xoa ${orphans.length} file thua tren R2...`);
  // Xoa theo lo 500 key/lan
  for (let i = 0; i < orphans.length; i += 500) {
    const batch = orphans.slice(i, i + 500);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
    console.log(`  Da xoa ${Math.min(i + 500, orphans.length)}/${orphans.length}`);
  }
  console.log("Xong. Nho purge cache neu ban dung CDN cache truoc Worker.");
}

main().catch((err) => {
  console.error("Loi:", err.message || err);
  process.exit(1);
});
