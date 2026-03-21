import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Wait for socket to be connected. Returns existing socket if already connected,
 * or waits for the connection to be established.
 */
export async function waitForSocket(): Promise<Socket | null> {
  if (socket?.connected) return socket;
  if (connectionPromise) {
    try {
      return await connectionPromise;
    } catch {
      // connectionPromise rejected but socket may have reconnected since
      if (socket?.connected) return socket;
      return null;
    }
  }
  return null;
}

export function connectSocket(token: string): Socket {
  // Return existing connected socket
  if (socket?.connected) return socket;

  // Disconnect stale socket if exists
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionPromise = null;
  }

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Create a promise that resolves when connected
  connectionPromise = new Promise<Socket>((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket not initialized'));
      return;
    }

    const onConnect = () => {
      socket?.off('connect', onConnect);
      socket?.off('connect_error', onError);
      resolve(socket!);
    };

    const onError = (err: Error) => {
      socket?.off('connect', onConnect);
      socket?.off('connect_error', onError);
      reject(err);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onError);

    // If already connected (can happen with persistent connections)
    if (socket.connected) {
      onConnect();
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectionPromise = null;
  }
}
