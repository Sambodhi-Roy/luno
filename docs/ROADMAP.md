# Luno Roadmap

Luno is a 2D metaverse in the style of Gather and Zep. Users sign in, pick an avatar, and join a space. There they walk around a shared map, see each other move live, chat, and get proximity audio and video.

**Target:** a portfolio-grade product that is polished, demoable, and deployed.

## Status

| Phase | Name | Status |
|---|---|---|
| 0 | Stabilise the foundation | ✅ Done |
| 1 | Web app shell | ⬜ Not started |
| 2 | Real-time multiplayer | ⬜ Not started |
| 3 | Space building (place elements) | ⬜ Not started |
| 4 | Social layer | ⬜ Not started |
| 5 | Proximity audio/video (LiveKit) | ⬜ Not started |
| 6 | Customisable maps and interactive objects | ⬜ Not started |
| 7 | Ship it | ⬜ Not started |

---

## Architecture decisions

### 1. Map model: Tiled base map plus DB elements
- **Base layer:** a Tiled map (`.tmj`) holds the floor, walls, collision, spawn points, and zones. An admin uploads it and it is stored as `Map.tmjUrl`. It does not change at runtime.
- **Object layer:** DB `Element`s (desks, plants, whiteboards) can be placed anywhere on top. A map ships with default `MapElements`. Each `Space` is an instance of a map (`Space.mapId`) and gets its own editable copy of those elements in `spaceElements`.
- **Custom maps come later**, in two steps. First, users upload their own `.tmj` and tilesets. After that, an in-app tile painter that writes the same Tiled JSON format. The runtime always renders Tiled JSON plus elements, so it never needs to change.

### 2. Movement: tile-grid, server-validated (like Gather)
The client tweens the sprite between 32px tiles. The server keeps each user's tile position and rejects any move that jumps more than one tile, leaves the map, or hits a collision tile. This keeps validation cheap and makes proximity maths trivial. All space and element coordinates are in **tiles**.

### 3. Shared protocol package
`core/packages/protocol` holds the WebSocket message types and Zod schemas. Both `apps/ws` and `apps/web` use it.

### 4. Proximity A/V: one LiveKit room per space
Each space gets a single LiveKit room with `autoSubscribe: false`. Each client subscribes only to participants within N tiles, or in the same private zone. This avoids switching rooms dynamically.

---

## Phases

### Phase 0: Stabilise the foundation
- [x] Schema: `Space.mapId`, `Map.tmjUrl`, `Space.height` required, cascade-delete space elements
- [x] `createSpace` copies the map's default elements and returns `spaceId`
- [x] Fix `getSpace` (params bug, viewable by any logged-in user)
- [x] Fix `/space/elements` route order and auth
- [x] Bounds-check element placement, and use consistent 403/404 codes
- [x] Signup returns `userId`, and admin self-signup is gated by `ALLOW_ADMIN_SIGNUP`
- [x] Port the legacy `tests/index.test.js` into the modular suite
- [x] Repo hygiene: `.env.example` files, README, untrack build artefacts

**Done when:** every HTTP integration test passes against the dev DB. ✅ 29/29 passing (`pnpm test:http`). The WS contract suite is in place for Phase 2.

### Phase 1: Web app shell
- [ ] Pages: `/login`, `/signup`, `/dashboard` (my spaces, create a space from a map picker), `/space/[spaceId]`, avatar picker
- [ ] API client and auth (cookie with `credentials: include`, CORS on `http`)
- [ ] `WorldScene` receives `spaceId`, fetches the space, loads the map's `.tmj` dynamically, and renders `spaceElements`. Static elements collide.
- [ ] Fix the `GameCanvas` mount race (StrictMode currently creates two Phaser games)

**Done when:** a user can sign up, create a space from the sample map, open it, and walk around alone with elements loaded from the DB.

### Phase 2: Real-time multiplayer
- [ ] `core/apps/ws`: Node with `ws` on :3001, a `RoomManager` (spaceId → users), and a `User` object per socket
- [ ] Messages: `join` → `space-joined {spawn, users}`, `user-join`, `movement` / `movement-rejected`, `user-left`
- [ ] Verify the JWT on join, and build the collision grid from the `.tmj` plus static elements
- [ ] Client: `NetworkManager` and a `RemotePlayer` entity that interpolates moves
- [ ] `Player` switches to tile-step movement, with name labels over avatars

**Done when:** `tests/ws` passes and two browser tabs see each other move smoothly.

### Phase 3: Space building
- [ ] Build mode for the space owner: element palette, ghost preview snapped to the grid, click to place, right-click to remove
- [ ] Broadcast `element-added` / `element-removed` over WS, and refresh the server's collision grid
- [ ] Admin page: upload Tiled maps and tilesets, create elements and avatars (local storage or S3/R2)

**Done when:** the owner rearranges furniture live while a visitor watches it change and collides with it.

### Phase 4: Social layer
- [ ] Text chat, both space-wide and proximity
- [ ] Online-users sidebar, emotes and reactions, follow a user
- [ ] Invite links, with an optional private-space flag
- [ ] Avatar sprite sheets per `Avatar`, replacing the hardcoded "adam"

### Phase 5: Proximity audio/video (LiveKit)
- [ ] `POST /space/:id/av-token` issues a LiveKit token (room = spaceId, identity = userId)
- [ ] Publish mic and camera. Subscribe or unsubscribe to others by tile distance, recomputed on every movement event.
- [ ] Video bubble UI, mute and camera toggles, device picker
- [ ] Private zones from a Tiled object layer: users in the same zone hear each other and are isolated from everyone else
- [ ] Screen share

**Done when:** walking toward someone brings in their video, and walking away drops it.

### Phase 6: Customisable maps and interactive objects
- [ ] Users can upload custom Tiled maps, followed by an in-app tile painter
- [ ] Portals (teleport or change space), embedded iframes, whiteboards, and YouTube on "press X"
- [ ] Multiple rooms per space (linked maps)

### Phase 7: Ship it
- [ ] Deploy: web on Vercel, `http` and `ws` on Fly.io or Railway, Postgres on Neon, LiveKit Cloud
- [ ] Docker Compose for local development
- [ ] GitHub Actions CI: typecheck, lint, and integration tests
- [ ] Hardening: rate limits, WS message validation, auth on every WS message
- [ ] Landing page, demo GIF, architecture diagram in the README

---

## Verification per phase
- **Phases 0 and 2:** start `http` on :3000 (and `ws` on :3001 for Phase 2), then run `cd tests && pnpm test`.
- **Phases 1 and 3–5:** check manually with two browser windows (one normal, one incognito) as two users, following each phase's "Done when" line.
- **Phase 7:** CI is green and the deployed URL works from a second device.
