// Custom maps: spaces whose floors and walls are painted in the editor (needs http and ws running).
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { createUser } = require("../_helpers/auth.helper");
const {
  createSpace,
  createCustomSpace,
  getSpace,
  getAllSpaces,
  saveCustomMap,
  uploadSpaceThumbnail,
} = require("../_helpers/space.helper");
const { waitForMessage } = require("../_helpers/ws.helper");

jest.setTimeout(30000);

const WEB_PUBLIC = path.resolve(__dirname, "../../core/apps/web/public");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

// Small custom maps are 20x15 tiles
const W = 20;
const H = 15;
const at = (x, y) => y * W + x;

describe("Custom maps", () => {
  let owner, other, spaceId;
  const createdFiles = [];

  beforeAll(async () => {
    owner = await createUser();
    other = await createUser();
    const res = await createCustomSpace(owner.token, "Custom room", "small", "Public");
    expect(res.status).toBe(200);
    spaceId = res.data.spaceId;
  });

  // Don't leave generated covers in the uploads folder
  afterAll(() => {
    for (const file of createdFiles) fs.rmSync(file, { force: true });
  });

  test("A new custom space is a walled room of plain floor at the preset size", async () => {
    const res = await getSpace(owner.token, spaceId);
    expect(res.status).toBe(200);
    expect(res.data.dimensions).toBe(`${W}x${H}`);
    expect(res.data.mapId).toBeNull();

    const { floor, walls } = res.data.customMap;
    expect(floor).toHaveLength(W * H);
    expect(walls).toHaveLength(W * H);
    expect(floor.every((f) => f === 1)).toBe(true);
    // The border is wall, the inside is open
    expect(walls[at(0, 0)]).toBe(1);
    expect(walls[at(W - 1, H - 1)]).toBe(1);
    expect(walls[at(5, 5)]).toBe(0);
    expect(walls.filter(Boolean)).toHaveLength(2 * W + 2 * (H - 2));
  });

  test("Other spaces have no custom map", async () => {
    const res = await createSpace(owner.token, "Plain room", "10x10");
    const space = await getSpace(owner.token, res.data.spaceId);
    expect(space.data.customMap).toBeNull();

    const save = await saveCustomMap(owner.token, res.data.spaceId, { floor: Array(100).fill(1), walls: Array(100).fill(0) });
    expect(save.status).toBe(400);
  });

  test("The owner can save floors and walls", async () => {
    const { data } = await getSpace(owner.token, spaceId);
    const map = data.customMap;
    map.floor[at(3, 3)] = 4;
    map.walls[at(8, 3)] = 2;

    const res = await saveCustomMap(owner.token, spaceId, map);
    expect(res.status).toBe(200);

    const after = await getSpace(owner.token, spaceId);
    expect(after.data.customMap.floor[at(3, 3)]).toBe(4);
    expect(after.data.customMap.walls[at(8, 3)]).toBe(2);
  });

  test("Only the owner can change the map", async () => {
    const res = await saveCustomMap(other.token, spaceId, { floor: Array(W * H).fill(1), walls: Array(W * H).fill(0) });
    expect(res.status).toBe(403);
  });

  test("A map of the wrong size or with bad style ids is rejected", async () => {
    const short = await saveCustomMap(owner.token, spaceId, { floor: [1, 1], walls: [0, 0] });
    expect(short.status).toBe(400);

    const negative = await saveCustomMap(owner.token, spaceId, {
      floor: Array(W * H).fill(-1),
      walls: Array(W * H).fill(0),
    });
    expect(negative.status).toBe(400);
  });

  test("Only the owner can set the cover image, and it must be a PNG", async () => {
    const notOwner = await uploadSpaceThumbnail(other.token, spaceId, PNG);
    expect(notOwner.status).toBe(403);

    const notPng = await uploadSpaceThumbnail(owner.token, spaceId, Buffer.from("not an image"));
    expect(notPng.status).toBe(400);

    const res = await uploadSpaceThumbnail(owner.token, spaceId, PNG);
    expect(res.status).toBe(200);
    expect(res.data.thumbnail).toMatch(new RegExp(`^/uploads/thumbnails/space-${spaceId}-[\\w-]+\\.png$`));
    createdFiles.push(path.join(WEB_PUBLIC, res.data.thumbnail));

    const listed = await getAllSpaces(owner.token);
    expect(listed.data.spaces.find((s) => s.id === spaceId).thumbnail).toBe(res.data.thumbnail);
  });

  test("A new cover replaces the previous file", async () => {
    const first = await uploadSpaceThumbnail(owner.token, spaceId, PNG);
    const second = await uploadSpaceThumbnail(owner.token, spaceId, PNG);
    createdFiles.push(path.join(WEB_PUBLIC, second.data.thumbnail));

    expect(second.data.thumbnail).not.toBe(first.data.thumbnail);
    // Deleted in the background after the response
    await new Promise((r) => setTimeout(r, 300));
    expect(fs.existsSync(path.join(WEB_PUBLIC, first.data.thumbnail))).toBe(false);
  });
});

describe("Custom maps in the game", () => {
  const sockets = [];

  afterAll(() => sockets.forEach((ws) => ws.close()));

  async function join(token, spaceId) {
    const messages = [];
    const ws = new WebSocket("ws://localhost:3002");
    sockets.push(ws);
    ws.on("message", (m) => messages.push(JSON.parse(m.toString())));
    await new Promise((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
    });
    ws.send(JSON.stringify({ type: "join", payload: { spaceId, token } }));
    const joined = await waitForMessage(messages);
    expect(joined.type).toBe("space-joined");
    return { ws, messages, spawn: joined.payload.spawn };
  }

  const move = (ws, x, y) => ws.send(JSON.stringify({ type: "movement", payload: { x, y } }));

  test("Walls block movement, and painting them away opens the way for everyone inside", async () => {
    const owner = await createUser();
    const visitor = await createUser();
    const { data } = await createCustomSpace(owner.token, "Custom walls", "small", "Public");
    const spaceId = data.spaceId;

    // Spawn is the centre tile (10, 7); put a wall just to its right
    const { data: space } = await getSpace(owner.token, spaceId);
    const map = space.customMap;
    map.walls[at(11, 7)] = 1;
    expect((await saveCustomMap(owner.token, spaceId, map)).status).toBe(200);

    const v = await join(visitor.token, spaceId);
    expect(v.spawn).toEqual({ x: 10, y: 7 });
    const watcher = await join(owner.token, spaceId);
    await waitForMessage(v.messages); // the watcher's user-join

    move(v.ws, 11, 7);
    const rejected = await waitForMessage(v.messages);
    expect(rejected.type).toBe("movement-rejected");

    // The owner removes the wall in the editor; everyone inside gets the new layout
    map.walls[at(11, 7)] = 0;
    expect((await saveCustomMap(owner.token, spaceId, map)).status).toBe(200);
    const updated = await waitForMessage(v.messages);
    expect(updated.type).toBe("map-updated");
    expect(updated.payload.walls[at(11, 7)]).toBe(0);
    expect((await waitForMessage(watcher.messages)).type).toBe("map-updated");

    move(v.ws, 11, 7);
    const moved = await waitForMessage(watcher.messages);
    expect(moved).toMatchObject({ type: "movement", payload: { x: 11, y: 7 } });
  });
});
