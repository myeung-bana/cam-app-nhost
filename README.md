# cam-app-nhost

Nhost backend for **Memo** (`cam-app-admin`, guest PWA, client portal). This repo holds Hasura config, database migrations, and serverless functions.

## Cloud project

| Setting | Value |
|---|---|
| Subdomain | `iowltpcolwnlrqfsrjtp` |
| Region | `ap-southeast-1` |

| Service | URL |
|---|---|
| GraphQL | `https://iowltpcolwnlrqfsrjtp.hasura.ap-southeast-1.nhost.run/v1/graphql` |
| Auth | `https://iowltpcolwnlrqfsrjtp.auth.ap-southeast-1.nhost.run/v1` |
| Functions | `https://iowltpcolwnlrqfsrjtp.functions.ap-southeast-1.nhost.run/v1` |
| Storage | `https://iowltpcolwnlrqfsrjtp.storage.ap-southeast-1.nhost.run/v1` |

Fill in secrets in the [Nhost Dashboard](https://app.nhost.io) after linking this repository.

## Prerequisites

- [Nhost CLI](https://docs.nhost.io/platform/cli) v1.45+
- Node.js 22
- Docker (for `nhost up` local stack)

## First-time setup

```bash
# 1. Link to your cloud project (one-time)
nhost link
# Select workspace → confirm subdomain: iowltpcolwnlrqfsrjtp

# 2. Pull cloud config/secrets (optional — overwrites local files)
# nhost config pull

# 3. Local secrets for development
cp .secrets.example .secrets
# Edit .secrets with values from Dashboard → Settings → Secrets

# 4. Install function dependencies
cd functions && npm install && npm run build && cd ..

# 5. Start local Nhost stack
nhost up
```

## Connect cam-app-admin

In `cam-app-admin/.env.local`:

```env
NEXT_PUBLIC_DEV_MODE=false

NHOST_SUBDOMAIN=iowltpcolwnlrqfsrjtp
NHOST_REGION=ap-southeast-1
NHOST_ADMIN_SECRET=<from-dashboard>
NHOST_FUNCTIONS_URL=https://iowltpcolwnlrqfsrjtp.functions.ap-southeast-1.nhost.run/v1

NEXT_PUBLIC_NHOST_SUBDOMAIN=iowltpcolwnlrqfsrjtp
NEXT_PUBLIC_NHOST_REGION=ap-southeast-1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Auth is headless: `cam-app-admin` calls `/v1/admin/auth/*` functions (via its `/api/auth/*` BFF), not Nhost Auth SDK directly.

Guest join URLs use `{GUEST_APP_URL}/j/{join_code}`. Set `GUEST_APP_URL` in `.secrets` for functions (QR generation).

```env
GUEST_APP_URL=http://localhost:3001
NEXT_PUBLIC_GUEST_APP_URL=http://localhost:3001
```

Hasura GraphQL URL pattern:

`https://${NHOST_SUBDOMAIN}.hasura.${NHOST_REGION}.nhost.run/v1/graphql`

## Repository layout

```text
cam-app-nhost/
├── nhost/
│   ├── nhost.toml          # Project config (Node 22, RS256 JWT, auth)
│   ├── config.yaml         # Hasura metadata v3 pointer
│   ├── metadata/           # Hasura permissions (incl. guest role)
│   ├── migrations/         # SQL migrations
│   └── emails/             # Auth email templates
├── functions/
│   ├── _lib/               # Shared helpers (env, auth, hasura-admin/user, guards)
│   ├── health.ts           # GET /v1/health
│   ├── admin/
│   │   ├── auth/           # sign-in, sign-out, refresh, session
│   │   └── events/         # get-qr, rotate-join-code
│   └── guest/
│       └── join/           # resolve, enter (dynamic QR)
├── .secrets.example
└── .secrets                # Local only — gitignored
```

Function conventions follow [`AI_rules_v2.md`](../AI_rules_v2.md) (§15 Nhost Functions).

## Useful commands

```bash
nhost up              # Start local stack
nhost down            # Stop local stack
nhost logs            # Tail service logs
nhost config validate # Validate nhost.toml
cd functions && npm run build
```

## Health check

After deploy:

```bash
curl https://iowltpcolwnlrqfsrjtp.functions.ap-southeast-1.nhost.run/v1/health
```

Expected: `{ "ok": true, "data": { "status": "ok", ... } }`

## Guest PWA auth hook

Configure in Nhost Dashboard → **Auth → Hooks → Custom access token** (if available):

- URL: `{FUNCTIONS_URL}/auth/access-token`
- Maps anonymous user `metadata.eventId` → Hasura claim `x-hasura-event-id` and `defaultRole: guest`

Also configured in `nhost/nhost.toml`:

```toml
[[auth.session.accessToken.customClaims]]
key = 'event-id'
value = 'metadata.eventId'
```

Guests must **re-join** after enabling the hook so new JWTs include the guest role.

The guest upload proxy (`POST /api/guest/upload`) falls back to admin session verification when JWT guest claims are missing, so uploads work even before the hook is live — provided `NHOST_ADMIN_SECRET` is set on the guest app.

## Hasura metadata

Guest permissions live in `nhost/metadata/` (restored from git). Push to deploy. Key tables for the PWA:

- `media` — guest `insert` scoped to `X-Hasura-Event-Id` + own session
- `guest_sessions` — guest `select` / heartbeat `update`
- `challenges`, `challenge_completions`, `milestones` — guest read / insert

Apply with your normal Nhost deploy flow (`git push` or `nhost deployments new`).

## Storage ACL (guest uploads)

In Nhost Dashboard → **Storage** → bucket **`cam-bucket`** (must match `NEXT_PUBLIC_STORAGE_BUCKET`):

Add rules so the **`guest`** role can **insert** and **select** files. Example policy shape:

```json
{
  "insert": { "user": { "role": { "_eq": "guest" } } },
  "select": { "user": { "role": { "_eq": "guest" } } }
}
```

Without this, photo bytes upload fails with 403 even when Hasura permissions are correct.

Guest join also sets `metadata.eventId` on anonymous sign-in (`functions/_lib/nhost-auth.ts`).
