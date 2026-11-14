# MABRIG PROVE — Cloudflare deployment correction (v0.3)

## Why Cloudflare says “Variables cannot be added to a Worker that only has static assets”

The earlier deployment uploaded only static files. It had no Worker JavaScript entry point, so no runtime variable, secret, D1, R2 or script logging could be configured. The repository now contains `worker/index.mjs` and a root `wrangler.jsonc` declaring both `main` and `assets`.

**The Node.js `server/index.mjs` and `data/prove.sqlite` CANNOT run in a static-assets deployment.** `worker/index.mjs` is the Cloudflare-native equivalent; it uses D1 and R2 bindings, encrypted session cookies and the same user-facing API routes. Do not select “static upload” for this project or point your build at just `public/`.

## Stage A — Correct the static-only deployment without opening the app for real users

1. In Cloudflare **Workers & Pages** > `mabrig-prove` > Settings > Builds, verify that the source is GitHub `mabrig1/MABRIG-PROVE`, branch `main`, project root `/`.
2. Use **Build command:** `npm run check && npm test` and **Deploy command:** `npx --yes wrangler@4 deploy`. Build output directory is **not applicable**, because this is a Worker plus static assets (the assets directory is set inside `wrangler.jsonc`). Avoid a static “output directory = public” deployment.
3. `wrangler.jsonc` must be respected: Worker **main** `./worker/index.mjs`, static assets **directory** `./public`, binding **ASSETS**, routes `run_worker_first: ["/api/*"]`.
4. Trigger a fresh Git-connected deployment, then visit `https://YOUR_WORKERS_URL/api/health`. Initially this intentionally returns HTTP 503 with `database_ready:false` while DB is unconfigured. That is the correct safe setup mode, not a build failure.
5. The Cloudflare **Settings > Variables and secrets** and **Bindings** panes should now allow configuration because the deployment contains executable Worker code. You do **not** need an OpenRouter or Resend key for this version.

**Important:** If Cloudflare Builds still deploys a static-only Worker, Cloudflare may be ignoring the repository `wrangler.jsonc` or the deployed Worker may belong to a different project. Ensure the deployment script is Wrangler, not a generic static-site upload. Check the Deployments build logs for the entrypoint `worker/index.mjs`.

## Stage B — Create the real database and evidence bucket

From a machine logged into the proper Cloudflare account (`npx wrangler login`):

```bash
npx --yes wrangler@4 d1 create mabrig-prove-db
npx --yes wrangler@4 r2 bucket create mabrig-prove-private-evidence
```

Copy the **actual** D1 UUID from the first command into the `wrangler.jsonc` configuration. Add these properties at the root level (do not leave placeholder UUIDs in a deployment):

```json
"d1_databases": [
  {"binding":"DB","database_name":"mabrig-prove-db","database_id":"ACTUAL_UUID_FROM_D1_CREATE"}
],
"r2_buckets": [
  {"binding":"EVIDENCE","bucket_name":"mabrig-prove-private-evidence"}
]
```

Then migrate the D1 database (requires confirmation when running against remote production):

```bash
npx --yes wrangler@4 d1 migrations apply DB --remote
```

If R2 is not available on the account, evidence uploads will return a clear HTTP 503 and **will never be stored in a publicly readable location**. The text-only buyer/seller flow can still work when D1 exists.

## Stage C — Enable only a protected pilot

1. Leave `PROVE_WRITE_MODE` = `locked` for the initial deployment. This prevents creation of sessions and cases by the public, even if the Worker is reachable.
2. Add a Cloudflare **Access** policy to protect the pilot, and enforce rate limiting with Cloudflare WAF/Rate Limiting. The Worker has an additional basic D1-backed hourly write limit, but that is not a substitute for network-edge abuse protection.
3. Arrange a privacy review, vulnerability testing, evidence retention controls and MFA-protected administrative workflow before onboarding any third-party data.
4. Once ready for a closed pilot, change the value in `wrangler.jsonc` to `pilot`, commit, and redeploy. If you change runtime vars only in the dashboard, note that a future Wrangler deploy can overwrite dashboard-managed settings; use the committed file as source of truth.
5. Visit `/api/health` and require `ok:true`, `database_ready:true`, `write_mode:"pilot"`, and `evidence_storage_ready:true` if attachments are enabled. Do not mistake an HTTP 200 at `/` (static homepage) for a ready API.
6. Test one **synthetic** buyer case and seller response in a protected staging environment before accepting real information.

## Required acceptance checks

- `npm run check && npm test` both pass.
- `npx --yes wrangler@4 deploy --dry-run` produces a Worker bundle with `worker/index.mjs` as entry point, not an assets-only Worker.
- Cloudflare dashboard allows runtime variables and bindings.
- `/api/health` returns truthful DB/write readiness.
- Buyer access to another user's case returns 404.
- Seller invitation contains no buyer offer details; expired/revoked links cannot respond.
- Evidence is only accessible through authorized API requests; no public R2 bucket or unprotected URLs.

## Rollback

Keep `PROVE_WRITE_MODE="locked"` while rolling back. Cloudflare Deployments can roll back to a previous Worker version. If reverting to a static-only deployment, API operations will again be unavailable. Database migration is additive; **do not drop D1 tables** to roll back code.

## Known release restrictions

No automatic image understanding, bank account checks, biometric KYC or verified-seller status exists. The rules engine does not independently authenticate goods or owners. The default locked mode intentionally requires the owner to enable closed-pilot writes. Production public rollout still requires reviewed privacy policies, operational monitoring, backups, data retention cleanup and security testing.

