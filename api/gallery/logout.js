import { expiredSessionCookie, json } from '../_lib/gallery.js';

export async function POST() {
  return json({ ok: true }, 200, { 'set-cookie': expiredSessionCookie() });
}
