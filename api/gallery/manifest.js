import { json, loadIndex, readSession, requireSlug, sortPhotos } from '../_lib/gallery.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const slug = requireSlug(url.searchParams.get('slug'));
    const session = readSession(request);

    if (!slug || !session || session.slug !== slug) {
      return json({ ok: false, error: 'Sign in to view this gallery.' }, 401);
    }

    const index = await loadIndex();
    const gallery = index[slug];
    if (!gallery) {
      return json({ ok: false, error: 'This gallery is no longer available.' }, 404);
    }

    return json({
      ok: true,
      title: gallery.title,
      photos: sortPhotos(gallery.photos).map((photo) => ({
        name: photo.name,
        src: `/api/gallery/file?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(photo.name)}`,
        download: `/api/gallery/file?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(photo.name)}&download=1`,
      })),
    });
  } catch (error) {
    console.error('manifest', error);
    return json({ ok: false, error: 'Could not load this gallery.' }, 500);
  }
}
