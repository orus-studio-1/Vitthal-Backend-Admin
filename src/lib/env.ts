import "dotenv/config";

const requiredEnvVars = [
    "DATABASE_URL",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
] as const;

export function validateEnv() {
    const missing = requiredEnvVars.filter((key) => !process.env[key]?.trim());

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(", ")}. Update your .env file before starting the server.`
        );
    }
}
