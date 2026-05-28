import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
/**
 * Model Vendor
 *
 */
export type VendorModel = runtime.Types.Result.DefaultSelection<Prisma.$VendorPayload>;
export type AggregateVendor = {
    _count: VendorCountAggregateOutputType | null;
    _avg: VendorAvgAggregateOutputType | null;
    _sum: VendorSumAggregateOutputType | null;
    _min: VendorMinAggregateOutputType | null;
    _max: VendorMaxAggregateOutputType | null;
};
export type VendorAvgAggregateOutputType = {
    minimum_commision_percentage: number | null;
    maximum_commision_percentage: number | null;
    rating: runtime.Decimal | null;
    review_count: number | null;
};
export type VendorSumAggregateOutputType = {
    minimum_commision_percentage: number | null;
    maximum_commision_percentage: number | null;
    rating: runtime.Decimal | null;
    review_count: number | null;
};
export type VendorMinAggregateOutputType = {
    id: string | null;
    user_id: string | null;
    company_name: string | null;
    gst_number: string | null;
    gst_certificate_link: string | null;
    business_type: string | null;
    company_website: string | null;
    phone: string | null;
    alternative_number: string | null;
    designation: string | null;
    business_description: string | null;
    credit_cycle: string | null;
    minimum_commision_percentage: number | null;
    maximum_commision_percentage: number | null;
    rating: runtime.Decimal | null;
    review_count: number | null;
    is_approved: boolean | null;
    is_active: boolean | null;
    is_blocked: boolean | null;
    approval_status: string | null;
    approval_notes: string | null;
    application_number: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type VendorMaxAggregateOutputType = {
    id: string | null;
    user_id: string | null;
    company_name: string | null;
    gst_number: string | null;
    gst_certificate_link: string | null;
    business_type: string | null;
    company_website: string | null;
    phone: string | null;
    alternative_number: string | null;
    designation: string | null;
    business_description: string | null;
    credit_cycle: string | null;
    minimum_commision_percentage: number | null;
    maximum_commision_percentage: number | null;
    rating: runtime.Decimal | null;
    review_count: number | null;
    is_approved: boolean | null;
    is_active: boolean | null;
    is_blocked: boolean | null;
    approval_status: string | null;
    approval_notes: string | null;
    application_number: string | null;
    created_at: Date | null;
    updated_at: Date | null;
};
export type VendorCountAggregateOutputType = {
    id: number;
    user_id: number;
    company_name: number;
    gst_number: number;
    gst_certificate_link: number;
    business_type: number;
    company_website: number;
    phone: number;
    alternative_number: number;
    designation: number;
    business_description: number;
    credit_cycle: number;
    minimum_commision_percentage: number;
    maximum_commision_percentage: number;
    rating: number;
    review_count: number;
    is_approved: number;
    is_active: number;
    is_blocked: number;
    approval_status: number;
    approval_notes: number;
    application_number: number;
    created_at: number;
    updated_at: number;
    _all: number;
};
export type VendorAvgAggregateInputType = {
    minimum_commision_percentage?: true;
    maximum_commision_percentage?: true;
    rating?: true;
    review_count?: true;
};
export type VendorSumAggregateInputType = {
    minimum_commision_percentage?: true;
    maximum_commision_percentage?: true;
    rating?: true;
    review_count?: true;
};
export type VendorMinAggregateInputType = {
    id?: true;
    user_id?: true;
    company_name?: true;
    gst_number?: true;
    gst_certificate_link?: true;
    business_type?: true;
    company_website?: true;
    phone?: true;
    alternative_number?: true;
    designation?: true;
    business_description?: true;
    credit_cycle?: true;
    minimum_commision_percentage?: true;
    maximum_commision_percentage?: true;
    rating?: true;
    review_count?: true;
    is_approved?: true;
    is_active?: true;
    is_blocked?: true;
    approval_status?: true;
    approval_notes?: true;
    application_number?: true;
    created_at?: true;
    updated_at?: true;
};
export type VendorMaxAggregateInputType = {
    id?: true;
    user_id?: true;
    company_name?: true;
    gst_number?: true;
    gst_certificate_link?: true;
    business_type?: true;
    company_website?: true;
    phone?: true;
    alternative_number?: true;
    designation?: true;
    business_description?: true;
    credit_cycle?: true;
    minimum_commision_percentage?: true;
    maximum_commision_percentage?: true;
    rating?: true;
    review_count?: true;
    is_approved?: true;
    is_active?: true;
    is_blocked?: true;
    approval_status?: true;
    approval_notes?: true;
    application_number?: true;
    created_at?: true;
    updated_at?: true;
};
export type VendorCountAggregateInputType = {
    id?: true;
    user_id?: true;
    company_name?: true;
    gst_number?: true;
    gst_certificate_link?: true;
    business_type?: true;
    company_website?: true;
    phone?: true;
    alternative_number?: true;
    designation?: true;
    business_description?: true;
    credit_cycle?: true;
    minimum_commision_percentage?: true;
    maximum_commision_percentage?: true;
    rating?: true;
    review_count?: true;
    is_approved?: true;
    is_active?: true;
    is_blocked?: true;
    approval_status?: true;
    approval_notes?: true;
    application_number?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
};
export type VendorAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which Vendor to aggregate.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Vendors
    **/
    _count?: true | VendorCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
    **/
    _avg?: VendorAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
    **/
    _sum?: VendorSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
    **/
    _min?: VendorMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
    **/
    _max?: VendorMaxAggregateInputType;
};
export type GetVendorAggregateType<T extends VendorAggregateArgs> = {
    [P in keyof T & keyof AggregateVendor]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateVendor[P]> : Prisma.GetScalarType<T[P], AggregateVendor[P]>;
};
export type VendorGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.VendorWhereInput;
    orderBy?: Prisma.VendorOrderByWithAggregationInput | Prisma.VendorOrderByWithAggregationInput[];
    by: Prisma.VendorScalarFieldEnum[] | Prisma.VendorScalarFieldEnum;
    having?: Prisma.VendorScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: VendorCountAggregateInputType | true;
    _avg?: VendorAvgAggregateInputType;
    _sum?: VendorSumAggregateInputType;
    _min?: VendorMinAggregateInputType;
    _max?: VendorMaxAggregateInputType;
};
export type VendorGroupByOutputType = {
    id: string;
    user_id: string;
    company_name: string;
    gst_number: string | null;
    gst_certificate_link: string | null;
    business_type: string | null;
    company_website: string | null;
    phone: string | null;
    alternative_number: string | null;
    designation: string | null;
    business_description: string | null;
    credit_cycle: string | null;
    minimum_commision_percentage: number | null;
    maximum_commision_percentage: number | null;
    rating: runtime.Decimal;
    review_count: number;
    is_approved: boolean;
    is_active: boolean;
    is_blocked: boolean;
    approval_status: string;
    approval_notes: string | null;
    application_number: string | null;
    created_at: Date;
    updated_at: Date;
    _count: VendorCountAggregateOutputType | null;
    _avg: VendorAvgAggregateOutputType | null;
    _sum: VendorSumAggregateOutputType | null;
    _min: VendorMinAggregateOutputType | null;
    _max: VendorMaxAggregateOutputType | null;
};
export type GetVendorGroupByPayload<T extends VendorGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<VendorGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof VendorGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], VendorGroupByOutputType[P]> : Prisma.GetScalarType<T[P], VendorGroupByOutputType[P]>;
}>>;
export type VendorWhereInput = {
    AND?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    OR?: Prisma.VendorWhereInput[];
    NOT?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    id?: Prisma.UuidFilter<"Vendor"> | string;
    user_id?: Prisma.UuidFilter<"Vendor"> | string;
    company_name?: Prisma.StringFilter<"Vendor"> | string;
    gst_number?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    gst_certificate_link?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    business_type?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    company_website?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    phone?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    alternative_number?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    designation?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    business_description?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    credit_cycle?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    minimum_commision_percentage?: Prisma.IntNullableFilter<"Vendor"> | number | null;
    maximum_commision_percentage?: Prisma.IntNullableFilter<"Vendor"> | number | null;
    rating?: Prisma.DecimalFilter<"Vendor"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFilter<"Vendor"> | number;
    is_approved?: Prisma.BoolFilter<"Vendor"> | boolean;
    is_active?: Prisma.BoolFilter<"Vendor"> | boolean;
    is_blocked?: Prisma.BoolFilter<"Vendor"> | boolean;
    approval_status?: Prisma.StringFilter<"Vendor"> | string;
    approval_notes?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    application_number?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    created_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    orders?: Prisma.OrderListRelationFilter;
    vendorProducts?: Prisma.VendorProductListRelationFilter;
    quotationRequests?: Prisma.QuotationRequestListRelationFilter;
};
export type VendorOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    company_name?: Prisma.SortOrder;
    gst_number?: Prisma.SortOrderInput | Prisma.SortOrder;
    gst_certificate_link?: Prisma.SortOrderInput | Prisma.SortOrder;
    business_type?: Prisma.SortOrderInput | Prisma.SortOrder;
    company_website?: Prisma.SortOrderInput | Prisma.SortOrder;
    phone?: Prisma.SortOrderInput | Prisma.SortOrder;
    alternative_number?: Prisma.SortOrderInput | Prisma.SortOrder;
    designation?: Prisma.SortOrderInput | Prisma.SortOrder;
    business_description?: Prisma.SortOrderInput | Prisma.SortOrder;
    credit_cycle?: Prisma.SortOrderInput | Prisma.SortOrder;
    minimum_commision_percentage?: Prisma.SortOrderInput | Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrderInput | Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
    is_approved?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    is_blocked?: Prisma.SortOrder;
    approval_status?: Prisma.SortOrder;
    approval_notes?: Prisma.SortOrderInput | Prisma.SortOrder;
    application_number?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    orders?: Prisma.OrderOrderByRelationAggregateInput;
    vendorProducts?: Prisma.VendorProductOrderByRelationAggregateInput;
    quotationRequests?: Prisma.QuotationRequestOrderByRelationAggregateInput;
};
export type VendorWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    user_id?: string;
    gst_number?: string;
    application_number?: string;
    AND?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    OR?: Prisma.VendorWhereInput[];
    NOT?: Prisma.VendorWhereInput | Prisma.VendorWhereInput[];
    company_name?: Prisma.StringFilter<"Vendor"> | string;
    gst_certificate_link?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    business_type?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    company_website?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    phone?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    alternative_number?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    designation?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    business_description?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    credit_cycle?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    minimum_commision_percentage?: Prisma.IntNullableFilter<"Vendor"> | number | null;
    maximum_commision_percentage?: Prisma.IntNullableFilter<"Vendor"> | number | null;
    rating?: Prisma.DecimalFilter<"Vendor"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFilter<"Vendor"> | number;
    is_approved?: Prisma.BoolFilter<"Vendor"> | boolean;
    is_active?: Prisma.BoolFilter<"Vendor"> | boolean;
    is_blocked?: Prisma.BoolFilter<"Vendor"> | boolean;
    approval_status?: Prisma.StringFilter<"Vendor"> | string;
    approval_notes?: Prisma.StringNullableFilter<"Vendor"> | string | null;
    created_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    updated_at?: Prisma.DateTimeFilter<"Vendor"> | Date | string;
    orders?: Prisma.OrderListRelationFilter;
    vendorProducts?: Prisma.VendorProductListRelationFilter;
    quotationRequests?: Prisma.QuotationRequestListRelationFilter;
}, "id" | "user_id" | "gst_number" | "application_number">;
export type VendorOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    company_name?: Prisma.SortOrder;
    gst_number?: Prisma.SortOrderInput | Prisma.SortOrder;
    gst_certificate_link?: Prisma.SortOrderInput | Prisma.SortOrder;
    business_type?: Prisma.SortOrderInput | Prisma.SortOrder;
    company_website?: Prisma.SortOrderInput | Prisma.SortOrder;
    phone?: Prisma.SortOrderInput | Prisma.SortOrder;
    alternative_number?: Prisma.SortOrderInput | Prisma.SortOrder;
    designation?: Prisma.SortOrderInput | Prisma.SortOrder;
    business_description?: Prisma.SortOrderInput | Prisma.SortOrder;
    credit_cycle?: Prisma.SortOrderInput | Prisma.SortOrder;
    minimum_commision_percentage?: Prisma.SortOrderInput | Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrderInput | Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
    is_approved?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    is_blocked?: Prisma.SortOrder;
    approval_status?: Prisma.SortOrder;
    approval_notes?: Prisma.SortOrderInput | Prisma.SortOrder;
    application_number?: Prisma.SortOrderInput | Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
    _count?: Prisma.VendorCountOrderByAggregateInput;
    _avg?: Prisma.VendorAvgOrderByAggregateInput;
    _max?: Prisma.VendorMaxOrderByAggregateInput;
    _min?: Prisma.VendorMinOrderByAggregateInput;
    _sum?: Prisma.VendorSumOrderByAggregateInput;
};
export type VendorScalarWhereWithAggregatesInput = {
    AND?: Prisma.VendorScalarWhereWithAggregatesInput | Prisma.VendorScalarWhereWithAggregatesInput[];
    OR?: Prisma.VendorScalarWhereWithAggregatesInput[];
    NOT?: Prisma.VendorScalarWhereWithAggregatesInput | Prisma.VendorScalarWhereWithAggregatesInput[];
    id?: Prisma.UuidWithAggregatesFilter<"Vendor"> | string;
    user_id?: Prisma.UuidWithAggregatesFilter<"Vendor"> | string;
    company_name?: Prisma.StringWithAggregatesFilter<"Vendor"> | string;
    gst_number?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    gst_certificate_link?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    business_type?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    company_website?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    phone?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    alternative_number?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    designation?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    business_description?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    credit_cycle?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    minimum_commision_percentage?: Prisma.IntNullableWithAggregatesFilter<"Vendor"> | number | null;
    maximum_commision_percentage?: Prisma.IntNullableWithAggregatesFilter<"Vendor"> | number | null;
    rating?: Prisma.DecimalWithAggregatesFilter<"Vendor"> | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntWithAggregatesFilter<"Vendor"> | number;
    is_approved?: Prisma.BoolWithAggregatesFilter<"Vendor"> | boolean;
    is_active?: Prisma.BoolWithAggregatesFilter<"Vendor"> | boolean;
    is_blocked?: Prisma.BoolWithAggregatesFilter<"Vendor"> | boolean;
    approval_status?: Prisma.StringWithAggregatesFilter<"Vendor"> | string;
    approval_notes?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    application_number?: Prisma.StringNullableWithAggregatesFilter<"Vendor"> | string | null;
    created_at?: Prisma.DateTimeWithAggregatesFilter<"Vendor"> | Date | string;
    updated_at?: Prisma.DateTimeWithAggregatesFilter<"Vendor"> | Date | string;
};
export type VendorCreateInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    vendorProducts?: Prisma.VendorProductCreateNestedManyWithoutVendorInput;
    quotationRequests?: Prisma.QuotationRequestCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    vendorProducts?: Prisma.VendorProductUncheckedCreateNestedManyWithoutVendorInput;
    quotationRequests?: Prisma.QuotationRequestUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    vendorProducts?: Prisma.VendorProductUpdateManyWithoutVendorNestedInput;
    quotationRequests?: Prisma.QuotationRequestUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    vendorProducts?: Prisma.VendorProductUncheckedUpdateManyWithoutVendorNestedInput;
    quotationRequests?: Prisma.QuotationRequestUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateManyInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
};
export type VendorUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type VendorUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type VendorCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    company_name?: Prisma.SortOrder;
    gst_number?: Prisma.SortOrder;
    gst_certificate_link?: Prisma.SortOrder;
    business_type?: Prisma.SortOrder;
    company_website?: Prisma.SortOrder;
    phone?: Prisma.SortOrder;
    alternative_number?: Prisma.SortOrder;
    designation?: Prisma.SortOrder;
    business_description?: Prisma.SortOrder;
    credit_cycle?: Prisma.SortOrder;
    minimum_commision_percentage?: Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
    is_approved?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    is_blocked?: Prisma.SortOrder;
    approval_status?: Prisma.SortOrder;
    approval_notes?: Prisma.SortOrder;
    application_number?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type VendorAvgOrderByAggregateInput = {
    minimum_commision_percentage?: Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
};
export type VendorMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    company_name?: Prisma.SortOrder;
    gst_number?: Prisma.SortOrder;
    gst_certificate_link?: Prisma.SortOrder;
    business_type?: Prisma.SortOrder;
    company_website?: Prisma.SortOrder;
    phone?: Prisma.SortOrder;
    alternative_number?: Prisma.SortOrder;
    designation?: Prisma.SortOrder;
    business_description?: Prisma.SortOrder;
    credit_cycle?: Prisma.SortOrder;
    minimum_commision_percentage?: Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
    is_approved?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    is_blocked?: Prisma.SortOrder;
    approval_status?: Prisma.SortOrder;
    approval_notes?: Prisma.SortOrder;
    application_number?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type VendorMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    user_id?: Prisma.SortOrder;
    company_name?: Prisma.SortOrder;
    gst_number?: Prisma.SortOrder;
    gst_certificate_link?: Prisma.SortOrder;
    business_type?: Prisma.SortOrder;
    company_website?: Prisma.SortOrder;
    phone?: Prisma.SortOrder;
    alternative_number?: Prisma.SortOrder;
    designation?: Prisma.SortOrder;
    business_description?: Prisma.SortOrder;
    credit_cycle?: Prisma.SortOrder;
    minimum_commision_percentage?: Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
    is_approved?: Prisma.SortOrder;
    is_active?: Prisma.SortOrder;
    is_blocked?: Prisma.SortOrder;
    approval_status?: Prisma.SortOrder;
    approval_notes?: Prisma.SortOrder;
    application_number?: Prisma.SortOrder;
    created_at?: Prisma.SortOrder;
    updated_at?: Prisma.SortOrder;
};
export type VendorSumOrderByAggregateInput = {
    minimum_commision_percentage?: Prisma.SortOrder;
    maximum_commision_percentage?: Prisma.SortOrder;
    rating?: Prisma.SortOrder;
    review_count?: Prisma.SortOrder;
};
export type VendorScalarRelationFilter = {
    is?: Prisma.VendorWhereInput;
    isNot?: Prisma.VendorWhereInput;
};
export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type VendorCreateNestedOneWithoutOrdersInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutOrdersInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutOrdersNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutOrdersInput;
    upsert?: Prisma.VendorUpsertWithoutOrdersInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutOrdersInput, Prisma.VendorUpdateWithoutOrdersInput>, Prisma.VendorUncheckedUpdateWithoutOrdersInput>;
};
export type VendorCreateNestedOneWithoutVendorProductsInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutVendorProductsInput, Prisma.VendorUncheckedCreateWithoutVendorProductsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutVendorProductsInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutVendorProductsNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutVendorProductsInput, Prisma.VendorUncheckedCreateWithoutVendorProductsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutVendorProductsInput;
    upsert?: Prisma.VendorUpsertWithoutVendorProductsInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutVendorProductsInput, Prisma.VendorUpdateWithoutVendorProductsInput>, Prisma.VendorUncheckedUpdateWithoutVendorProductsInput>;
};
export type VendorCreateNestedOneWithoutQuotationRequestsInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutQuotationRequestsInput, Prisma.VendorUncheckedCreateWithoutQuotationRequestsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutQuotationRequestsInput;
    connect?: Prisma.VendorWhereUniqueInput;
};
export type VendorUpdateOneRequiredWithoutQuotationRequestsNestedInput = {
    create?: Prisma.XOR<Prisma.VendorCreateWithoutQuotationRequestsInput, Prisma.VendorUncheckedCreateWithoutQuotationRequestsInput>;
    connectOrCreate?: Prisma.VendorCreateOrConnectWithoutQuotationRequestsInput;
    upsert?: Prisma.VendorUpsertWithoutQuotationRequestsInput;
    connect?: Prisma.VendorWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.VendorUpdateToOneWithWhereWithoutQuotationRequestsInput, Prisma.VendorUpdateWithoutQuotationRequestsInput>, Prisma.VendorUncheckedUpdateWithoutQuotationRequestsInput>;
};
export type VendorCreateWithoutOrdersInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    vendorProducts?: Prisma.VendorProductCreateNestedManyWithoutVendorInput;
    quotationRequests?: Prisma.QuotationRequestCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutOrdersInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    vendorProducts?: Prisma.VendorProductUncheckedCreateNestedManyWithoutVendorInput;
    quotationRequests?: Prisma.QuotationRequestUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutOrdersInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
};
export type VendorUpsertWithoutOrdersInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutOrdersInput, Prisma.VendorUncheckedUpdateWithoutOrdersInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutOrdersInput, Prisma.VendorUncheckedCreateWithoutOrdersInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutOrdersInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutOrdersInput, Prisma.VendorUncheckedUpdateWithoutOrdersInput>;
};
export type VendorUpdateWithoutOrdersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    vendorProducts?: Prisma.VendorProductUpdateManyWithoutVendorNestedInput;
    quotationRequests?: Prisma.QuotationRequestUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutOrdersInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    vendorProducts?: Prisma.VendorProductUncheckedUpdateManyWithoutVendorNestedInput;
    quotationRequests?: Prisma.QuotationRequestUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateWithoutVendorProductsInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    quotationRequests?: Prisma.QuotationRequestCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutVendorProductsInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    quotationRequests?: Prisma.QuotationRequestUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutVendorProductsInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutVendorProductsInput, Prisma.VendorUncheckedCreateWithoutVendorProductsInput>;
};
export type VendorUpsertWithoutVendorProductsInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutVendorProductsInput, Prisma.VendorUncheckedUpdateWithoutVendorProductsInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutVendorProductsInput, Prisma.VendorUncheckedCreateWithoutVendorProductsInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutVendorProductsInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutVendorProductsInput, Prisma.VendorUncheckedUpdateWithoutVendorProductsInput>;
};
export type VendorUpdateWithoutVendorProductsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    quotationRequests?: Prisma.QuotationRequestUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutVendorProductsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    quotationRequests?: Prisma.QuotationRequestUncheckedUpdateManyWithoutVendorNestedInput;
};
export type VendorCreateWithoutQuotationRequestsInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderCreateNestedManyWithoutVendorInput;
    vendorProducts?: Prisma.VendorProductCreateNestedManyWithoutVendorInput;
};
export type VendorUncheckedCreateWithoutQuotationRequestsInput = {
    id?: string;
    user_id: string;
    company_name: string;
    gst_number?: string | null;
    gst_certificate_link?: string | null;
    business_type?: string | null;
    company_website?: string | null;
    phone?: string | null;
    alternative_number?: string | null;
    designation?: string | null;
    business_description?: string | null;
    credit_cycle?: string | null;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    rating?: runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: number;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: string;
    approval_notes?: string | null;
    application_number?: string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    orders?: Prisma.OrderUncheckedCreateNestedManyWithoutVendorInput;
    vendorProducts?: Prisma.VendorProductUncheckedCreateNestedManyWithoutVendorInput;
};
export type VendorCreateOrConnectWithoutQuotationRequestsInput = {
    where: Prisma.VendorWhereUniqueInput;
    create: Prisma.XOR<Prisma.VendorCreateWithoutQuotationRequestsInput, Prisma.VendorUncheckedCreateWithoutQuotationRequestsInput>;
};
export type VendorUpsertWithoutQuotationRequestsInput = {
    update: Prisma.XOR<Prisma.VendorUpdateWithoutQuotationRequestsInput, Prisma.VendorUncheckedUpdateWithoutQuotationRequestsInput>;
    create: Prisma.XOR<Prisma.VendorCreateWithoutQuotationRequestsInput, Prisma.VendorUncheckedCreateWithoutQuotationRequestsInput>;
    where?: Prisma.VendorWhereInput;
};
export type VendorUpdateToOneWithWhereWithoutQuotationRequestsInput = {
    where?: Prisma.VendorWhereInput;
    data: Prisma.XOR<Prisma.VendorUpdateWithoutQuotationRequestsInput, Prisma.VendorUncheckedUpdateWithoutQuotationRequestsInput>;
};
export type VendorUpdateWithoutQuotationRequestsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUpdateManyWithoutVendorNestedInput;
    vendorProducts?: Prisma.VendorProductUpdateManyWithoutVendorNestedInput;
};
export type VendorUncheckedUpdateWithoutQuotationRequestsInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    user_id?: Prisma.StringFieldUpdateOperationsInput | string;
    company_name?: Prisma.StringFieldUpdateOperationsInput | string;
    gst_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    gst_certificate_link?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_type?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    company_website?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    phone?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    alternative_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    designation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    business_description?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    credit_cycle?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    minimum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    maximum_commision_percentage?: Prisma.NullableIntFieldUpdateOperationsInput | number | null;
    rating?: Prisma.DecimalFieldUpdateOperationsInput | runtime.Decimal | runtime.DecimalJsLike | number | string;
    review_count?: Prisma.IntFieldUpdateOperationsInput | number;
    is_approved?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_active?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    is_blocked?: Prisma.BoolFieldUpdateOperationsInput | boolean;
    approval_status?: Prisma.StringFieldUpdateOperationsInput | string;
    approval_notes?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    application_number?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    created_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    orders?: Prisma.OrderUncheckedUpdateManyWithoutVendorNestedInput;
    vendorProducts?: Prisma.VendorProductUncheckedUpdateManyWithoutVendorNestedInput;
};
/**
 * Count Type VendorCountOutputType
 */
export type VendorCountOutputType = {
    orders: number;
    vendorProducts: number;
    quotationRequests: number;
};
export type VendorCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    orders?: boolean | VendorCountOutputTypeCountOrdersArgs;
    vendorProducts?: boolean | VendorCountOutputTypeCountVendorProductsArgs;
    quotationRequests?: boolean | VendorCountOutputTypeCountQuotationRequestsArgs;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VendorCountOutputType
     */
    select?: Prisma.VendorCountOutputTypeSelect<ExtArgs> | null;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountOrdersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.OrderWhereInput;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountVendorProductsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.VendorProductWhereInput;
};
/**
 * VendorCountOutputType without action
 */
export type VendorCountOutputTypeCountQuotationRequestsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.QuotationRequestWhereInput;
};
export type VendorSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    user_id?: boolean;
    company_name?: boolean;
    gst_number?: boolean;
    gst_certificate_link?: boolean;
    business_type?: boolean;
    company_website?: boolean;
    phone?: boolean;
    alternative_number?: boolean;
    designation?: boolean;
    business_description?: boolean;
    credit_cycle?: boolean;
    minimum_commision_percentage?: boolean;
    maximum_commision_percentage?: boolean;
    rating?: boolean;
    review_count?: boolean;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: boolean;
    approval_notes?: boolean;
    application_number?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
    orders?: boolean | Prisma.Vendor$ordersArgs<ExtArgs>;
    vendorProducts?: boolean | Prisma.Vendor$vendorProductsArgs<ExtArgs>;
    quotationRequests?: boolean | Prisma.Vendor$quotationRequestsArgs<ExtArgs>;
    _count?: boolean | Prisma.VendorCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["vendor"]>;
export type VendorSelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    user_id?: boolean;
    company_name?: boolean;
    gst_number?: boolean;
    gst_certificate_link?: boolean;
    business_type?: boolean;
    company_website?: boolean;
    phone?: boolean;
    alternative_number?: boolean;
    designation?: boolean;
    business_description?: boolean;
    credit_cycle?: boolean;
    minimum_commision_percentage?: boolean;
    maximum_commision_percentage?: boolean;
    rating?: boolean;
    review_count?: boolean;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: boolean;
    approval_notes?: boolean;
    application_number?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
}, ExtArgs["result"]["vendor"]>;
export type VendorSelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    user_id?: boolean;
    company_name?: boolean;
    gst_number?: boolean;
    gst_certificate_link?: boolean;
    business_type?: boolean;
    company_website?: boolean;
    phone?: boolean;
    alternative_number?: boolean;
    designation?: boolean;
    business_description?: boolean;
    credit_cycle?: boolean;
    minimum_commision_percentage?: boolean;
    maximum_commision_percentage?: boolean;
    rating?: boolean;
    review_count?: boolean;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: boolean;
    approval_notes?: boolean;
    application_number?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
}, ExtArgs["result"]["vendor"]>;
export type VendorSelectScalar = {
    id?: boolean;
    user_id?: boolean;
    company_name?: boolean;
    gst_number?: boolean;
    gst_certificate_link?: boolean;
    business_type?: boolean;
    company_website?: boolean;
    phone?: boolean;
    alternative_number?: boolean;
    designation?: boolean;
    business_description?: boolean;
    credit_cycle?: boolean;
    minimum_commision_percentage?: boolean;
    maximum_commision_percentage?: boolean;
    rating?: boolean;
    review_count?: boolean;
    is_approved?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    approval_status?: boolean;
    approval_notes?: boolean;
    application_number?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
};
export type VendorOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "user_id" | "company_name" | "gst_number" | "gst_certificate_link" | "business_type" | "company_website" | "phone" | "alternative_number" | "designation" | "business_description" | "credit_cycle" | "minimum_commision_percentage" | "maximum_commision_percentage" | "rating" | "review_count" | "is_approved" | "is_active" | "is_blocked" | "approval_status" | "approval_notes" | "application_number" | "created_at" | "updated_at", ExtArgs["result"]["vendor"]>;
export type VendorInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    orders?: boolean | Prisma.Vendor$ordersArgs<ExtArgs>;
    vendorProducts?: boolean | Prisma.Vendor$vendorProductsArgs<ExtArgs>;
    quotationRequests?: boolean | Prisma.Vendor$quotationRequestsArgs<ExtArgs>;
    _count?: boolean | Prisma.VendorCountOutputTypeDefaultArgs<ExtArgs>;
};
export type VendorIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type VendorIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type $VendorPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Vendor";
    objects: {
        orders: Prisma.$OrderPayload<ExtArgs>[];
        vendorProducts: Prisma.$VendorProductPayload<ExtArgs>[];
        quotationRequests: Prisma.$QuotationRequestPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        user_id: string;
        company_name: string;
        gst_number: string | null;
        gst_certificate_link: string | null;
        business_type: string | null;
        company_website: string | null;
        phone: string | null;
        alternative_number: string | null;
        designation: string | null;
        business_description: string | null;
        credit_cycle: string | null;
        minimum_commision_percentage: number | null;
        maximum_commision_percentage: number | null;
        rating: runtime.Decimal;
        review_count: number;
        is_approved: boolean;
        is_active: boolean;
        is_blocked: boolean;
        approval_status: string;
        approval_notes: string | null;
        application_number: string | null;
        created_at: Date;
        updated_at: Date;
    }, ExtArgs["result"]["vendor"]>;
    composites: {};
};
export type VendorGetPayload<S extends boolean | null | undefined | VendorDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$VendorPayload, S>;
export type VendorCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<VendorFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: VendorCountAggregateInputType | true;
};
export interface VendorDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Vendor'];
        meta: {
            name: 'Vendor';
        };
    };
    /**
     * Find zero or one Vendor that matches the filter.
     * @param {VendorFindUniqueArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends VendorFindUniqueArgs>(args: Prisma.SelectSubset<T, VendorFindUniqueArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one Vendor that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {VendorFindUniqueOrThrowArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends VendorFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, VendorFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first Vendor that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorFindFirstArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends VendorFindFirstArgs>(args?: Prisma.SelectSubset<T, VendorFindFirstArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first Vendor that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorFindFirstOrThrowArgs} args - Arguments to find a Vendor
     * @example
     * // Get one Vendor
     * const vendor = await prisma.vendor.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends VendorFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, VendorFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more Vendors that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Vendors
     * const vendors = await prisma.vendor.findMany()
     *
     * // Get first 10 Vendors
     * const vendors = await prisma.vendor.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const vendorWithIdOnly = await prisma.vendor.findMany({ select: { id: true } })
     *
     */
    findMany<T extends VendorFindManyArgs>(args?: Prisma.SelectSubset<T, VendorFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    /**
     * Create a Vendor.
     * @param {VendorCreateArgs} args - Arguments to create a Vendor.
     * @example
     * // Create one Vendor
     * const Vendor = await prisma.vendor.create({
     *   data: {
     *     // ... data to create a Vendor
     *   }
     * })
     *
     */
    create<T extends VendorCreateArgs>(args: Prisma.SelectSubset<T, VendorCreateArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many Vendors.
     * @param {VendorCreateManyArgs} args - Arguments to create many Vendors.
     * @example
     * // Create many Vendors
     * const vendor = await prisma.vendor.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends VendorCreateManyArgs>(args?: Prisma.SelectSubset<T, VendorCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many Vendors and returns the data saved in the database.
     * @param {VendorCreateManyAndReturnArgs} args - Arguments to create many Vendors.
     * @example
     * // Create many Vendors
     * const vendor = await prisma.vendor.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Vendors and only return the `id`
     * const vendorWithIdOnly = await prisma.vendor.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends VendorCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, VendorCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    /**
     * Delete a Vendor.
     * @param {VendorDeleteArgs} args - Arguments to delete one Vendor.
     * @example
     * // Delete one Vendor
     * const Vendor = await prisma.vendor.delete({
     *   where: {
     *     // ... filter to delete one Vendor
     *   }
     * })
     *
     */
    delete<T extends VendorDeleteArgs>(args: Prisma.SelectSubset<T, VendorDeleteArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one Vendor.
     * @param {VendorUpdateArgs} args - Arguments to update one Vendor.
     * @example
     * // Update one Vendor
     * const vendor = await prisma.vendor.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends VendorUpdateArgs>(args: Prisma.SelectSubset<T, VendorUpdateArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more Vendors.
     * @param {VendorDeleteManyArgs} args - Arguments to filter Vendors to delete.
     * @example
     * // Delete a few Vendors
     * const { count } = await prisma.vendor.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends VendorDeleteManyArgs>(args?: Prisma.SelectSubset<T, VendorDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more Vendors.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Vendors
     * const vendor = await prisma.vendor.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends VendorUpdateManyArgs>(args: Prisma.SelectSubset<T, VendorUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more Vendors and returns the data updated in the database.
     * @param {VendorUpdateManyAndReturnArgs} args - Arguments to update many Vendors.
     * @example
     * // Update many Vendors
     * const vendor = await prisma.vendor.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Vendors and only return the `id`
     * const vendorWithIdOnly = await prisma.vendor.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends VendorUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, VendorUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    /**
     * Create or update one Vendor.
     * @param {VendorUpsertArgs} args - Arguments to update or create a Vendor.
     * @example
     * // Update or create a Vendor
     * const vendor = await prisma.vendor.upsert({
     *   create: {
     *     // ... data to create a Vendor
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Vendor we want to update
     *   }
     * })
     */
    upsert<T extends VendorUpsertArgs>(args: Prisma.SelectSubset<T, VendorUpsertArgs<ExtArgs>>): Prisma.Prisma__VendorClient<runtime.Types.Result.GetResult<Prisma.$VendorPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of Vendors.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorCountArgs} args - Arguments to filter Vendors to count.
     * @example
     * // Count the number of Vendors
     * const count = await prisma.vendor.count({
     *   where: {
     *     // ... the filter for the Vendors we want to count
     *   }
     * })
    **/
    count<T extends VendorCountArgs>(args?: Prisma.Subset<T, VendorCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], VendorCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a Vendor.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends VendorAggregateArgs>(args: Prisma.Subset<T, VendorAggregateArgs>): Prisma.PrismaPromise<GetVendorAggregateType<T>>;
    /**
     * Group by Vendor.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {VendorGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
    **/
    groupBy<T extends VendorGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: VendorGroupByArgs['orderBy'];
    } : {
        orderBy?: VendorGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, VendorGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetVendorGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Vendor model
     */
    readonly fields: VendorFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for Vendor.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__VendorClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    orders<T extends Prisma.Vendor$ordersArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$ordersArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$OrderPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    vendorProducts<T extends Prisma.Vendor$vendorProductsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$vendorProductsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$VendorProductPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    quotationRequests<T extends Prisma.Vendor$quotationRequestsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.Vendor$quotationRequestsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$QuotationRequestPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
/**
 * Fields of the Vendor model
 */
export interface VendorFieldRefs {
    readonly id: Prisma.FieldRef<"Vendor", 'String'>;
    readonly user_id: Prisma.FieldRef<"Vendor", 'String'>;
    readonly company_name: Prisma.FieldRef<"Vendor", 'String'>;
    readonly gst_number: Prisma.FieldRef<"Vendor", 'String'>;
    readonly gst_certificate_link: Prisma.FieldRef<"Vendor", 'String'>;
    readonly business_type: Prisma.FieldRef<"Vendor", 'String'>;
    readonly company_website: Prisma.FieldRef<"Vendor", 'String'>;
    readonly phone: Prisma.FieldRef<"Vendor", 'String'>;
    readonly alternative_number: Prisma.FieldRef<"Vendor", 'String'>;
    readonly designation: Prisma.FieldRef<"Vendor", 'String'>;
    readonly business_description: Prisma.FieldRef<"Vendor", 'String'>;
    readonly credit_cycle: Prisma.FieldRef<"Vendor", 'String'>;
    readonly minimum_commision_percentage: Prisma.FieldRef<"Vendor", 'Int'>;
    readonly maximum_commision_percentage: Prisma.FieldRef<"Vendor", 'Int'>;
    readonly rating: Prisma.FieldRef<"Vendor", 'Decimal'>;
    readonly review_count: Prisma.FieldRef<"Vendor", 'Int'>;
    readonly is_approved: Prisma.FieldRef<"Vendor", 'Boolean'>;
    readonly is_active: Prisma.FieldRef<"Vendor", 'Boolean'>;
    readonly is_blocked: Prisma.FieldRef<"Vendor", 'Boolean'>;
    readonly approval_status: Prisma.FieldRef<"Vendor", 'String'>;
    readonly approval_notes: Prisma.FieldRef<"Vendor", 'String'>;
    readonly application_number: Prisma.FieldRef<"Vendor", 'String'>;
    readonly created_at: Prisma.FieldRef<"Vendor", 'DateTime'>;
    readonly updated_at: Prisma.FieldRef<"Vendor", 'DateTime'>;
}
/**
 * Vendor findUnique
 */
export type VendorFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor findUniqueOrThrow
 */
export type VendorFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor findFirst
 */
export type VendorFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Vendors.
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Vendors.
     */
    distinct?: Prisma.VendorScalarFieldEnum | Prisma.VendorScalarFieldEnum[];
};
/**
 * Vendor findFirstOrThrow
 */
export type VendorFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendor to fetch.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Vendors.
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Vendors.
     */
    distinct?: Prisma.VendorScalarFieldEnum | Prisma.VendorScalarFieldEnum[];
};
/**
 * Vendor findMany
 */
export type VendorFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter, which Vendors to fetch.
     */
    where?: Prisma.VendorWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Vendors to fetch.
     */
    orderBy?: Prisma.VendorOrderByWithRelationInput | Prisma.VendorOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Vendors.
     */
    cursor?: Prisma.VendorWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Vendors from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Vendors.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Vendors.
     */
    distinct?: Prisma.VendorScalarFieldEnum | Prisma.VendorScalarFieldEnum[];
};
/**
 * Vendor create
 */
export type VendorCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * The data needed to create a Vendor.
     */
    data: Prisma.XOR<Prisma.VendorCreateInput, Prisma.VendorUncheckedCreateInput>;
};
/**
 * Vendor createMany
 */
export type VendorCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many Vendors.
     */
    data: Prisma.VendorCreateManyInput | Prisma.VendorCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * Vendor createManyAndReturn
 */
export type VendorCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * The data used to create many Vendors.
     */
    data: Prisma.VendorCreateManyInput | Prisma.VendorCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * Vendor update
 */
export type VendorUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * The data needed to update a Vendor.
     */
    data: Prisma.XOR<Prisma.VendorUpdateInput, Prisma.VendorUncheckedUpdateInput>;
    /**
     * Choose, which Vendor to update.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor updateMany
 */
export type VendorUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update Vendors.
     */
    data: Prisma.XOR<Prisma.VendorUpdateManyMutationInput, Prisma.VendorUncheckedUpdateManyInput>;
    /**
     * Filter which Vendors to update
     */
    where?: Prisma.VendorWhereInput;
    /**
     * Limit how many Vendors to update.
     */
    limit?: number;
};
/**
 * Vendor updateManyAndReturn
 */
export type VendorUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * The data used to update Vendors.
     */
    data: Prisma.XOR<Prisma.VendorUpdateManyMutationInput, Prisma.VendorUncheckedUpdateManyInput>;
    /**
     * Filter which Vendors to update
     */
    where?: Prisma.VendorWhereInput;
    /**
     * Limit how many Vendors to update.
     */
    limit?: number;
};
/**
 * Vendor upsert
 */
export type VendorUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * The filter to search for the Vendor to update in case it exists.
     */
    where: Prisma.VendorWhereUniqueInput;
    /**
     * In case the Vendor found by the `where` argument doesn't exist, create a new Vendor with this data.
     */
    create: Prisma.XOR<Prisma.VendorCreateInput, Prisma.VendorUncheckedCreateInput>;
    /**
     * In case the Vendor was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.VendorUpdateInput, Prisma.VendorUncheckedUpdateInput>;
};
/**
 * Vendor delete
 */
export type VendorDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
    /**
     * Filter which Vendor to delete.
     */
    where: Prisma.VendorWhereUniqueInput;
};
/**
 * Vendor deleteMany
 */
export type VendorDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which Vendors to delete
     */
    where?: Prisma.VendorWhereInput;
    /**
     * Limit how many Vendors to delete.
     */
    limit?: number;
};
/**
 * Vendor.orders
 */
export type Vendor$ordersArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Order
     */
    select?: Prisma.OrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Order
     */
    omit?: Prisma.OrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.OrderInclude<ExtArgs> | null;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[];
    cursor?: Prisma.OrderWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.OrderScalarFieldEnum | Prisma.OrderScalarFieldEnum[];
};
/**
 * Vendor.vendorProducts
 */
export type Vendor$vendorProductsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the VendorProduct
     */
    select?: Prisma.VendorProductSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the VendorProduct
     */
    omit?: Prisma.VendorProductOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorProductInclude<ExtArgs> | null;
    where?: Prisma.VendorProductWhereInput;
    orderBy?: Prisma.VendorProductOrderByWithRelationInput | Prisma.VendorProductOrderByWithRelationInput[];
    cursor?: Prisma.VendorProductWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.VendorProductScalarFieldEnum | Prisma.VendorProductScalarFieldEnum[];
};
/**
 * Vendor.quotationRequests
 */
export type Vendor$quotationRequestsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QuotationRequest
     */
    select?: Prisma.QuotationRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QuotationRequest
     */
    omit?: Prisma.QuotationRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.QuotationRequestInclude<ExtArgs> | null;
    where?: Prisma.QuotationRequestWhereInput;
    orderBy?: Prisma.QuotationRequestOrderByWithRelationInput | Prisma.QuotationRequestOrderByWithRelationInput[];
    cursor?: Prisma.QuotationRequestWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.QuotationRequestScalarFieldEnum | Prisma.QuotationRequestScalarFieldEnum[];
};
/**
 * Vendor without action
 */
export type VendorDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Vendor
     */
    select?: Prisma.VendorSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Vendor
     */
    omit?: Prisma.VendorOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.VendorInclude<ExtArgs> | null;
};
//# sourceMappingURL=Vendor.d.ts.map