import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');

// SVG template for icons
const createSvg = (size) => `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1f2937"/>
    <text x="${size/2}" y="${size/2 + size/8}" font-size="${size/2.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">CC</text>
  </svg>
`;

// Create maskable SVG (circular)
const createMaskableSvg = (size) => `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 * 0.9}" fill="#1f2937"/>
    <text x="${size/2}" y="${size/2 + size/8}" font-size="${size/2.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">CC</text>
  </svg>
`;

// Create screenshot SVG
const createScreenshot = (width, height) => `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f3f4f6"/>
    <rect x="0" y="0" width="${width}" height="60" fill="#1f2937"/>
    <text x="${width/2}" y="35" font-size="32" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">CC Events</text>
    <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)/4}" fill="#1f2937"/>
    <text x="${width/2}" y="${height/2 + 20}" font-size="60" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">CC</text>
  </svg>
`;

async function generateIcons() {
  try {
    // Generate 192x192
    const svg192 = createSvg(192);
    await sharp(Buffer.from(svg192)).png().toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✓ Created icon-192.png');

    // Generate 512x512
    const svg512 = createSvg(512);
    await sharp(Buffer.from(svg512)).png().toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✓ Created icon-512.png');

    // Generate maskable 192x192
    const svgMaskable192 = createMaskableSvg(192);
    await sharp(Buffer.from(svgMaskable192)).png().toFile(path.join(publicDir, 'icon-192-maskable.png'));
    console.log('✓ Created icon-192-maskable.png');

    // Generate maskable 512x512
    const svgMaskable512 = createMaskableSvg(512);
    await sharp(Buffer.from(svgMaskable512)).png().toFile(path.join(publicDir, 'icon-512-maskable.png'));
    console.log('✓ Created icon-512-maskable.png');

    // Generate screenshots
    const screenshot540x720 = createScreenshot(540, 720);
    await sharp(Buffer.from(screenshot540x720)).png().toFile(path.join(publicDir, 'screenshot-540x720.png'));
    console.log('✓ Created screenshot-540x720.png');

    const screenshot1280x720 = createScreenshot(1280, 720);
    await sharp(Buffer.from(screenshot1280x720)).png().toFile(path.join(publicDir, 'screenshot-1280x720.png'));
    console.log('✓ Created screenshot-1280x720.png');

    console.log('\n✅ All PWA assets generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
