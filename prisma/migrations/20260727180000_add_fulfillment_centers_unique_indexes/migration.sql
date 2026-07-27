-- Ensure unique indexes exist on fulfillment_centers
CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_centers_user_id_key" ON "fulfillment_centers"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fulfillment_centers_code_key" ON "fulfillment_centers"("code");
