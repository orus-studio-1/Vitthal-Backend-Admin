type VendorProfile = {
    id: string;
    user_id: string;
    name: string;
    email: string;
    company_name: string;
    gst_number: string | null;
    gst_certificate_link: string | null;
    vendor_signature_image_link: string | null;
    business_type: string | null;
    company_website: string | null;
    phone: string | null;
    alternative_number: string | null;
    designation: string | null;
    business_description: string | null;
    credit_cycle: string | null;
    minimum_commision_percentage: number | null;
    maximum_commision_percentage: number | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
    approval_status: string;
    approval_notes: string | null;
    application_number: string | null;
    is_active: boolean;
    is_blocked: boolean;
    created_at: string;
    updated_at: string;
    order_count: number;
    categories: any[];
};
export declare function getVendorProfile(vendorId: string): Promise<VendorProfile | null>;
export declare function getVendorIdByUserId(userId: string): Promise<string | null>;
export declare function getVendorDashboardData(vendorId: string): Promise<{
    stats: {
        totalRevenue: number;
        totalOrders: number;
        activeProducts: number;
        totalCustomers: number;
    };
    revenueChart: {
        labels: string[];
        data: number[];
    };
    recentOrders: {
        orderId: any;
        customerName: any;
        productName: any;
        date: any;
        amount: number;
        status: any;
    }[];
    topProducts: {
        name: any;
        sales: number;
        revenue: number;
    }[];
}>;
export declare function getVendorAnalyticsData(vendorId: string, rawTimeframe?: string): Promise<{
    timeframe: string;
    kpi: {
        totalQuantity: number;
        tonnageGrowth: number;
        avgOrderValue: number;
        aovGrowth: number;
        topSegment: {
            name: any;
            volume: number;
            percentage: number;
        } | null;
        totalRevenue: number;
        revenueGrowth: number;
    };
    revenueChart: {
        labels: string[];
        data: number[];
    };
    categoryDistribution: {
        name: any;
        quantity: number;
        revenue: number;
        percentage: number;
    }[];
    topProducts: {
        id: any;
        name: any;
        category: any;
        sales: number;
        revenue: number;
        growth: number;
    }[];
}>;
export {};
//# sourceMappingURL=vendorInsights.service.d.ts.map