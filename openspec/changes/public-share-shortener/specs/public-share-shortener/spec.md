## ADDED Requirements

### Requirement: First-party destination allowlist
The create endpoint SHALL accept only destination URLs whose hostname exactly matches the `allowed_host` of the referenced app's registry row, after URL canonicalization. All other destinations SHALL be rejected with HTTP 400. Only HTTPS URLs SHALL be accepted; IP-literal hosts, userinfo components, IDN/punycode homographs, and destinations that are themselves URL shorteners SHALL be rejected.

#### Scenario: First-party destination accepted
- **WHEN** the create endpoint receives a content reference for app `macrolattice` that renders to `https://macrolattice.com/meal/r_8f3k`
- **THEN** the link SHALL be created and a short URL on `sh.macrolattice.com` returned

#### Scenario: Non-allowlisted destination rejected
- **WHEN** any client-supplied value would render a URL on a host other than the app's `allowed_host`
- **THEN** the endpoint SHALL return HTTP 400 and no record SHALL be stored

#### Scenario: Obfuscated malicious destination rejected
- **WHEN** a destination uses `https://user@macrolattice.com`, `https://macrolattice.com.evil.io`, an IP literal, or `http://` scheme
- **THEN** the endpoint SHALL return HTTP 400

### Requirement: Content-reference creation with template rendering
The create endpoint SHALL accept `{ appId, type, contentId, params }` and SHALL construct the destination URL server-side from the app's `url_template`. Clients SHALL NOT be able to submit arbitrary destination URLs. Clients SHOULD pre-validate their URL structures with Zod before calling; the server-side validation SHALL be authoritative.

#### Scenario: Content reference shortened
- **WHEN** a client posts `{ appId: "supatrainer", type: "workout", contentId: "w_42", params: { week: 3 } }`
- **THEN** the server renders the destination from the `supatrainer` template, validates it against the allowlist, and returns the short URL

#### Scenario: Unknown app or type rejected
- **WHEN** `appId` has no registry row or `type` has no template entry
- **THEN** the endpoint SHALL return HTTP 400

### Requirement: Anonymous creation gated by Turnstile
The create endpoint SHALL require a valid Cloudflare Turnstile token and SHALL verify it against `challenges.cloudflare.com/turnstile/v0/siteverify` before any other processing. Requests with missing, invalid, or replayed tokens SHALL be rejected with HTTP 403.

#### Scenario: Valid token accepted
- **WHEN** a request carries a fresh Turnstile token that verifies
- **THEN** processing SHALL continue to quota and allowlist checks

#### Scenario: Missing or invalid token rejected
- **WHEN** a request has no Turnstile token or a token that fails siteverify
- **THEN** the endpoint SHALL return HTTP 403 without side effects

### Requirement: Per-IP daily creation quota
The system SHALL enforce a per-IP daily creation quota, keyed by `CF-Connecting-IP` and app, with a default of 100 creates/day/app (configurable per app via `daily_create_limit`). Requests from an IP at or above the quota SHALL be rejected with HTTP 429.

#### Scenario: Quota enforced at limit
- **WHEN** an IP has created 100 links for `sh.macrolattice.com` today
- **THEN** further creates for that app from that IP SHALL return HTTP 429 until midnight UTC

#### Scenario: Quota is per app
- **WHEN** an IP has exhausted its quota for `sh.macrolattice.com` but not for `sh.supatrainer.com`
- **THEN** creates for `sh.supatrainer.com` from that IP SHALL still succeed

### Requirement: Global circuit breaker
The system SHALL support a `public_creation_paused` flag that, when set, causes all anonymous create requests to be rejected with HTTP 503 while clicks continue to work. A daily job SHALL set the flag automatically when total creates exceed a configurable multiple of the trailing baseline; an operator SHALL be able to reset it via the PocketBase admin UI.

#### Scenario: Automatic trip on flood
- **WHEN** daily creates exceed the configured multiple of baseline
- **THEN** the flag SHALL be set and subsequent creates SHALL return HTTP 503

#### Scenario: Clicks unaffected by trip
- **WHEN** the circuit breaker is tripped
- **THEN** existing short URLs SHALL continue to redirect normally at the edge

### Requirement: Random unguessable slugs
The system SHALL generate slugs as random strings with at least 7 characters from a 62-character alphabet (≥ 2^41 bits of entropy), with collision retry. Anonymous users SHALL NOT be able to choose custom slugs.

#### Scenario: Sequential or client-chosen slugs unavailable
- **WHEN** a create request includes a client-supplied slug
- **THEN** it SHALL be ignored and a random slug generated

### Requirement: Auto-expiry of unused links
Every anonymous link SHALL be purged when it has received zero clicks in the last 30 days (evaluated by a daily PocketBase cron using `last_click_at`/`created`), with the KV entry deleted alongside the record. Expiry SHALL bound junk accumulation from bot flooding.

#### Scenario: Unused link purged
- **WHEN** a link has had no clicks for 30 consecutive days
- **THEN** the daily cron SHALL delete the record and its KV entry

#### Scenario: Recently active link retained
- **WHEN** a link was clicked 5 days ago
- **THEN** it SHALL be retained until 30 clickless days elapse

### Requirement: Host-keyed edge routing
The Cloudflare Worker SHALL serve all configured `sh.<app-domain>` zones and SHALL resolve redirects by `Host` header using KV keys of the form `sh.<host>:/<slug>`. Adding a new app SHALL require no Worker or engine code change.

#### Scenario: Same slug on two apps resolves independently
- **WHEN** `sh.macrolattice.com/Ab3xK9` and `sh.supatrainer.com/Ab3xK9` both exist
- **THEN** each SHALL redirect to its own app's destination

### Requirement: Read-through fallback on KV miss
On a KV miss, the Worker SHALL query the PocketBase resolve endpoint (`host` + `path`), and on hit SHALL populate KV and perform the redirect; only on a confirmed database miss SHALL it return 404. The resolve endpoint SHALL be rate-limited.

#### Scenario: Fresh link clicked seconds after creation
- **WHEN** a recipient clicks a link before KV propagation has reached their PoP
- **THEN** the Worker SHALL resolve via PocketBase, cache into KV, and redirect (not 404)

#### Scenario: Genuine miss returns 404
- **WHEN** neither KV nor PocketBase has the slug
- **THEN** the Worker SHALL return 404

### Requirement: Unified create and click analytics
The Worker SHALL write one Analytics Engine data point per click (`share_host`, `slug`, country, UA class) and the create endpoint SHALL write one per create (`share_host`, hashed IP). These SHALL be the only click-analytics path (PocketBase click ingestion is removed).

#### Scenario: Click recorded without backend involvement
- **WHEN** a redirect is served at the edge
- **THEN** a data point with host and slug dimensions SHALL be written and the redirect SHALL not wait on any PocketBase call

### Requirement: App onboarding without code changes
Adding an app SHALL require only: a Cloudflare route for its `sh.` subdomain, and an `apps` registry row (`app_id`, `share_host`, `allowed_host`, `url_template`, `daily_create_limit`). No Worker, engine, or backend code change SHALL be needed.

#### Scenario: Fourth app onboarded
- **WHEN** `sh.newapp.com/*` is routed to the Worker and an `apps` row exists
- **THEN** create and redirect flows for the new app SHALL work immediately
