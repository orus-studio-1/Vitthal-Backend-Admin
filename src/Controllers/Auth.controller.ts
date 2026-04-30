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
    const { email, password } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email' });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'User account is inactive' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const refreshToken = generateRefreshToken(user.id, user.name, user.email, user.role);
        const accessToken = generateAccessToken(user.id, user.name, user.email, user.role);

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
                name: user.name,
                email: user.email,
                role: user.role,
                is_active: user.is_active,
                created_at: user.created_at
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

        return res.status(200).json({ message: 'User fetched successfully', data: user });
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
