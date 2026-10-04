import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import crypto from "crypto";

// Helper verifikasi JWT Telegram langsung di Middleware
function verifyTelegramJWT(token: string, secret: string) {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;

    try {
        const b64urlToBuffer = (str: string) => {
            let t = str.replace(/-/g, "+").replace(/_/g, "/");
            while (t.length % 4) t += "=";
            return Buffer.from(t, "base64");
        };

        const expected = crypto
            .createHmac("sha256", secret)
            .update(`${h}.${p}`)
            .digest();
        const given = b64urlToBuffer(s);
        if (
            expected.length !== given.length ||
            !crypto.timingSafeEqual(expected, given)
        )
            return null;

        const payload = JSON.parse(b64urlToBuffer(p).toString("utf8"));
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname, searchParams } = req.nextUrl;

    // 1. Izinkan request Auth, Statis, Login, DAN URL yang membawa parameter ?token=
    if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        searchParams.has("token") // Loloskan URL link login via bot Telegram
    ) {
        return NextResponse.next();
    }

    // 2. Ambil data Session NextAuth & Cookie Telegram Token
    const session = await auth();
    const isAdminNextAuth = (session?.user as any)?.role === "admin";

    const telegramToken = req.cookies.get("finance_token")?.value;
    const secret = process.env.BOT_JWT_SECRET;
    const adminId = process.env.ADMIN_TELEGRAM_ID;

    let isTelegramUser = false;
    let isTelegramAdmin = false;

    if (telegramToken && secret) {
        const payload = verifyTelegramJWT(telegramToken, secret);
        if (payload) {
            isTelegramUser = true;
            if (String(payload.telegram_id) === String(adminId)) {
                isTelegramAdmin = true;
            }
        }
    }

    // 3. Khusus Rute /admin atau /api/admin: Wajib Admin (NextAuth ATAU Telegram Admin)
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (!isAdminNextAuth && !isTelegramAdmin) {
            // Tolak user biasa dan kembalikan ke dashboard utama
            return NextResponse.redirect(new URL("/", req.url));
        }
        return NextResponse.next();
    }

    // 4. Khusus Rute Dashboard Utama (/): Boleh diakses jika Login NextAuth ATAU User Telegram Valid
    if (session || isTelegramUser) {
        return NextResponse.next();
    }

    // 5. Jika tidak punya akses sama sekali, alihkan ke /login
    return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};