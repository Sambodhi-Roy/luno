const WebSocket = require("ws");
const { createAdmin, createUser } = require("../_helpers/auth.helper");
const { waitForMessage } = require("../_helpers/ws.helper");

jest.setTimeout(30000);

describe("Websocket integration", () => {
  let admin, user, ws1, ws2;
  let ws1Messages = [];
  let ws2Messages = [];

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    ws1 = new WebSocket("ws://localhost:3001");
    ws1.on("message", (m) => ws1Messages.push(JSON.parse(m.toString())));
    await new Promise((r) => ws1.on("open", r));

    ws2 = new WebSocket("ws://localhost:3001");
    ws2.on("message", (m) => ws2Messages.push(JSON.parse(m.toString())));
    await new Promise((r) => ws2.on("open", r));
  });

  afterAll(() => {
    ws1 && ws1.close();
    ws2 && ws2.close();
  });

  test("Join space flow (example)", async () => {
    // you will send join payloads and waitForMessage from helper
    ws1.send(
      JSON.stringify({
        type: "join",
        payload: { token: admin.token, spaceId: "foo" },
      })
    );
    const msg = await waitForMessage(ws1Messages);
    expect(msg.type).toBeDefined();
  });
});
