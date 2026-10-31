#!/usr/bin/env node
/**
 * Tạo bản 720p cho video cảnh để điện thoại tải nhẹ hơn (bản gốc giữ nguyên).
 * App tự chọn bản nhẹ theo màn hình và tự lùi về bản gốc nếu file nhẹ chưa có.
 *
 * Cách dùng: npm run encode:mobile
 * Cần ffmpeg trong PATH, hoặc đặt FFMPEG_PATH trỏ tới ffmpeg.exe.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const MOBILE_SUFFIX = ".1280x720.mp4";

const scenes = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/assets/scenes.json"), "utf8")
);

const videos = scenes.filter(
  (scene) =>
    scene.type === "VIDEO" &&
    typeof scene.mediaPath === "string" &&
    /\.mp4$/i.test(scene.mediaPath)
);

let created = 0;
let skipped = 0;
let failed = 0;
let savedBytes = 0;

for (const scene of videos) {
  const input = path.join(root, "public/study", scene.mediaPath);
  if (!fs.existsSync(input)) {
    console.warn(`bỏ qua (không có file gốc): ${scene.mediaPath}`);
    continue;
  }

  const output = input.replace(/\.mp4$/i, MOBILE_SUFFIX);
  if (fs.existsSync(output)) {
    skipped++;
    continue;
  }

  const before = fs.statSync(input).size;
  process.stdout.write(`đang nén ${path.basename(output)} ... `);
  try {
    execFileSync(
      ffmpeg,
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        input,
        "-vf",
        "scale=-2:720",
        "-c:v",
        "libx264",
        "-crf",
        "26",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-movflags",
        "+faststart",
        output,
      ],
      { stdio: ["ignore", "ignore", "inherit"] }
    );
    const after = fs.statSync(output).size;
    savedBytes += before - after;
    created++;
    console.log(`${(after / 1048576).toFixed(1)} MB (gốc ${(before / 1048576).toFixed(1)} MB)`);
  } catch {
    failed++;
    console.log("lỗi");
    fs.rmSync(output, { force: true });
  }
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
console.log(`\nXong: tạo ${created}, bỏ qua ${skipped}, lỗi ${failed}. Giảm được ${mb(savedBytes)}.`);
if (failed) process.exitCode = 1;
