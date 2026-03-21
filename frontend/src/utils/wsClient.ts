import type { WSEnvelope } from '@/types/ws';

type MessageSubscriber = (message: WSEnvelope) => void;

function resolveWsMessagesUrl(): string {
  const raw = import.meta.env.VITE_WS_URL as string | undefined;
  if (raw !== undefined && raw !== '') {
    return raw;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/v1/ws/messages`;
  }
  return 'ws://localhost:8080/api/v1/ws/messages';
}

class WSClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private readonly subscribers = new Set<MessageSubscriber>();
  private token: string | null = null;

  connect(token: string): void {
    this.token = token;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const wsBase = resolveWsMessagesUrl();
    const url = `${wsBase}?token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WSEnvelope;
        this.subscribers.forEach((subscriber) => subscriber(payload));
      } catch {
        // Ignore malformed frames.
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  subscribe(subscriber: MessageSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private scheduleReconnect(): void {
    if (!this.token) {
      return;
    }
    if (this.reconnectTimer) {
      return;
    }
    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts += 1;
      if (this.token) {
        this.connect(this.token);
      }
    }, delayMs);
  }
}

export const wsClient = new WSClient();
