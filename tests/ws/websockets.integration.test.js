// WebSocket contract for core/apps/ws (needs it running on :3002 alongside the API).
const WebSocket = require("ws");
const { createAdmin, createUser } = require("../_helpers/auth.helper");
const { createSpace, addElement, removeElement, getSpace, acceptInvite } = require("../_helpers/space.helper");
const { createElement } = require("../_helpers/admin.helper");
const { waitForMessage } = require("../_helpers/ws.helper");

const WS_URL = "ws://localhost:3002";

jest.setTimeout(30000);

async function connect(messages) {
  const ws = new WebSocket(WS_URL);
  ws.on("message", (m) => messages.push(JSON.parse(m.toString())));
  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  return ws;
}

function send(ws, type, payload) {
  ws.send(JSON.stringify({ type, payload }));
}

function waitForClose(ws) {
  return new Promise((resolve) => ws.on("close", (code) => resolve(code)));
}

describe("Websocket integration", () => {
  let admin, user, spaceId;
  let ws1, ws2;
  const ws1Messages = [];
  const ws2Messages = [];
  let adminX, adminY;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    const spaceRes = await createSpace(user.token, "WS Space", "100x200", undefined, "Public");
    spaceId = spaceRes.data.spaceId;

    ws1 = await connect(ws1Messages);
    ws2 = await connect(ws2Messages);
  });

  afterAll(() => {
    ws1 && ws1.close();
    ws2 && ws2.close();
  });

  test("Joining a space is acknowledged and announced to others", async () => {
    ws1.send(
      JSON.stringify({ type: "join", payload: { spaceId, token: admin.token } })
    );
    const joined1 = await waitForMessage(ws1Messages);

    ws2.send(
      JSON.stringify({ type: "join", payload: { spaceId, token: user.token } })
    );
    const joined2 = await waitForMessage(ws2Messages);
    const announce = await waitForMessage(ws1Messages);

    expect(joined1.type).toBe("space-joined");
    expect(joined1.payload.users.length).toBe(0);

    expect(joined2.type).toBe("space-joined");
    expect(joined2.payload.users.length).toBe(1);

    expect(announce.type).toBe("user-join");
    expect(announce.payload.userId).toBe(user.userId);
    expect(announce.payload.x).toBe(joined2.payload.spawn.x);
    expect(announce.payload.y).toBe(joined2.payload.spawn.y);

    adminX = joined1.payload.spawn.x;
    adminY = joined1.payload.spawn.y;
  });

  test("Moving outside the map is rejected", async () => {
    ws1.send(
      JSON.stringify({ type: "movement", payload: { x: 100000000, y: 10000000 } })
    );
    const msg = await waitForMessage(ws1Messages);

    expect(msg.type).toBe("movement-rejected");
    expect(msg.payload.x).toBe(adminX);
    expect(msg.payload.y).toBe(adminY);
  });

  test("Moving two tiles at once is rejected", async () => {
    ws1.send(
      JSON.stringify({ type: "movement", payload: { x: adminX + 2, y: adminY } })
    );
    const msg = await waitForMessage(ws1Messages);

    expect(msg.type).toBe("movement-rejected");
    expect(msg.payload.x).toBe(adminX);
    expect(msg.payload.y).toBe(adminY);
  });

  test("A valid one-tile move is broadcast to other users", async () => {
    // Step away from the right edge if the spawn happens to be on it
    const nextX = adminX + 1 < 100 ? adminX + 1 : adminX - 1;

    ws1.send(
      JSON.stringify({ type: "movement", payload: { x: nextX, y: adminY } })
    );
    const msg = await waitForMessage(ws2Messages);

    expect(msg.type).toBe("movement");
    expect(msg.payload.userId).toBe(admin.userId);
    expect(msg.payload.x).toBe(nextX);
    expect(msg.payload.y).toBe(adminY);
  });

  test("Leaving notifies the remaining users", async () => {
    ws1.close();
    const msg = await waitForMessage(ws2Messages);

    expect(msg.type).toBe("user-left");
    expect(msg.payload.userId).toBe(admin.userId);
  });
});

describe("Websocket rules", () => {
  let admin, user;
  const sockets = [];

  async function open() {
    const messages = [];
    const ws = await connect(messages);
    sockets.push(ws);
    return { ws, messages };
  }

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();
  });

  afterAll(() => sockets.forEach((ws) => ws.close()));

  test("Joining with an invalid token is refused and the socket closed", async () => {
    const space = await createSpace(user.token, "WS Auth", "10x10");
    const { ws, messages } = await open();
    const closed = waitForClose(ws);

    send(ws, "join", { spaceId: space.data.spaceId, token: "not-a-jwt" });

    const msg = await waitForMessage(messages);
    expect(msg.type).toBe("error");
    expect(await closed).toBe(4001);
  });

  test("Joining a space that does not exist is refused", async () => {
    const { ws, messages } = await open();
    const closed = waitForClose(ws);

    send(ws, "join", { spaceId: "no-such-space", token: user.token });

    const msg = await waitForMessage(messages);
    expect(msg.type).toBe("error");
    expect(await closed).toBe(4004);
  });

  test("Joining a private space needs an invite", async () => {
    const space = await createSpace(user.token, "WS Private", "10x10");
    const spaceId = space.data.spaceId;

    const refused = await open();
    const closed = waitForClose(refused.ws);
    send(refused.ws, "join", { spaceId, token: admin.token });
    expect((await waitForMessage(refused.messages)).type).toBe("error");
    expect(await closed).toBe(4003);

    const { inviteCode } = (await getSpace(user.token, spaceId)).data;
    expect((await acceptInvite(admin.token, inviteCode)).status).toBe(200);

    const member = await open();
    send(member.ws, "join", { spaceId, token: admin.token });
    expect((await waitForMessage(member.messages)).type).toBe("space-joined");
  });

  test("Moving before joining returns an error", async () => {
    const { ws, messages } = await open();
    send(ws, "movement", { x: 1, y: 1 });

    const msg = await waitForMessage(messages);
    expect(msg.type).toBe("error");
  });

  test("Walking into a static element is rejected", async () => {
    // Spawn is the centre tile of an empty space: (5, 5) for 10x10. Block the tile to its right.
    const space = await createSpace(user.token, "WS Wall", "10x10");
    const element = await createElement(admin.token, { isStatic: true });
    const added = await addElement(user.token, space.data.spaceId, element.data.id, 6, 5);
    expect(added.status).toBe(200);

    const { ws, messages } = await open();
    send(ws, "join", { spaceId: space.data.spaceId, token: user.token });
    const joined = await waitForMessage(messages);
    expect(joined.payload.spawn).toEqual({ x: 5, y: 5 });

    send(ws, "movement", { x: 6, y: 5 });
    const blocked = await waitForMessage(messages);
    expect(blocked.type).toBe("movement-rejected");
    expect(blocked.payload).toEqual({ x: 5, y: 5 });
  });

  test("Joining again from another tab replaces the first session without a leave event", async () => {
    const space = await createSpace(user.token, "WS Tabs", "10x10", undefined, "Public");
    const spaceId = space.data.spaceId;

    const watcher = await open();
    send(watcher.ws, "join", { spaceId, token: admin.token });
    await waitForMessage(watcher.messages);

    const tab1 = await open();
    send(tab1.ws, "join", { spaceId, token: user.token });
    await waitForMessage(tab1.messages);
    expect((await waitForMessage(watcher.messages)).type).toBe("user-join");

    const tab1Closed = waitForClose(tab1.ws);
    const tab2 = await open();
    send(tab2.ws, "join", { spaceId, token: user.token });

    expect((await waitForMessage(tab2.messages)).type).toBe("space-joined");
    expect(await tab1Closed).toBe(4000);

    // The watcher sees the user re-appear, never leave
    const next = await waitForMessage(watcher.messages);
    expect(next.type).toBe("user-join");
    expect(next.payload.userId).toBe(user.userId);
  });
});

describe("Live furniture updates", () => {
  let owner, visitor, spaceId, elementId;
  const sockets = [];

  async function joined(token) {
    const messages = [];
    const ws = await connect(messages);
    sockets.push(ws);
    send(ws, "join", { spaceId, token });
    const msg = await waitForMessage(messages);
    return { ws, messages, spawn: msg.payload.spawn };
  }

  beforeAll(async () => {
    owner = await createUser();
    visitor = await createAdmin();
    const space = await createSpace(owner.token, "WS Build", "10x10", undefined, "Public");
    spaceId = space.data.spaceId;
    const element = await createElement(visitor.token, { isStatic: true });
    elementId = element.data.id;
  });

  afterAll(() => sockets.forEach((ws) => ws.close()));

  test("Placing and removing furniture is pushed live and changes what's walkable", async () => {
    // The visitor spawns in the centre (5, 5); the owner joins to watch the visitor's moves
    const v = await joined(visitor.token);
    expect(v.spawn).toEqual({ x: 5, y: 5 });
    const o = await joined(owner.token);
    expect((await waitForMessage(v.messages)).type).toBe("user-join");

    const added = await addElement(owner.token, spaceId, elementId, 6, 5);
    expect(added.status).toBe(200);

    for (const client of [v, o]) {
      const msg = await waitForMessage(client.messages);
      expect(msg.type).toBe("element-added");
      expect(msg.payload.id).toBe(added.data.element.id);
      expect(msg.payload).toMatchObject({ x: 6, y: 5, element: { id: elementId, static: true } });
    }

    // The new table blocks the tile to the visitor's right
    send(v.ws, "movement", { x: 6, y: 5 });
    expect((await waitForMessage(v.messages)).type).toBe("movement-rejected");

    const removed = await removeElement(owner.token, added.data.element.id);
    expect(removed.status).toBe(200);
    for (const client of [v, o]) {
      const msg = await waitForMessage(client.messages);
      expect(msg).toEqual({ type: "element-removed", payload: { id: added.data.element.id } });
    }

    // Walkable again: the owner sees the visitor step onto it
    send(v.ws, "movement", { x: 6, y: 5 });
    const moved = await waitForMessage(o.messages);
    expect(moved.type).toBe("movement");
    expect(moved.payload).toMatchObject({ userId: visitor.userId, x: 6, y: 5 });
  });

  test("The internal events endpoint rejects callers without the shared secret", async () => {
    const res = await fetch(`http://localhost:3002/internal/spaces/${spaceId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong-secret" },
      body: JSON.stringify({ type: "element-removed", payload: { id: "x" } }),
    });
    expect(res.status).toBe(401);
  });
});
