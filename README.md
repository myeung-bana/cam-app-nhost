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

NEXT_PUBLIC_NHOST_SUBDOMAIN=iowltpcolwnlrqfsrjtp
NEXT_PUBLIC_NHOST_REGION=ap-southeast-1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

These match `cam-app-admin/lib/nhost.ts`, which builds the Hasura URL as:

`https://${NHOST_SUBDOMAIN}.hasura.${NHOST_REGION}.nhost.run/v1/graphql`

## Repository layout

```text
cam-app-nhost/
├── nhost/
│   ├── nhost.toml          # Project config (Node 22, RS256 JWT, auth)
│   ├── config.yaml         # Hasura metadata v3 pointer
│   ├── migrations/         # SQL migrations
│   └── emails/             # Auth email templates
├── functions/
│   ├── _lib/               # Shared helpers (env, auth, hasura, respond)
│   ├── health.ts           # GET /v1/health
│   └── echo.ts             # POST /v1/echo (auth smoke test)
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
