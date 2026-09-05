# Connector broker

This is the trusted server boundary for operator-managed Proactive integrations
such as Browserbase and Supermemory, plus legacy environment-based connector
checks. External-user Supabase and LangSmith connections now use the private
SpacetimeDB connector table and typed module procedures described in the root
README. Broker credentials are loaded from `.env.local`, used only on the
server, and never returned by an API response. All query routes run fixed,
bounded reads; callers cannot submit SQL, filters, project IDs, or provider URLs.
Fetched provider records are summarized inside the broker and discarded; the
browser receives a count/timestamp receipt, never record content.

## Run it

Copy the relevant values from `server/.env.example` into the root `.env.local`.
The local bypass is off by default. It can be explicitly enabled for a temporary
loopback-only test with:

```env
BROKER_ALLOW_UNAUTHENTICATED_LOCAL=true
```

This flag deliberately removes broker authentication for qualifying requests.
It is **unsafe for any deployment**. Never expose, tunnel, or reverse-proxy a
bypass-enabled broker, and never place the flag in hosted configuration. Use it
only for a short-lived smoke test on the local machine, then restore `false`.

`npm run dev` starts both Vite at `http://localhost:5174` and this broker at
`http://127.0.0.1:8787`. Vite proxies `/api` to the broker. Once SpacetimeAuth is
configured, set `BROKER_OIDC_CLIENT_ID` (the same public client ID used by Vite)
and turn the local bypass off. The bypass is accepted only when the broker is
outside production and bound to loopback, the peer is loopback, Host/Origin are
loopback when present, no forwarding headers are present, and the request has no
bearer token. These checks limit accidental exposure; they do not make
unauthenticated mode a deployment option.

The browser always calls relative, same-origin `/api` paths. Vite supplies the
proxy during development. In production, run `npm run build` followed by
`npm start`; the broker serves the generated `dist` assets and client-side route
fallback from the same process while reserving `/api` for the authenticated API.
`PORT` takes precedence over `BROKER_PORT` for Azure App Service, and production
defaults to a `0.0.0.0` bind. Public `VITE_*` values are fixed at build time;
broker and provider credentials must be supplied only as runtime settings.

The broker then verifies the bearer ID token's signature, issuer, audience,
expiry, issued-at time, subject, and authorized party from OIDC discovery/JWKS.
The broker path is deliberately one workspace per process: all configured
provider credentials are shared by every authorized user of that workspace.
Allowlists gate the process; they do not map users to separate credentials or
connector roles. Do not serve multiple customer workspaces from one alpha
process. Set one or both comma-separated allowlists:

```env
BROKER_ALLOWED_SUBJECTS=oidc-subject-1,oidc-subject-2
BROKER_ALLOWED_EMAILS=founder@example.com
```

Subject matches are exact. Email matches are case-insensitive and accepted only
when the identity token says the email is verified. Production startup fails
closed unless at least one allowlist entry is present. Outside production, an
empty allowlist permits any otherwise valid token for the configured client ID,
so a shared private-alpha environment should populate an allowlist even during
development.

## API contract

- `GET /api/integrations/status` returns `{ providers: [...] }` with safe setup and
  last-verification state.
- `POST /api/integrations/:provider/verify` accepts no body or `{}` and proves the
  configured read boundary.
- `POST /api/integrations/:provider/query` accepts no body or `{}` and returns
  `{ receipt }` for one bounded sample summary. Provider rows/content are never
  included in the response.

Supported provider IDs are `supabase`, `langsmith`, `supermemory`, `spacetimedb`,
and `browserbase`. Other routes, methods, query parameters, and request fields are
rejected. Requests are capped at 4 KiB; upstream calls time out after 10 seconds
and responses are capped at 1 MiB. Errors are sanitized before they reach the
browser or logs. Each authenticated principal is limited to 30 verify/query
requests per minute and two concurrent provider requests.

## Coordination-module boundary

The module now rejects connections without a SpacetimeAuth JWT for the exact
issuer and client audience. Its private connector table is keyed by sender
identity and omitted from client bindings. The demo incident-room tables are
still public to authenticated clients, however, and callers can choose their own
room role. Organization-scoped private room data and server-assigned membership
remain required before a customer beta.

## Provider boundaries

### Supabase

Use a fine-grained Management API token with Project Settings Read and Database
Read, plus a schema-qualified source table. The query runs through Supabase's
`/database/query/read-only` endpoint as `supabase_read_only_user`; it never uses
an `sb_secret` or `service_role` key. `server/sql/supabase-proactive-events.sql`
creates a non-sensitive demo table. Verification performs a one-row constant
projection from that exact table. Sampling reads only five `occurred_at` values
to calculate a count and latest timestamp.

### LangSmith

Use a workspace-scoped service key, workspace UUID, and tracing-project UUID.
Verification runs a one-item v2 query against that exact project. The sample asks
the same endpoint only for five IDs/timestamps from the last 24 hours and omits
inputs, outputs, events, and errors.
If your plan cannot issue a viewer-only key, the credential can technically do
more than this broker: the broker's endpoint allowlist is the read boundary.

### Supermemory

Create a key scoped to one container and configure that exact tag. Verification
lists one document without content. The sample performs a five-result hybrid
search in that container with aggregation, reranking, and query rewriting off.
Only its count/latest timestamp receipt leaves the broker. Supermemory scoped
keys may still permit writes; this broker exposes read calls only.

### SpacetimeDB source

This reuses the same Maincloud database and SpacetimeAuth identity already
used by the room. The broker forwards the caller's ID token and runs a fixed
`SELECT 1 FROM incident_room LIMIT n`. Do not configure a database-owner or CLI
publisher token. Override host/database/table only if you need a separate
curated source.

Official references:

- Supabase read-only query: https://supabase.com/docs/reference/api/v1-read-only-query
- LangSmith trace queries: https://docs.langchain.com/langsmith/export-traces
- Supermemory v4 search: https://supermemory.ai/docs/api-reference/recall-search/search-memory-entries
- SpacetimeDB HTTP database API: https://spacetimedb.com/docs/http/database/
