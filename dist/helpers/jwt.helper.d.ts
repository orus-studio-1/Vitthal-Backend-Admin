type TokenType = 'access' | 'refresh';
export declare function generateRefreshToken(userId: string, username: string, email: string, role: string): string;
export declare function generateAccessToken(userId: string, username: string, email: string, role: string): string;
export declare function verifyToken(token: string, type: TokenType): {
    userId: string;
    username: string;
    email: string;
    role: string;
};
export {};
//# sourceMappingURL=jwt.helper.d.ts.map