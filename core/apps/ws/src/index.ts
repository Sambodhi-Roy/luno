import "dotenv/config";
import { createServer } from "node:http";
import client, { pruneChatMessages } from "@repo/db/client";
import { WebSocketServer, type WebSocket } from "ws";
import { tokenFromCookieHeader } from "./auth.js";
import { handleInternalRequest } from "./internal.js";
import { RoomManager } from "./RoomManager.js";
import { Session } from "./Session.js";

const PORT = Number(process.env.PORT ?? 3002);
// Messages are tiny JSON objects; anything bigger is a mistake or abuse
const MAX_PAYLOAD_BYTES = 4 * 1024;
// Connections that stop answering pings (closed laptop, dropped network) are cleaned up
const HEARTBEAT_MS = 30_000;
// Old space-wide chat is deleted this often (pruneChatMessages has the limits)
const CHAT_PRUNE_MS = 60 * 60_000;

const rooms = new RoomManager();

// Plain HTTP requests are the internal events endpoint; WebSocket upgrades go to the game server
const server = createServer((req, res) => {
  handleInternalRequest(req, res, rooms).catch((e) => {
    console.error("ws: internal request failed", e);
    if (!res.headersSent) res.writeHead(500).end();
  });
});
const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD_BYTES });
const alive = new WeakMap<WebSocket, boolean>();

wss.on("connection", (ws, req) => {
  alive.set(ws, true);
  ws.on("pong", () => alive.set(ws, true));
  new Session(ws, rooms, tokenFromCookieHeader(req.headers.cookie));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, HEARTBEAT_MS);

function pruneChat() {
  pruneChatMessages(client).catch((e) => console.error("ws: pruning chat failed", e));
}
const chatPrune = setInterval(pruneChat, CHAT_PRUNE_MS);

wss.on("close", () => {
  clearInterval(heartbeat);
  clearInterval(chatPrune);
});
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  // Open a database connection now, so the first player to join doesn't wait for the handshake
  client.$queryRaw`SELECT 1`.catch((e) => console.error("ws: database warm-up failed", e));
  pruneChat();
});
