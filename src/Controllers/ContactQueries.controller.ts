import {Request , Response} from "express"
import { prisma } from "../lib/prisma.js";

export const getClientQueries = async (req:Request, res:Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, parseInt(limit));

    const where = status ? { status: status as string } : {};

    const [queries, total] = await Promise.all([
      prisma.contact_queries.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contact_queries.count({ where }),
    ]);

    res.json({
      data: queries,
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Fetch contact queries error:", err);
    res.status(500).json({ error: "Failed to fetch contact queries" });
  }
}

export const updateClientQuery = async (req:Request, res:Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!["new", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await prisma.contact_queries.update({
      where: { id },
      data: { status, updated_at: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("Update contact query error:", err);
    res.status(500).json({ error: "Failed to update query" });
  }
}