import { getAdminChatRecipients, getAdminConversationList, getConversationByVendorId, getVendorChatHistory, sendMessageAsAdmin, sendMessageAsVendor, } from "../services/chat.service.js";
import { emitAdminChatMessage, emitUserChatMessage, emitVendorChatMessage } from "../lib/socket.js";
const adminRoles = ["admin", "super_admin"];
function getAuthUser(req) {
    return req.user;
}
export async function getVendorChatMessages(req, res) {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || authUser.role !== "vendor") {
        return res.status(403).json({ message: "Unauthorized! Only vendors can access this chat." });
    }
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 50);
        const data = await getVendorChatHistory(authUser.userId, page, limit);
        return res.status(200).json({ message: "Chat history fetched successfully", data });
    }
    catch (error) {
        if (error instanceof Error && error.message === "Vendor not found") {
            return res.status(404).json({ message: error.message });
        }
        console.error("Error fetching vendor chat history:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function sendVendorChatMessage(req, res) {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || authUser.role !== "vendor") {
        return res.status(403).json({ message: "Unauthorized! Only vendors can send chat messages." });
    }
    try {
        const { body } = req.body;
        const result = await sendMessageAsVendor(authUser.userId, body ?? "");
        const payload = {
            vendorId: result.vendor.vendor_id,
            sender: {
                userId: authUser.userId,
                role: authUser.role,
            },
            message: result.message,
        };
        emitVendorChatMessage(payload);
        const admins = await getAdminChatRecipients();
        for (const admin of admins) {
            emitAdminChatMessage(admin.id, payload);
        }
        return res.status(201).json({ message: "Message sent successfully", data: result.message });
    }
    catch (error) {
        if (error instanceof Error && (error.message === "Vendor not found" || error.message === "Message body is required")) {
            return res.status(error.message === "Vendor not found" ? 404 : 400).json({ message: error.message });
        }
        console.error("Error sending vendor chat message:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function getAdminVendorConversations(req, res) {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || !adminRoles.includes(authUser.role)) {
        return res.status(403).json({ message: "Unauthorized! Only admins can access vendor chats." });
    }
    try {
        const data = await getAdminConversationList();
        return res.status(200).json({ message: "Vendor conversations fetched successfully", data });
    }
    catch (error) {
        console.error("Error fetching vendor conversation list:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function getAdminVendorConversation(req, res) {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || !adminRoles.includes(authUser.role)) {
        return res.status(403).json({ message: "Unauthorized! Only admins can access vendor chats." });
    }
    try {
        const vendorId = String(req.params.vendorId ?? "");
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 50);
        const data = await getConversationByVendorId(vendorId, page, limit, "admin");
        return res.status(200).json({ message: "Conversation fetched successfully", data });
    }
    catch (error) {
        if (error instanceof Error && error.message === "Vendor not found") {
            return res.status(404).json({ message: error.message });
        }
        console.error("Error fetching admin vendor conversation:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function sendAdminVendorMessage(req, res) {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || !adminRoles.includes(authUser.role)) {
        return res.status(403).json({ message: "Unauthorized! Only admins can send vendor chat messages." });
    }
    try {
        const vendorId = String(req.params.vendorId ?? "");
        const { body } = req.body;
        const result = await sendMessageAsAdmin(authUser.userId, authUser.role, vendorId, body ?? "");
        const payload = {
            vendorId,
            sender: {
                userId: authUser.userId,
                role: authUser.role,
            },
            message: result.message,
        };
        emitVendorChatMessage(payload);
        emitAdminChatMessage(authUser.userId, payload);
        emitUserChatMessage(result.vendor.user_id, payload);
        return res.status(201).json({ message: "Message sent successfully", data: result.message });
    }
    catch (error) {
        if (error instanceof Error && (error.message === "Vendor not found" || error.message === "Message body is required")) {
            return res.status(error.message === "Vendor not found" ? 404 : 400).json({ message: error.message });
        }
        console.error("Error sending admin vendor message:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
//# sourceMappingURL=Chat.controller.js.map