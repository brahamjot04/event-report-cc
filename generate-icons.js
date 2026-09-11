import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const faviconSvg = path.join(__dirname, 'src', 'assets', 'cc.svg');

async function generateIcons() {
  try {
    const bgBlack = { r: 0, g: 0, b: 1, alpha: 1 };

    // 1. Generate icon-192.png
    await sharp(faviconSvg)
      .resize(192, 192, { fit: 'contain', background: bgBlack })
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✓ Created icon-192.png from favicon');

    // 2. Generate icon-512.png
    await sharp(faviconSvg)
      .resize(512, 512, { fit: 'contain', background: bgBlack })
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✓ Created icon-512.png from favicon');

    // 3. Generate maskable 192x192 (safe zone with padding)
    const inner192 = await sharp(faviconSvg)
      .resize(150, 150, { fit: 'contain', background: bgBlack })
      .toBuffer();

    await sharp({
      create: {
        width: 192,
        height: 192,
        channels: 4,
        background: bgBlack,
      },
    })
      .composite([{ input: inner192, gravity: 'center' }])
      .png()
      .toFile(path.join(publicDir, 'icon-192-maskable.png'));
    console.log('✓ Created icon-192-maskable.png from favicon');

    // 4. Generate maskable 512x512 (safe zone with padding)
    const inner512 = await sharp(faviconSvg)
      .resize(400, 400, { fit: 'contain', background: bgBlack })
      .toBuffer();

    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: bgBlack,
      },
    })
      .composite([{ input: inner512, gravity: 'center' }])
      .png()
      .toFile(path.join(publicDir, 'icon-512-maskable.png'));
    console.log('✓ Created icon-512-maskable.png from favicon');

    // 5. Generate apple-touch-icon.png (180x180)
    await sharp(faviconSvg)
      .resize(180, 180, { fit: 'contain', background: bgBlack })
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✓ Created apple-touch-icon.png from favicon');

    console.log('\n✅ All PWA icons generated from favicon successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
