import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const outputDir = path.resolve('public/brand');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Full Logo SVG (Mascot Kawaii Cốc Cà Phê + Chữ "ZenStudy" to, rõ nét, đậm đà)
const fullLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 146 36" width="146" height="36" fill="none">
  <defs>
    <!-- Warm Cozy Sunset Gradient cho thân cốc -->
    <linearGradient id="cupBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>

    <!-- Gradient hơi nước ấm áp -->
    <linearGradient id="steamWarm" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#fde047" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0.25"/>
    </linearGradient>

    <!-- Gradient miệng cốc sữa bọt -->
    <linearGradient id="cupRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="100%" stop-color="#fef08a"/>
    </linearGradient>

    <!-- Typography Gradient -->
    <linearGradient id="zenBrandWhite" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <linearGradient id="studyBrandAmber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>

  <!-- Mascot: Tách Cà Phê / Trà Thiền Kawaii to rõ, đáng yêu -->
  <g transform="translate(1, 2)">
    <!-- Quai cầm cốc -->
    <path d="M 22 14 C 27.5 14, 27.5 21, 22 21" 
          fill="none" 
          stroke="#f59e0b" 
          stroke-width="2.8" 
          stroke-linecap="round"/>

    <!-- Thân cốc tròn đầy -->
    <path d="M 4 12 H 22 C 22 12, 22 22, 20.5 24.5 C 19 26.8, 7 26.8, 5.5 24.5 C 4 22, 4 12, 4 12 Z" 
          fill="url(#cupBodyGrad)"/>

    <!-- Miệng cốc có bọt sữa -->
    <ellipse cx="13" cy="12" rx="9" ry="2.4" fill="url(#cupRimGrad)"/>
    <ellipse cx="13" cy="12.3" rx="7.4" ry="1.7" fill="#78350f" opacity="0.85"/>

    <!-- Khuôn mặt Kawaii -->
    <!-- Mắt trái -->
    <circle cx="9.6" cy="18" r="1.4" fill="#1e1b4b"/>
    <circle cx="9.2" cy="17.6" r="0.5" fill="#ffffff"/>

    <!-- Mắt phải -->
    <circle cx="16.4" cy="18" r="1.4" fill="#1e1b4b"/>
    <circle cx="16" cy="17.6" r="0.5" fill="#ffffff"/>

    <!-- Miệng cười chúm chím -->
    <path d="M 11.8 20.2 Q 13 21.6 14.2 20.2" 
          fill="none" 
          stroke="#1e1b4b" 
          stroke-width="1.1" 
          stroke-linecap="round"/>

    <!-- Má hồng hai bên -->
    <circle cx="7.4" cy="19.4" r="1.3" fill="#fb7185" opacity="0.85"/>
    <circle cx="18.6" cy="19.4" r="1.3" fill="#fb7185" opacity="0.85"/>

    <!-- Làn khói ấm áp -->
    <path d="M 9 8.8 C 7.5 5.8, 10 3.8, 8.5 1" 
          fill="none" 
          stroke="url(#steamWarm)" 
          stroke-width="2" 
          stroke-linecap="round"/>
    <path d="M 15.5 8.8 C 14 5.5, 16.5 3.5, 15 0.8" 
          fill="none" 
          stroke="url(#steamWarm)" 
          stroke-width="2" 
          stroke-linecap="round"/>

    <!-- Đốm sáng -->
    <circle cx="2" cy="17" r="1" fill="#fde047"/>
    <circle cx="28" cy="11" r="0.8" fill="#fbbf24"/>
  </g>

  <!-- Typography "ZenStudy" to, đậm, rõ ràng, nổi bật tuyệt đối -->
  <g transform="translate(36, 23.5)">
    <!-- "Zen" -->
    <text x="0" y="0" 
          fill="url(#zenBrandWhite)" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Nunito', 'Comfortaa', Inter, sans-serif" 
          font-size="18" 
          font-weight="800" 
          letter-spacing="-0.3">Zen</text>

    <!-- "Study" -->
    <text x="36" y="0" 
          fill="url(#studyBrandAmber)" 
          font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Nunito', 'Comfortaa', Inter, sans-serif" 
          font-size="18" 
          font-weight="800" 
          letter-spacing="-0.2">Study</text>
  </g>
</svg>`;

// 2. Icon Only SVG (Mascot Kawaii 34x34)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="34" height="34" fill="none">
  <defs>
    <linearGradient id="cupBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="steamWarm" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.95"/>
      <stop offset="50%" stop-color="#fde047" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#fef08a" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="cupRimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fed7aa"/>
      <stop offset="100%" stop-color="#fef08a"/>
    </linearGradient>
  </defs>
  <g transform="translate(1, 1)">
    <path d="M 23 15 C 28.5 15, 28.5 22, 23 22" fill="none" stroke="#f59e0b" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M 5 13 H 23 C 23 13, 23 23, 21.5 25.5 C 20 27.8, 8 27.8, 6.5 25.5 C 5 23, 5 13, 5 13 Z" fill="url(#cupBodyGrad)"/>
    <ellipse cx="14" cy="13" rx="9" ry="2.4" fill="url(#cupRimGrad)"/>
    <ellipse cx="14" cy="13.3" rx="7.4" ry="1.7" fill="#78350f" opacity="0.85"/>
    <circle cx="10.6" cy="19" r="1.4" fill="#1e1b4b"/>
    <circle cx="10.2" cy="18.6" r="0.5" fill="#ffffff"/>
    <circle cx="17.4" cy="19" r="1.4" fill="#1e1b4b"/>
    <circle cx="17" cy="18.6" r="0.5" fill="#ffffff"/>
    <path d="M 12.8 21.2 Q 14 22.6 15.2 21.2" fill="none" stroke="#1e1b4b" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="8.4" cy="20.4" r="1.3" fill="#fb7185" opacity="0.85"/>
    <circle cx="19.6" cy="20.4" r="1.3" fill="#fb7185" opacity="0.85"/>
    <path d="M 10 9.8 C 8.5 6.8, 11 4.8, 9.5 2" fill="none" stroke="url(#steamWarm)" stroke-width="2" stroke-linecap="round"/>
    <path d="M 16.5 9.8 C 15 6.5, 17.5 4.5, 16 1.8" fill="none" stroke="url(#steamWarm)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="3" cy="18" r="1" fill="#fde047"/>
  </g>
</svg>`;



fs.writeFileSync(path.join(outputDir, 'zenstudy-logo.svg'), fullLogoSvg.trim());
fs.writeFileSync(path.join(outputDir, 'zenstudy-logo-icon.svg'), iconSvg.trim());

// Generate PNGs with 3x density for retina crispness
async function generatePngs() {
  // 1x and 2x high resolution
  await sharp(Buffer.from(fullLogoSvg))
    .png({ quality: 100 })
    .toFile(path.join(outputDir, 'zenstudy-logo.png'));

  await sharp(Buffer.from(fullLogoSvg), { density: 216 })
    .resize(342, 108)
    .png({ quality: 100 })
    .toFile(path.join(outputDir, 'zenstudy-logo@2x.png'));

  await sharp(Buffer.from(iconSvg))
    .resize(128, 128)
    .png({ quality: 100 })
    .toFile(path.join(outputDir, 'zenstudy-logo-icon.png'));

  console.log('Brand logos successfully regenerated in public/brand/');
}

generatePngs().catch(console.error);
