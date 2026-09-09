import { createHmac, timingSafeEqual } from 'node:crypto';
import { BlobNotFoundError, get, put } from '@vercel/blob';

export const INDEX_PATH = 'client-galleries/index.json';
export const WINDOW_MS = 15 * 60 * 1000;
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
export const COOKIE_NAME = 'gallery_session';
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const IMAGE_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.gif']);

export function byPhotoName(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortPhotos(photos) {
  return [...(photos || [])].sort((a, b) => byPhotoName(a?.name, b?.name));
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function secret() {
  const value = process.env.GALLERY_SECRET;
  if (!value) throw new Error('GALLERY_SECRET is not set');
  return value;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function windowIndex(offset = 0) {
  return Math.floor(Date.now() / WINDOW_MS) - offset;
}

export function confirmationCode(slug, email, window) {
  const digest = createHmac('sha256', secret())
    .update(`${slug}|${email}|${window}`)
    .digest('hex');
  return String(parseInt(digest.slice(0, 8), 16) % 1_000_000).padStart(6, '0');
}

export function codeMatches(slug, email, code) {
  const submitted = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(submitted)) return false;
  return [0, 1].some((offset) =>
    safeEqual(submitted, confirmationCode(slug, email, windowIndex(offset)))
  );
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signSession({ slug, email, exp }) {
  const payload = Buffer.from(JSON.stringify({ slug, email, exp })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(request) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  if (!safeEqual(sig, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.slug || !data?.email || !data?.exp) return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch (error) {
    console.error('readSession', error);
    return null;
  }
}

export function sessionCookie(token) {
  const isProd = process.env.VERCEL_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export async function loadIndex() {
  try {
    const result = await get(INDEX_PATH, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return {};
    const text = await new Response(result.stream).text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (error instanceof BlobNotFoundError) return {};
    console.error('loadIndex', error);
    throw error;
  }
}

export async function saveIndex(index) {
  await put(INDEX_PATH, JSON.stringify(index, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export function emailAllowed(gallery, email) {
  const allowed = (gallery?.emails || []).map(normalizeEmail);
  return allowed.includes(email);
}

export function mimeFor(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

export function requireSlug(value) {
  const slug = String(value || '').trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) return null;
  return slug;
}

export function findPhoto(gallery, filename) {
  return (gallery?.photos || []).find((photo) => photo.name === filename) || null;
}
