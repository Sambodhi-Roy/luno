# Luno Roadmap

Luno is a 2D metaverse in the style of Gather and Zep. Users sign in, pick an avatar, and join a space. There they walk around a shared map, see each other move live, chat, and get proximity audio and video.

**Target:** a portfolio-grade product that is polished, demoable, and deployed.

## Status

| Phase | Name | Status |
|---|---|---|
| 0 | Stabilise the foundation | ✅ Done |
| 1 | Web app shell | ✅ Done |
| 2 | Real-time multiplayer | ✅ Done |
| 3 | Space building (place elements) | ✅ Done |
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
- [x] Pages: `/login`, `/signup`, `/dashboard` (my spaces, create a space from a map picker), `/space/[spaceId]`, avatar picker
- [x] API client and auth (cookie with `credentials: include`, CORS on `http`), plus `GET /user/me`, `POST /user/signout`, `GET /maps`
- [x] `WorldScene` receives the space, loads the map's `.tmj` and tilesets dynamically, and renders `spaceElements`. Static elements collide on their bottom row.
- [x] Fix the `GameCanvas` mount race (StrictMode currently creates two Phaser games)
- [x] Seed script (`npx prisma db seed`): the "Office" map, 6 furniture elements, the "Adam" avatar (later: Office and Village maps, 62 avatars)

**Done when:** a user can sign up, create a space from the sample map, open it, and walk around alone with elements loaded from the DB. ✅ Verified in headless Chrome, and 34/34 HTTP tests pass.

### Phase 2: Real-time multiplayer
- [x] `core/apps/ws`: Node with `ws` on :3002, a `RoomManager` (spaceId → room, loaded on first join and dropped when empty), and a `Session` per socket
- [x] Messages: `join` → `space-joined {spawn, users}`, `user-join`, `movement` / `movement-rejected`, `user-left`, `error`
- [x] Verify the JWT on join (from the auth cookie, or a `token` in the payload), and build the collision grid from the `.tmj` plus static elements
- [x] `@repo/protocol`: message types, Zod schemas and the shared collision rules (`@repo/protocol/rules`), used by both server and client
- [x] Client: `NetworkManager` (auto-reconnect), an `Avatar` entity for other players, and a `LocalPlayer` that steps tile by tile with predicted collisions
- [x] Name labels over avatars, an online count and connection status in the space page, and a second tab replaces the first session

**Done when:** `tests/ws` passes and two browser tabs see each other move smoothly. ✅ 44/44 tests pass, and a two-player headless Chrome run sees join, movement and leave.

### Phase 3: Space building
- [x] Build mode for the space owner: furniture palette, see-through preview snapped to the grid (red outline when it doesn't fit), click to place, right-click to remove
- [x] Live sync: after a change `apps/http` notifies `apps/ws` (internal endpoint, shared `INTERNAL_SECRET`), which updates the room's collision grid and broadcasts `element-added` / `element-removed`
- [x] Admin page (`/admin`): upload furniture, avatars and Tiled maps (`.tmj` plus tilesets plus a thumbnail). Files are stored in `apps/web/public/uploads` for now.
- [x] Tilesets live next to their `.tmj`, so any uploaded map renders without code changes

**Done when:** the owner rearranges furniture live while a visitor watches it change and collides with it. ✅ 53/53 tests pass. Headless Chrome confirms owner/visitor live placement and removal, and an admin upload of furniture and a map that a new space then uses.

### Between Phases 3 and 4: space access and the editor
- [x] Spaces are **Public** (listed in Explore, open to anyone signed in) or **Private** (invite link only). New spaces default to Private; spaces that existed before were migrated to Public.
- [x] `SpaceMember` records non-owners who joined through an invite or a public visit. The dashboard has **Your spaces**, **Joined** (most recently visited first) and **Explore** tabs.
- [x] One access rule (owner, public, or member), enforced by `GET /space/:id` in `apps/http` and on `join` in `apps/ws` (close code 4003)
- [x] Invite links (`/invite/<code>`) that the owner can reset. Signed-out visitors log in and come back to the invite.
- [x] Building moved out of the live space into a dedicated editor (`/space/:id/edit`, from the card's ⋯ menu). It has no avatar or connection, and changes still reach players live.
- [x] `promote-admin` / `demote-admin` scripts in `@repo/db`, so admins don't depend on self-signup

**Known limitation:** switching a space to Private doesn't remove people who are already inside. It only affects new joins.

### Between Phases 3 and 4: UI polish
A pass to make the app feel like a finished product before the social layer. The look follows Twitch (near-black layered surfaces, `#9146FF` for actions, pill buttons, the card hover that reveals a purple block), and the in-space layout follows Gather and ZEP.
- [x] Design system in `globals.css`: Twitch palette, Inter and Space Grotesk, and utilities for buttons, badges, a floating dock, key caps and skeletons. `lucide-react` icons, `sonner` toasts, and a moon logo and favicon.
- [x] Shared primitives: accessible `Modal` (Escape, focus trap, fixed header and footer), `useConfirm` in place of `confirm()`, `EmptyState`, `FullPageState`, `Popover`, `friendlyError` for user-facing API errors, and a `useMe` status so an unreachable API shows a retry screen instead of loading forever
- [x] Pages: a marketing landing page, split-layout auth with a banner for invite links, a dashboard with a header and account menu, tabs in the URL with counts, skeletons and empty states with actions, redesigned space cards, an invite page that knows existing members (`isMember` on `GET /space/invite/:code`), admin sections with previews, a branded 404 and error pages, and per-route titles
- [x] Space HUD: a loading screen with progress until you've joined, a space title with live status, a share popover, a dock with your avatar, a first-visit controls card, and a dialog for disconnects that won't retry (another tab, lost access, space deleted) with Rejoin
- [x] In game: each player's chosen avatar (sheets load on demand and fall back to the default character), rounded name tags, and a purple tag and floor marker for yourself
- [x] Editor: floating top bar with a saving indicator, a collapsible furniture panel (bottom sheet on phones) with retry, toasts for errors, and Undo after removing furniture

### Between Phases 3 and 4: art swap
The first art was LimeZu's free pack, which is non-commercial only, and its 16x32 avatars were drawn at 2x over 32px tiles.
- [x] All art is now Pipoya's free 32x32 packs (commercial use allowed, no redistribution), kept in the private `luno-assets` repo and mounted as a submodule at `apps/web/public/assets`
- [x] Maps: a rebuilt 25x25 Office (same id, so existing spaces keep working) and a 60x60 Village converted from Pipoya's sample map, both with a hidden `Collision` layer
- [x] 62 avatars (every human Pipoya character, first colour variant) in the 32x32, 3x4 layout, drawn at 1x so characters match the map's pixel size, and 67 furniture and outdoor pieces cropped from the tileset (listed in the assets repo's `elements.json`, which the seed reads)

### Phase 4: Social layer
- [ ] Text chat, both space-wide and proximity
- [ ] Online-users sidebar, emotes and reactions, follow a user
- [x] Invite links, with an optional private-space flag (done early, see above)
- [x] Avatar sprite sheets per `Avatar`, replacing the hardcoded "adam" (done in the UI polish pass; every sheet shares one layout, now Pipoya's 32x32 3x4)

### Phase 5: Proximity audio/video (LiveKit)
- [ ] `POST /space/:id/av-token` issues a LiveKit token (room = spaceId, identity = userId)
- [ ] Publish mic and camera. Subscribe or unsubscribe to others by tile distance, recomputed on every movement event.
- [ ] Video bubble UI, mute and camera toggles, device picker
- [ ] Private zones from a Tiled object layer: users in the same zone hear each other and are isolated from everyone else
- [ ] Screen share

**Done when:** walking toward someone brings in their video, and walking away drops it.

### Phase 6: Customisable maps and interactive objects
- [x] Custom maps: "Custom map" when creating a space opens the editor on a walled room (small 20x15, medium 32x24 or large 48x36). The owner paints floors, draws walls (their tops and fronts are drawn automatically, and they block movement), and places furniture. Saves go live to everyone in the space, and the dashboard cover is rendered from the map.
- [x] Usernames are case-insensitive (`citext`), so "Sam" and "sam" can no longer be two different accounts
- [ ] Custom maps: undo for painting, more styles (outdoor terrain, water), and resizing a map after it's created
- [ ] Users can upload their own Tiled maps (admins can already)
- [ ] Portals (teleport or change space), embedded iframes, whiteboards, and YouTube on "press X"
- [ ] Multiple rooms per space (linked maps)

### Phase 7: Ship it
- [ ] Deploy: web on Vercel, `http` and `ws` on Fly.io or Railway, Postgres on Neon, LiveKit Cloud
- [ ] Asset hosting: give the deploy read access to the private `luno-assets` submodule, or move assets and admin uploads to object storage (e.g. Cloudflare R2) and store absolute URLs
- [ ] Credit Pipoya in the app (an about or credits page)
- [ ] Docker Compose for local development
- [ ] GitHub Actions CI: typecheck, lint, and integration tests
- [ ] Hardening: rate limits, WS message validation, auth on every WS message
- [ ] Landing page, demo GIF, architecture diagram in the README

---

## Verification per phase
- **Phases 0 and 2:** start `http` on :3001 (and `ws` on :3002 for Phase 2), then run `cd tests && pnpm test`.
- **Phases 1 and 3–5:** check manually with two browser windows (one normal, one incognito) as two users, following each phase's "Done when" line.
- **Phase 7:** CI is green and the deployed URL works from a second device.
