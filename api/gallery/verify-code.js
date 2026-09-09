import {
  SESSION_MAX_AGE,
  codeMatches,
  emailAllowed,
  isEmail,
  json,
  loadIndex,
  normalizeEmail,
  requireSlug,
  sessionCookie,
  signSession,
} from '../_lib/gallery.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const slug = requireSlug(body.slug);
    const email = normalizeEmail(body.email);
    const code = body.code;

    if (!slug || !isEmail(email)) {
      return json({ ok: false, error: 'Enter a valid email and confirmation number.' }, 400);
    }

    const index = await loadIndex();
    const gallery = index[slug];

    if (!gallery || !emailAllowed(gallery, email) || !codeMatches(slug, email, code)) {
      return json({ ok: false, error: 'That confirmation number is not valid.' }, 403);
    }

    const token = signSession({
      slug,
      email,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    });

    return json(
      { ok: true, title: gallery.title },
      200,
      { 'set-cookie': sessionCookie(token) }
    );
  } catch (error) {
    console.error('verify-code', error);
    return json({ ok: false, error: 'Could not verify the confirmation number.' }, 500);
  }
}
