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
./dev.sh --migrate
./dev.sh
```

Development runs on `http://127.0.0.1:5173` with React and Worker HMR. The
machine's persistent Cloudflare Tunnel also makes that same server available at
`https://preview.glisic.net` behind GitHub-backed Cloudflare Access. All local
D1/R2 state is isolated under `.wrangler/state`; development does not connect to
the remote production bindings. Stopping Vite makes the preview origin
unavailable without changing the tunnel.

## Checks

```sh
npm --prefix frontend run lint
npm run typecheck
npm run build
```

See [Cloudflare operations](docs/cloudflare-operations.md) for migrations and
deployment.
