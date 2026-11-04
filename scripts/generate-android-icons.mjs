/**
 * Sinh bộ icon launcher Android từ nghệ thuật squircle chuẩn (public/icon-512.png).
 * - Foreground (108dp): nghệ thuật squircle thu nhỏ còn 86% canvas, đặt giữa — viền vàng
 *   nằm trong vùng an toàn của mọi dạng mask (tròn/squircle) launcher.
 * - Background: màu tối lấy mẫu từ chính nghệ thuật icon (không còn nền trắng).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const resDir = path.resolve('android/app/src/main/res');
const artPath = path.resolve('public/icon-512.png');

// Kích thước lớp adaptive-icon theo dp (viewport 108dp)
const FOREGROUND_DP = 108;
const DENSITIES = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Lấy mẫu màu tối nền từ dải trong bên trái của squircle (tránh cốc, viền, flare)
async function sampleDarkColor() {
  const img = sharp(artPath);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(info.height * 0.35); y < info.height * 0.65; y++) {
    for (let x = Math.floor(info.width * 0.09); x < info.width * 0.15; x++) {
      const i = (y * info.width + x) * info.channels;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

async function generate(darkColor) {
  const art = sharp(artPath);
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const size = Math.round(FOREGROUND_DP * scale);
    const inner = Math.round(size * 0.86);
    const offset = Math.round((size - inner) / 2);

    const fg = await art
      .clone()
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: offset, bottom: offset, left: offset, right: offset,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const outDir = path.join(resDir, `mipmap-${density}`);
    fs.writeFileSync(path.join(outDir, 'ic_launcher_foreground.png'), fg);
    // Nền đặc cùng kích thước lớp (phòng khi máy không đọc được @color)
    const bg = await sharp({
      create: { width: size, height: size, channels: 4, background: darkColor },
    }).png().toBuffer();
    fs.writeFileSync(path.join(outDir, 'ic_launcher_background.png'), bg);

    // Icon legacy (API < 26): nghệ thuật squircle nguyên bản, kích thước 48dp
    const legacySize = Math.round(48 * scale);
    await art.clone().resize(legacySize, legacySize).png()
      .toFile(path.join(outDir, 'ic_launcher.png'));
    await art.clone().resize(legacySize, legacySize).png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log(`mipmap-${density}: ${size}px (fg/bg), ${legacySize}px (legacy)`);
  }

  // Ghi màu nền vào values để adaptive-icon dùng
  const valuesPath = path.join(resDir, 'values/ic_launcher_background.xml');
  fs.writeFileSync(valuesPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${darkColor}</color>\n</resources>\n`);
  console.log(`Màu nền: ${darkColor}`);
}

const darkColor = await sampleDarkColor();
await generate(darkColor);
console.log('Xong bộ icon launcher Android.');
