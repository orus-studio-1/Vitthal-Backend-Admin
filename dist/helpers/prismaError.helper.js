export function getPrismaErrorMessage(error) {
    const prismaError = error;
    const message = prismaError?.message ?? "";
    if (prismaError?.code === "P2021") {
        return "Database tables are not initialized yet. Run `npm run admin:setup -- --email you@example.com --password yourpassword --name \"Admin\"` to push the schema and create the first admin in one step.";
    }
    if (/EAI_AGAIN|ENOTFOUND|ECONNREFUSED/i.test(message)) {
        return "Could not reach the database. Check that your DATABASE_URL is correct, your internet/VPN is available, and the database server is accepting connections.";
    }
    return null;
}
//# sourceMappingURL=prismaError.helper.js.map