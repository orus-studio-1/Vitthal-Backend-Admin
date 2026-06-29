import type { Request, Response, NextFunction } from "express";
import { generateAccessToken, verifyToken } from "../helpers/jwt.helper.js";
import { COOKIE_OPTIONS } from "../shared/CokkieSetting.shared.js";
import { prisma } from "../lib/prisma.js";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requestFrom = req.headers["x-request-from"];
        let accessToken = req.cookies.accessToken;
        let refreshToken = req.cookies.refreshToken;

        if (requestFrom === "vendor") {
            accessToken = req.cookies.vendorAccessToken || accessToken;
            refreshToken = req.cookies.vendorRefreshToken || refreshToken;
        } else if (requestFrom === "client") {
            accessToken = req.cookies.clientAccessToken || accessToken;
            refreshToken = req.cookies.clientRefreshToken || refreshToken;
        }

        if (!refreshToken)
            return res.status(401).json({ message: "Unauthorized" });

        const decodedRefreshToken = verifyToken(refreshToken, "refresh");
        const user = await prisma.user.findUnique({
            where: { id: decodedRefreshToken.userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                is_active: true,
                refresh_token: true
            }
        });

        if (!user || !user.is_active || user.refresh_token !== refreshToken) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!accessToken) {
            const newAccessToken = generateNewAccessToken(refreshToken);
            const cookieName = requestFrom === "vendor" ? "vendorAccessToken" : requestFrom === "client" ? "clientAccessToken" : "accessToken";
            res.cookie(cookieName, newAccessToken, {
                ...COOKIE_OPTIONS,
                maxAge: 30 * 60 * 1000,
            });
            (req as any).user = decodedRefreshToken;
            return next();
        }

        const decodedAccessToken = verifyToken(accessToken, "access");
        if (decodedAccessToken.userId !== decodedRefreshToken.userId)
            return res.status(401).json({ message: "Refresh Token and Access Token are not issued for same user!!" });

        const { userId, username, email, role } = decodedAccessToken;
        (req as any).user = { userId, username, email, role };
        next();

    } catch (error) {
        [
            "accessToken",
            "refreshToken",
            "vendorAccessToken",
            "vendorRefreshToken",
            "clientAccessToken",
            "clientRefreshToken",
        ].forEach((cookieName) => {
            res.clearCookie(cookieName, COOKIE_OPTIONS);
        });
        return res.status(401).json({ message: "Unauthorized! Failed to verify Tokens." });
    }
}

//helpers :
const generateNewAccessToken = (refreshToken: string) => {
    try {
        const decoded = verifyToken(refreshToken, "refresh");
        const { userId, username, email, role } = decoded;
        const newAccessToken = generateAccessToken(userId, username, email, role);
        return newAccessToken;
    }
    catch (error) {
        console.error("Error generating new access token:", error);
        throw new Error("Failed to generate new access token");
    }
}
