import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
    region: (process.env.AWS_REGION || "ap-south-1").trim(),
    credentials: {
        accessKeyId: (process.env.AWS_ACCESS_KEY_ID || "").trim(),
        secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || "").trim(),
    },
});

const BUCKET_NAME = (process.env.AWS_BUCKET_NAME || "").trim();

/**
 * Get a presigned URL for a private S3 object (expires in 1 hour by default).
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}

export function extractS3Key(url: string | null | undefined): string {
    if (!url || typeof url !== "string") {
        return "";
    }
    let key = url;
    if (url.includes("amazonaws.com/")) {
        const parts = url.split("amazonaws.com/");
        if (parts.length > 1) {
            key = parts[1] || "";
        }
    }
    if (key.includes("?")) {
        key = key.split("?")[0] || "";
    }
    return key;
}

export async function getPresignedUrlOrOriginal(url: string | null | undefined): Promise<string> {
    if (!url || typeof url !== "string") {
        return url || "";
    }
    if (url.includes("amazonaws.com/") || url.startsWith("uploads/") || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        const key = extractS3Key(url);
        try {
            return await getPresignedUrl(key);
        } catch (err) {
            console.error("Failed to generate presigned URL for key", key, err);
            return url;
        }
    }
    return url;
}

export { s3Client, BUCKET_NAME };
