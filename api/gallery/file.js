import { get } from '@vercel/blob';
import {
  canViewGallery,
  findPhoto,
  loadIndex,
  mimeFor,
  readSession,
  requireSlug,
} from '../_lib/gallery.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const slug = requireSlug(url.searchParams.get('slug'));
    const filename = url.searchParams.get('file');
    const download = url.searchParams.get('download') === '1';
    const session = readSession(request);

    if (!slug || !filename) {
      return new Response('Unauthorized', { status: 401 });
    }

    const index = await loadIndex();
    const gallery = index[slug];
    if (!canViewGallery(gallery, session, slug)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const photo = findPhoto(gallery, filename);
    if (!photo?.url && !photo?.pathname) {
      return new Response('Not found', { status: 404 });
    }

    const result = await get(photo.url || photo.pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response('Not found', { status: 404 });
    }

    const headers = {
      'content-type': result.blob.contentType || mimeFor(photo.name || filename),
      'cache-control': 'private, max-age=300',
    };
    if (download) {
      const downloadName = String(photo.name || filename).replace(/"/g, '').split('/').pop();
      headers['content-disposition'] = `attachment; filename="${downloadName}"`;
    }

    return new Response(result.stream, { headers });
  } catch (error) {
    console.error('file', error);
    return new Response('Not found', { status: 404 });
  }
}
