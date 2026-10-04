import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { auth } from '../auth';

function b64urlToBuffer(s: string): Buffer {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return Buffer.from(t, 'base64');
}

// Verifikasi JWT HS256 buatan bot atau sistem
function verifyJWT(token: string, secret: string): Record<string, any> | null {
    try {
        return jwt.verify(token, secret) as Record<string, any>;
    } catch {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const [h, p, s] = parts;

            const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
            const given = b64urlToBuffer(s);
            if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

            const header = JSON.parse(b64urlToBuffer(h).toString('utf8'));
            if (header.alg !== 'HS256') return null;
            const payload = JSON.parse(b64urlToBuffer(p).toString('utf8'));
            if (payload.exp && payload.exp * 1000 < Date.now()) return null;
            return payload;
        } catch {
            return null;
        }
    }
}

// true kalau request datang dari admin:
// 1) login admin (NextAuth), atau
// 2) login Telegram dengan telegram_id == ADMIN_TELEGRAM_ID
export async function isAdminRequest(request: Request): Promise<boolean> {
    const session = await auth();
    if ((session?.user as any)?.role === 'admin') return true;

    const adminId = process.env.ADMIN_TELEGRAM_ID;
    const secret = process.env.BOT_JWT_SECRET || process.env.JWT_SECRET;
    if (!adminId || !secret) return false;

    let token: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } else {
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) {
            const match = cookieHeader.match(/finance_token=([^;]+)/);
            if (match) token = decodeURIComponent(match[1].trim());
        }
    }

    if (!token) return false;

    const payload = verifyJWT(token, secret);
    if (!payload) return false;

    const userTelegramId = String(payload.telegram_id ?? payload.id ?? '').trim();
    const targetAdminId = String(adminId).trim();

    return !!userTelegramId && !!targetAdminId && userTelegramId === targetAdminId;
}