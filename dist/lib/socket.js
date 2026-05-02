import { WebSocketServer, WebSocket } from "ws";
import { verifyToken } from "../helpers/jwt.helper.js";
let wss = null;
const rooms = new Map();
function parseCookies(cookieHeader) {
    const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader ?? "";
    return rawCookie.split(";").reduce((acc, part) => {
        const [rawKey, ...rest] = part.trim().split("=");
        if (!rawKey) {
            return acc;
        }
        acc[rawKey] = decodeURIComponent(rest.join("="));
        return acc;
    }, {});
}
function readSocketUser(req) {
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
    }
    catch (error) {
        return null;
    }
    return null;
}
function joinRoom(ws, room) {
    if (!rooms.has(room)) {
        rooms.set(room, new Set());
    }
    rooms.get(room).add(ws);
}
function leaveRoom(ws, room) {
    rooms.get(room)?.delete(ws);
}
function leaveAllRooms(ws) {
    for (const clients of rooms.values()) {
        clients.delete(ws);
    }
}
function emitToRoom(room, event, data) {
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
function handleSocketMessage(ws, rawMessage) {
    if (!ws.user) {
        return;
    }
    try {
        const message = JSON.parse(rawMessage);
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
    }
    catch (error) {
        return;
    }
}
export function initSocket(httpServer) {
    wss = new WebSocketServer({ server: httpServer });
    wss.on("connection", (ws, req) => {
        const user = readSocketUser(req);
        if (!user) {
            ws.close();
            return;
        }
        ws.user = user;
        joinRoom(ws, `user:${user.userId}`);
        ws.on("message", (message) => {
            handleSocketMessage(ws, message.toString());
        });
        ws.on("close", () => {
            leaveAllRooms(ws);
        });
    });
    return wss;
}
export function emitVendorChatMessage(payload) {
    emitToRoom(`vendor:${payload.vendorId}`, "new_message", payload);
    emitToRoom(`user:${payload.sender.userId}`, "message_echo", payload);
}
export function emitUserChatMessage(userId, payload) {
    emitToRoom(`user:${userId}`, "new_message", payload);
}
export function emitAdminChatMessage(adminUserId, payload) {
    emitToRoom(`user:${adminUserId}`, "new_message", payload);
}
//# sourceMappingURL=socket.js.map