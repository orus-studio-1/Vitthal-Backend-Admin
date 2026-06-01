/**
 * notificationEmitter.ts
 * 
 * Socket.IO client that connects to the Client Backend's /notifications namespace.
 * Used to deliver real-time notifications to vendors when the admin reviews products.
 * 
 * Architecture:
 *   Admin Backend (port 9001)  ──Socket.IO client──►  Client Backend (port 9000) /notifications
 *                                                          │
 *                                                          ▼
 *                                                    Vendor Frontend (Socket.IO client)
 *
 * The admin backend inserts the notification into the DB, then forwards it via Socket.IO
 * to the client backend, which broadcasts it to the target user's room.
 */

import { io, Socket } from "socket.io-client";
import { marketplacePool } from "./marketplace.js";

const CLIENT_BACKEND_URL = process.env.CLIENT_BACKEND_URL || "http://localhost:9000";

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Initialize the Socket.IO client connection to the Client Backend's /notifications namespace.
 * This should be called once during server startup.
 */
export function initNotificationEmitter(): void {
    if (socket) {
        if (process.env.Production !== 'true' && process.env.NODE_ENV !== 'production') {
        }
        return;
    }

    if (process.env.Production !== 'true' && process.env.NODE_ENV !== 'production') {
    }

    socket = io(`${CLIENT_BACKEND_URL}/notifications`, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        timeout: 10000,
        autoConnect: true,
    });

    // Join as an admin emitter so the client backend can identify us
    socket.on("connect", () => {
        reconnectAttempts = 0;
        socket?.emit("join_as_admin_emitter");
    });

    socket.on("disconnect", (reason) => {
    });

    socket.on("reconnect_attempt", (attempt) => {
        reconnectAttempts = attempt;
    });

    socket.on("reconnect_failed", () => {
    });

    socket.on("connect_error", (err) => {
        if (reconnectAttempts === 0) {
        }
    });
}

/**
 * Create a notification in the database and emit it in real-time to the target user
 * via the Client Backend's Socket.IO server.
 */
export async function createAndEmitNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    referenceType?: string;
    referenceId?: string;
}): Promise<void> {
    try {
        // 1. Insert into the database
        const result = await marketplacePool.query(
            `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, type, title, body, reference_type, reference_id, is_read, created_at`,
            [
                params.userId,
                params.type,
                params.title,
                params.body,
                params.referenceType || null,
                params.referenceId || null,
            ]
        );

        if (!result.rows.length) {
            return;
        }

        const notification = result.rows[0];

        // 2. Emit via Socket.IO to the Client Backend for real-time delivery
        if (socket?.connected) {
            socket.emit("forward_notification", {
                targetUserId: params.userId,
                notification,
            });
        } else {

        }
    } catch (error) {
    }
}

/**
 * Gracefully disconnect the Socket.IO client.
 */
export function disconnectNotificationEmitter(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
