export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
};
//# sourceMappingURL=CokkieSetting.shared.js.map