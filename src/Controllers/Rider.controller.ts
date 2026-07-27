import type { Request, Response } from "express";
import bcrypt from 'bcrypt';
import { prisma } from "../lib/prisma.js";
import { UserRole } from "../generated/prisma/enums.js";
import { getPrismaErrorMessage } from "../helpers/prismaError.helper.js";

export const getAllDeliveryAgents = async (req: Request, res: Response): Promise<Response> => {
    try {
        const agents = await prisma.delivery_agents.findMany({
            include: {
                users: true,
                fulfillment_centers: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        const deliveryCountsRaw: any[] = await prisma.$queryRaw`
            SELECT da.id::text as delivery_agent_id, 
                   (
                       SELECT COUNT(DISTINCT sub.order_id)::int 
                       FROM (
                           SELECT oft.order_id 
                           FROM order_fulfillment_tracking oft
                           WHERE oft.delivery_agent_id = da.id 
                             AND oft.status IN ('delivered', 'received', 'handed_over')
                           UNION
                           SELECT orp.order_id 
                           FROM order_route_plan orp
                           WHERE orp.pickup_rider_id = da.id
                       ) sub
                   ) as completed_count
            FROM delivery_agents da
        `;

        const countsMap = new Map<string, number>();
        if (Array.isArray(deliveryCountsRaw)) {
            deliveryCountsRaw.forEach(item => {
                countsMap.set(item.delivery_agent_id, item.completed_count || 0);
            });
        }

        const mapped = agents.map(agent => ({
            id: agent.id,
            special_rider_id: agent.special_rider_id,
            contact_phone: agent.contact_phone,
            vehicle_type: agent.vehicle_type,
            vehicle_number: agent.vehicle_number,
            status: agent.status,
            is_online: agent.is_online,
            created_at: agent.created_at.toISOString(),
            rider_name: agent.users?.name || '',
            rider_email: agent.users?.email || '',
            center_name: agent.fulfillment_centers?.name || '',
            center_code: agent.fulfillment_centers?.code || '',
            completed_deliveries_count: countsMap.get(agent.id) || 0
        }));

        return res.status(200).json({ data: mapped });
    } catch (error) {
        console.error("Error fetching delivery agents:", error);
        return res.status(500).json({ message: "Failed to load database records." });
    }
};

export const getRiderDeliveries = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    try {
        const deliveries: any[] = await prisma.$queryRaw`
            SELECT sub.tracking_id,
                   sub.order_id,
                   sub.order_reference,
                   sub.customer_name,
                   sub.address_line, sub.city, sub.state, sub.pincode,
                   sub.vendor_name, sub.vendor_city, sub.vendor_state,
                   sub.delivered_at,
                   sub.delivery_status,
                   sub.delivery_leg_title,
                   sub.items
            FROM (
                SELECT oft.id::text as tracking_id,
                       o.id as order_id, 
                       COALESCE(o.order_reference, substring(o.id::text, 1, 8)) as order_reference, 
                       COALESCE(o.customer_name, 'Valued Customer') as customer_name, 
                       o.address_line, o.city, o.state, o.pincode,
                       COALESCE(v.company_name, 'Partner Vendor') as vendor_name,
                       o.vendor_city, o.vendor_state,
                       oft.created_at as delivered_at, 
                       oft.status as delivery_status,
                       CASE 
                           WHEN oft.status = 'received' THEN 'Vendor ➔ Fulfillment Center Hub'
                           ELSE 'Fulfillment Center Hub ➔ Client Dropoff'
                       END as delivery_leg_title,
                       (
                           SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity))
                           FROM order_items oi
                           JOIN products p ON oi.product_id = p.id
                           WHERE oi.order_id = o.id
                       ) as items
                FROM order_fulfillment_tracking oft
                JOIN orders o ON oft.order_id = o.id
                LEFT JOIN vendors v ON o.vendor_id = v.id
                WHERE oft.delivery_agent_id = ${id}::uuid
                  AND oft.status IN ('delivered', 'received', 'handed_over')

                UNION ALL

                SELECT orp.id::text as tracking_id,
                       o.id as order_id,
                       COALESCE(o.order_reference, substring(o.id::text, 1, 8)) as order_reference,
                       COALESCE(o.customer_name, 'Valued Customer') as customer_name,
                       o.address_line, o.city, o.state, o.pincode,
                       COALESCE(v.company_name, 'Partner Vendor') as vendor_name,
                       o.vendor_city, o.vendor_state,
                       COALESCE(orp.actual_arrival, orp.updated_at, orp.created_at) as delivered_at,
                       'received' as delivery_status,
                       'Vendor ➔ Fulfillment Center Hub' as delivery_leg_title,
                       (
                           SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity))
                           FROM order_items oi
                           JOIN products p ON oi.product_id = p.id
                           WHERE oi.order_id = o.id
                       ) as items
                FROM order_route_plan orp
                JOIN orders o ON orp.order_id = o.id
                LEFT JOIN vendors v ON o.vendor_id = v.id
                WHERE orp.pickup_rider_id = ${id}::uuid
                  AND NOT EXISTS (
                      SELECT 1 FROM order_fulfillment_tracking oft2 
                      WHERE oft2.order_id = o.id AND oft2.delivery_agent_id = ${id}::uuid AND oft2.status = 'received'
                  )
            ) sub
            ORDER BY sub.delivered_at DESC
        `;

        return res.status(200).json({ data: deliveries });
    } catch (error) {
        console.error("Error fetching rider deliveries:", error);
        return res.status(500).json({ message: "Failed to load rider delivery history." });
    }
};

export const createDeliveryAgent = async (req: Request, res: Response): Promise<Response> => {
    const { name, email, password, contact_phone, vehicle_type, vehicle_number, fulfillment_center_id } = req.body;

    if (!name || !email || !password || !fulfillment_center_id) {
        return res.status(400).json({ message: "Name, email, password, and Fulfillment Center are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const prefix = "RID";
        const randomStr = Math.floor(100000 + Math.random() * 900000).toString();
        const specialRiderId = `${prefix}-${randomStr}`;

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: String(name).trim(),
                    email: String(email).trim().toLowerCase(),
                    password_hash: hashedPassword,
                    role: UserRole.delivery_agent
                }
            });

            const agent = await tx.delivery_agents.create({
                data: {
                    user_id: user.id,
                    fulfillment_center_id: fulfillment_center_id,
                    special_rider_id: specialRiderId,
                    contact_phone: contact_phone ? String(contact_phone).trim() : null,
                    vehicle_type: vehicle_type ? String(vehicle_type).trim() : null,
                    vehicle_number: vehicle_number ? String(vehicle_number).trim() : null,
                    status: 'active',
                    is_online: false
                }
            });

            return agent;
        });

        return res.status(201).json({ message: "Rider Partner registered successfully!", data: result });
    } catch (error: any) {
        console.error("Error creating delivery agent:", error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: "Email or Rider ID already exists." });
        }
        return res.status(500).json({ message: getPrismaErrorMessage(error) || "Failed to register Rider Partner." });
    }
};
