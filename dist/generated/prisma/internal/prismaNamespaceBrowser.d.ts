import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models.js';
export type * from './prismaNamespace.js';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
/**
 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
/**
 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
/**
 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
export declare const ModelName: {
    readonly User: "User";
    readonly Product: "Product";
    readonly ProductImage: "ProductImage";
    readonly Vendor: "Vendor";
    readonly Order: "Order";
    readonly VendorProduct: "VendorProduct";
    readonly Cart: "Cart";
    readonly QuotationRequest: "QuotationRequest";
    readonly QuotationMessage: "QuotationMessage";
    readonly Payment: "Payment";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const UserScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly email: "email";
    readonly password_hash: "password_hash";
    readonly role: "role";
    readonly is_active: "is_active";
    readonly refresh_token: "refresh_token";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];
export declare const ProductScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly description: "description";
    readonly category: "category";
    readonly product_type: "product_type";
    readonly material: "material";
    readonly grade: "grade";
    readonly application: "application";
    readonly standard: "standard";
    readonly specifications: "specifications";
    readonly approval_status: "approval_status";
    readonly approval_notes: "approval_notes";
    readonly created_by_user_id: "created_by_user_id";
    readonly is_active: "is_active";
    readonly rating: "rating";
    readonly review_count: "review_count";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type ProductScalarFieldEnum = (typeof ProductScalarFieldEnum)[keyof typeof ProductScalarFieldEnum];
export declare const ProductImageScalarFieldEnum: {
    readonly id: "id";
    readonly product_id: "product_id";
    readonly image_url: "image_url";
    readonly is_primary: "is_primary";
    readonly display_order: "display_order";
    readonly is_approved: "is_approved";
    readonly approval_status: "approval_status";
    readonly created_by_user_id: "created_by_user_id";
    readonly reviewed_by_user_id: "reviewed_by_user_id";
    readonly created_at: "created_at";
};
export type ProductImageScalarFieldEnum = (typeof ProductImageScalarFieldEnum)[keyof typeof ProductImageScalarFieldEnum];
export declare const VendorScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly company_name: "company_name";
    readonly gst_number: "gst_number";
    readonly gst_certificate_link: "gst_certificate_link";
    readonly business_type: "business_type";
    readonly company_website: "company_website";
    readonly phone: "phone";
    readonly alternative_number: "alternative_number";
    readonly designation: "designation";
    readonly business_description: "business_description";
    readonly credit_cycle: "credit_cycle";
    readonly minimum_commision_percentage: "minimum_commision_percentage";
    readonly maximum_commision_percentage: "maximum_commision_percentage";
    readonly rating: "rating";
    readonly review_count: "review_count";
    readonly is_approved: "is_approved";
    readonly is_active: "is_active";
    readonly is_blocked: "is_blocked";
    readonly approval_status: "approval_status";
    readonly approval_notes: "approval_notes";
    readonly reconsideration_notes: "reconsideration_notes";
    readonly application_number: "application_number";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type VendorScalarFieldEnum = (typeof VendorScalarFieldEnum)[keyof typeof VendorScalarFieldEnum];
export declare const OrderScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly vendor_id: "vendor_id";
    readonly cart_id: "cart_id";
    readonly status: "status";
    readonly payment_status: "payment_status";
    readonly order_type: "order_type";
    readonly total_amount: "total_amount";
    readonly source: "source";
    readonly order_reference: "order_reference";
    readonly order_notes: "order_notes";
    readonly customer_name: "customer_name";
    readonly customer_email: "customer_email";
    readonly customer_phone: "customer_phone";
    readonly created_by_admin_id: "created_by_admin_id";
    readonly address_line: "address_line";
    readonly city: "city";
    readonly state: "state";
    readonly country: "country";
    readonly pincode: "pincode";
    readonly latitude: "latitude";
    readonly langitude: "langitude";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type OrderScalarFieldEnum = (typeof OrderScalarFieldEnum)[keyof typeof OrderScalarFieldEnum];
export declare const VendorProductScalarFieldEnum: {
    readonly id: "id";
    readonly product_id: "product_id";
    readonly vendor_id: "vendor_id";
    readonly price: "price";
    readonly moq: "moq";
    readonly stock_quantity: "stock_quantity";
    readonly quotation_enabled: "quotation_enabled";
    readonly quotation_min_qty: "quotation_min_qty";
    readonly is_active: "is_active";
    readonly status: "status";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type VendorProductScalarFieldEnum = (typeof VendorProductScalarFieldEnum)[keyof typeof VendorProductScalarFieldEnum];
export declare const CartScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly cart_type: "cart_type";
    readonly status: "status";
    readonly total_amount: "total_amount";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type CartScalarFieldEnum = (typeof CartScalarFieldEnum)[keyof typeof CartScalarFieldEnum];
export declare const QuotationRequestScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly vendor_id: "vendor_id";
    readonly product_id: "product_id";
    readonly requested_quantity: "requested_quantity";
    readonly requested_price: "requested_price";
    readonly status: "status";
    readonly request_note: "request_note";
    readonly buyer_city: "buyer_city";
    readonly buyer_state: "buyer_state";
    readonly buyer_country: "buyer_country";
    readonly buyer_pincode: "buyer_pincode";
    readonly current_offer_price: "current_offer_price";
    readonly current_offer_quantity: "current_offer_quantity";
    readonly current_offer_by: "current_offer_by";
    readonly accepted_price: "accepted_price";
    readonly accepted_quantity: "accepted_quantity";
    readonly rejection_reason: "rejection_reason";
    readonly order_id: "order_id";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type QuotationRequestScalarFieldEnum = (typeof QuotationRequestScalarFieldEnum)[keyof typeof QuotationRequestScalarFieldEnum];
export declare const QuotationMessageScalarFieldEnum: {
    readonly id: "id";
    readonly quotation_id: "quotation_id";
    readonly sender_user_id: "sender_user_id";
    readonly sender_role: "sender_role";
    readonly action: "action";
    readonly offer_price: "offer_price";
    readonly offer_quantity: "offer_quantity";
    readonly note: "note";
    readonly reason: "reason";
    readonly created_at: "created_at";
};
export type QuotationMessageScalarFieldEnum = (typeof QuotationMessageScalarFieldEnum)[keyof typeof QuotationMessageScalarFieldEnum];
export declare const PaymentScalarFieldEnum: {
    readonly id: "id";
    readonly user_id: "user_id";
    readonly amount: "amount";
    readonly currency: "currency";
    readonly status: "status";
    readonly payment_method: "payment_method";
    readonly razorpay_order_id: "razorpay_order_id";
    readonly razorpay_payment_id: "razorpay_payment_id";
    readonly razorpay_signature: "razorpay_signature";
    readonly order_ids: "order_ids";
    readonly quotation_request_id: "quotation_request_id";
    readonly split_number: "split_number";
    readonly split_percentage: "split_percentage";
    readonly created_at: "created_at";
    readonly updated_at: "updated_at";
};
export type PaymentScalarFieldEnum = (typeof PaymentScalarFieldEnum)[keyof typeof PaymentScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const JsonNullValueInput: {
    readonly JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
};
export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
export declare const JsonNullValueFilter: {
    readonly DbNull: import("@prisma/client-runtime-utils").DbNullClass;
    readonly JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
    readonly AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
};
export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];
//# sourceMappingURL=prismaNamespaceBrowser.d.ts.map