# 09 — Deployment

## Hosting
- **Vercel** for the Next.js app and all static data (`public/data`). The CDN serves JSON, so nothing sleeps.
- **No separate backend.** Do not use a free-tier server that cold-starts (for example Render free) in the user path. The Python pipeline runs on the developer's machine, not in production.
- `/api/ask` runs as a Vercel serverless function.

## Environment variables
| Name | Where | Purpose |
|---|---|---|
| `ZAI_API_KEY` | server only | Z.ai key |
| `ZAI_BASE_URL` | server only | provider base URL (check docs) |
| `ZAI_MODEL` | server only | model id for explanations and chat |
| `OPENF1_TOKEN` | server, optional | paid live access |
| `NEXT_PUBLIC_SITE_URL` | client | for share cards and links |

Never commit keys. Add `.env.local` to `.gitignore`. Provide `.env.example`.

## Data in the repo
Commit the generated `public/data` for the featured races if total size is under about 50 MB; otherwise upload to a storage bucket or Vercel Blob and point `NEXT_PUBLIC_DATA_BASE` at it. Keep raw caches out of git.

## Caching headers
`public/data/**` is immutable once built: add `Cache-Control: public, max-age=31536000, immutable` via `next.config.js` headers, and version race folders (`2025-18-singapore`) so a rebuild gets a new path when data changes.

## Share cards
Generate with `next/og` (`ImageResponse`) at `/api/og?m=<moment id>`; used by Recap and moment links.

## Pre-launch checklist
- [ ] Production build passes, no console errors.
- [ ] Open on a real phone over mobile data; Easy mode first paint under 2 s.
- [ ] Radio-missing race, telemetry-missing race and AI-down state all render.
- [ ] `/api/ask` rate limit and input cap verified.
- [ ] Open Graph image and title set; favicon set.
- [ ] Methods page credits OpenF1 and FastF1; footer says unofficial fan project.
- [ ] Public link works in a private window (no login wall).
