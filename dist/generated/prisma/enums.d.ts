export declare const UserRole: {
    readonly client: "client";
    readonly vendor: "vendor";
    readonly admin: "admin";
    readonly super_admin: "super_admin";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const OrderStatus: {
    readonly placed: "placed";
    readonly payment_pending: "payment_pending";
    readonly payment_completed: "payment_completed";
    readonly processing: "processing";
    readonly shipped: "shipped";
    readonly delivered: "delivered";
    readonly cancelled: "cancelled";
    readonly refunded: "refunded";
};
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
//# sourceMappingURL=enums.d.ts.map