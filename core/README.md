# Luno core

This is the pnpm + Turborepo monorepo for Luno. Roadmap: [`../docs/ROADMAP.md`](../docs/ROADMAP.md).

| Path | What |
|---|---|
| `apps/http` | Express 5 REST API (:3001) |
| `apps/ws` | WebSocket server (:3002), coming in Phase 2 |
| `apps/web` | Next.js + Phaser client (:3000) |
| `packages/db` | Prisma 7 schema and client (`@repo/db/client`) |
| `packages/ui` | Shared React components |

## Setup

Requires Node 20+ and pnpm.

```sh
pnpm install

# Environment: copy the examples and fill them in
cp packages/db/.env.example packages/db/.env
cp apps/http/.env.example apps/http/.env

# Database
cd packages/db
npx prisma migrate dev
npx prisma generate
npx prisma db seed    # starter map, furniture and avatar (safe to re-run)
cd ../..
pnpm --filter @repo/db build
```

## Run

```sh
cp apps/web/.env.example apps/web/.env.local   # first time only
pnpm dev    # web on :3000 + API on :3001 (reloads on save)
```

To run one at a time: `pnpm --filter http dev` or `pnpm --filter web dev`.

The API allows the web origin through CORS. Set `WEB_ORIGIN` in `apps/http/.env` if the web app runs somewhere other than `http://localhost:3000`.

## Tests

The integration tests live in `../tests` and run against the running servers:

```sh
cd ../tests
pnpm install
pnpm test:http   # REST API suites
pnpm test        # everything, including the WebSocket contract (Phase 2)
```
