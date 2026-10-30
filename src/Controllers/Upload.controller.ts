import { Request, Response } from "express";
import crypto from "crypto";
import { getPresignedUrl, uploadBufferToS3 } from "../services/s3.service.js";

// Same key layout as the Client Backend's /api/upload, so files stay viewable from either backend.
const UPLOAD_PREFIX = "uploads/";

export const uploadFile = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }
        const userId = (req as any).user.userId as string;
        const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileName = `${UPLOAD_PREFIX}${userId}/${Date.now()}_${crypto.randomUUID()}_${originalName}`;

        await uploadBufferToS3(req.file.buffer, fileName, req.file.mimetype);

        return res.status(200).json({ success: true, message: "File uploaded successfully", fileName });
    } catch (error) {
        console.error("Error uploading file to S3:", error);
        return res.status(500).json({ success: false, message: "Failed to upload the file to storage. Please try again." });
    }
};

export const getFileUrl = async (req: Request, res: Response) => {
    try {
        const fileName = req.query.fileName;
        if (typeof fileName !== "string" || !fileName) {
            return res.status(400).json({ success: false, message: "Filename is required" });
        }
        if (fileName.includes("..")) {
            return res.status(403).json({ success: false, message: "You do not have access to this file." });
        }

        const url = await getPresignedUrl(fileName);
        return res.status(200).json({ success: true, url });
    } catch (error) {
        console.error("Error getting signed URL from S3:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
