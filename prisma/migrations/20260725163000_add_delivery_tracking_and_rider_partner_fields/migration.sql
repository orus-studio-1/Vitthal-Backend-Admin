-- Migration: 20260725163000_add_delivery_tracking_and_rider_partner_fields

-- 1. Ensure delivery_agents table exists with all rider partner tracking columns
CREATE TABLE IF NOT EXISTS "delivery_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "fulfillment_center_id" UUID NOT NULL,
    "special_rider_id" TEXT NOT NULL,
    "contact_phone" TEXT,
    "vehicle_type" TEXT,
    "vehicle_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_latitude" DOUBLE PRECISION,
    "current_longitude" DOUBLE PRECISION,
    "last_located_at" TIMESTAMPTZ(6),

    CONSTRAINT "delivery_agents_pkey" PRIMARY KEY ("id")
);

-- Unique indexes for delivery_agents
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_agents_user_id_key" ON "delivery_agents"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_agents_special_rider_id_key" ON "delivery_agents"("special_rider_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_agents_fc" ON "delivery_agents"("fulfillment_center_id");

-- Foreign key constraints for delivery_agents
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_agents_fulfillment_center_id_fkey') THEN
        ALTER TABLE "delivery_agents" ADD CONSTRAINT "delivery_agents_fulfillment_center_id_fkey" 
        FOREIGN KEY ("fulfillment_center_id") REFERENCES "fulfillment_centers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_agents_user_id_fkey') THEN
        ALTER TABLE "delivery_agents" ADD CONSTRAINT "delivery_agents_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- 2. Add delivery_agent_id column to order_fulfillment_tracking
ALTER TABLE "order_fulfillment_tracking" ADD COLUMN IF NOT EXISTS "delivery_agent_id" UUID;

-- Foreign key constraint for order_fulfillment_tracking -> delivery_agents
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_oft_delivery_agent') THEN
        ALTER TABLE "order_fulfillment_tracking" ADD CONSTRAINT "fk_oft_delivery_agent" 
        FOREIGN KEY ("delivery_agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

-- Index for tracking lookup by delivery agent
CREATE INDEX IF NOT EXISTS "idx_oft_delivery_agent_id" ON "order_fulfillment_tracking"("delivery_agent_id");

-- 3. Add pickup_rider_id column to order_route_plan
ALTER TABLE "order_route_plan" ADD COLUMN IF NOT EXISTS "pickup_rider_id" UUID;

-- Foreign key constraint for order_route_plan -> delivery_agents
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_route_plan_pickup_rider_id_fkey') THEN
        ALTER TABLE "order_route_plan" ADD CONSTRAINT "order_route_plan_pickup_rider_id_fkey" 
        FOREIGN KEY ("pickup_rider_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;
