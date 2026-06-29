export declare const UserRole: {
    readonly client: "client";
    readonly vendor: "vendor";
    readonly admin: "admin";
    readonly super_admin: "super_admin";
    readonly fulfillment_center: "fulfillment_center";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const CartType: {
    readonly direct: "direct";
    readonly quotation: "quotation";
};
export type CartType = (typeof CartType)[keyof typeof CartType];
export declare const QuotationStatus: {
    readonly pending_vendor: "pending_vendor";
    readonly vendor_offered: "vendor_offered";
    readonly vendor_countered: "vendor_countered";
    readonly client_countered: "client_countered";
    readonly client_accepted: "client_accepted";
    readonly client_rejected: "client_rejected";
    readonly vendor_rejected: "vendor_rejected";
    readonly cancelled: "cancelled";
    readonly expired: "expired";
};
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];
export declare const QuotationMessageAction: {
    readonly request: "request";
    readonly offer: "offer";
    readonly counter: "counter";
    readonly accept: "accept";
    readonly reject: "reject";
    readonly note: "note";
};
export type QuotationMessageAction = (typeof QuotationMessageAction)[keyof typeof QuotationMessageAction];
//# sourceMappingURL=enums.d.ts.map