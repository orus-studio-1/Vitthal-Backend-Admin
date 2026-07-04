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
            center_code: agent.fulfillment_centers?.code || ''
        }));

        return res.status(200).json({ data: mapped });
    } catch (error) {
        console.error("Error fetching delivery agents:", error);
        return res.status(500).json({ message: "Failed to load database records." });
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
