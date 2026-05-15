import { marketplacePool } from "../lib/marketplace.js";

const adminRoles = ["admin", "super_admin"] as const;

function parseInteger(value: unknown) {
    const parsed = parseInt(String(value ?? 0), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getPagination(page: number, limit: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
    return {
        page: safePage,
        limit: safeLimit,
        offset: (safePage - 1) * safeLimit,
    };
}

export type ChatMessageOut = {
    id: string;
    vendorId: string;
    senderUserId: string;
    senderRole: string;
    body: string;
    isRead: boolean;
    createdAt: string;
};

function mapMessage(row: any): ChatMessageOut {
    return {
        id: row.id,
        vendorId: row.vendor_id,
        senderUserId: row.sender_user_id,
        senderRole: row.sender_role,
        body: row.body,
        isRead: row.is_read,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
}

export async function getVendorChatIdentityByUserId(userId: string) {
    const result = await marketplacePool.query(
        `
            SELECT
                v.id AS vendor_id,
                v.company_name,
                u.name,
                u.email
            FROM vendors v
            JOIN users u ON u.id = v.user_id
            WHERE v.user_id = $1
        `,
        [userId]
    );

    return result.rows[0] ?? null;
}

export async function getVendorChatHistory(userId: string, page: number, limit: number) {
    const vendor = await getVendorChatIdentityByUserId(userId);
    if (!vendor) {
        throw new Error("Vendor not found");
    }

    return getConversationByVendorId(vendor.vendor_id, page, limit, "vendor");
}

export async function sendMessageAsVendor(userId: string, body: string) {
    const vendor = await getVendorChatIdentityByUserId(userId);
    if (!vendor) {
        throw new Error("Vendor not found");
    }

    const trimmedBody = String(body ?? "").trim();
    if (!trimmedBody) {
        throw new Error("Message body is required");
    }

    const result = await marketplacePool.query(
        `
            INSERT INTO vendor_chat_messages (vendor_id, sender_user_id, sender_role, body)
            VALUES ($1, $2, 'vendor', $3)
            RETURNING *
        `,
        [vendor.vendor_id, userId, trimmedBody]
    );

    return {
        vendor,
        message: mapMessage(result.rows[0]),
    };
}

export async function getAdminConversationList() {
    const result = await marketplacePool.query(
        `
            WITH ranked_messages AS (
                SELECT
                    m.*,
                    ROW_NUMBER() OVER (PARTITION BY m.vendor_id ORDER BY m.created_at DESC) AS row_num
                FROM vendor_chat_messages m
            ),
            unread_counts AS (
                SELECT
                    vendor_id,
                    COUNT(*)::int AS unread_count
                FROM vendor_chat_messages
                WHERE sender_role = 'vendor' AND is_read = FALSE
                GROUP BY vendor_id
            )
            SELECT
                v.id AS vendor_id,
                v.company_name,
                v.phone,
                u.id AS user_id,
                u.name,
                u.email,
                COALESCE(unread_counts.unread_count, 0) AS unread_count,
                ranked_messages.id AS last_message_id,
                ranked_messages.sender_user_id AS last_message_sender_user_id,
                ranked_messages.sender_role AS last_message_sender_role,
                ranked_messages.body AS last_message_body,
                ranked_messages.is_read AS last_message_is_read,
                ranked_messages.created_at AS last_message_created_at
            FROM vendors v
            JOIN users u ON u.id = v.user_id
            LEFT JOIN ranked_messages
                ON ranked_messages.vendor_id = v.id
               AND ranked_messages.row_num = 1
            LEFT JOIN unread_counts
                ON unread_counts.vendor_id = v.id
            ORDER BY ranked_messages.created_at DESC NULLS LAST, v.company_name ASC
        `
    );

    return result.rows.map((row) => ({
        vendorId: row.vendor_id,
        vendor: {
            id: row.vendor_id,
            userId: row.user_id,
            companyName: row.company_name,
            name: row.name,
            email: row.email,
            phone: row.phone,
        },
        unreadCount: parseInteger(row.unread_count),
        lastMessage: row.last_message_id ? {
            id: row.last_message_id,
            vendorId: row.vendor_id,
            senderUserId: row.last_message_sender_user_id,
            senderRole: row.last_message_sender_role,
            body: row.last_message_body,
            isRead: row.last_message_is_read,
            createdAt: row.last_message_created_at instanceof Date
                ? row.last_message_created_at.toISOString()
                : row.last_message_created_at,
        } : null,
    }));
}

export async function getAdminChatRecipients() {
    const result = await marketplacePool.query(
        `
            SELECT id, role::text AS role
            FROM users
            WHERE role IN ('admin', 'super_admin')
              AND is_active = TRUE
        `
    );

    return result.rows as Array<{ id: string; role: string }>;
}

export async function getConversationByVendorId(vendorId: string, page: number, limit: number, viewerRole: "vendor" | "admin") {
    const vendorResult = await marketplacePool.query(
        `
            SELECT
                v.id AS vendor_id,
                v.company_name,
                v.phone,
                u.id AS user_id,
                u.name,
                u.email
            FROM vendors v
            JOIN users u ON u.id = v.user_id
            WHERE v.id = $1
        `,
        [vendorId]
    );

    if (!vendorResult.rows.length) {
        throw new Error("Vendor not found");
    }

    const { page: safePage, limit: safeLimit, offset } = getPagination(page, limit);

    const [messagesResult, totalResult] = await Promise.all([
        marketplacePool.query(
            `
                SELECT *
                FROM vendor_chat_messages
                WHERE vendor_id = $1
                ORDER BY created_at ASC
                OFFSET $2
                LIMIT $3
            `,
            [vendorId, offset, safeLimit]
        ),
        marketplacePool.query(
            `SELECT COUNT(*)::int AS total FROM vendor_chat_messages WHERE vendor_id = $1`,
            [vendorId]
        ),
    ]);

    await marketplacePool.query(
        `
            UPDATE vendor_chat_messages
            SET is_read = TRUE
            WHERE vendor_id = $1
              AND sender_role ${viewerRole === "vendor" ? `IN ('admin', 'super_admin')` : `= 'vendor'`}
              AND is_read = FALSE
        `,
        [vendorId]
    );

    return {
        vendor: {
            id: vendorResult.rows[0].vendor_id,
            userId: vendorResult.rows[0].user_id,
            companyName: vendorResult.rows[0].company_name,
            name: vendorResult.rows[0].name,
            email: vendorResult.rows[0].email,
            phone: vendorResult.rows[0].phone,
        },
        messages: messagesResult.rows.map(mapMessage),
        meta: {
            page: safePage,
            limit: safeLimit,
            total: parseInteger(totalResult.rows[0]?.total),
        },
    };
}

export async function sendMessageAsAdmin(adminUserId: string, adminRole: string, vendorId: string, body: string) {
    if (!adminRoles.includes(adminRole as (typeof adminRoles)[number])) {
        throw new Error("Only admins can send messages from this endpoint");
    }

    const trimmedBody = String(body ?? "").trim();
    if (!trimmedBody) {
        throw new Error("Message body is required");
    }

    const vendorResult = await marketplacePool.query(
        `SELECT id, company_name, user_id FROM vendors WHERE id = $1`,
        [vendorId]
    );

    if (!vendorResult.rows.length) {
        throw new Error("Vendor not found");
    }

    const result = await marketplacePool.query(
        `
            INSERT INTO vendor_chat_messages (vendor_id, sender_user_id, sender_role, body)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `,
        [vendorId, adminUserId, adminRole, trimmedBody]
    );

    return {
        vendor: vendorResult.rows[0],
        message: mapMessage(result.rows[0]),
    };
}
