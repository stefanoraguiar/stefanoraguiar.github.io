import { existsSync, readFileSync, createWriteStream } from 'node:fs';
import { readdir, readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { put } from '@vercel/blob';
import {
  IMAGE_EXTENSIONS,
  INDEX_PATH,
  byPhotoName,
  loadIndex,
  saveIndex,
  zipFileName,
} from '../api/_lib/gallery.js';

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

const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));
const slug = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const zipOnly = flags.has('--zip-only');

if (!slug) {
  console.error('Usage: npm run publish-gallery -- <slug> [--zip-only]');
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

async function putBlob(pathname, body, size) {
  let blob;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      blob = await put(pathname, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        multipart: size > 4 * 1024 * 1024,
      });
      return blob;
    } catch (error) {
      console.error(`Retry ${attempt}/3 for ${pathname}: ${error.message}`);
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error(`Failed to upload ${pathname}`);
}

async function zipPhotos(outPath) {
  const output = createWriteStream(outPath);
  const archive = new ZipArchive({ zlib: { level: 0 } });
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') reject(error);
    });
    archive.pipe(output);
    for (const name of names) {
      archive.file(path.join(folder, name), { name, store: true });
    }
    archive.finalize();
  });
}

let photos;
if (zipOnly) {
  const index = await loadIndex();
  photos = index[slug]?.photos;
  if (!photos?.length) {
    console.error('No published photos found for this slug. Run without --zip-only first.');
    process.exit(1);
  }
} else {
  photos = [];
  for (const name of names) {
    const filePath = path.join(folder, name);
    const info = await stat(filePath);
    if (!info.isFile()) continue;

    const pathname = `client-galleries/${slug}/${name}`;
    const body = await readFile(filePath);
    const blob = await putBlob(pathname, body, info.size);
    photos.push({
      name,
      pathname,
      url: blob.url,
    });
    console.log(`Uploaded ${name}`);
  }
}

const zipName = zipFileName(slug);
const tempDir = await mkdtemp(path.join(os.tmpdir(), 'gallery-zip-'));
const zipPath = path.join(tempDir, zipName);
try {
  await zipPhotos(zipPath);
  const zipBody = await readFile(zipPath);
  const zipInfo = await stat(zipPath);
  const zipPathname = `client-galleries/${slug}/${zipName}`;
  const zipBlob = await putBlob(zipPathname, zipBody, zipInfo.size);

  const index = await loadIndex();
  index[slug] = {
    title: config.title,
    emails: config.emails.map((email) => String(email).trim().toLowerCase()),
    photos,
    zip: {
      name: zipName,
      pathname: zipPathname,
      url: zipBlob.url,
      size: zipInfo.size,
    },
    updatedAt: new Date().toISOString(),
  };
  await saveIndex(index);

  console.log(`Zipped ${names.length} photos (${(zipInfo.size / (1024 * 1024)).toFixed(1)} MB)`);
  console.log(`Published ${slug} (${photos.length} photos) to ${INDEX_PATH}`);
  console.log(`Client link: https://gallery.stefanoaguiar.com/${slug}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
