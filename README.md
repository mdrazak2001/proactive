# Proactive

Proactive is a shared investigation computer for live incident calls. It turns a spoken hypothesis into an approved, read-only check and returns evidence while the team keeps talking.

The demo is deliberately narrow: determine whether release R42 or Stripe caused a checkout 5xx spike. A phone can correct and approve scope while every connected client watches the same agent steps, evidence, and conclusion through SpacetimeDB.

## What is real

- SpacetimeDB synchronizes rooms, participants, transcript segments, approvals, agent steps, evidence, conclusions, and the audit timeline.
- Reducers enforce the investigation state machine and commander-only approval/pause.
- A server-side connector broker exposes only fixed, bounded reads for Supabase, LangSmith, Supermemory, and an optional separate SpacetimeDB source.
- The integrations console reports actual configured, verified, error, and offline states. Credentials never enter the browser.
- SpacetimeAuth OIDC code + PKCE is wired in the React client; its ID token is passed to SpacetimeDB and to the broker without being copied into the anonymous demo token store.

The War Room's observability sequence is still seeded for a deterministic demo. No remediation action is available.

## Product surfaces

- `/` — product story and the hypothesis → order → evidence interaction.
- `/app/integrations` — live connector status, bounded verification, and sanitized sample receipts.
- `/demo/war-room` — the live SpacetimeDB-backed incident room.

Browserbase is the next execution/display slice, not a credential layer. API connectors retrieve evidence, SpacetimeDB synchronizes approved room state, and the visible browser will show sanitized work.

## Run locally

Requirements: Node.js 22 and SpacetimeDB CLI 2.10.

```powershell
npm install
Copy-Item .env.example .env.local
spacetime start
spacetime publish proactive --module-path spacetimedb --server local
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
npm run dev
```

Open `http://localhost:5174`. `npm run dev` starts Vite and the connector broker; Vite proxies `/api` to the loopback broker on port `8787`.

Broker authentication is fail-closed by default. Before SpacetimeAuth is
configured, a temporary local smoke test can set
`BROKER_ALLOW_UNAUTHENTICATED_LOCAL=true` while the broker remains bound to
`127.0.0.1`. This deliberately removes authentication for qualifying loopback
requests. It is **unsafe for any deployment**: never expose, tunnel, or proxy a
bypass-enabled broker, and never set the flag in hosted configuration. The
bypass is not honored in production and, in development, requires a loopback
bind and peer, loopback Host/Origin metadata when present, and no forwarding
headers. Return the flag to `false` as soon as the smoke test is complete.

For local connector testing, add provider values to `.env.local`, restart the broker, open `/app/integrations`, and press **Verify**. Never prefix a credential with `VITE_`: Vite publishes those values to the browser. The exact variables and provider boundaries are documented in [`server/README.md`](server/README.md); a non-sensitive Supabase demo table is in [`server/sql/supabase-proactive-events.sql`](server/sql/supabase-proactive-events.sql).

## Run as one production service

`npm run build` compiles the browser into `dist` and the broker into
`server/dist`. `npm start` runs one production Node service that serves the
browser, provides history fallback for client-side routes, and keeps `/api`
inside the authenticated broker. Build-time `VITE_*` values must be present
when the build runs; secrets and all `BROKER_*`/provider values stay in the
runtime environment.

Azure App Service supplies `PORT`, which takes precedence over `BROKER_PORT`.
The production service binds to `0.0.0.0` unless `BROKER_HOST` is explicitly
set. Do not set `BROKER_ALLOW_UNAUTHENTICATED_LOCAL` in Azure. Production still
fails closed unless `BROKER_ALLOWED_SUBJECTS` or `BROKER_ALLOWED_EMAILS` contains
at least one authorized identity.

```powershell
npm run build
npm start
```

## Google login through SpacetimeAuth

1. Create a SpacetimeAuth project and browser client.
2. Add `http://localhost:5174/auth/callback` as a redirect URI and `http://localhost:5174/` as a post-logout URI. Add the equivalent HTTPS production URLs later.
3. In Google Cloud, create a Web OAuth client and use `https://auth.spacetimedb.com/interactions/federated/callback/google` as Google's authorized redirect URI.
4. Enter the Google client ID and secret only in the SpacetimeAuth dashboard.
5. Put the SpacetimeAuth **public client ID** in both `VITE_OIDC_CLIENT_ID` and `BROKER_OIDC_CLIENT_ID` in `.env.local`.
6. Add your pilot users to `BROKER_ALLOWED_SUBJECTS` or `BROKER_ALLOWED_EMAILS`, then set `BROKER_ALLOW_UNAUTHENTICATED_LOCAL=false`.

The Google secret does not belong in this repository or chat. The SpacetimeAuth public client ID is not secret.

## Security status

The broker is currently a **single-workspace private alpha**. One broker process
loads one server-side set of provider credentials, and every allowlisted pilot
user can reach those same configured connectors. The allowlists gate access to
the process; they do not select tenant-specific credentials or connector roles.
Do not put multiple customer workspaces behind one broker process.

Broker hardening does not secure the coordination database. The browser passes
its SpacetimeAuth ID token to SpacetimeDB, but the current module never checks
`ctx.senderAuth` for the required JWT, exact issuer, and client audience. Its
tables are public, and `joinRoom` lets a caller self-select the incident
commander role. This is the blocking authentication gap for any shared or
customer deployment: Google login alone does not create a tenant boundary.

Before a private beta, enforce authentication at the module connection/reducer
boundary, move customer data behind organization-scoped private tables/views,
assign memberships and commander roles server-side, and store per-workspace
connector credentials in an encrypted secret vault. Do not connect customer
production accounts to the public demo room until those controls and the
same-origin production routing are in place.

## Product boundary

Proactive investigates and prepares. It does not deploy, roll back, email, or change production without a separate explicit approval surface. The next build slice is one real connector feeding one live investigation, followed by Browserbase Live View. Billing comes after that loop works for pilot users.
