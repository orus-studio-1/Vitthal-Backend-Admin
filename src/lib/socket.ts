import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { verifyToken } from "../helpers/jwt.helper.js";

type SocketUser = {
    userId: string;
    username: string;
    email: string;
    role: string;
};

type ExtWebSocket = WebSocket & {
    user?: SocketUser;
};

type ChatPayload = {
    vendorId: string;
    sender: {
        userId: string;
        role: string;
    };
    message: unknown;
};

let wss: WebSocketServer | null = null;

const rooms = new Map<string, Set<ExtWebSocket>>();

function parseCookies(cookieHeader?: string | string[]) {
    const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader ?? "";
    return rawCookie.split(";").reduce((acc, part) => {
        const [rawKey, ...rest] = part.trim().split("=");
        if (!rawKey) {
            return acc;
        }
        acc[rawKey] = decodeURIComponent(rest.join("="));
        return acc;
    }, {} as Record<string, string>);
}

function readSocketUser(req: IncomingMessage): SocketUser | null {
    try {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const tokenFromQuery = url.searchParams.get("token");

        if (tokenFromQuery) {
            return verifyToken(tokenFromQuery, "access");
        }

        const cookies = parseCookies(req.headers.cookie);
        if (cookies.accessToken) {
            return verifyToken(cookies.accessToken, "access");
        }

        if (cookies.refreshToken) {
            return verifyToken(cookies.refreshToken, "refresh");
        }
    } catch (error) {
        return null;
    }

    return null;
}

function joinRoom(ws: ExtWebSocket, room: string) {
    if (!rooms.has(room)) {
        rooms.set(room, new Set());
    }

    rooms.get(room)!.add(ws);
}

function leaveRoom(ws: ExtWebSocket, room: string) {
    rooms.get(room)?.delete(ws);
}

function leaveAllRooms(ws: ExtWebSocket) {
    for (const clients of rooms.values()) {
        clients.delete(ws);
    }
}

function emitToRoom(room: string, event: string, data: unknown) {
    const clients = rooms.get(room);
    if (!clients) {
        return;
    }

    const payload = JSON.stringify({ event, data });
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

function handleSocketMessage(ws: ExtWebSocket, rawMessage: string) {
    if (!ws.user) {
        return;
    }

    try {
        const message = JSON.parse(rawMessage) as { event?: string; data?: { vendorId?: string } };
        if (message.event === "join_chat") {
            joinRoom(ws, `user:${ws.user.userId}`);
            if (ws.user.role === "vendor") {
                joinRoom(ws, `vendor:${ws.user.userId}`);
            }
            if (message.data?.vendorId) {
                joinRoom(ws, `vendor:${message.data.vendorId}`);
            }
        }

        if (message.event === "leave_chat" && message.data?.vendorId) {
            leaveRoom(ws, `vendor:${message.data.vendorId}`);
        }
    } catch (error) {
        return;
    }
}

export function initSocket(httpServer: HttpServer) {
    wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws: ExtWebSocket, req: IncomingMessage) => {
        const user = readSocketUser(req);
        if (!user) {
            ws.close();
            return;
        }

        ws.user = user;
        joinRoom(ws, `user:${user.userId}`);

        ws.on("message", (message: WebSocket.RawData) => {
            handleSocketMessage(ws, message.toString());
        });

        ws.on("close", () => {
            leaveAllRooms(ws);
        });
    });

    return wss;
}

export function emitVendorChatMessage(payload: ChatPayload) {
    emitToRoom(`vendor:${payload.vendorId}`, "new_message", payload);
    emitToRoom(`user:${payload.sender.userId}`, "message_echo", payload);
}

export function emitUserChatMessage(userId: string, payload: ChatPayload) {
    emitToRoom(`user:${userId}`, "new_message", payload);
}

export function emitAdminChatMessage(adminUserId: string, payload: ChatPayload) {
    emitToRoom(`user:${adminUserId}`, "new_message", payload);
}
