---
title: "MABRIG PROVE — Product Requirements, Architecture & MVP Implementation Blueprint"
subtitle: "Proof-to-Decision Engine | Version 1.0 | 14 November 2026"
author: "MABRIG Technologies"
date: "14 November 2026"
---

# Executive summary

**Product:** MABRIG PROVE  
**Promise:** “Before You Trust It, Make It Prove It.”  
**Status:** Proposed product specification; not yet implemented, tested or deployed.  
**Recommended launch:** Nigeria-first, mobile-first progressive web app (PWA), initially focused on social-commerce purchases of phones, laptops and similar goods.  
**Proposed web address:** `prove.mabrigkorie.org` (subject to configuration and availability).

MABRIG PROVE is a privacy-conscious consumer decision-support service. A buyer pastes an offer or uploads an advert screenshot, receives a structured list of claims and missing evidence, sends the seller a targeted proof request, and reviews a report comparing the original claims with what the seller supplied. The service must distinguish **claim made**, **evidence provided**, **independently corroborated**, and **still unknown**. It never guarantees safety, ownership, authenticity, or a legitimate transaction.

The defensible product opportunity is not “the first scam detector”; existing services already analyze scam messages or verify sellers. The proposed differentiation is the **end-to-end, consent-based buyer-to-seller evidence workflow**, with verifiable provenance of evidence submissions, uncertainty-aware results, and shareable privacy-preserving educational summaries. Novelty must be validated through competitive research and user testing.

# 1. Product strategy and scope

## 1.1 Problem and jobs to be done

Social-commerce buyers often face attractive prices and urgent payment demands without clear ways to check product possession, specific condition, seller claims, or the legitimacy of delivery promises. Screenshots and seller videos can be fabricated, stolen or reused. Manual checking is inconsistent and difficult for non-technical buyers.

**Primary job:** “Before I pay a person I met online, help me identify what is missing, ask for the right proof, understand the evidence I receive, and decide on a safer next step.”

**Secondary job:** “As a legitimate seller, give me a straightforward, non-intrusive way to respond to reasonable evidence requests without handing my identity documents to strangers.”

**Out-of-scope judgment:** MABRIG PROVE is not a bank, escrow agent, certified identity provider, detective, law-enforcement body, or guarantor of transactions.

## 1.2 Target users

| Persona | Context | Key need | Important constraint |
|---|---|---|---|
| Student buyer | Used iPhone or laptop advertised on WhatsApp | Check offer before paying | Low data usage; simple language |
| Parent | Purchases from an unfamiliar Instagram seller | Know what questions to ask | No technical knowledge |
| Honest seller | Responding to buyer skepticism | Provide limited proof | Privacy and anti-harassment |
| Support reviewer | Handles reported harmful or manipulated submissions | Resolve cases fairly | Auditability and role separation |
| Founder/admin | Owns product operations | Monitor quality and abuse | Strong authentication and scoped access |

## 1.3 Launch positioning

Lead with **“Check that phone or laptop deal before you pay.”** Support text, screenshot and URL inputs from day one. Introduce rental, job, scholarship and service-contract flows only after the initial evidence workflow proves useful. A narrow starting use case produces better challenge templates, fewer false claims, and clearer marketing.

## 1.4 Outcomes and metrics

- **North-star indicator:** weekly completed decision sessions in which a buyer sees the evidence comparison and selects a next step.
- Activation: proportion of new visitors who complete a first offer analysis.
- Challenge creation: proportion of completed analyses producing a seller request.
- Seller participation: percentage of delivered challenges receiving any response.
- Decision utility: percentage of sampled users who report that the explanation was useful, independently of whether they purchased.
- Retention: weekly returning buyers, excluding forced return via email links.
- Growth: privacy-safe summary shares, referral visits, and earned social followers (tracked separately from app users).
- Safety: substantiated false allegations, harassment reports, leakage incidents, successful account compromise, and unsupported “verified safe” output rate.

**Pilot targets, not forecasts:** 1,000 offer analyses, 200 proof requests, 100 return visitors within 30 days of pilot availability; inspect conversion and harm metrics before scaling. Do not advertise one million followers as an expected result.

# 2. User experience and core journeys

## 2.1 Buyer journey

1. Open landing screen → tap **Check an Offer**; no mandatory registration for a one-off analysis.
2. Choose **Paste text**, **Upload screenshot**, or **Paste link**. For links, v1 analyzes the URL structure and user-supplied descriptions/screenshots; it must not blindly visit an untrusted site.
3. Review highlighted personal information for masking before any AI transmission. User confirms permitted processing and sees retention disclosure.
4. App extracts offer claims and risks; presents **Evidence present**, **Evidence missing**, **Potential contradictions**, and **Recommended checks** with explicit uncertainty.
5. Buyer chooses **Request proof**. App generates a precise set of reasonable requests, such as a recent item-specific video showing a temporary code, a battery-health screenshot and a safe in-person inspection suggestion.
6. Buyer manually copies/sends invitation using WhatsApp or another channel. The app does not secretly contact the seller.
7. Seller opens a scoped invitation and submits a voluntary response, or declines. Buyer receives an opt-in notification.
8. App compares seller evidence with recorded claims and generates an updated report and recommended next steps.
9. Buyer can save privately, delete, or share a **redacted summary**. Seller can report abuse and request correction/deletion where applicable.

## 2.2 Seller journey

Invite → clear explanation of who requested the check and what data is asked for → optional consent → submit response (text plus limited media) → review all fields → submit → receipt → optional appeal, decline or withdrawal request. Seller needs no buyer email or phone number; buyer never sees raw seller account identifiers unless seller explicitly chooses to share them.

**No compulsory selfie, NIN, BVN, government ID or biometric identification in MVP.** A challenge-response video is *not proof of ownership or liveness*. Avoid collecting identity materials merely to create an illusion of certainty.

## 2.3 System states

`DRAFT → SUBMITTED → ANALYZING → ANALYSIS_READY → CHALLENGE_SENT → SELLER_RESPONDED → REASSESSING → REPORT_READY → CLOSED/EXPIRED/DELETED`

Alternate states: `ANALYSIS_FAILED` (retry allowed), `SELLER_DECLINED`, `UNDER_REVIEW`, `ABUSE_BLOCKED`, `CANCELLED`. Status changes should be validated server-side and logged.

# 3. Screens and interaction specifications

All screens are designed for a 360px-wide mobile viewport before desktop expansion. Brand direction: deep navy, warm white, restrained teal, amber for caution, red only for clear warnings. Do not use a reassuring green “safe seller” badge. System font with clear typography, 44px minimum touch targets, captions, alt text, good contrast, and keyboard access.

| ID | Screen / route | Core components and microcopy | Primary action and states |
|---|---|---|---|
| S01 | Landing `/` | Headline “Check that online deal before you pay”; 3-step explainer; supported examples; limitations; privacy promise | **Check an offer**; no fake testimonials or statistics |
| S02 | New check `/check/new` | Tabbed text / screenshot / URL; preview; optional asking price and item category | **Review my information**; input validation, drag/drop and camera capture |
| S03 | Redaction & consent `/check/review` | Visible sensitive-data suggestions; redact phone, address and banking details; consent and third-party notice | **Analyze safely**; user can edit/redact or cancel |
| S04 | Analysis progress `/check/:id/status` | Stage indicators: securing evidence, reading offer, identifying claims, preparing steps | Automatic transition; timeout, cancel, retry, failure explanation |
| S05 | Offer assessment `/check/:id` | Claim ledger, evidence-status chips, observed warning signals, unknowns, next steps, prominent limitations | **Request specific proof**, **Save**, **Delete** |
| S06 | Proof request editor `/check/:id/request` | Editable checklist, challenge code, expiry, preview of seller-facing text | **Generate private link**; prevent excessive/irrelevant demands |
| S07 | Share invitation `/check/:id/invite` | Copy link, WhatsApp share intent, expiry and revocation; “We will not contact the seller for you” | **Copy link**, **Revoke**, **View status** |
| S08 | Seller introduction `/prove/:token` | Purpose, asked-for proof, privacy summary, expiry, requester alias, abuse report button | **Respond**, **Decline**, **Report abuse** |
| S09 | Seller response `/prove/:token/respond` | Response fields, limited photos/video, permissions, preview and terms | **Submit response**; upload progress, save draft, validation |
| S10 | Evidence comparison `/check/:id/compare` | Side-by-side claim / submitted evidence / interpretation / what cannot be established | **View decision report**; no false certainties |
| S11 | Decision report `/check/:id/report` | Concise conclusion, supported/contradicted/unknown facts, alternative safer actions, timestamps and limitations | **Create redacted summary**, **Delete** |
| S12 | Optional case library `/cases` | Account sign-in, case cards, filters, retention dates, deletion control | **Open case**; empty state and export |
| S13 | Privacy, help & dispute `/help` | Clear policy, account/data deletion, report harmful content, appeal an assessment | **Submit report/request**; public contact channel |
| S14 | Admin console `/admin` | Abuse queue, model errors, data-retention jobs, cost budget, feature flags, access logs | Role-gated **Review / Restrict / Resolve** |

### S02 low-fidelity mobile layout

```text
┌──────────────────────────────────┐
│ ◇ MABRIG PROVE                  │
│ Check an online offer            │
│                                  │
│ [Screenshot] [Paste text] [Link] │
│ ┌──────────────────────────────┐ │
│ │  Upload offer screenshot     │ │
│ │  JPG / PNG / WebP             │ │
│ └──────────────────────────────┘ │
│                                  │
│ Category: [Phone / Laptop  v]   │
│ Advertised price: [Optional  ]  │
│                                  │
│ [ Review my information       ] │
│ We never guarantee seller safety │
└──────────────────────────────────┘
```

### S05 low-fidelity mobile layout

```text
┌──────────────────────────────────┐
│ Offer review                     │
│ STATUS: Evidence incomplete      │
│                                  │
│ CLAIM      “Original iPhone”     │
│ EVIDENCE   Seller advert only    │
│ RESULT     Not independently     │
│            established           │
│                                  │
│ WATCH FOR                        │
│ • Pressure to pay a deposit      │
│ • Unclear inspection policy      │
│                                  │
│ NEXT STEPS                       │
│ [ Request specific proof       ] │
│ [ Save private report          ] │
│ Not a guarantee or accusation    │
└──────────────────────────────────┘
```

### S10 low-fidelity mobile layout

```text
┌──────────────────────────────────┐
│ Compare the seller's response    │
│                                  │
│ CLAIM: In seller's possession    │
│ REQUEST: Video showing code 4821 │
│ RECEIVED: Video with code 4821   │
│ RESULT: Response matched request │
│ LIMIT: Ownership not proven      │
│                                  │
│ CLAIM: No repairs                │
│ RECEIVED: No evidence supplied   │
│ RESULT: Still unknown            │
│                                  │
│ [ See next safest steps        ] │
└──────────────────────────────────┘
```

**Copy rules:** Prefer “the evidence does not establish this claim” over “the seller is a scammer”; prefer “additional independent inspection recommended” over “this deal is verified”. Warn the user about advance payments, off-platform redirects and sharing financial information without issuing categorical allegations.

# 4. Functional product requirements

| ID | Priority | Requirement | Acceptance condition |
|---|---|---|---|
| FR-01 | P0 | Guest first-analysis | Visitor can start and receive result without registering |
| FR-02 | P0 | Secure upload and redaction | Max 2 images, 8MB each; type and content validated; EXIF removed; private storage |
| FR-03 | P0 | URL and pasted-text intake | Valid URL parsing; no automatic fetch of arbitrary sites |
| FR-04 | P0 | Claim extraction and structured response | Claims include source excerpt, evidence status and uncertainty; schema validated |
| FR-05 | P0 | Deterministic warnings | Rule catalogue for urgency, deposit pressure, address mismatch claimed by user, and inability to inspect; no invented indicators |
| FR-06 | P0 | Proof challenge | Context-aware editable checklist; random code; expiry 72h (configurable); revocable token |
| FR-07 | P0 | Seller submission | No buyer details; voluntary consent; one active response per challenge with replacement audit |
| FR-08 | P0 | Evidence comparison | Each finding refers to specific claim and submitted evidence; absence not treated as proof of guilt |
| FR-09 | P0 | Private report | Clearly split supported / contradicted / unknown; safe next steps and disclaimer |
| FR-10 | P0 | Reporting and deletion | Both parties can flag abuse; owners can delete case and media subject to disclosed legal exceptions |
| FR-11 | P0 | Admin safety operations | MFA, role-gated review, record access audit, takedown controls |
| FR-12 | P0 | Observability | Traces, usage, failure codes, AI budget caps without storing raw personal content in logs |
| FR-13 | P1 | Optional emailed account and library | Email magic link; only verified user sees their own prior cases |
| FR-14 | P1 | Redacted share-card | User previews exactly what becomes shareable; no names, images or direct accusations |
| FR-15 | P1 | Seller response notification | Only to buyer who opted in; anti-spam limits |
| FR-16 | P2 | Rentals and jobs templates | Distinct checklists and risk categories after product pilot |
| FR-17 | P2 | Third-party independent inspection | Only through vetted human partners and separate contracts |
| FR-18 | P2 | Escrow/payment integration | Only with appropriately licensed payment/escrow providers |

**Excluded from v1:** official identity verification, facial recognition, auto-contacting sellers, bank lookup, scraping personal profiles, public seller blacklists, crowdsourced accusation feeds, “verified safe” badges, funds custody, payment collection, automatic consumer-law complaint filing, or claims of governmental endorsement.

# 5. Evidence and AI decision engine

## 5.1 Four-layer processing pipeline

**Layer A — Input security:** check authentication/session and rate limit; validate file types by actual content; re-encode images; strip EXIF; handle malware and oversized assets in isolated processing; scan for personal data; store as private evidence with tenant ownership and time-to-live. URL only parsed in v1.

**Layer B — Claim extraction:** AI extracts item, price, location as voluntarily disclosed, promised condition, delivery expectation, payment urgency and explicit factual claims. Every extracted claim includes a source pointer (e.g., text span or screenshot reference); unsupported inferred details are rejected.

**Layer C — Rules and targeted proof:** deterministic rules flag missing return terms, payment-before-inspection pressure, ambiguous product identity or inconsistent amounts. A rule catalog generates minimal relevant evidence requests. LLM can rewrite for readability but cannot add invasive requirements or remove core safety disclaimers.

**Layer D — Reconciliation:** compare incoming evidence to pre-existing claim IDs. Return a status for each: `supported_by_submission`, `contradicted_by_submission`, `not_supported`, or `cannot_assess`. An additional `independently_corroborated` status is reserved for future checks against genuinely independent external sources. *A seller-submitted image alone does not constitute independent corroboration.*

## 5.2 Risk presentation model

Do not launch a magic 0–100 “trust score”. Instead expose an explainable **attention level** — `STANDARD_CHECKS`, `IMPORTANT_GAPS`, `URGENT_CAUTION` — derived from known rule signals and accompanied by facts, not probabilities. A high concern level is not a criminal finding; low concern is not a safety guarantee. If inputs are insufficient, show `INSUFFICIENT_INFORMATION` rather than a false assessment.

| Signal | Rule source | Presentation | Required action |
|---|---|---|---|
| Pressure to pay immediately | Quoted advert language | “Urgency or pressure was stated” | Encourage cooling-off and independent check |
| Deposit required before inspection | Seller claim | “Upfront payment requested” | Explain risk; suggest safer payment pathway |
| Seller supplies challenge-code video | Media metadata + content analysis | “Response appears to match current challenge” | Warn that staged media are possible |
| Product condition cannot be checked | Missing evidence | “Condition not established” | In-person or professional inspection |
| Unfamiliar URL | URL parser | “Link destination unconfirmed” | Do not auto-visit; explain manual verification |

## 5.3 AI output contract (illustrative)

```json
{
  "case_id": "case_01HX...",
  "assessment_version": "v1",
  "attention_level": "IMPORTANT_GAPS",
  "claims": [
    {
      "id": "claim_01",
      "text": "The phone has never been repaired",
      "source_asset_id": "asset_01",
      "source_excerpt": "Never repaired",
      "status": "not_supported",
      "explanation": "Only an advertisement statement is available."
    }
  ],
  "signals": [{"code": "UPFRONT_PAYMENT", "source_claim_id": "claim_02"}],
  "unknowns": ["Ownership and physical condition have not been established"],
  "recommended_actions": ["Arrange a safe inspection before payment"],
  "limitations": ["No guarantee of seller legitimacy or product authenticity"]
}
```

Validate the result with a versioned Zod/JSON schema; invalid output should trigger one bounded retry, then deterministic fallback or a clear error. Reject citations that do not point to case-local evidence. Maintain a prompt/model/version log without retaining raw prompts in telemetry.

## 5.4 AI privacy boundary

For OpenRouter (or any broker), explicitly permit only reviewed provider/model routes with appropriate retention terms, disable content logging, and use provider restrictions/zero-data-retention controls where supported. Redact unnecessary personal data *before* transmission. Models are untrusted reasoning components, not authoritative truth engines. An assessment must not invent external verification or fabricate database checks.

# 6. Proposed application architecture

## 6.1 Technical decisions

**Recommended v1:** React + TypeScript + Vite PWA for a robust, low-complexity client; Cloudflare Workers with Hono for the API; Cloudflare D1 for case metadata; private Cloudflare R2 for evidence; Cloudflare Queues for asynchronous analysis; Turnstile for abuse protection; Resend for optional email; an explicit allowlist of OpenRouter model/provider options for inference. Tailwind CSS and accessible UI components; Drizzle ORM for migrations. DNS, secrets and deployment remain separate from source code.

This favors a simple client/API split and avoids relying on beta compatibility for a new Next.js-on-Workers application. If adopting Next.js for shared company conventions, Cloudflare's current preferred path is **vinext**, which is documented as beta and therefore needs compatibility tests before production adoption.

```text
                     Buyer / Seller mobile browser
                                 |
                      React/Vite installable PWA
                                 |
                        Cloudflare WAF + TLS
                                 |
                      Cloudflare Worker API
                           (Hono + Zod)
           ┌─────────────────────┼──────────────────────┐
           |                     |                      |
       D1 metadata          Private R2            Turnstile / Auth
     cases, claims,      evidence objects         sessions, one-use
     permissions         sealed access            scoped invitations
           |                     |                      |
           └─────────────────────┼──────────────────────┘
                                 |
                        Cloudflare Queue
                        analysis jobs + DLQ
                                 |
                       Analysis Worker
                  rules + redaction + AI adapter
                                 |
                    Reviewed OpenRouter provider
                    (optional; bounded inference)
                                 |
                        Structured comparison
                                 |
                 D1 report + private buyer update
                                 |
                   Optional Resend notifications
```

## 6.2 Trust boundaries and storage

- **Client → API:** HTTPS, rate limiting, CSRF protections where cookie authentication applies, strict input schemas, short session lifetime.
- **Invited seller:** scoped capability token stored only as a server-side hash; expires and revocable; no right to read unrelated cases or buyer evidence.
- **API → R2:** server-generated limited upload permissions, randomized object keys and private buckets; no public object listing. Download via short-lived authorized access.
- **Worker → LLM:** process minimized snippets or sanitized media only, explicitly opt in where needed, limit model spending and timeouts.
- **Admin:** separate role with strong authentication/MFA, non-public route, audited actions, no hard-coded email superuser or embedded credentials.
- **Data residency:** cross-border AI/vendor transfers require documented assessment, lawful basis, notice and provider contracts before live use.

## 6.3 Data schema

| Table | Key fields | Purpose |
|---|---|---|
| `users` | `id`, `email_hash`, `created_at`, `status` | Optional user library; email held separately/encrypted if needed |
| `sessions` | `id`, `owner_user_id?`, `session_hash`, `expires_at` | Revocable anonymous or signed-in sessions |
| `cases` | `id`, `owner_session_id`, `category`, `status`, `attention_level`, `created_at`, `purge_at` | Root private case |
| `evidence_assets` | `id`, `case_id`, `uploader_role`, `object_key`, `sha256`, `mime`, `size`, `scan_status`, `purge_at` | Private evidence metadata |
| `claims` | `id`, `case_id`, `source_asset_id?`, `claim_text`, `source_excerpt`, `claim_status` | Source-grounded offer claims |
| `assessments` | `id`, `case_id`, `version`, `structured_json`, `model_id`, `created_at` | Immutable assessment snapshots |
| `proof_requests` | `id`, `case_id`, `token_hash`, `challenge_code`, `expires_at`, `revoked_at`, `request_json` | One scoped seller invitation |
| `proof_responses` | `id`, `request_id`, `response_json`, `submitted_at`, `consent_record_id` | Seller responses and consent |
| `consent_records` | `id`, `subject_role`, `notice_version`, `purpose`, `created_at` | Consent/notice evidence |
| `safety_reports` | `id`, `case_id?`, `reporter_role`, `reason`, `status`, `created_at` | Abuse escalation |
| `audit_events` | `id`, `actor_role`, `subject_id`, `action`, `created_at` | Minimal security audit trail |
| `deletion_jobs` | `id`, `case_id`, `requested_at`, `status`, `completed_at` | Data-removal workflow |

**Constraints:** foreign keys and indexes on ownership and expiration; unique idempotency keys for submissions and jobs; object hashes for integrity and duplicate detection (not authenticity); version every comparison; soft-delete only for short recovery period when lawful and disclosed, followed by verified purge.

## 6.4 API contract v1

| Method | Endpoint | Caller | Behavior |
|---|---|---|---|
| `POST` | `/v1/sessions/guest` | Visitor | Issue short-lived signed session or secure cookie |
| `POST` | `/v1/cases` | Buyer | Create draft with ownership |
| `POST` | `/v1/cases/:id/assets/presign` | Buyer/seller (scoped) | Validate requested media and return short-lived authorized upload |
| `POST` | `/v1/cases/:id/assets/confirm` | Uploader | Verify actual object, size, content signature, scan and ownership |
| `POST` | `/v1/cases/:id/analyze` | Buyer | Enqueue idempotent analysis; return `202` and job status |
| `GET` | `/v1/cases/:id` | Case owner | Return only authorized case summary |
| `GET` | `/v1/cases/:id/report` | Case owner | Return latest source-linked result |
| `POST` | `/v1/cases/:id/proof-requests` | Buyer | Validate and create limited invitation |
| `POST` | `/v1/proof/:token/respond` | Seller | Submit scoped response with consent |
| `GET` | `/v1/proof/:token` | Seller | Show request only; no buyer case details |
| `POST` | `/v1/cases/:id/reassess` | Buyer / job | Async comparison after response |
| `POST` | `/v1/reports` | Any user | Abuse, incorrect assessment or privacy report |
| `DELETE` | `/v1/cases/:id` | Case owner | Tombstone and queue actual data removal |
| `POST` | `/v1/cases/:id/share-summary` | Buyer | Create explicitly redacted share content |
| `GET` | `/v1/admin/queue` | Safety reviewer | Authenticated flagged-case list |

**Common response shape:** `{ "data": ..., "request_id": "req_..." }`; errors `{ "error": { "code": "CASE_NOT_FOUND", "message": "..." }, "request_id": "..." }`. Ensure error messages do not disclose another party's case existence. Rate-limit guest analyses, invitations, submissions and reports separately. All mutation routes need idempotency and ownership checks.

# 7. Safety, privacy, compliance and abuse response

## 7.1 Legal and ethical design

Nigeria's **Data Protection Act 2023** governs processing of personal data and includes requirements relating to lawful basis, information notices, security, individual rights, breach handling and cross-border transfers. The **NDPC General Application and Implementation Directive (GAID) 2025** provides additional implementation guidance. Obtain qualified Nigerian legal/privacy review, determine obligations for a DPIA, applicable registration or DPO requirements, cross-border processing and contractual controls **before** processing live third-party evidence.

- Separate notice and lawful-basis analysis for buyers and sellers; do not assume buyer consent covers a third-party seller.
- Explain which media may be sent to the AI provider; limit transmission to necessary data.
- Provide notice, user access/deletion request intake, correction and objection procedures.
- Never expose raw evidence publicly by default.
- Set sample v1 TTLs: guest case 14 days, opted-in saved case 30 days, unused seller invitation 72 hours, operational audit metadata 90 days; final retention must be reviewed and exceptions recorded. Automatically purge R2 objects and backup replicas according to platform capabilities and disclosed timelines.
- Anonymous educational shares require explicit preview and consent, as de-identification can fail if the offer is recognizable.
- Consumer complaint links may direct users to the official FCCPC complaint service, without falsely implying affiliation or automatic filing.

## 7.2 Threat model and mitigations

| Threat | Severity | Mitigation and release gate |
|---|---|---|
| Seller document/video forgery or replay | High | Challenge codes, time-boxing, independent inspection recommendation; never claim proof of ownership |
| False accusations or defamation | High | No public seller blacklist; neutral language; appeals and moderator review |
| Unauthorized access to private evidence | Critical | Strict case ownership, scoped signed requests, private R2, access logs, penetration testing |
| Token enumeration / link leakage | High | 192-bit+ random tokens, hashed at rest, TTL, revocation, no embedding token in analytics/referrer logs |
| Malicious files or parser exploit | Critical | Allowlisted types, signature checks, re-encoding, resource limits, malware scanning and quarantined processing |
| Prompt injection in screenshots/advert text | High | Treat media/text as hostile data, fixed system instructions, schema validation, no tool privileges from model output |
| SSRF via pasted seller URL | High | No server-side URL fetch in MVP; later use egress sandbox and strict network policy |
| Abuse of seller invitations | High | Rate limits, invitation revocation, harassment reports, moderation and email/phone non-disclosure |
| Model hallucination of external checks | High | Every claim tied to local source; forbidden “verified via registry” without a real trusted integration |
| AI billing exhaustion / bot swarm | Medium | Turnstile server verification, quotas, queue caps, concurrency budgets, spend alerts |
| Seller manipulation of generated proof report | High | Report always distinguish seller-provided material from independent corroboration |

**Incident response:** suspend affected flows, preserve minimal audit evidence, notify appropriate internal owners, assess breach reporting obligations under Nigerian law, and communicate accurately to affected parties where required.

# 8. Non-functional standards and service objectives

- **Availability target:** 99.5% monthly target after pilot, explicitly non-contractual initially.
- **Perceived performance:** initial interactive screen target under 3 seconds on a typical 4G Android device when cached; instrument real-world metrics.
- **Async analysis:** visible job progress; no blocking the HTTP request for long AI inference; show retry if queue/model fails.
- **Accessibility:** WCAG 2.2 AA target; test screen readers, zoom, keyboard and error announcement.
- **Localization:** English MVP; Nigerian Pidgin helpful-content experiments after testing; do not misrepresent machine translations as certified advice.
- **Resilience:** retries with dead-letter queue, queue idempotency, backpressure, circuit breaker for AI providers, deterministic fallback for partial outages.
- **Observability:** structured logs without raw offers, logs with request IDs, latency/error dashboards, R2/D1 usage and model cost per successfully analyzed case.
- **Quality:** all public claims backed by a reproducible internal evaluation and clear publication date.

# 9. Development repository and delivery topology

```text
mabrig-prove/
├── apps/
│   ├── web/               # React/Vite PWA, routes, forms, accessibility
│   ├── api/               # Hono Worker routes, auth, validation, security
│   └── analyzer/          # Cloudflare Queue consumer and rule engine
├── packages/
│   ├── domain/            # status enums, privacy policy rules, business logic
│   ├── schemas/           # Zod request, response and AI output contracts
│   ├── evidence/          # redaction, validation, controlled object access
│   ├── ai/                # provider adapter, prompts, costs and safe fallback
│   └── ui/                # accessible design system
├── db/migrations/         # D1 SQL migrations
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── privacy-retention.md
│   └── evaluation-protocol.md
├── tests/
│   ├── fixtures/          # synthetic scams and legitimate offers
│   ├── integration/
│   ├── e2e/
│   └── security/
├── .github/workflows/      # tests and deployment gates
└── README.md
```

**Environments:** local → isolated preview (synthetic data, fake email and AI stubs) → restricted live pilot (real users only after privacy gates) → public. Do not merge or deploy by default. Preview and production must have separate Cloudflare bindings, secrets, buckets, D1 databases, queues and domain names.

**Config names (placeholders only):** `APP_ENV`, `APP_ORIGIN`, `SESSION_SIGNING_KEY`, `R2_BUCKET`, `DB`, `ANALYSIS_QUEUE`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_ALLOWLIST`, `RESEND_API_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_IDP_ISSUER`, `LOG_LEVEL`, `CASE_TTL_DAYS`, `AI_MONTHLY_BUDGET_USD`. Store secrets in Cloudflare-managed secret storage; never commit them or forward to the browser.

# 10. MVP sprint plan: six weeks

**Team assumption:** 1 product/UX lead, 2 full-stack engineers, part-time security/privacy reviewer, and a part-time tester/content reviewer. Timing is an illustrative sequencing estimate, not a guarantee.

| Sprint | Outcomes | Work items | Definition of done |
|---|---|---|---|
| Week 1 — Foundation | Clickable experience + safe infrastructure | Define copy and user research; responsive design system; Vite/Worker monorepo; D1 migrations; synthetic demo records; preview-only CI | Buyer can traverse S01–S05 on mocked data; no public deployment |
| Week 2 — Secure intake | Working private case storage | Guest sessions; ownership middleware; screenshot intake and redaction; R2 private uploads; content scanning; retention scheduler | E2E test confirms unrelated guests cannot access cases; uploads rejected if malformed |
| Week 3 — Analysis | Source-grounded offer reports | Claim extractor; rule engine; model adapter; queue + DLQ; schema validator; cost limits; progress UI | 30 synthetic fixtures have grounded references and no fabricated external checks |
| Week 4 — Proof workflow | Buyer–seller interaction | Challenge templates; expiring invitation; seller submission and consent; response review; comparison | Complete scripted two-person flow, plus expiry/revocation/malicious-response tests |
| Week 5 — Trust & operations | Admin and abuse protections | Reports/appeals; safety moderation queue; privacy requests; deletion jobs; Turnstile and rate limits; accessibility | Security tests pass; data deletion works; abuse report triage works |
| Week 6 — Pilot readiness | Measured launch candidate | Performance, mobile testing, pilot consent documents, legal sign-off, failure drills, analytics, tutorial clips | Release checklist signed and restricted pilot ready for manual approval |

## 10.1 Prioritized engineering backlog

**P0 stories (must ship):** secure anonymous session; create draft case; upload sanitized image; paste text/URL safely; create claim ledger; show attention level with explanation; generate proof challenge; private seller reply; compare evidence; private report; revoke/delete; user abuse report; admin moderation; spend controls; CI and security test gate.

**P1 stories (after first end-to-end success):** opt-in email notification, account library, redacted export/share, seller feedback survey and improved templates. Add Nigerian Pidgin support only if user research supports it.

**P2 stories (not MVP):** native mobile applications; rented-apartment workflow; job offer workflow; outside identity verification; licensed transaction protection partnerships; B2B API.

## 10.2 Core automated tests

| Test | Expected behavior |
|---|---|
| Offer includes unsupported claim | Assessment marks claim `not_supported`, never “false” unless contradicted |
| Video includes correct challenge code | Says code matched; never concludes identity or ownership verified |
| Seller declines invitation | Buyer sees “declined”; no automatic negative fraud label |
| AI returns malformed JSON | Validate, bounded retry, clear fallback; no half-formed report |
| Screenshot contains “ignore all instructions” | Treated as quoted case data; no prompt/tool manipulation |
| Buyer A requests Buyer B case | `403` or opaque `404`; never leaks case existence |
| Expired/revoked invite is opened | No access or upload; user-friendly expired message |
| Disguised executable uploaded as JPEG | Reject/quarantine before any public access |
| Attacker submits private-network URL | No outbound fetch; no SSRF |
| Data deletion requested | R2 assets and D1 case removed or justifiably retained according to disclosed policy; audit confirmation |
| Admin account lacks MFA or scope | Console access denied |
| User shares report | Preview redacts identity, direct contact, raw media and unsupported accusations |
| AI provider unavailable | Queue retries under limit and reports temporary unavailability; no invented result |

# 11. Evaluation, release gates and operational safeguards

## 11.1 Dataset and evaluation

Collect **consented, de-identified or synthetic** test examples across obvious scams, legitimate offers, ambiguous offers and adversarial material. Minimum pilot evaluation set: 150 examples, including at least 40 legitimate-looking offers and 30 ambiguous cases. Have two human evaluators independently label each example; adjudicate disagreements. Track harmful false certainty, missed clear red flags, unsupported claims, request usefulness, and retention/privacy issues. There is no one-number “accuracy” claim until a transparent benchmark exists.

## 11.2 Pilot launch gates

1. All P0 flows pass buyer/seller E2E tests on phone-sized screens and desktop.
2. Privacy notice, terms, seller consent and retention policy reviewed by counsel as appropriate.
3. Secret scan, dependency checks, upload security, access-control tests and penetration review completed.
4. AI tests show **zero** outputs that assert verified ownership or guaranteed legitimacy on benchmark fixtures.
5. Deletion/expiry and token revocation tested against actual preview R2/D1 resources.
6. Monitoring, incident owner, safety review queue, budget limits and kill switches configured.
7. Human review owner can pause all invitation links or AI analysis independently.
8. Founder expressly approves any actual deployment to a public domain.

## 11.3 Rollback

Keep one known-good release artifact; use safe database migrations (expand/contract with backups and rollback plans); configure feature flags for AI, uploads, seller replies and sharing; never rely on rolling back D1 schema blindly. Preserve deletion jobs during rollback; do not resurrect purged personal evidence. Disable suspicious capabilities centrally in an incident.

# 12. Business model and growth experiments

**Launch:** a bounded number of free first-time analyses to remove friction, subject to reasonable anti-abuse caps; neither a paid “safety guarantee” nor a pressure-based upgrade. If free trials have previously attracted only transient engagement, this is not a time-limited trial: the essential safety check remains genuinely useful without signup. Optional paid human assistance, business verification workflow or organizational subscriptions only after value and obligations are validated.

**Organic growth loop:** buyer checks offer → shares proof request privately → seller experiences a useful response form → user generates a redacted educational summary (opt-in) → audience encounters MABRIG PROVE. Measure referral **quality**, not mass unsolicited seller invitations.

**Campaign hypothesis:** “I checked this phone deal before paying” demonstrations, with synthetic offers and visible verification limitations. Avoid publishing identifiable third-party sellers, bank details, addresses or unproven accusations.

**Acquisition experiments:** compare short video demonstrating a suspicious price, a benign legitimate offer, and an ambiguous case; evaluate qualified visitors, completed reviews and repeat engagement, not just video views. The one-million-follower ambition is a long-term brand objective, not a release criterion.

# 13. Open decisions and dependencies

| Decision | Recommended default | Must validate before launch |
|---|---|---|
| Domain | `prove.mabrigkorie.org` | Ownership, DNS, legal notices, TLS |
| Product wedge | Nigeria-based phone/laptop purchases | 15–20 buyer interviews and seller response willingness |
| Client | Vite/React PWA | Browser device matrix |
| API/database/storage | Workers + D1 + private R2 + Queues | Pricing, quotas, data handling and service availability |
| AI model | Reviewed OpenRouter allowlist | Retention, quality, cost, failure behavior |
| Seller media | Images and one short video only after safety review | Malware processing, storage cost, privacy scope |
| Data retention | 14-day guest / 30-day saved | Lawful basis, NDPA/GAID review, vendor capabilities |
| User auth | Guest first; email magic link optional | Recovery and session-hijack testing |
| Official disputes | Link to FCCPC official complaints | No implied official endorsement |
| Admin roles | Founder, safety reviewer, support read-only | MFA, least privilege, emergency revocation |

# 14. Definition of success

The minimum lovable product is **one uninterrupted, trustworthy transaction-checking journey**: the buyer submits a screenshot, receives source-grounded concerns, sends a privacy-safe request, the seller responds, and the buyer sees a clear, non-accusatory comparison with safe next steps. An app with 30 categories but no reliable evidence workflow does not meet this definition.

**Recommendation:** Build that single journey first; measure whether people genuinely use it before paying, whether sellers respond, and whether the advice is both understandable and safe. Earn trust through precision, transparent limitations and strong data stewardship.

# 15. Source notes and official references

1. Nigeria Data Protection Act, 2023 — NDPC official text: https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf
2. NDPC General Application and Implementation Directive (GAID), 2025: https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf
3. OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
4. Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
5. Cloudflare Queue dead-letter queues: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
6. Cloudflare Turnstile server verification: https://developers.cloudflare.com/turnstile/get-started/
7. Cloudflare Next.js framework guidance (vinext beta): https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
8. OpenRouter data handling and provider practices: https://openrouter.ai/privacy
9. OpenRouter API guardrails: https://openrouter.ai/docs/guides/features/guardrails
10. FCCPC consumer complaint process: https://fccpc.gov.ng/consumers/complaint-handling/

**This document is a proposed software specification, not a deployed product, a legal opinion, an assurance of fraud prevention or a claim of certified verification.**
