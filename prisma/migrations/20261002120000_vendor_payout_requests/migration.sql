ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS account_number TEXT,
    ADD COLUMN IF NOT EXISTS account_number_last4 CHAR(4),
    ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cancelled_cheque_link TEXT;

ALTER TABLE vendors ALTER COLUMN account_number TYPE TEXT;

CREATE TABLE IF NOT EXISTS vendor_payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    order_id UUID,
    booking_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'partially_paid', 'rejected', 'paid')),
    eligible_amount NUMERIC(12, 2) NOT NULL CHECK (eligible_amount > 0),
    paid_amount NUMERIC(12, 2) CHECK (paid_amount IS NULL OR (paid_amount > 0 AND paid_amount <= eligible_amount)),
    transfer_reference TEXT,
    rejection_reason TEXT,
    admin_note TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID,
    CHECK (num_nonnulls(order_id, booking_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_payout_requests_active_order
    ON vendor_payout_requests(order_id)
    WHERE order_id IS NOT NULL AND status IN ('requested', 'partially_paid', 'paid');
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_payout_requests_active_booking
    ON vendor_payout_requests(booking_id)
    WHERE booking_id IS NOT NULL AND status IN ('requested', 'partially_paid', 'paid');
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_payout_requests_transfer_reference
    ON vendor_payout_requests(transfer_reference)
    WHERE transfer_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_payout_requests_vendor_status
    ON vendor_payout_requests(vendor_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS vendor_payout_bank_access_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_payout_request_id UUID NOT NULL,
    admin_user_id UUID NOT NULL,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_payout_bank_audit_request
    ON vendor_payout_bank_access_audit(vendor_payout_request_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payout_bank_audit_admin
    ON vendor_payout_bank_access_audit(admin_user_id, accessed_at);

CREATE TABLE IF NOT EXISTS vendor_payout_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES vendor_payout_requests(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transfer_reference TEXT NOT NULL UNIQUE,
    transferred_by UUID NOT NULL,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_payout_transfers_request
    ON vendor_payout_transfers(request_id, transferred_at);