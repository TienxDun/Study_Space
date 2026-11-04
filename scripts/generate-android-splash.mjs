/**
 * Sinh ảnh splash.png cho vỏ Android: nền tối #05070D + logo squircle căn giữa.
 * Giữ nguyên kích thước từng file splash hiện có (theo từng drawable-* density).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const resDir = path.resolve('android/app/src/main/res');
const artPath = path.resolve('public/icon-512.png');
const BG = '#05070D';

const entries = fs.readdirSync(resDir).filter((d) => d.startsWith('drawable'));
let count = 0;

for (const dir of entries) {
  const splashPath = path.join(resDir, dir, 'splash.png');
  if (!fs.existsSync(splashPath)) continue;
  const { width, height } = await sharp(splashPath).metadata();
  const logoW = Math.round(Math.min(width, height) * 0.45);
  const logo = await sharp(artPath)
    .resize(logoW, logoW, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(splashPath);
  console.log(`${dir}/splash.png: ${width}x${height}`);
  count++;
}
console.log(`Xong ${count} ảnh splash.`);
