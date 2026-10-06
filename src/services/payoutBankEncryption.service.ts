import crypto from "node:crypto";

function getEncryptionKey(): Buffer {
    const encodedKey = process.env.PAYOUT_BANK_ENCRYPTION_KEY;
    const key = encodedKey ? Buffer.from(encodedKey, "base64") : Buffer.alloc(0);
    if (key.length !== 32) {
        throw new Error("PAYOUT_BANK_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    }
    return key;
}

export function decryptPayoutAccountNumber(value: string): string {
    const [version, encodedIv, encodedTag, encodedData] = value.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedData) {
        throw new Error("Unsupported payout account ciphertext format.");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
        decipher.update(Buffer.from(encodedData, "base64url")),
        decipher.final(),
    ]).toString("utf8");
}