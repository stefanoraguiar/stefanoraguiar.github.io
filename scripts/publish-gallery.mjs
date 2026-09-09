import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import { IMAGE_EXTENSIONS, INDEX_PATH, byPhotoName, loadIndex, saveIndex } from '../api/_lib/gallery.js';

function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFiles();

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npm run publish-gallery -- <slug>');
  process.exit(1);
}

const folder = path.resolve('client-galleries', slug);
const configPath = path.join(folder, 'gallery.json');

const config = JSON.parse(await readFile(configPath, 'utf8'));
if (!config.title || !Array.isArray(config.emails) || config.emails.length === 0) {
  console.error('gallery.json needs a title and at least one email.');
  process.exit(1);
}

const names = (await readdir(folder))
  .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
  .sort(byPhotoName);

if (names.length === 0) {
  console.error(`No photos found in ${folder}`);
  process.exit(1);
}

const photos = [];
for (const name of names) {
  const filePath = path.join(folder, name);
  const info = await stat(filePath);
  if (!info.isFile()) continue;

  const pathname = `client-galleries/${slug}/${name}`;
  const body = await readFile(filePath);
  let blob;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      blob = await put(pathname, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: info.size > 4 * 1024 * 1024,
      });
      break;
    } catch (error) {
      console.error(`Retry ${attempt}/3 for ${name}: ${error.message}`);
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  photos.push({
    name,
    pathname,
    url: blob.url,
  });
  console.log(`Uploaded ${name}`);
}

const index = await loadIndex();
index[slug] = {
  title: config.title,
  emails: config.emails.map((email) => String(email).trim().toLowerCase()),
  photos,
  updatedAt: new Date().toISOString(),
};
await saveIndex(index);

console.log(`Published ${slug} (${photos.length} photos) to ${INDEX_PATH}`);
console.log(`Client link: https://gallery.stefanoaguiar.com/${slug}`);
