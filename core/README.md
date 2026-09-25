# Luno core

This is the pnpm + Turborepo monorepo for Luno. Roadmap: [`../docs/ROADMAP.md`](../docs/ROADMAP.md).

| Path | What |
|---|---|
| `apps/http` | Express 5 REST API (:3000) |
| `apps/ws` | WebSocket server (:3001), coming in Phase 2 |
| `apps/web` | Next.js + Phaser client |
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
cd ../..
pnpm --filter @repo/db build

# API
pnpm --filter http build
cd apps/http && node dist/index.js
```

Web client: `pnpm --filter web dev`, then open http://localhost:3000. If the API is already on :3000, Next picks the next free port.

## Tests

The integration tests live in `../tests` and run against the running servers:

```sh
cd ../tests
pnpm install
pnpm test:http   # REST API suites
pnpm test        # everything, including the WebSocket contract (Phase 2)
```
