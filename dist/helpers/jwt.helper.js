import jwt from 'jsonwebtoken';
function isTokenPayload(decoded) {
    return typeof decoded === 'object' && decoded !== null
        && typeof decoded.userId === 'string'
        && typeof decoded.username === 'string'
        && typeof decoded.email === 'string'
        && (decoded.type === 'access' || decoded.type === 'refresh');
}
export function generateRefreshToken(userId, username, email, role) {
    try {
        const payload = { userId, username, email, role, type: 'refresh' };
        const secretKey = process.env.REFRESH_TOKEN_SECRET;
        if (!secretKey) {
            throw new Error('Refresh token secret key is not defined');
        }
        const options = { expiresIn: '45d' };
        const refreshToken = jwt.sign(payload, secretKey, options);
        return refreshToken;
    }
    catch (error) {
        console.error('Error generating refresh token:', error);
        throw new Error('Failed to generate refresh token');
    }
}
export function generateAccessToken(userId, username, email, role) {
    try {
        const payload = { userId, username, email, role, type: 'access' };
        const secretKey = process.env.ACCESS_TOKEN_SECRET;
        if (!secretKey) {
            throw new Error('Access token secret key is not defined');
        }
        const options = { expiresIn: '30m' };
        const accessToken = jwt.sign(payload, secretKey, options);
        return accessToken;
    }
    catch (error) {
        console.error('Error generating access token:', error);
        throw new Error('Failed to generate access token');
    }
}
export function verifyToken(token, type) {
    try {
        const secretKey = type === 'access' ? process.env.ACCESS_TOKEN_SECRET : process.env.REFRESH_TOKEN_SECRET;
        if (!secretKey) {
            throw new Error('Token secret key is not defined');
        }
        const decoded = jwt.verify(token, secretKey);
        if (!isTokenPayload(decoded)) {
            throw new Error('Invalid token payload');
        }
        if (decoded.type !== type) {
            throw new Error('Invalid token type');
        }
        return { userId: decoded.userId, username: decoded.username, email: decoded.email, role: decoded.role };
    }
    catch (error) {
        console.error('Error verifying token:', error);
        throw new Error('Failed to verify token');
    }
}
//# sourceMappingURL=jwt.helper.js.map