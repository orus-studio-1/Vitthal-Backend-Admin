CREATE TABLE order_dispatch_details (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id              UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id             UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    lr_number             VARCHAR(100) NOT NULL,
    eway_bill_number      VARCHAR(100),
    transporter_name      VARCHAR(150),
    eway_bill_url         TEXT NOT NULL,
    delivery_challan_url  TEXT NOT NULL,
    invoice_url           TEXT NOT NULL,
    lr_document_url       TEXT,
    dispatched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_dispatch_vendor ON order_dispatch_details(vendor_id);