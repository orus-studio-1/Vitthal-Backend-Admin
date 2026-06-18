import "dotenv/config";
import { Pool } from "pg";
import { isPostgresConnectionString, normalizeDatabaseUrl } from "./database-url.js";

const rawConnectionString = process.env.MARKETPLACE_DATABASE_URL || process.env.DATABASE_URL;
const connectionString = normalizeDatabaseUrl(rawConnectionString);

if (!connectionString || !isPostgresConnectionString(connectionString)) {
    throw new Error("MARKETPLACE_DATABASE_URL or DATABASE_URL must be a valid PostgreSQL connection string.");
}

export const marketplacePool = new Pool({
    connectionString,
});

export async function ensureMarketplaceSchema() {
    await marketplacePool.query(`
-- SETUP INSTRUCTIONS:
-- 1. Create a new database (in psql): CREATE DATABASE vitthal_db;
-- 2. Connect to it: \c vitthal_db;
-- 3. Then run this entire script.

-- This schema is designed to be idempotent where PostgreSQL supports it.

-- ============================================
-- B2B Multi-Vendor Marketplace - PostgreSQL Schema
-- ============================================

-- ================================
-- EXTENSIONS
-- ================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- PostGIS is optional. This schema stores latitude/longitude as numeric columns,
-- so it works on plain PostgreSQL without PostGIS installed.

-- ================================
-- TYPES
-- ================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('client', 'vendor', 'admin', 'super_admin');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_product_status') THEN
        CREATE TYPE vendor_product_status AS ENUM ('active', 'inactive', 'out_of_stock', 'discontinued', 'waiting');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vendor_approval_status') THEN
        CREATE TYPE vendor_approval_status AS ENUM ('pending', 'agreement_sent', 'approved', 'rejected');
    END IF;
END$$;

ALTER TYPE vendor_approval_status ADD VALUE IF NOT EXISTS 'reconsideration';


DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'handed_over', 'received', 'dispatched');
    END IF;
END$$;

-- ================================
-- AUTHENTICATION LAYER
-- ================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'client',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    OTP TEXT,
    refresh_token TEXT,
    OTP_Expiry TIMESTAMPTZ,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================
-- BUSINESS LAYER
-- ================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    gst_number TEXT UNIQUE,
    gst_certificate_link TEXT,
    business_type TEXT,
    company_website TEXT,
    phone TEXT,
    alternative_number TEXT,
    designation TEXT,
    business_description TEXT,
    credit_cycle TEXT,
    minimum_commision_percentage INTEGER DEFAULT 0,
    maximum_commision_percentage INTEGER DEFAULT 0,
    application_number TEXT UNIQUE,
    rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER NOT NULL DEFAULT 0,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    approval_status vendor_approval_status NOT NULL DEFAULT 'pending',
    approval_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_vendors_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================
-- SEED: default product categories (idempotent)
-- These inserts are guarded by WHERE NOT EXISTS so running the script
-- multiple times will not create duplicates.
-- ================================
        ALTER TABLE product_category
            ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS min_commision_percentage INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS max_commision_percentage INTEGER NOT NULL DEFAULT 10;

        INSERT INTO product_category (code, label, description, image, min_commision_percentage, max_commision_percentage, sort_order, is_active) VALUES
        ('metal_fabrication_parts', 'Metal & Fabrication Products', 'Sheet metal, structural parts, and custom fabricated components.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780292933/Metal_Fabricated_n51kin.jpg', 0, 10, 1, true),
        ('electrical_automation_components', 'Electrical & Electronics Manufacturing', 'Industrial panels, sensors, and automation hardware.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780293409/Electrical_Electronics_twuwgm.jpg', 0, 10, 2, true),
        ('industrial_machinery_equipment', 'Machinery & Industrial Equipment', 'Pumps, compressors, conveyor systems, and packaging machines.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780293705/Industrial_Machinery_jubodl.jpg', 0, 10, 3, true),
        ('construction_building_materials', 'Construction & Building Material', 'Hardware, roofing, flooring, and structural materials.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294255/Construction_zozolo.jpg', 0, 10, 4, true),
        ('automotive_spare_parts', 'Automobile & Auto Parts', 'Engine parts, braking systems, and EV components.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294268/Automative_part_tusmob.jpg', 0, 10, 5, true),
        ('plastic_polymer_components', 'Plastic & Polymer Products', 'Injection molded parts and industrial plastic components.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294480/Plastic_polymer_ysm22x.jpg', 0, 10, 6, true),
        ('food_agriculture_supplies', 'Food & Agriculture Processing', 'Agro-equipment, processing inputs, and organic supplies.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294555/Food_Agriculture_heawd4.jpg', 0, 10, 7, true),
        ('laboratory_pharma_consumables', 'Chemical & Pharma Manufacturing', 'Chemicals, additives, and medical consumables.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294629/Pharamas_labs_nigahy.jpg', 0, 10, 8, true),
        ('modular_furniture_wood', 'Furniture & Wood Products', 'Office, kitchen, and interior decorative products.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294735/Furniture_uig7s6.jpg', 0, 10, 9, true),
        ('renewable_energy_systems', 'Renewable Energy Products', 'Solar panels, inverters, and energy storage solutions.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294829/Renewable_Energy_piev0o.jpg', 0, 10, 10, true),
        ('packaging_logistics_supplies', 'Packaging Industry', 'Corrugated boxes, labels, and industrial pallets.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780294984/Packaging_boxes_mivqtz.jpg', 0, 10, 11, true),
        ('textile_garment_materials', 'Textile & Garments', 'Fabrics, yarns, and industrial safety apparel.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780295062/Textile_gqybcg.jpg', 0, 10, 12, true),
        ('cnc_industrial_tooling', 'CNC & VMC Tooling Product Categories', 'Precision cutting tools, holders, and inserts for CNC machines.', 'https://res.cloudinary.com/djolzxgct/image/upload/v1780295138/CNCC_Industrial_Tooling_vqipnh.jpg', 0, 10, 13, true)
        ON CONFLICT (code) DO UPDATE 
        SET label = EXCLUDED.label,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            sort_order = EXCLUDED.sort_order,
            is_active = EXCLUDED.is_active;

        DELETE FROM product_category 
        WHERE code NOT IN (
            'metal_fabrication_parts',
            'electrical_automation_components',
            'industrial_machinery_equipment',
            'construction_building_materials',
            'automotive_spare_parts',
            'plastic_polymer_components',
            'food_agriculture_supplies',
            'laboratory_pharma_consumables',
            'modular_furniture_wood',
            'renewable_energy_systems',
            'packaging_logistics_supplies',
            'textile_garment_materials',
            'cnc_industrial_tooling'
        );

CREATE TABLE IF NOT EXISTS vendor_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    category_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_vendor_category_selection UNIQUE (vendor_id, category_id),
    CONSTRAINT fk_vendor_categories_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_categories_category
        FOREIGN KEY (category_id)
        REFERENCES product_category(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_categories_vendor_id ON vendor_categories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_categories_category_id ON vendor_categories(category_id);

CREATE OR REPLACE FUNCTION enforce_vendor_category_limit()
RETURNS TRIGGER AS $$
DECLARE
    category_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_count
    FROM vendor_categories
    WHERE vendor_id = NEW.vendor_id;

    IF category_count >= 3 THEN
        RAISE EXCEPTION 'A vendor can select up to 3 categories only';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendor_category_limit ON vendor_categories;
CREATE TRIGGER trg_vendor_category_limit
BEFORE INSERT ON vendor_categories
FOR EACH ROW
EXECUTE FUNCTION enforce_vendor_category_limit();

-- ================================
-- CATALOG LAYER
-- ================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category UUID NOT NULL,
    product_type TEXT,
    specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    approval_status TEXT NOT NULL DEFAULT 'approved',
    approval_notes TEXT,
    created_by_user_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_products_product_type
        CHECK (product_type IS NULL OR product_type IN ('plastic', 'metal')),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category)
        REFERENCES product_category(id)
);

CREATE TABLE IF NOT EXISTS products_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    created_by_user_id UUID,
    reviewed_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_products_images_status
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT fk_products_images_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_products_images_created_by
        FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_products_images_reviewed_by
        FOREIGN KEY (reviewed_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- ================================
-- TRANSACTION LOGIC LAYER
-- ================================

CREATE TABLE IF NOT EXISTS vendor_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    moq INTEGER NOT NULL CHECK (moq > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    commision_percentage INTEGER DEFAULT 0 CHECK (commision_percentage >= 0 AND commision_percentage <= 100),
    quotation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quotation_min_qty INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    status vendor_product_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_vendor_product UNIQUE (vendor_id, product_id),
    CONSTRAINT fk_vendor_products_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_products_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_specification(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL,

    spec_key TEXT NOT NULL,
    spec_value TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    approval_notes TEXT,

    created_by_user_id UUID NOT NULL, -- user_id (admin/vendor)
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_product_specification_status
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),

    CONSTRAINT fk_product_specifications_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_specifications_created_by
        FOREIGN KEY (created_by_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_specifications_reviewed_by
        FOREIGN KEY (reviewed_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_specification_product_id ON product_specification(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specification_status ON product_specification(approval_status);

CREATE TABLE IF NOT EXISTS addresses(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
    latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_addresses_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS client(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_client_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_wishlists_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL,
    product_id UUID NOT NULL,
    vendor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_wishlist_product UNIQUE (wishlist_id, product_id),
    CONSTRAINT fk_wishlist_items_wishlist
        FOREIGN KEY (wishlist_id)
        REFERENCES wishlists(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_wishlist_items_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE SET NULL
);

    CREATE TABLE IF NOT EXISTS abandoned_reminder_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('cart', 'wishlist')),
        source_item_id UUID NOT NULL,
        reminder_type TEXT NOT NULL DEFAULT '24h_abandoned_reminder',
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_abandoned_reminder_source UNIQUE (source_type, source_item_id, reminder_type),
        CONSTRAINT fk_abandoned_reminder_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS fulfillment_centers(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL CHECK (pincode ~ '^[0-9]{6}$'),
    latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
    capacity TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_fulfillment_centers_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ================================
-- CART SYSTEM
-- ================================

--cart : 
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE, -- ensures 1 cart per user (for now)

    status TEXT NOT NULL DEFAULT 'active', 
    -- future: active, converted, abandoned, saved

    total_amount NUMERIC(12,2) DEFAULT 0, -- optional (can be computed)

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_carts_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

--cart_items : 
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cart_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_variant_id UUID,
    vendor_id UUID NOT NULL,

    quantity INTEGER NOT NULL CHECK (quantity > 0),

    price_at_added NUMERIC(12,2) NOT NULL, -- snapshot price

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cart_items_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_items_product_variant
        FOREIGN KEY (product_variant_id)
        REFERENCES product_variants(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_items_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_cart_product_vendor
        UNIQUE (cart_id, product_id, vendor_id)
);

-- ================================
-- ORDERS
-- ================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    vendor_id UUID NOT NULL,

    cart_id UUID, -- reference to original cart (optional but useful)

    status TEXT NOT NULL DEFAULT 'pending',
    -- pending, confirmed, shipped, delivered, cancelled

    payment_status TEXT DEFAULT 'pending',
    -- pending, paid, failed

    total_amount NUMERIC(12,2) NOT NULL,
    source TEXT NOT NULL DEFAULT 'client',
    order_reference TEXT,
    order_notes TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    created_by_admin_id TEXT,

    -- for storing address(not storing address refrence but storing address directly, because if refrence is stored them deletion of address by user become impossible)
    address_line TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    latitude TEXT NOT NULL,
    langitude TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_orders_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT fk_orders_cart FOREIGN KEY (cart_id) REFERENCES carts(id)
);

-- cart_items : 
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,

    product_id UUID NOT NULL,  -- keep FK (since we are not deleting products)
    vendor_id UUID NOT NULL,

    quantity INTEGER NOT NULL CHECK (quantity > 0),

    price NUMERIC(12,2) NOT NULL, -- 🔥 final locked price at checkout

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_order_items_order 
        FOREIGN KEY (order_id) 
        REFERENCES orders(id) 
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(id),

    CONSTRAINT fk_order_items_vendor 
        FOREIGN KEY (vendor_id) 
        REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS order_status_history(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,

    status order_status NOT NULL,
    note TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_order_status_history_order 
        FOREIGN KEY (order_id) 
        REFERENCES orders(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_fulfillment_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_id UUID NOT NULL,

    fulfillment_center_id UUID,

    status order_status NOT NULL,
    -- received, processing, dispatched, arrived, handed_over

    note TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_oft_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_oft_center
        FOREIGN KEY (fulfillment_center_id)
        REFERENCES fulfillment_centers(id)
        ON DELETE SET NULL
);

-- ================================
-- REVIEWS
-- ================================
CREATE TABLE IF NOT EXISTS order_item_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_title TEXT,
    review_text TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_item_reviews_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_item_reviews_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_item_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_item_reviews_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_item_reviews_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    user_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_title TEXT,
    review_text TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_vendor_review_per_order UNIQUE (order_id, vendor_id),
    CONSTRAINT fk_vendor_reviews_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_reviews_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE
);

-- ================================
-- DYNAMIC MIGRATIONS & ALTERATIONS
-- ================================

-- Safely alter users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS OTP TEXT,
    ADD COLUMN IF NOT EXISTS OTP_Expiry TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Safely alter products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS item_code TEXT,
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS approval_notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Safely alter vendors
ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS gst_number TEXT,
    ADD COLUMN IF NOT EXISTS gst_certificate_link TEXT,
    ADD COLUMN IF NOT EXISTS business_type TEXT,
    ADD COLUMN IF NOT EXISTS company_website TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS alternative_number TEXT,
    ADD COLUMN IF NOT EXISTS designation TEXT,
    ADD COLUMN IF NOT EXISTS business_description TEXT,
    ADD COLUMN IF NOT EXISTS credit_cycle TEXT,
    ADD COLUMN IF NOT EXISTS minimum_commision_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS maximum_commision_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS application_number TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS approval_status vendor_approval_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS approval_notes TEXT,
    ADD COLUMN IF NOT EXISTS reconsideration_notes TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Safely alter vendor_products
ALTER TABLE vendor_products
    ADD COLUMN IF NOT EXISTS product_id UUID,
    ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS commision_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quotation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS quotation_min_qty INTEGER,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS status vendor_product_status NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE products_images
    ADD COLUMN IF NOT EXISTS product_id UUID,
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Safely alter orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'client',
    ADD COLUMN IF NOT EXISTS order_reference TEXT,
    ADD COLUMN IF NOT EXISTS order_notes TEXT,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS created_by_admin_id TEXT,
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS cart_id UUID,
    ADD COLUMN IF NOT EXISTS address_line TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS pincode VARCHAR(6) NOT NULL DEFAULT '000000',
    ADD COLUMN IF NOT EXISTS latitude TEXT NOT NULL DEFAULT '0',
    ADD COLUMN IF NOT EXISTS langitude TEXT NOT NULL DEFAULT '0',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ================================
-- INDEXES
-- ================================

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS product_variant_id UUID;

-- Optimizing Foreign Keys (Postgres does not index these automatically)
CREATE INDEX IF NOT EXISTS idx_vendor_products_product_id ON vendor_products(product_id);
CREATE INDEX IF NOT EXISTS idx_products_images_product_id ON products_images(product_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_centers_user_id ON fulfillment_centers(user_id);

-- Optimizing Common Filtering Columns
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_vendor_products_status ON vendor_products(status);

--cart indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_variant_id ON cart_items(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items(product_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_reminder_logs_user_id ON abandoned_reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_reminder_logs_source ON abandoned_reminder_logs(source_type, source_item_id);

--order indexs : 
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE INDEX IF NOT EXISTS idx_vendor_categories_vendor_id ON vendor_categories(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_categories_category_id ON vendor_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_order_item_reviews_order_id ON order_item_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_reviews_user_id ON order_item_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_order_item_reviews_product_id ON order_item_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_order_item_reviews_vendor_id ON order_item_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_order_id ON vendor_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_user_id ON vendor_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_id ON vendor_reviews(vendor_id);

-- ================================
-- VENDOR COMMUNICATION & QUOTATIONS
-- ================================

CREATE TABLE IF NOT EXISTS vendor_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    sender_user_id UUID NOT NULL,
    sender_role TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_vendor_chat_messages_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_chat_messages_sender
        FOREIGN KEY (sender_user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_vendor_chat_sender_role
        CHECK (sender_role IN ('vendor', 'admin', 'super_admin'))
);

CREATE TABLE IF NOT EXISTS vendor_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number TEXT NOT NULL UNIQUE,
    quotation_kind TEXT NOT NULL DEFAULT 'vendor_agreement',
    vendor_id UUID NOT NULL,
    product_id UUID,
    created_by_admin_id UUID NOT NULL,
    sent_to_email CITEXT NOT NULL,
    title TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    target_price NUMERIC(12,2) CHECK (target_price >= 0),
    requested_moq INTEGER CHECK (requested_moq > 0),
    request_notes TEXT,
    validity_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'sent',
    vendor_price NUMERIC(12,2) CHECK (vendor_price >= 0),
    vendor_moq INTEGER CHECK (vendor_moq > 0),
    vendor_notes TEXT,
    admin_signature_data TEXT NOT NULL,
    vendor_signature_data TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    token_expires_at TIMESTAMPTZ NOT NULL,
    vendor_opened_at TIMESTAMPTZ,
    vendor_responded_at TIMESTAMPTZ,
    vendor_response_ip TEXT,
    vendor_response_user_agent TEXT,
    admin_reviewed_at TIMESTAMPTZ,
    reviewed_by_admin_id UUID,
    admin_review_notes TEXT,
    vendor_rejection_reason TEXT,
    email_sent_at TIMESTAMPTZ,
    email_last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_vendor_quotations_vendor
        FOREIGN KEY (vendor_id)
        REFERENCES vendors(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_quotations_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_vendor_quotations_admin
        FOREIGN KEY (created_by_admin_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_vendor_quotations_reviewed_by_admin
        FOREIGN KEY (reviewed_by_admin_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_vendor_quotation_status
        CHECK (status IN ('sent', 'vendor_opened', 'vendor_approved', 'vendor_rejected', 'admin_approved', 'admin_rejected'))
);

ALTER TABLE vendor_quotations
    ADD COLUMN IF NOT EXISTS quotation_number TEXT,
    ADD COLUMN IF NOT EXISTS quotation_kind TEXT NOT NULL DEFAULT 'vendor_agreement',
    ADD COLUMN IF NOT EXISTS vendor_id UUID,
    ADD COLUMN IF NOT EXISTS product_id UUID,
    ADD COLUMN IF NOT EXISTS created_by_admin_id UUID,
    ADD COLUMN IF NOT EXISTS sent_to_email CITEXT,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS unit TEXT,
    ADD COLUMN IF NOT EXISTS target_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS requested_moq INTEGER,
    ADD COLUMN IF NOT EXISTS request_notes TEXT,
    ADD COLUMN IF NOT EXISTS validity_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent',
    ADD COLUMN IF NOT EXISTS vendor_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS vendor_moq INTEGER,
    ADD COLUMN IF NOT EXISTS vendor_notes TEXT,
    ADD COLUMN IF NOT EXISTS admin_signature_data TEXT,
    ADD COLUMN IF NOT EXISTS vendor_signature_data TEXT,
    ADD COLUMN IF NOT EXISTS token_hash TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_responded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vendor_response_ip TEXT,
    ADD COLUMN IF NOT EXISTS vendor_response_user_agent TEXT,
    ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by_admin_id UUID,
    ADD COLUMN IF NOT EXISTS admin_review_notes TEXT,
    ADD COLUMN IF NOT EXISTS vendor_rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_last_error TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_vendor_chat_messages_vendor_id
    ON vendor_chat_messages(vendor_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_vendor_chat_messages_is_read
    ON vendor_chat_messages(vendor_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_quotations_number_unique
    ON vendor_quotations(quotation_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_quotations_token_hash_unique
    ON vendor_quotations(token_hash);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_vendor_id
    ON vendor_quotations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_product_id
    ON vendor_quotations(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_created_by_admin_id
    ON vendor_quotations(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_reviewed_by_admin_id
    ON vendor_quotations(reviewed_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_status
    ON vendor_quotations(status);

ALTER TABLE vendor_quotations DROP CONSTRAINT IF EXISTS chk_vendor_quotation_status;
ALTER TABLE vendor_quotations
    ADD CONSTRAINT chk_vendor_quotation_status
    CHECK (status IN ('sent', 'vendor_opened', 'vendor_approved', 'vendor_rejected', 'admin_approved', 'admin_rejected'));
ALTER TABLE vendor_quotations DROP CONSTRAINT IF EXISTS fk_vendor_quotations_reviewed_by_admin;
ALTER TABLE vendor_quotations
    ADD CONSTRAINT fk_vendor_quotations_reviewed_by_admin
    FOREIGN KEY (reviewed_by_admin_id)
    REFERENCES users(id)
    ON DELETE CASCADE;
ALTER TABLE vendor_quotations DROP CONSTRAINT IF EXISTS fk_vendor_quotations_product;
ALTER TABLE vendor_quotations
    ADD CONSTRAINT fk_vendor_quotations_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE SET NULL;
        -- Backfill Scripts


        UPDATE products
        SET approval_status = 'approved'
        WHERE approval_status IS NULL OR approval_status::TEXT = '';

        UPDATE vendors
        SET approval_status = 'approved'
        WHERE approval_status IS NULL OR approval_status::TEXT = '';

        INSERT INTO vendors (
            user_id,
            company_name,
            is_active,
            is_blocked,
            approval_status,
            approval_notes
        )
        SELECT
            u.id,
            COALESCE(NULLIF(TRIM(u.name), ''), u.email::text),
            TRUE,
            FALSE,
            'pending',
            'Backfilled from verified vendor account'
        FROM users u
        LEFT JOIN vendors v ON v.user_id = u.id
        WHERE u.role = 'vendor'
          AND u.is_verified = TRUE
          AND v.id IS NULL
        ON CONFLICT (user_id) DO NOTHING;

        UPDATE orders
        SET source = 'client'
        WHERE source IS NULL OR source::TEXT = '';

        UPDATE users
        SET is_verified = TRUE
        WHERE role IN ('admin', 'super_admin') AND is_verified = FALSE;

        -- ================================
        -- NOTIFICATIONS TABLE (shared with Client Backend)
        -- ================================
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            reference_type TEXT,
            reference_id UUID,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_notifications_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);

        -- Expand notification type constraint to include product-related types
        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_type;
        ALTER TABLE notifications
            ADD CONSTRAINT chk_notification_type
            CHECK (type IN (
                'quotation_request_received',
                'quotation_offer_received',
                'quotation_counter_received',
                'quotation_accepted',
                'quotation_rejected',
                'admin_confirmation_sent',
                'admin_confirmation_accepted',
                'admin_confirmation_rejected',
                'product_approved',
                'product_rejected',
                'image_approved',
                'image_rejected',
                'vendor_product_approved',
                'vendor_product_rejected',
                'general'
            ));

        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_reference_type;
        ALTER TABLE notifications
            ADD CONSTRAINT chk_notification_reference_type
            CHECK (reference_type IS NULL OR reference_type IN ('quotation', 'order', 'product'));

        -- ================================
        -- VENDOR PAYOUTS TABLE
        -- ================================
        CREATE TABLE IF NOT EXISTS vendor_payouts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            payout_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
            payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            delivered_at TIMESTAMPTZ,
            due_date TIMESTAMPTZ,
            last_paid_at TIMESTAMPTZ,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_vendor_payouts_order_id ON vendor_payouts(order_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id ON vendor_payouts(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status);

        -- Backfill existing orders that do not have a payout record
        INSERT INTO vendor_payouts (order_id, vendor_id, status, delivered_at, due_date)
        SELECT 
            o.id AS order_id,
            o.vendor_id AS vendor_id,
            'pending' AS status,
            CASE WHEN o.status = 'delivered' THEN COALESCE(
                (SELECT MIN(created_at) FROM order_status_history WHERE order_id = o.id AND status = 'delivered'),
                o.updated_at,
                NOW()
            ) ELSE NULL END AS delivered_at,
            CASE WHEN o.status = 'delivered' THEN COALESCE(
                (SELECT MIN(created_at) FROM order_status_history WHERE order_id = o.id AND status = 'delivered'),
                o.updated_at,
                NOW()
            ) + (
                COALESCE(
                    CASE 
                        WHEN LOWER(v.credit_cycle) LIKE '%immediate%' THEN 0
                        WHEN substring(v.credit_cycle from '\\d+') IS NOT NULL THEN substring(v.credit_cycle from '\\d+')::integer
                        ELSE 15
                    END, 
                    15
                ) * INTERVAL '1 day'
            ) ELSE NULL END AS due_date
        FROM orders o
        JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN vendor_payouts vp ON vp.order_id = o.id
        WHERE vp.id IS NULL
        ON CONFLICT (order_id) DO NOTHING;

        -- Update existing payouts where delivered_at is set but due_date is null
        UPDATE vendor_payouts vp
        SET 
            delivered_at = COALESCE(vp.delivered_at, (SELECT MIN(created_at) FROM order_status_history WHERE order_id = vp.order_id AND status = 'delivered'), NOW()),
            due_date = COALESCE(vp.delivered_at, (SELECT MIN(created_at) FROM order_status_history WHERE order_id = vp.order_id AND status = 'delivered'), NOW()) + (
                COALESCE(
                    CASE 
                        WHEN LOWER(v.credit_cycle) LIKE '%immediate%' THEN 0
                        WHEN substring(v.credit_cycle from '\\d+') IS NOT NULL THEN substring(v.credit_cycle from '\\d+')::integer
                        ELSE 15
                    END, 
                    15
                ) * INTERVAL '1 day'
            ),
            updated_at = NOW()
        FROM orders o
        JOIN vendors v ON o.vendor_id = v.id
        WHERE vp.order_id = o.id 
          AND o.status = 'delivered' 
          AND vp.due_date IS NULL;

        -- V2 schema updates
        ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_product_type;
        ALTER TABLE vendor_products ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 0.00;
        ALTER TABLE products_images ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE constraint_name = 'chk_products_images_media_type'
                  AND table_name = 'products_images'
            ) THEN
                ALTER TABLE products_images
                    ADD CONSTRAINT chk_products_images_media_type
                    CHECK (media_type IN ('image', 'video'));
            END IF;
        END $$;

        -- V3 schema updates - Stock & Price approvals
        ALTER TABLE vendor_products ADD COLUMN IF NOT EXISTS pending_price NUMERIC(12,2) DEFAULT NULL CHECK (pending_price >= 0);
        ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS product_variant_id UUID;

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_cart_items_product_variant'
                  AND table_name = 'cart_items'
            ) THEN
                ALTER TABLE cart_items
                    ADD CONSTRAINT fk_cart_items_product_variant
                    FOREIGN KEY (product_variant_id)
                    REFERENCES product_variants(id)
                    ON DELETE CASCADE;
            END IF;
        END $$;

        -- Drop obsolete uniqueness constraints that block multiple variants of the same product
        ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS idx_unique_cart_product_vendor;
        DROP INDEX IF EXISTS idx_unique_cart_product_vendor;
        ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS unique_cart_product_vendor;
        DROP INDEX IF EXISTS unique_cart_product_vendor;

        -- Drop legacy vendor product constraints/indexes that block multiple variants
        ALTER TABLE vendor_products DROP CONSTRAINT IF EXISTS unique_vendor_product;
        ALTER TABLE vendor_products DROP CONSTRAINT IF EXISTS idx_unique_vendor_product;
        DROP INDEX IF EXISTS idx_unique_vendor_product;

        -- Ensure unique_cart_product_variant_vendor is added
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE constraint_name = 'unique_cart_product_variant_vendor'
                  AND table_name = 'cart_items'
            ) THEN
                ALTER TABLE cart_items
                    ADD CONSTRAINT unique_cart_product_variant_vendor
                    UNIQUE (cart_id, product_variant_id, vendor_id);
            END IF;
        END $$;
    `);
}
