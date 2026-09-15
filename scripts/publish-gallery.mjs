import { existsSync, readFileSync, createWriteStream } from 'node:fs';
import { readdir, readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { put } from '@vercel/blob';
import {
  DATE_KEY,
  IMAGE_EXTENSIONS,
  INDEX_PATH,
  byPhotoName,
  loadIndex,
  saveIndex,
  takenOnFromName,
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
const allowlistOnly = flags.has('--allowlist-only');

if (!slug) {
  console.error('Usage: npm run publish-gallery -- <slug> [--zip-only | --allowlist-only]');
  process.exit(1);
}

const folder = path.resolve('client-galleries', slug);
const configPath = path.join(folder, 'gallery.json');

const config = JSON.parse(await readFile(configPath, 'utf8'));
const access = config.access === 'open' ? 'open' : 'private';
const emails =
  access === 'open'
    ? []
    : (config.emails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean);

if (!config.title) {
  console.error('gallery.json needs a title.');
  process.exit(1);
}
if (access === 'private' && emails.length === 0) {
  console.error('Private galleries need at least one email in gallery.json.');
  process.exit(1);
}
const dateLabels = {};
if (config.dateLabels && typeof config.dateLabels === 'object') {
  for (const [key, value] of Object.entries(config.dateLabels)) {
    if (!DATE_KEY.test(key)) continue;
    const label = String(value || '').trim();
    if (label) dateLabels[key] = label;
  }
}

async function collectPhotoFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory() && DATE_KEY.test(entry.name)) {
      const nested = await readdir(path.join(root, entry.name), { withFileTypes: true });
      for (const child of nested) {
        if (!child.isFile()) continue;
        if (!IMAGE_EXTENSIONS.has(path.extname(child.name).toLowerCase())) continue;
        files.push({
          name: child.name,
          relative: `${entry.name}/${child.name}`,
          filePath: path.join(root, entry.name, child.name),
          takenOn: entry.name,
        });
      }
      continue;
    }

    if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push({
        name: entry.name,
        relative: entry.name,
        filePath: path.join(root, entry.name),
        takenOn: takenOnFromName(entry.name),
      });
    }
  }

  return files.sort((a, b) => {
    if (a.takenOn !== b.takenOn) {
      if (!a.takenOn) return 1;
      if (!b.takenOn) return -1;
      return a.takenOn.localeCompare(b.takenOn);
    }
    return byPhotoName(a.relative, b.relative);
  });
}

const photoFiles = await collectPhotoFiles(folder);

if (photoFiles.length === 0) {
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
    for (const photo of photoFiles) {
      archive.file(photo.filePath, { name: photo.relative, store: true });
    }
    archive.finalize();
  });
}

if (allowlistOnly) {
  const index = await loadIndex();
  if (!index[slug]) {
    console.error('No published gallery found for this slug. Run a full publish first.');
    process.exit(1);
  }
  index[slug] = {
    ...index[slug],
    title: config.title,
    access,
    emails,
    dateLabels,
    updatedAt: new Date().toISOString(),
  };
  await saveIndex(index);
  console.log(`Updated ${slug} (${access})`);
  if (access === 'open') {
    console.log('  link-only public gallery — no email gate');
  } else {
    console.log('allowlist:');
    for (const email of emails) console.log(`  ${email}`);
  }
  console.log(`Client link: https://gallery.stefanoaguiar.com/${slug}`);
  process.exit(0);
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
  for (const item of photoFiles) {
    const info = await stat(item.filePath);
    if (!info.isFile()) continue;

    const pathname = `client-galleries/${slug}/${item.relative}`;
    const body = await readFile(item.filePath);
    const blob = await putBlob(pathname, body, info.size);
    photos.push({
      name: item.name,
      file: item.relative,
      takenOn: item.takenOn,
      pathname,
      url: blob.url,
    });
    console.log(`Uploaded ${item.relative}`);
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
    access,
    emails,
    dateLabels,
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

  console.log(`Zipped ${photoFiles.length} photos (${(zipInfo.size / (1024 * 1024)).toFixed(1)} MB)`);
  console.log(`Published ${slug} (${photos.length} photos) to ${INDEX_PATH}`);
  console.log(`Client link: https://gallery.stefanoaguiar.com/${slug}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
