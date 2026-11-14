# Cloudflare migration and safe launch plan

Current status: functional **local MVP**, not a hosted consumer service. Production hosting should be redesigned around Cloudflare rather than placing this file-system SQLite server directly into an edge runtime.

## Recommended stack

- **UI:** React + TypeScript + Vite PWA, published on Cloudflare Pages or Workers Static Assets.
- **API:** Hono + Zod on Cloudflare Workers; versioned `/v1` routes.
- **Data:** Cloudflare D1 with explicit migrations, indices, foreign keys and retention jobs.
- **Evidence:** private R2 bucket. Browser-origin uploads via short-lived scoped URLs and hardened transcoding/AV pipeline, without making originals publicly accessible.
- **Async analysis:** Cloudflare Queues + dead-letter queue for provider outages. Review regional and data processor privacy requirements before sharing case data with any external AI provider.
- **Auth:** secure verified login and explicit guest-to-account migration; avoid session fixation. Owner admin uses a dedicated identity provider with required MFA and audit events.
- **Abuse protection:** Turnstile, distributed rate limits, quotas per session, incident queue, invitation-revocation, report takedown, anomaly detection.
- **Secrets:** Cloudflare secret bindings (not in Git or browser bundles). Model budget ceiling, circuit breakers and disable switches.

## Migration sequence

1. Establish new **private** GitHub repository, CI, code scanning and preview environment (not connected to production domain).
2. Reimplement local SQLite access with D1 prepared statements and the existing case/session permission tests.
3. Move private evidence attachments to R2 with least-privilege authorization and lifecycle rules; verify metadata sanitization, malware processing and file deletion.
4. Add a dedicated async analysis contract with strict input/output schemas, bounded model calls and fallback to the existing rules engine. Validate against a de-identified evaluation set. Never promise seller safety.
5. Add signed consent notices, owner-account recovery, seller report/withdrawal, transparent retention, privacy requests and local support workflows.
6. Add hardened admin SSO + MFA, abuse triage, logs without case payloads, error budgets, rate limiting and alerting.
7. Perform Nigerian Data Protection Act/GAID review, threat modeling, accessibility audits, load tests, full end-to-end and rollback rehearsals.
8. Obtain explicit founder approval before exposing the service publicly, connecting payments or processing real consumer disputes.

## Explicit blockers for public launch

- No independent malware scanning or image quarantine.
- No MFA or production-grade identity provider.
- No provider data-processing agreement, legal/privacy signoff or audited transfer controls.
- No distributed rate-limiting or abuse escalation operations.
- No external corroboration or market intelligence; source material is only buyer/seller provided.
- No production observability, backups, SLO alerting or restoration drills.

**Never deploy the local experimental version with live consumer evidence to a public domain without addressing these blockers.**
