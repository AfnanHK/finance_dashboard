import crypto from 'crypto';
import { auth } from '../auth';

function b64urlToBuffer(s: string): Buffer {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    return Buffer.from(t, 'base64');
}

// Verifikasi JWT HS256 buatan bot
function verifyJWT(token: string, secret: string): Record<string, any> | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;

    const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const given = b64urlToBuffer(s);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

    try {
        const header = JSON.parse(b64urlToBuffer(h).toString('utf8'));
        if (header.alg !== 'HS256') return null;
        const payload = JSON.parse(b64urlToBuffer(p).toString('utf8'));
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

// true kalau request datang dari admin:
// 1) login admin (NextAuth), atau
// 2) login Telegram dengan telegram_id == ADMIN_TELEGRAM_ID
export async function isAdminRequest(request: Request): Promise<boolean> {
    const session = await auth();
    if ((session?.user as any)?.role === 'admin') return true;

    const adminId = process.env.ADMIN_TELEGRAM_ID;
    const secret = process.env.BOT_JWT_SECRET;
    const header = request.headers.get('authorization');
    if (!adminId || !secret || !header?.startsWith('Bearer ')) return false;

    const payload = verifyJWT(header.slice(7), secret);
    if (!payload) return false;

    return String(payload.telegram_id) === String(adminId);
}