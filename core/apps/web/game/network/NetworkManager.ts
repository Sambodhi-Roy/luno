import type { ClientMessage, ServerMessage, ServerMessageType } from "@repo/protocol";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002";

// Wait longer after each failed attempt, capped at the last value
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000];
// Close codes from apps/ws that mean "don't retry": replaced by another tab, unauthorized, space not found
const TERMINAL_CLOSE_CODES = new Set([4000, 4001, 4003, 4004]);

export type ConnectionStatus =
  | { state: "connecting" }
  | { state: "connected" }
  | { state: "reconnecting" }
  // `code` is the WebSocket close code from apps/ws (4000 replaced, 4001 unauthorized, 4003 forbidden, 4004 not found)
  | { state: "closed"; code: number; reason: string };

type PayloadOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>["payload"];
type Handler<T extends ServerMessageType> = (payload: PayloadOf<T>) => void;

/**
 * Keeps one WebSocket to apps/ws for a space: joins on every (re)connect and dispatches server messages.
 * Auth rides on the httpOnly `token` cookie the browser sends with the upgrade request.
 */
export class NetworkManager {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private lastError: string | null = null;
  // Keyed by message type; `on` guarantees each handler matches its type's payload
  private readonly handlers = new Map<ServerMessageType, (payload: unknown) => void>();

  constructor(
    private readonly spaceId: string,
    private readonly onStatus: (status: ConnectionStatus) => void
  ) {}

  on<T extends ServerMessageType>(type: T, handler: Handler<T>) {
    this.handlers.set(type, handler as (payload: unknown) => void);
    return this;
  }

  connect() {
    this.onStatus({ state: this.attempt === 0 ? "connecting" : "reconnecting" });
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.send({ type: "join", payload: { spaceId: this.spaceId } });
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      if (message.type === "space-joined") {
        this.attempt = 0;
        this.onStatus({ state: "connected" });
      }
      if (message.type === "error") this.lastError = message.payload.message;
      this.handlers.get(message.type)?.(message.payload);
    };

    ws.onclose = (event) => {
      if (this.stopped) return;
      if (TERMINAL_CLOSE_CODES.has(event.code)) {
        this.onStatus({ state: "closed", code: event.code, reason: this.lastError ?? "Disconnected" });
        return;
      }
      const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
      this.attempt++;
      this.onStatus({ state: "reconnecting" });
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  sendMove(x: number, y: number) {
    this.send({ type: "movement", payload: { x, y } });
  }

  close() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }
}
