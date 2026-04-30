function replaceSslMode(url, nextMode) {
    return url.replace(/sslmode=(prefer|require|verify-ca)/i, `sslmode=${nextMode}`);
}
export function isPostgresConnectionString(value) {
    return /^postgres(ql)?:\/\//i.test(value);
}
export function normalizeDatabaseUrl(rawUrl) {
    if (!rawUrl) {
        throw new Error("DATABASE_URL is not defined.");
    }
    if (!isPostgresConnectionString(rawUrl)) {
        throw new Error("DATABASE_URL must be a valid PostgreSQL connection string.");
    }
    if (/uselibpqcompat=/i.test(rawUrl)) {
        return rawUrl;
    }
    if (/sslmode=(prefer|require|verify-ca)/i.test(rawUrl)) {
        return replaceSslMode(rawUrl, "verify-full");
    }
    return rawUrl;
}
//# sourceMappingURL=database-url.js.map