# Blueberry Web Platform

A Cloudflare-native application consisting of:

- React and Vite for the browser application
- a Hono Cloudflare Worker for `/api/*` and `/videos/*`
- D1 for relational data
- R2 for private sensory-video objects

## Local development

```sh
npm run ci:all
cp .dev.vars.example .dev.vars
./dev.sh seed-db
./dev.sh
```

Development runs on `http://127.0.0.1:5173` with React and Worker HMR. The
machine's persistent Cloudflare Tunnel also makes that same server available at
`https://preview.glisic.net` behind GitHub-backed Cloudflare Access. All local
D1/R2 state is isolated under `.wrangler/state`; development does not connect to
the remote production bindings during normal use. `./dev.sh` starts Vite in the
background; use `./dev.sh status`, `./dev.sh logs`, and `./dev.sh stop` to manage
it. `./dev.sh seed-db` takes a read-only production D1 snapshot, preserves the
previous local D1 state under `.wrangler/backups`, and replaces only local D1.
The export consumes no D1 row writes, though Cloudflare may briefly make the
small production database unavailable while creating a consistent export.

Requests through either production or `preview.glisic.net` carry a signed
Cloudflare Access assertion. The Worker validates the assertion for that
hostname, reads the verified email claim, and uses the local or production
`email_whitelist` table to determine which interface features are available.
`DEV_USER_EMAIL` is used only when accessing the localhost server directly.

## Checks

```sh
npm --prefix frontend run lint
npm run typecheck
npm run build
```

See [Cloudflare operations](docs/cloudflare-operations.md) for migrations and
deployment.
