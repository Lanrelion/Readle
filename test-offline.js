import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readDistFile(fileName) {
  const filePath = join(distDir, fileName);
  assert(existsSync(filePath), `Missing ${fileName}. Run npm run build first.`);
  return readFileSync(filePath, 'utf8');
}

try {
  console.log('Checking production PWA offline artifacts...');

  assert(existsSync(distDir), 'Missing dist directory. Run npm run build first.');
  requiredFiles.forEach((fileName) => readDistFile(fileName));

  const indexHtml = readDistFile('index.html');
  const swSource = readDistFile('sw.js');
  const manifest = JSON.parse(readDistFile('manifest.webmanifest'));
  const assetFiles = readdirSync(join(distDir, 'assets'));

  assert(indexHtml.includes('<div id="root"></div>'), 'index.html is missing the React root.');
  assert(assetFiles.some((file) => file.endsWith('.js')), 'No built JavaScript asset found.');
  assert(assetFiles.some((file) => file.endsWith('.css')), 'No built CSS asset found.');
  assert(swSource.includes('precacheAndRoute'), 'Service worker is missing Workbox precache setup.');
  assert(manifest.name && manifest.short_name, 'Web manifest is missing app names.');
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Web manifest is missing icons.');

  console.log('Offline artifact check passed.');
  console.log(`Found ${assetFiles.length} built asset(s), service worker, manifest, and app shell.`);
} catch (error) {
  console.error(`[Offline check failed] ${error.message}`);
  process.exitCode = 1;
}
