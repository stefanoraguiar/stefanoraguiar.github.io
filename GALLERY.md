# Client galleries

Private delivery galleries: the client enters an allowlisted email, receives a 6-digit confirmation number, then can view and download the photos. Galleries are not linked from the public site.

The public site stays on GitHub Pages at `stefanoaguiar.com`. Client galleries live on Vercel at `gallery.stefanoaguiar.com`.

## One-time setup

1. Create a [Vercel](https://vercel.com) project from this repo (framework: Other). Deploy the existing HTML as-is; `/api/*` becomes serverless functions.
2. Create a **Blob** store in that project. Vercel will add `BLOB_READ_WRITE_TOKEN`.
3. Create a [Resend](https://resend.com) account, verify `stefanoaguiar.com`, and send from `stefano@stefanoaguiar.com`.
4. In Vercel → Environment Variables, set:

   - `RESEND_API_KEY`
   - `GALLERY_SECRET` (long random string; used to sign codes and the login cookie)
   - `BLOB_READ_WRITE_TOKEN`
   - `RESEND_FROM` — `Stefano Aguiar <stefano@stefanoaguiar.com>`

5. Point `gallery.stefanoaguiar.com` at that Vercel project (see below). Do not move `stefanoaguiar.com` itself off GitHub Pages.

Local development:

```bash
cp .env.example .env.local
npx vercel env pull .env.local
npx vercel dev
```

Local test URL: `http://localhost:3000/gallery/your-slug`

## Custom domain

Use the **photography** Vercel account (the one where the email code already worked), not a different team such as Bingo / R66.

### 1. Add the domain in Vercel

Project → **Settings** → **Domains** → add `gallery.stefanoaguiar.com`.

Vercel will show a CNAME target, usually `cname.vercel-dns.com`. Copy that value.

### 2. Add one DNS record

At the same place you already manage DNS for `stefanoaguiar.com` (the registrar or DNS host used for GitHub Pages), add:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `gallery` | `cname.vercel-dns.com` (or whatever Vercel showed) |

Leave the existing records for `stefanoaguiar.com` and `www` alone. Those keep the public site on GitHub Pages.

If the DNS host is Cloudflare, keep the record **DNS only** (grey cloud), not proxied.

Wait until Vercel marks the domain as **Valid**. Then the client link is:

`https://gallery.stefanoaguiar.com/ariane-2026-09-01`

The Vercel preview URL (`*.vercel.app/gallery/...`) keeps working.

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

That uploads the photos and builds a zip for **Download all**. To rebuild only the zip:

```bash
npm run publish-gallery -- fernanda-2026 --zip-only
```

Send the client: `https://gallery.stefanoaguiar.com/fernanda-2026`

Photos and emails live in private Blob storage, not in the public GitHub repo.
