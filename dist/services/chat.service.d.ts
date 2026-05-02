export type ChatMessageOut = {
    id: string;
    vendorId: string;
    senderUserId: string;
    senderRole: string;
    body: string;
    isRead: boolean;
    createdAt: string;
};
export declare function getVendorChatIdentityByUserId(userId: string): Promise<any>;
export declare function getVendorChatHistory(userId: string, page: number, limit: number): Promise<{
    vendor: {
        id: any;
        userId: any;
        companyName: any;
        name: any;
        email: any;
        phone: any;
    };
    messages: ChatMessageOut[];
    meta: {
        page: number;
        limit: number;
        total: number;
    };
}>;
export declare function sendMessageAsVendor(userId: string, body: string): Promise<{
    vendor: any;
    message: ChatMessageOut;
}>;
export declare function getAdminConversationList(): Promise<{
    vendorId: any;
    vendor: {
        id: any;
        userId: any;
        companyName: any;
        name: any;
        email: any;
        phone: any;
    };
    unreadCount: number;
    lastMessage: {
        id: any;
        vendorId: any;
        senderUserId: any;
        senderRole: any;
        body: any;
        isRead: any;
        createdAt: any;
    } | null;
}[]>;
export declare function getAdminChatRecipients(): Promise<{
    id: string;
    role: string;
}[]>;
export declare function getConversationByVendorId(vendorId: string, page: number, limit: number, viewerRole: "vendor" | "admin"): Promise<{
    vendor: {
        id: any;
        userId: any;
        companyName: any;
        name: any;
        email: any;
        phone: any;
    };
    messages: ChatMessageOut[];
    meta: {
        page: number;
        limit: number;
        total: number;
    };
}>;
export declare function sendMessageAsAdmin(adminUserId: string, adminRole: string, vendorId: string, body: string): Promise<{
    vendor: any;
    message: ChatMessageOut;
}>;
//# sourceMappingURL=chat.service.d.ts.map