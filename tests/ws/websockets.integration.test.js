// WebSocket contract for Phase 2. Expected to fail until core/apps/ws exists.
const WebSocket = require("ws");
const { createAdmin, createUser } = require("../_helpers/auth.helper");
const { createSpace } = require("../_helpers/space.helper");
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

describe("Websocket integration", () => {
  let admin, user, spaceId;
  let ws1, ws2;
  const ws1Messages = [];
  const ws2Messages = [];
  let adminX, adminY;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    const spaceRes = await createSpace(user.token, "WS Space", "100x200");
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
