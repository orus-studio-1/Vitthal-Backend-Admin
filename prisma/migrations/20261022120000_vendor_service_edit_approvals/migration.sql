ALTER TABLE "vendor_services"
ADD COLUMN "pending_modifications" JSONB,
ADD COLUMN "modification_status" TEXT;

CREATE INDEX "idx_vendor_services_modification_status"
ON "vendor_services"("modification_status");
