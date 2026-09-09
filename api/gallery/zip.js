import { get } from '@vercel/blob';
import { loadIndex, readSession, requireSlug, zipFileName } from '../_lib/gallery.js';

export const maxDuration = 60;

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const slug = requireSlug(url.searchParams.get('slug'));
    const session = readSession(request);

    if (!slug || !session || session.slug !== slug) {
      return new Response('Unauthorized', { status: 401 });
    }

    const index = await loadIndex();
    const gallery = index[slug];
    const zip = gallery?.zip;
    if (!zip?.url && !zip?.pathname) {
      return new Response('Not found', { status: 404 });
    }

    const result = await get(zip.url || zip.pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new Response('Not found', { status: 404 });
    }

    const filename = (zip.name || zipFileName(slug)).replace(/"/g, '');
    return new Response(result.stream, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('zip', error);
    return new Response('Not found', { status: 404 });
  }
}
