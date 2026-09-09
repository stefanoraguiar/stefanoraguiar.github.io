# Client galleries

Private delivery galleries: the client enters an allowlisted email, receives a 6-digit confirmation number, then can view and download the photos. Galleries are not linked from the public site.

## One-time setup

1. Create a [Vercel](https://vercel.com) project from this repo (framework: Other). Deploy the existing HTML as-is; `/api/*` becomes serverless functions.
2. Create a **Blob** store in that project. Vercel will add `BLOB_READ_WRITE_TOKEN`.
3. Create a [Resend](https://resend.com) account, verify `stefanoaguiar.com`, and send from `stefano@stefanoaguiar.com`.
4. In Vercel → Environment Variables, set:

   - `RESEND_API_KEY`
   - `GALLERY_SECRET` (long random string; used to sign codes and the login cookie)
   - `BLOB_READ_WRITE_TOKEN`
   - `RESEND_FROM` — `Stefano Aguiar <stefano@stefanoaguiar.com>`

5. Point DNS at Vercel when you want `/gallery/...` on `stefanoaguiar.com`. Until then you can use the Vercel preview URL or a `gallery` subdomain.

Local development:

```bash
cp .env.example .env.local
npx vercel env pull .env.local
npx vercel dev
```

## Publish a gallery

```
client-galleries/fernanda-2026/gallery.json
client-galleries/fernanda-2026/001.webp
client-galleries/fernanda-2026/002.webp
```

`gallery.json`:

```json
{
  "title": "Sessão Fernanda — Março 2026",
  "emails": ["fernanda@example.com", "parceiro@example.com"]
}
```

This folder is gitignored. Then:

```bash
npm run publish-gallery -- fernanda-2026
```

Send the client: `https://stefanoaguiar.com/gallery/fernanda-2026`

Photos and emails live in private Blob storage, not in the public GitHub repo.
