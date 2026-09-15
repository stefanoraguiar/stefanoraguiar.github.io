import { existsSync, readFileSync } from 'node:fs';
import { loadIndex, normalizeEmail } from '../api/_lib/gallery.js';

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
const index = await loadIndex();

if (!slug) {
  const slugs = Object.keys(index);
  if (slugs.length === 0) {
    console.log('No published galleries in Blob.');
    process.exit(0);
  }
  for (const name of slugs) {
    const gallery = index[name];
    console.log(`${name}`);
    console.log(`  ${gallery.title}`);
    console.log(`  ${gallery.access === 'open' ? 'open (link-only)' : 'private'}`);
    console.log(`  ${(gallery.emails || []).join(', ') || '(no emails)'}`);
    console.log(`  updated ${gallery.updatedAt || 'unknown'}`);
  }
  process.exit(0);
}

const gallery = index[slug];
if (!gallery) {
  console.error(`No published gallery named "${slug}".`);
  console.error(`Known: ${Object.keys(index).join(', ') || '(none)'}`);
  process.exit(1);
}

const emails = (gallery.emails || []).map(normalizeEmail);
console.log(slug);
console.log(gallery.title);
console.log(gallery.access === 'open' ? 'open (link-only)' : 'private');
console.log(`updated ${gallery.updatedAt || 'unknown'}`);
console.log(`${gallery.photos?.length || 0} photos`);
if (gallery.zip?.size) {
  console.log(`zip ${(gallery.zip.size / (1024 * 1024)).toFixed(1)} MB`);
}
console.log('allowlist:');
for (const email of emails) console.log(`  ${email}`);
