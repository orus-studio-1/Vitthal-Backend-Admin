import { WebSocketServer } from "ws";
import type { Server as HttpServer } from "http";
type ChatPayload = {
    vendorId: string;
    sender: {
        userId: string;
        role: string;
    };
    message: unknown;
};
export declare function initSocket(httpServer: HttpServer): WebSocketServer;
export declare function emitVendorChatMessage(payload: ChatPayload): void;
export declare function emitUserChatMessage(userId: string, payload: ChatPayload): void;
export declare function emitAdminChatMessage(adminUserId: string, payload: ChatPayload): void;
export {};
//# sourceMappingURL=socket.d.ts.map