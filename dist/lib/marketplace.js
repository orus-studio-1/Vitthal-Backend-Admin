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
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE EXTENSION IF NOT EXISTS citext;

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
                CREATE TYPE user_role AS ENUM ('client', 'vendor', 'admin', 'super_admin');
            END IF;
        END $$;

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

        CREATE TABLE IF NOT EXISTS vendors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE,
            company_name TEXT NOT NULL,
            gst_number TEXT UNIQUE,
            phone TEXT,
            rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
            approval_status TEXT NOT NULL DEFAULT 'pending',
            approval_notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_vendors_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            product_type TEXT,
            specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
            approval_status TEXT NOT NULL DEFAULT 'approved',
            approval_notes TEXT,
            created_by_user_id UUID,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS products_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL,
            image_url TEXT NOT NULL,
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_products_images_product
                FOREIGN KEY (product_id)
                REFERENCES products(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vendor_products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
            moq INTEGER NOT NULL CHECK (moq > 0),
            stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
            commision_percentage INTEGER DEFAULT 0 CHECK (commision_percentage >= 0 AND commision_percentage <= 100),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
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

        CREATE TABLE IF NOT EXISTS addresses (
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

        CREATE TABLE IF NOT EXISTS client (
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

        CREATE TABLE IF NOT EXISTS carts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'active',
            total_amount NUMERIC(12,2) DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_carts_user
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cart_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cart_id UUID NOT NULL,
            product_id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            price_at_added NUMERIC(12,2) NOT NULL,
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
            CONSTRAINT fk_cart_items_vendor
                FOREIGN KEY (vendor_id)
                REFERENCES vendors(id)
                ON DELETE CASCADE,
            CONSTRAINT unique_cart_product_vendor
                UNIQUE (cart_id, product_id, vendor_id)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            cart_id UUID,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_status TEXT DEFAULT 'pending',
            total_amount NUMERIC(12,2) NOT NULL,
            source TEXT NOT NULL DEFAULT 'client',
            order_reference TEXT,
            order_notes TEXT,
            customer_name TEXT,
            customer_email TEXT,
            customer_phone TEXT,
            created_by_admin_id TEXT,
            address_line TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            state TEXT NOT NULL DEFAULT '',
            country TEXT NOT NULL DEFAULT '',
            pincode VARCHAR(6) NOT NULL DEFAULT '000000',
            latitude TEXT NOT NULL DEFAULT '0',
            langitude TEXT NOT NULL DEFAULT '0',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id),
            CONSTRAINT fk_orders_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
            CONSTRAINT fk_orders_cart FOREIGN KEY (cart_id) REFERENCES carts(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL,
            product_id UUID NOT NULL,
            vendor_id UUID NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            price NUMERIC(12,2) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS OTP TEXT,
            ADD COLUMN IF NOT EXISTS OTP_Expiry TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS refresh_token TEXT,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE products
            ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS approval_notes TEXT,
            ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE vendors
            ADD COLUMN IF NOT EXISTS user_id UUID,
            ADD COLUMN IF NOT EXISTS company_name TEXT,
            ADD COLUMN IF NOT EXISTS gst_number TEXT,
            ADD COLUMN IF NOT EXISTS phone TEXT,
            ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS approval_notes TEXT,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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

        ALTER TABLE products_images
            ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE vendor_products
            ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS commision_percentage INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE addresses
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE client
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE vendor_chat_messages
            ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_product_type;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_user_id_unique ON vendors(user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_gst_number_unique
            ON vendors(gst_number) WHERE gst_number IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_client_user_id_unique ON client(user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_user_id_unique ON addresses(user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_vendor_product
            ON vendor_products(vendor_id, product_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_cart_product_vendor
            ON cart_items(cart_id, product_id, vendor_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_products_product_id ON vendor_products(product_id);
        CREATE INDEX IF NOT EXISTS idx_products_images_product_id ON products_images(product_id);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
        CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating DESC) WHERE is_active = TRUE;
        CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
        CREATE INDEX IF NOT EXISTS idx_vendor_chat_messages_vendor_id
            ON vendor_chat_messages(vendor_id, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_vendor_chat_messages_is_read
            ON vendor_chat_messages(vendor_id, is_read);

        UPDATE products
        SET specifications = jsonb_strip_nulls(
            jsonb_build_object(
                'material', material,
                'grade', grade,
                'application', application,
                'standard', standard
            )
        )
        WHERE specifications = '{}'::jsonb
          AND (
              material IS NOT NULL
              OR grade IS NOT NULL
              OR application IS NOT NULL
              OR standard IS NOT NULL
          );

        UPDATE products
        SET approval_status = 'approved'
        WHERE approval_status IS NULL OR approval_status::TEXT = '';

        UPDATE vendors
        SET approval_status = 'approved'
        WHERE approval_status IS NULL OR approval_status::TEXT = '';

        UPDATE orders
        SET source = 'client'
        WHERE source IS NULL OR source::TEXT = '';

        UPDATE users
        SET is_verified = TRUE
        WHERE role IN ('admin', 'super_admin') AND is_verified = FALSE;
    `);
}
//# sourceMappingURL=marketplace.js.map