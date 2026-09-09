import { Resend } from 'resend';
import {
  confirmationCode,
  emailAllowed,
  isEmail,
  json,
  loadIndex,
  normalizeEmail,
  requireSlug,
  windowIndex,
} from '../_lib/gallery.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const slug = requireSlug(body.slug);
    const email = normalizeEmail(body.email);

    if (!slug || !isEmail(email)) {
      return json({ ok: false, error: 'Enter a valid email address.' }, 400);
    }

    const index = await loadIndex();
    const gallery = index[slug];

    if (!gallery || !emailAllowed(gallery, email)) {
      return json({ ok: false, error: 'This email is not on the list for this gallery.' }, 403);
    }

    const code = confirmationCode(slug, email, windowIndex(0));
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM || 'Stefano Aguiar <stefano@stefanoaguiar.com>';

    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: `Your confirmation number / O teu código — ${gallery.title}`,
      text: [
        `Your confirmation number for "${gallery.title}" is: ${code}`,
        'It is valid for about 15 minutes.',
        '',
        `O teu código de confirmação para "${gallery.title}" é: ${code}`,
        'É válido durante cerca de 15 minutos.',
      ].join('\n'),
    });

    if (error) {
      console.error('request-code resend', error);
      return json({ ok: false, error: 'Could not send the confirmation email.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('request-code', error);
    return json({ ok: false, error: 'Could not send the confirmation email.' }, 500);
  }
}
