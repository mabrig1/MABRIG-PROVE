# Implemented local API (v0.1)

Base: `http://127.0.0.1:4173/api`. Private buyer routes use a browser-scoped `prove_session` cookie. `Content-Type: application/json` is required for JSON submissions.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Local service status (no private information) |
| GET / POST | `/session` | Check or create a guest session |
| DELETE | `/session` | Delete all guest cases, media and session |
| GET | `/cases` | Current guest's cases |
| POST | `/cases` | Create and analyze case `{ category, offer_text, offer_url?, asking_price?, redact? }` |
| GET / DELETE | `/cases/:id` | Read or delete owned case |
| POST | `/cases/:id/evidence` | Upload sanitized JPEG/PNG/WebP `{ mime, data: base64 }` |
| GET | `/cases/:id/evidence/:assetId` | Authenticated, attachment-only evidence download |
| POST | `/cases/:id/invite` | Generate 72-hour proof invitation with `{ questions?: string[] }` |
| POST | `/cases/:id/invite/revoke` | Revoke active invitation |
| GET | `/cases/:id/report` | Private decision report |
| POST | `/cases/:id/abuse-report` | Buyer report of abuse, `{ reason }` |
| GET | `/proof/:token` | Seller invitation information (no buyer private case details) |
| POST | `/proof/:token/respond` | Seller `{ answers: string[], consent: true }` |
| POST | `/proof/:token/decline` | Decline without fraud labeling |
| POST | `/proof/:token/report` | Seller concerns `{ reason }` |
| POST | `/admin/login` | Local console login (disabled by default) |
| GET | `/admin/overview` | Admin counts, requires local admin cookie |
| GET | `/admin/reports` | Admin abuse queue, requires local admin cookie |
| POST | `/admin/reports/:id/resolve` | Resolve abuse report |
| POST | `/admin/logout` | Clear preview admin cookie |

## Intentional API limits

- New buyer cases require a meaningful text description. Automatic OCR, visual manipulation detection and third-party price checks are not represented as working features.
- A seller response is a voluntary written statement, **not** a verified fact.
- Access to a case requires the **same original browser session**; if cookies are lost, no account recovery exists in v0.1.
- Invitation links are secret, time-limited bearer credentials. Treat them as passwords. No public sharing, indexing or analytics collection is permitted.
- User-provided URLs are parsed only. The server does not request arbitrary websites.

For a hosted Cloudflare deployment, the OpenAPI design draft included in `docs/PROPOSED_CLOUDFLARE_API.yaml` is aspirational and is **not** a contract claiming that the hosted endpoints exist.
