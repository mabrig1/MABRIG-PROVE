# MABRIG PROVE

**Before you trust it, make it prove it.**

A functioning, mobile-first **local MVP** of the proof-first consumer safety app proposed by MABRIG Technologies. It helps buyers assess a text offer, generate private time-limited proof requests, receive seller responses voluntarily, compare the responses, and produce a private decision report. It is intentionally **not** a public verification service or proof-of-ownership certification.

## Start the app

Prerequisite: **Node.js 22.13+** (tested with Node.js 22.16). No npm install, internet connection, model keys, payment configuration or additional dependencies are required.

```bash
cd MABRIG-PROVE
npm start
```

Open **http://127.0.0.1:4173** in a browser. On Windows, open a terminal in the extracted `MABRIG-PROVE` folder and run `npm start`.

To use another port, set `PORT=5000`. To expose the local development server to your LAN in a trusted environment, set `HOST=0.0.0.0` (NOT recommended without authentication and hardening).

## Use the complete flow

1. Click **Check an offer**, paste a phone/laptop advert (at least 15 characters), optionally attach a screenshot, review privacy choices and submit.
2. Study matched warning phrases, claims and unknowns. This engine is **deterministic**, not an external AI integration.
3. Click **Request specific proof**, edit the questions, then **Generate private link**.
4. Copy the one-time-display URL and open it in another browser or private window to simulate the seller. Sellers can decline or reply without registration.
5. Return to the buyer's case and open **Compare evidence**, then **Decision report**. Print to PDF or export JSON.
6. Delete the case or the entire guest session when finished. Physical evidence files are erased.

**Tip:** On the homepage, **Try sample case** creates a synthetic case for exploration.

## Implemented in v0.1

| Capability | Status |
|---|---|
| Mobile-first responsive UI, installable PWA manifest | Implemented |
| Browser-specific, secure-cookie guest sessions | Implemented for local preview |
| Private cases and 30-day expiration | Implemented |
| Offer text review: urgency, deposit, no-inspection, off-platform, no-refunds | Deterministic rule matching |
| Automatic offer screenshot reading/OCR | **Not implemented**; user must enter offer text |
| Optional two private screenshot attachments, processed to remove common metadata | Implemented (requires browser image canvas) |
| Time-limited 72-hour seller invitations; random hashed tokens | Implemented |
| Seller voluntary response, decline, abuse reporting | Implemented |
| Claim/evidence comparison and decision report | Implemented, **not independently verified** |
| Print-to-PDF and private JSON export | Implemented |
| Case/session deletion, cross-session access controls, CSRF origin checks | Implemented and tested |
| Founder safety admin review | Local-only password preview, **disabled by default** |
| MFA, live AI provider, identity verification, payment/escrow | Not implemented |
| Cloudflare Workers/D1/R2 hosted production | Migration planned, **not deployed** |

## Run checks

```bash
npm run check
npm test
```

Automated tests cover buyer/seller journey, access isolation, expiration/revocation flow, seller decline, redaction, malformed uploads, origin checks and deletion. Use [docs/API.md](docs/API.md) for live API routes; [docs/CLOUDFLARE_MIGRATION.md](docs/CLOUDFLARE_MIGRATION.md) for the recommended hosted architecture and launch gates.

## Security and operating notes

- All case data is stored in `data/prove.sqlite`; evidence is stored in `data/evidence/`, inaccessible from the public web root. These directories are not included in source control.
- `prove_session` is an `HttpOnly; SameSite=Strict` browser cookie. In public HTTPS mode the `Secure` flag is set with `NODE_ENV=production`, but merely setting that flag does **not** make this preview safe for public hosting.
- The seller's invitation token is stored only as a SHA-256 hash. The plaintext token is returned **once**, so copy it immediately. A new invitation revokes a prior unanswered one.
- Link previews are **never fetched** by the server, reducing SSRF risk. Seller-submitted text is escaped before rendering.
- The browser redraws selected images and uploads JPEG at most 2MB; server checks magic bytes and stores the attachment privately. **This is not a replacement for production malware scanning.** A hardened image-processing sandbox is required before public deployment.
- No external LLM receives consumer data. Risk indicators are limited to what appeared in buyer-submitted text. No objective market price check or independent ownership verification occurs.
- For any public service, replace the in-memory rate limiter with a distributed limiter; add abuse and retention operations, verified accounts, robust origin restrictions, a dedicated audited admin identity provider with MFA, an incident workflow, security testing and Nigerian privacy/legal review.
- Do **not** solicit NIN/BVN, identity cards, payment credentials or biometric video. Do not publish case histories, seller names or allegations.

## Admin — development preview only

To try the safety-report console locally, set `ADMIN_PASSWORD` (16+ chars) and `ADMIN_SESSION_SECRET` (32+ chars) in the shell process environment before launching. The console is **not production-ready** because MFA is not implemented. Its authentication is intentionally disabled if either setting is missing.

## Technology

Zero-dependency Node.js HTTP server; built-in SQLite (`node:sqlite`); vanilla JavaScript, CSS and semantic HTML. This choice makes the MVP immediately runnable with no package installation. The intended production conversion to React/TypeScript and Cloudflare Workers + D1 + R2 is documented, not falsely presented as complete.

© 2026 MABRIG Technologies — https://www.mabrigkorie.org

## v0.2: buyer decision gate and share-safe education

The app now includes a five-step **Decision Gate** in each buyer case. A buyer can mark an independent inspection, ownership context, functionality, payment protections and written terms as not checked, planned, completed (self-reported) or unavailable, and leave a short private note. They can privately record **pause**, **walk away**, or **consider proceeding with precautions**, only after acknowledging that PROVE independently verified nothing. Gate progress and decision appear in the JSON decision report. No "verified seller" or guarantee is issued.

A **Share safety tip** action exports only generic educational advice. It deliberately excludes case identifiers, links, seller answers and suspected wrongdoing. This is not a public reputation board or allegation-sharing tool.

### Deployment reality

This repository is a **runnable Node.js 22+ Docker/long-running-service MVP with local SQLite persistence**, not a one-click Vercel static website or Cloudflare Worker. For hosted use, supply a persistent private data volume, a single writable SQLite instance, HTTPS, monitoring and stronger public-launch protections. See [`docs/CLOUDFLARE_MIGRATION.md`](docs/CLOUDFLARE_MIGRATION.md) for the D1/R2/Workers production migration. **Do not deploy this local guest-session preview as a public consumer safety service without security and privacy review.**
