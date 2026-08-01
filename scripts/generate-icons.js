import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ICON_DIR = './public/icons';
const SCREENSHOT_DIR = './public/screenshots';

// Ensure directories exist
fs.mkdirSync(ICON_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Base icon source (should be a 512×512 PNG)
// For now, we'll create a placeholder if it doesn't exist
const baseIconPath = './public/base-icon.png';

// If base icon doesn't exist, create a simple placeholder
if (!fs.existsSync(baseIconPath)) {
  console.log('[Icon Generator] Base icon not found. Creating placeholder...');
  
  // Create a simple 512×512 placeholder with rice paper color
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 245, g: 241, b: 232 }, // Rice paper color
    },
  })
    .png()
    .toFile(baseIconPath);
}

console.log('[Icon Generator] Generating PWA icons...');

// Generate standard icons
const sizes = [192, 512];

for (const size of sizes) {
  // Standard icon
  await sharp(baseIconPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICON_DIR, `icon-${size}.png`));
  
  console.log(`✓ Generated icon-${size}.png`);
  
  // Maskable icon (for adaptive icons on Android)
  await sharp(baseIconPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ICON_DIR, `icon-${size}-maskable.png`));
  
  console.log(`✓ Generated icon-${size}-maskable.png`);
}

// Generate shortcut icon (Add Book)
await sharp(baseIconPath)
  .resize(192, 192)
  .png()
  .toFile(path.join(ICON_DIR, 'add-book-192.png'));

console.log('✓ Generated add-book-192.png');

// Generate screenshots (placeholder for now)
// In production, you'd generate these from actual app screenshots
const screenshotDimensions = [
  { width: 540, height: 720, name: 'screenshot-540' }, // Mobile
  { width: 1280, height: 720, name: 'screenshot-1280' }, // Tablet/Desktop
];

for (const dim of screenshotDimensions) {
  await sharp({
    create: {
      width: dim.width,
      height: dim.height,
      channels: 3,
      background: { r: 245, g: 241, b: 232 }, // Rice paper
    },
  })
    .png()
    .toFile(path.join(SCREENSHOT_DIR, `${dim.name}.png`));
  
  console.log(`✓ Generated ${dim.name}.png`);
}

console.log('[Icon Generator] ✓ All icons generated successfully!');
