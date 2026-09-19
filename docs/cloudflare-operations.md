# Cloudflare operations

Blueberry Web Platform runs as a React single-page application and Hono API in
one Cloudflare Worker. Application data is stored in D1 and sensory videos are
stored in the private `blueberry-web-videos` R2 bucket.

FruitFirm measurements enter through the isolated
`blueberry-fruitfirm-ingest` Worker. The Orem collector uses its authenticated
`workers.dev` endpoint; `fruitfirm.blueberry-web.com` is also attached as a
custom domain. The Worker exposes only ingestion and health endpoints and
requires an `X-API-KEY` value found in D1's `api_keys` table.

Anonymous sensory participants use the isolated `blueberry-deepflavor-api`
Worker at `deepflavor-api.blueberry-web.com`. It exposes only the four
DeepFlavor session/submission/upload endpoints and accepts browser requests only
from `https://blueberry-web.com`; administrative sensory endpoints remain behind
Cloudflare Access on the main application hostname.

## Development

1. Run `npm run ci:all` after cloning.
2. Copy `.dev.vars.example` to `.dev.vars` and set a local Access identity.
3. Run `./dev.sh seed-db` to refresh isolated local D1 from a read-only
   production export (or `./dev.sh migrate` for a new empty database).
4. Run `./dev.sh` and open `http://127.0.0.1:5173`. The command returns after
   starting Vite in the background; use `./dev.sh logs`, `status`, or `stop` to
   manage it.

The machine's persistent Cloudflare Tunnel routes `preview.glisic.net` to the
standard development port, `127.0.0.1:5173`. Starting `./dev.sh` makes the local
Vite/Worker HMR server available through the preview hostname automatically.
Cloudflare Access applies the same identity providers and allow rules as
`dev.glisic.net`. `./dev.sh stop` leaves no preview origin listening, and local
D1/R2 bindings remain isolated from production.

`./dev.sh seed-db` exports D1 without consuming row writes, validates the new
SQLite database, backs up the previous local D1 state under `.wrangler/backups`,
and atomically installs the seed. Local R2 objects are preserved. Cloudflare may
briefly make D1 unavailable while it creates the consistent export.

Preview requests are authenticated twice: Access enforces the application
policy at the edge, and the local tunnel validates the signed assertion before
forwarding it to Vite. The Worker then validates the assertion against the
preview application's audience, reads its email claim, and applies the same
database-backed access-level logic as production. Direct localhost requests use
the ignored `DEV_USER_EMAIL` value because they do not pass through Access.

The Cloudflare Vite plugin serves the React application and Worker together with
HMR. D1 and R2 are emulated locally under `.wrangler/state`; remote bindings are
disabled in `frontend/vite.config.ts`.

## Database migrations

D1 migrations are sequential SQL files in `migrations/`. Wrangler records each
applied filename in the database's `d1_migrations` table.

Create and verify a schema change:

```sh
npx wrangler d1 migrations create blueberry-web descriptive_name
npm run db:migrate:local
npm run typecheck
npm run build
```

After reviewing the SQL and its expected D1 row-write cost, apply it remotely:

```sh
npm run db:migrate:remote
```

Applied migrations are immutable. Never edit an existing migration for a new
schema change; add the next numbered file instead. The remote database retains
legacy `AUTOINCREMENT` table declarations, but all Worker inserts use explicit
negative IDs and therefore do not update SQLite sequences. Fresh databases use
plain `INTEGER PRIMARY KEY`.

## Deployment

Build and deploy the production application manually with:

```sh
npm run deploy:cloudflare
```

The GitHub workflow in `.github/workflows/deploy.yml` runs on the on-premises
`self-hosted`, `Linux`, `X64` runner. Every push to `main` installs from the lock
files, lints, type-checks, builds, applies pending D1 migrations, deploys the two
supporting API Workers followed by the application Worker, and smoke-tests the
live endpoints. Manual runs may skip migrations. The runner uses the protected
Wrangler OAuth credentials in the `soriserver` account; no Cloudflare token is
copied into GitHub.
`blueberry-web.com/*` is a reversible Worker route; its `workers.dev` and
preview URLs remain disabled. Deploy the two supporting API Workers before the
main application Worker so a frontend release never points at an API that has
not been deployed yet. The FruitFirm Worker intentionally keeps `workers.dev`
enabled for the on-prem Orem collector, while preview URLs remain disabled.

The Orem machine continues to pull instrument files over Tailscale and keeps
its local processed-file ledger. Its processor sends only new measurements to
the authenticated Cloudflare ingestion Worker over outbound HTTPS. This local
collector is intentionally outside this repository and should remain running
unless the instrument-side data source is redesigned.

After cutover, monitor D1 rows written closely. The busiest historical business
day is projected to consume approximately 66,500 of the 100,000 daily Free-plan
row-write allowance with the current three-index, explicit-ID design.
