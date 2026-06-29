import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { marketplacePool } from "../lib/marketplace.js";

const adminRoles = ["admin", "super_admin"];

function ensureAdmin(req: Request, res: Response) {
    const { role } = (req as any).user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can perform this action." });
        return null;
    }
    return (req as any).user as { userId: string; role: string };
}

export const createFulfillmentCenter = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const {
        name,
        code,
        email,
        password,
        contact_phone,
        contact_email,
        manager_name,
        address,
        city,
        state,
        country,
        pincode,
        latitude,
        longitude,
        total_area_sqft,
        capacity_packages,
        storage_type,
        operating_hours,
        status,
    } = req.body;

    if (!name || !code || !email || !password || !address || !city || !state || !country || !pincode) {
        return res.status(400).json({
            message: "Name, code, email, password, address, city, state, country, and pincode are required.",
        });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const normalizedEmail = String(email).trim().toLowerCase();
        const existingUserResult = await client.query(
            `SELECT id, role FROM users WHERE email = $1`,
            [normalizedEmail]
        );

        let userId: string;
        if (!existingUserResult.rows.length) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const createdUser = await client.query(
                `
                    INSERT INTO users (name, email, password_hash, role, is_active, is_verified)
                    VALUES ($1, $2, $3, 'fulfillment_center', TRUE, TRUE)
                    RETURNING id
                `,
                [String(name).trim(), normalizedEmail, hashedPassword]
            );
            userId = createdUser.rows[0].id;
        } else {
            const existingUser = existingUserResult.rows[0];
            if (existingUser.role !== "fulfillment_center") {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    message: "A user with a different role already exists with this email.",
                });
            }

            userId = existingUser.id;
            await client.query(
                `UPDATE users SET name = $1, is_active = TRUE, updated_at = NOW() WHERE id = $2`,
                [String(name).trim(), userId]
            );
        }

        const fcResult = await client.query(
            `
                INSERT INTO fulfillment_centers (
                    user_id, name, code, contact_phone, contact_email, manager_name,
                    address, city, state, country, pincode, latitude, longitude,
                    total_area_sqft, capacity_packages, storage_type, operating_hours, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    code = EXCLUDED.code,
                    contact_phone = EXCLUDED.contact_phone,
                    contact_email = EXCLUDED.contact_email,
                    manager_name = EXCLUDED.manager_name,
                    address = EXCLUDED.address,
                    city = EXCLUDED.city,
                    state = EXCLUDED.state,
                    country = EXCLUDED.country,
                    pincode = EXCLUDED.pincode,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    total_area_sqft = EXCLUDED.total_area_sqft,
                    capacity_packages = EXCLUDED.capacity_packages,
                    storage_type = EXCLUDED.storage_type,
                    operating_hours = EXCLUDED.operating_hours,
                    status = EXCLUDED.status,
                    updated_at = NOW()
                RETURNING *
            `,
            [
                userId,
                String(name).trim(),
                String(code).trim().toUpperCase(),
                contact_phone ? String(contact_phone).trim() : null,
                contact_email ? String(contact_email).trim().toLowerCase() : null,
                manager_name ? String(manager_name).trim() : null,
                String(address).trim(),
                String(city).trim(),
                String(state).trim(),
                String(country).trim(),
                String(pincode).trim(),
                latitude ? Number(latitude) : null,
                longitude ? Number(longitude) : null,
                total_area_sqft ? Number(total_area_sqft) : null,
                capacity_packages ? Number(capacity_packages) : null,
                storage_type ? String(storage_type).trim() : null,
                operating_hours ? String(operating_hours).trim() : null,
                status ? String(status).trim() : "active",
            ]
        );

        await client.query("COMMIT");
        return res.status(201).json({
            message: "Fulfillment center created successfully",
            data: { ...fcResult.rows[0], email: normalizedEmail },
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error creating fulfillment center:", error);
        if (error.code === "23505" && error.constraint === "fulfillment_centers_code_key") {
            return res.status(409).json({ message: "A fulfillment center with this code already exists." });
        }
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const getAllFulfillmentCenters = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `
                SELECT fc.*, u.email 
                FROM fulfillment_centers fc
                JOIN users u ON u.id = fc.user_id
                ORDER BY fc.created_at DESC
            `
        );
        return res.status(200).json({
            message: "Fulfillment centers retrieved successfully",
            data: result.rows,
        });
    } catch (error) {
        console.error("Error retrieving fulfillment centers:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getFulfillmentCenterById = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;

    try {
        const result = await marketplacePool.query(
            `
                SELECT fc.*, u.email 
                FROM fulfillment_centers fc
                JOIN users u ON u.id = fc.user_id
                WHERE fc.id = $1
            `,
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Fulfillment center not found" });
        }

        return res.status(200).json({
            message: "Fulfillment center retrieved successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error retrieving fulfillment center details:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateFulfillmentCenter = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;
    const {
        name,
        code,
        email,
        password,
        contact_phone,
        contact_email,
        manager_name,
        address,
        city,
        state,
        country,
        pincode,
        latitude,
        longitude,
        total_area_sqft,
        capacity_packages,
        storage_type,
        operating_hours,
        status,
    } = req.body;

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const fcCheck = await client.query(
            `SELECT id, user_id FROM fulfillment_centers WHERE id = $1`,
            [id]
        );

        if (!fcCheck.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Fulfillment center not found" });
        }

        const userId = fcCheck.rows[0].user_id;

        // Update user name/email/password
        if (email) {
            const normalizedEmail = String(email).trim().toLowerCase();
            const emailCheck = await client.query(
                `SELECT id FROM users WHERE email = $1 AND id != $2`,
                [normalizedEmail, userId]
            );
            if (emailCheck.rows.length) {
                await client.query("ROLLBACK");
                return res.status(409).json({ message: "Email is already taken by another user." });
            }

            await client.query(
                `UPDATE users SET email = $1 WHERE id = $2`,
                [normalizedEmail, userId]
            );
        }

        if (name) {
            await client.query(
                `UPDATE users SET name = $1 WHERE id = $2`,
                [String(name).trim(), userId]
            );
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await client.query(
                `UPDATE users SET password_hash = $1 WHERE id = $2`,
                [hashedPassword, userId]
            );
        }

        const updateResult = await client.query(
            `
                UPDATE fulfillment_centers
                SET
                    name = COALESCE($1, name),
                    code = COALESCE($2, code),
                    contact_phone = $3,
                    contact_email = $4,
                    manager_name = $5,
                    address = COALESCE($6, address),
                    city = COALESCE($7, city),
                    state = COALESCE($8, state),
                    country = COALESCE($9, country),
                    pincode = COALESCE($10, pincode),
                    latitude = $11,
                    longitude = $12,
                    total_area_sqft = $13,
                    capacity_packages = $14,
                    storage_type = $15,
                    operating_hours = $16,
                    status = COALESCE($17, status),
                    updated_at = NOW()
                WHERE id = $18
                RETURNING *
            `,
            [
                name ? String(name).trim() : null,
                code ? String(code).trim().toUpperCase() : null,
                contact_phone ? String(contact_phone).trim() : null,
                contact_email ? String(contact_email).trim().toLowerCase() : null,
                manager_name ? String(manager_name).trim() : null,
                address ? String(address).trim() : null,
                city ? String(city).trim() : null,
                state ? String(state).trim() : null,
                country ? String(country).trim() : null,
                pincode ? String(pincode).trim() : null,
                latitude !== undefined ? (latitude ? Number(latitude) : null) : undefined,
                longitude !== undefined ? (longitude ? Number(longitude) : null) : undefined,
                total_area_sqft !== undefined ? (total_area_sqft ? Number(total_area_sqft) : null) : undefined,
                capacity_packages !== undefined ? (capacity_packages ? Number(capacity_packages) : null) : undefined,
                storage_type ? String(storage_type).trim() : null,
                operating_hours ? String(operating_hours).trim() : null,
                status ? String(status).trim() : null,
                id,
            ]
        );

        await client.query("COMMIT");
        return res.status(200).json({
            message: "Fulfillment center updated successfully",
            data: updateResult.rows[0],
        });
    } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Error updating fulfillment center:", error);
        if (error.code === "23505" && error.constraint === "fulfillment_centers_code_key") {
            return res.status(409).json({ message: "A fulfillment center with this code already exists." });
        }
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const deleteFulfillmentCenter = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;

    try {
        const fcCheck = await marketplacePool.query(
            `SELECT user_id FROM fulfillment_centers WHERE id = $1`,
            [id]
        );

        if (!fcCheck.rows.length) {
            return res.status(404).json({ message: "Fulfillment center not found" });
        }

        const userId = fcCheck.rows[0].user_id;

        // Deleting from users cascades to fulfillment_centers
        await marketplacePool.query(`DELETE FROM users WHERE id = $1`, [userId]);

        return res.status(200).json({ message: "Fulfillment center deleted successfully" });
    } catch (error) {
        console.error("Error deleting fulfillment center:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
