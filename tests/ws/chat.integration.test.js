// Chat over core/apps/ws (needs it running on :3002 alongside the API): nearby messages reach only people within
// CHAT_RADIUS tiles and aren't saved; space messages reach everyone, are saved and come back in the history.
const WebSocket = require("ws");
const { createUser } = require("../_helpers/auth.helper");
const { createSpace } = require("../_helpers/space.helper");
const { waitForMessage } = require("../_helpers/ws.helper");
const client = require("../_helpers/axios.client");

const WS_URL = "ws://localhost:3002";
// Same as CHAT_RADIUS in @repo/protocol/rules
const CHAT_RADIUS = 5;

jest.setTimeout(30000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Skips messages until one of the given type arrives
async function waitForType(messages, type, timeout) {
  for (;;) {
    const msg = await waitForMessage(messages, timeout);
    if (msg.type === type) return msg;
  }
}

// True if a message of this type arrives within `ms`
async function receives(messages, type, ms = 1000) {
  try {
    await waitForType(messages, type, ms);
    return true;
  } catch {
    return false;
  }
}

async function join(user, spaceId) {
  const messages = [];
  const ws = await connect(messages);
  send(ws, "join", { spaceId, token: user.token });
  const joined = await waitForType(messages, "space-joined");
  return { ws, messages, joined, user };
}

function history(token, spaceId, query = "") {
  return client.get(`/space/${spaceId}/messages${query}`, { headers: { Authorization: `Bearer ${token}` } });
}

describe("Chat", () => {
  let owner, near, far, spaceId;
  const sockets = [];

  beforeAll(async () => {
    const [ownerUser, nearUser, farUser] = await Promise.all([createUser(), createUser(), createUser()]);
    spaceId = (await createSpace(ownerUser.token, "Chat Space", "40x40", undefined, "Public")).data.spaceId;

    // Everyone spawns around the centre of an empty room
    owner = await join(ownerUser, spaceId);
    near = await join(nearUser, spaceId);
    far = await join(farUser, spaceId);
    sockets.push(owner.ws, near.ws, far.ws);

    // `far` walks up, out of earshot, one step at a time (the server limits the pace)
    let { x, y } = far.joined.payload.spawn;
    const target = owner.joined.payload.spawn.y - CHAT_RADIUS - 3;
    while (y > target) {
      y -= 1;
      send(far.ws, "movement", { x, y, dir: "up" });
      await sleep(120);
    }
    await sleep(300);
    for (const p of [owner, near, far]) p.messages.length = 0;
  });

  afterAll(() => sockets.forEach((ws) => ws.close()));

  test("A nearby message reaches people close by, not people far away", async () => {
    send(owner.ws, "chat", { text: "  hello nearby  ", scope: "nearby" });

    const own = await waitForType(owner.messages, "chat");
    const heard = await waitForType(near.messages, "chat");
    expect(own.payload).toMatchObject({ text: "hello nearby", scope: "nearby", userId: owner.user.userId });
    expect(own.payload.username).toBe(owner.user.username);
    expect(heard.payload.id).toBe(own.payload.id);
    expect(await receives(far.messages, "chat")).toBe(false);
  });

  test("Nearby messages aren't saved", async () => {
    const res = await history(owner.user.token, spaceId);
    expect(res.status).toBe(200);
    expect(res.data.messages.some((m) => m.text === "hello nearby")).toBe(false);
  });

  test("A space message reaches everyone and is replayed to people who join later", async () => {
    send(owner.ws, "chat", { text: "hello everyone", scope: "space" });

    for (const p of [owner, near, far]) {
      const msg = await waitForType(p.messages, "chat");
      expect(msg.payload).toMatchObject({ text: "hello everyone", scope: "space" });
    }

    const late = await join(await createUser(), spaceId);
    sockets.push(late.ws);
    expect(late.joined.payload.chat.map((m) => m.text)).toContain("hello everyone");
  });

  test("Saved messages are loaded a page at a time, newest first", async () => {
    for (const text of ["one", "two", "three"]) {
      send(near.ws, "chat", { text, scope: "space" });
      await waitForType(near.messages, "chat");
    }

    const first = await history(near.user.token, spaceId, "?limit=2");
    expect(first.status).toBe(200);
    expect(first.data.messages.map((m) => m.text)).toEqual(["three", "two"]);
    expect(first.data.hasMore).toBe(true);

    const before = encodeURIComponent(first.data.messages[1].at);
    const rest = await history(near.user.token, spaceId, `?limit=10&before=${before}`);
    expect(rest.data.messages.map((m) => m.text)).toEqual(["one", "hello everyone"]);
    expect(rest.data.hasMore).toBe(false);
  });

  test("Empty and overlong messages are refused", async () => {
    near.messages.length = 0;
    send(near.ws, "chat", { text: "   ", scope: "nearby" });
    expect((await waitForType(near.messages, "error")).payload.message).toBe("Invalid message");

    send(near.ws, "chat", { text: "x".repeat(301), scope: "nearby" });
    expect((await waitForType(near.messages, "error")).payload.message).toBe("Invalid message");
  });

  test("Sending too fast is refused without disconnecting", async () => {
    const quietId = (await createSpace(owner.user.token, "Quiet", "10x10", undefined, "Public")).data.spaceId;
    const solo = await join(await createUser(), quietId);
    sockets.push(solo.ws);

    for (let i = 0; i < 6; i++) send(solo.ws, "chat", { text: `spam ${i}`, scope: "nearby" });
    const rejected = await waitForType(solo.messages, "chat-rejected");
    expect(rejected.payload.message).toMatch(/too fast/);
    expect(solo.ws.readyState).toBe(WebSocket.OPEN);
  });

  test("Chatting before joining is refused", async () => {
    const messages = [];
    const ws = await connect(messages);
    sockets.push(ws);
    send(ws, "chat", { text: "hi", scope: "space" });
    expect((await waitForType(messages, "chat-rejected")).payload.message).toMatch(/Join a space/);
  });
});
