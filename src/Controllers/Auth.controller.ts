import type { Request, Response } from "express";
import bcrypt from 'bcrypt';
import { generateAccessToken, generateRefreshToken, verifyToken } from "../helpers/jwt.helper.js";
import { getPrismaErrorMessage } from "../helpers/prismaError.helper.js";
import { COOKIE_OPTIONS } from "../shared/CokkieSetting.shared.js";
import { prisma } from "../lib/prisma.js";
import { UserRole } from "../generated/prisma/enums.js";

const selectSafeUser = {
    id: true,
    name: true,
    email: true,
    role: true,
    is_active: true,
    created_at: true
} as const;

type CurrentUserRecord = {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    is_active: boolean;
    refresh_token: string | null;
    created_at: Date;
    updated_at: Date;
};

type LegacyAdminUser = {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: string;
    is_active: boolean;
    created_at: string | null;
};

const adminRoles = new Set<UserRole>(["admin", "super_admin"]);

function normalizeRoleValue(role: string | null | undefined): string {
    return String(role ?? "").trim().toLowerCase().replace(/-/g, "_");
}

function isAdminRole(role: string | UserRole | null | undefined): role is UserRole {
    return adminRoles.has(normalizeRoleValue(role) as UserRole);
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function pickColumn(columns: Set<string>, candidates: string[]): string | null {
    for (const candidate of candidates) {
        if (columns.has(candidate)) {
            return candidate;
        }
    }

    return null;
}

async function findLegacyAdminUserByEmail(email: string): Promise<LegacyAdminUser | null> {
    const tableCheck = await prisma.$queryRawUnsafe<Array<{ table_name: string | null }>>(
        `SELECT to_regclass('public."User"')::text AS table_name`
    );

    if (!tableCheck[0]?.table_name) {
        return null;
    }

    const columnRows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'User'`
    );

    const columns = new Set(columnRows.map((row) => row.column_name));
    const idColumn = pickColumn(columns, ["id"]);
    const emailColumn = pickColumn(columns, ["email"]);
    const passwordColumn = pickColumn(columns, ["password_hash", "passwordHash"]);
    const roleColumn = pickColumn(columns, ["role"]);

    if (!idColumn || !emailColumn || !passwordColumn || !roleColumn) {
        return null;
    }

    const nameColumn = pickColumn(columns, ["name"]);
    const isActiveColumn = pickColumn(columns, ["is_active", "isActive"]);
    const createdAtColumn = pickColumn(columns, ["created_at", "createdAt"]);

    const sql = `
        SELECT
            ${quoteIdentifier(idColumn)}::text AS id,
            ${nameColumn ? `${quoteIdentifier(nameColumn)}::text` : "''"} AS name,
            ${quoteIdentifier(emailColumn)}::text AS email,
            ${quoteIdentifier(passwordColumn)}::text AS password_hash,
            ${quoteIdentifier(roleColumn)}::text AS role,
            ${isActiveColumn ? `${quoteIdentifier(isActiveColumn)}::boolean` : "TRUE"} AS is_active,
            ${createdAtColumn ? `${quoteIdentifier(createdAtColumn)}::text` : "NULL"} AS created_at
        FROM public."User"
        WHERE LOWER(${quoteIdentifier(emailColumn)}::text) = LOWER($1)
        LIMIT 1
    `;

    const result = await prisma.$queryRawUnsafe<LegacyAdminUser[]>(sql, email);
    return result[0] ?? null;
}

async function ensureSessionUserFromLegacy(legacyUser: LegacyAdminUser): Promise<CurrentUserRecord> {
    return prisma.user.upsert({
        where: { email: legacyUser.email.trim().toLowerCase() },
        update: {
            name: legacyUser.name || "MTWO Admin",
            password_hash: legacyUser.password_hash,
            is_active: legacyUser.is_active,
        },
        create: {
            id: legacyUser.id,
            name: legacyUser.name || "MTWO Admin",
            email: legacyUser.email.trim().toLowerCase(),
            password_hash: legacyUser.password_hash,
            role: legacyUser.role as UserRole,
            is_active: legacyUser.is_active,
        },
    });
}

export async function registerUser(req: Request, res: Response): Promise<Response> {
    const { name, email, password, role: requestedRole } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const role = typeof requestedRole === "string" && requestedRole.trim() ? requestedRole.trim().toLowerCase() : "client";

    if (!name || !normalizedEmail || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (!/^[\w.-]+@[\w.-]+\.\w{2,}$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!Object.values(UserRole).includes(role as UserRole)) {
        return res.status(400).json({ message: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name: String(name).trim(),
                email: normalizedEmail,
                password_hash: hashedPassword,
                role: role as UserRole
            },
            select: selectSafeUser
        });

        const refreshToken = generateRefreshToken(user.id, user.name, user.email, role);
        const accessToken = generateAccessToken(user.id, user.name, user.email, role);

        // Store refresh token in database for revocation and session tracking
        await prisma.user.update({
            where: { id: user.id },
            data: { refresh_token: refreshToken }
        });

        res.cookie('refreshToken', refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 45 * 24 * 60 * 60 * 1000, // 45 days
        });

        res.cookie('accessToken', accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 30 * 60 * 1000, // 30 minutes
        });

        return res.status(201).json({ message: 'User registered successfully', data: user });
    }
    catch (error: any) {
        const prismaMessage = getPrismaErrorMessage(error);
        if (prismaMessage) {
            return res.status(503).json({ message: prismaMessage });
        }

        if (error.code === 'P2002') {
            return res.status(409).json({ message: 'User with this email already exists' });
        }
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function loginUser(req: Request, res: Response): Promise<Response> {
    const { email, password, role: requestedRole } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedRequestedRole = typeof requestedRole === "string" ? requestedRole.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        let effectiveRole = user?.role;
        let legacyAdminUser: LegacyAdminUser | null = null;
        let legacyPasswordValid = false;

        if (normalizedRequestedRole === "admin" && !isAdminRole(user?.role)) {
            legacyAdminUser = await findLegacyAdminUserByEmail(normalizedEmail);

            if (legacyAdminUser && isAdminRole(legacyAdminUser.role)) {
                legacyPasswordValid = await bcrypt.compare(password, legacyAdminUser.password_hash);
                if (legacyPasswordValid) {
                    user = await ensureSessionUserFromLegacy(legacyAdminUser);
                    effectiveRole = normalizeRoleValue(legacyAdminUser.role) as UserRole;
                }
            }
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid email' });
        }

        if (normalizedRequestedRole === "admin" && !isAdminRole(effectiveRole)) {
            return res.status(403).json({ message: 'Only admin accounts can access this dashboard' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'User account is inactive' });
        }

        const isPasswordValid = legacyPasswordValid || await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const sessionRole = effectiveRole ?? user.role;
        const responseName = legacyAdminUser?.name || user.name;
        const responseCreatedAt = legacyAdminUser?.created_at || user.created_at;

        const refreshToken = generateRefreshToken(user.id, responseName, user.email, sessionRole);
        const accessToken = generateAccessToken(user.id, responseName, user.email, sessionRole);

        // Store refresh token in database for revocation and session tracking
        await prisma.user.update({
            where: { id: user.id },
            data: { refresh_token: refreshToken }
        });

        res.cookie('refreshToken', refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: 45 * 24 * 60 * 60 * 1000, // 45 days
        });

        res.cookie('accessToken', accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: 30 * 60 * 1000, // 30 minutes
        });

        return res.status(200).json({
            message: 'Login successful',
            data: {
                id: user.id,
                name: responseName,
                email: user.email,
                role: sessionRole,
                is_active: user.is_active,
                created_at: responseCreatedAt
            }
        });
    }
    catch (error) {
        const prismaMessage = getPrismaErrorMessage(error);
        if (prismaMessage) {
            return res.status(503).json({ message: prismaMessage });
        }

        console.error('Error logging in user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function logoutUser(req: Request, res: Response): Promise<Response> {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {

        const isVerified = verifyToken(refreshToken, 'refresh');
        if (!isVerified) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Clear refresh token from database
        await prisma.user.updateMany({
            where: { refresh_token: refreshToken },
            data: { refresh_token: null }
        });

        res.clearCookie('refreshToken', COOKIE_OPTIONS);
        res.clearCookie('accessToken', COOKIE_OPTIONS);

        return res.status(200).json({ message: 'Logout successful' });
    }
    catch (error) {
        const prismaMessage = getPrismaErrorMessage(error);
        if (prismaMessage) {
            return res.status(503).json({ message: prismaMessage });
        }

        console.error('Error logging out user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function getCurrentUser(req: Request, res: Response): Promise<Response> {
    const authUser = (req as any).user;

    if (!authUser?.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: authUser.userId },
            select: selectSafeUser
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'User account is inactive' });
        }

        const responseUser = isAdminRole(authUser.role) && !isAdminRole(user.role)
            ? { ...user, role: authUser.role as UserRole }
            : user;

        return res.status(200).json({ message: 'User fetched successfully', data: responseUser });
    }
    catch (error) {
        const prismaMessage = getPrismaErrorMessage(error);
        if (prismaMessage) {
            return res.status(503).json({ message: prismaMessage });
        }

        console.error('Error fetching current user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
