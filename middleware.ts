import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

// Helper verifikasi JWT Telegram menggunakan Web Crypto API (Edge Runtime Compatible)
async function verifyTelegramJWT(token: string, secret: string) {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;

    try {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(`${h}.${p}`);

        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );

        const b64urlToBuffer = (str: string) => {
            let t = str.replace(/-/g, "+").replace(/_/g, "/");
            while (t.length % 4) t += "=";
            const binary = atob(t);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        };

        const signature = b64urlToBuffer(s);
        const isValid = await crypto.subtle.verify("HMAC", key, signature, messageData);

        if (!isValid) return null;

        const payloadText = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadText);

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
        searchParams.has("token")
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
        const payload = await verifyTelegramJWT(telegramToken, secret);
        if (payload) {
            isTelegramUser = true;
            if (String(payload.telegram_id) === String(adminId)) {
                isTelegramAdmin = true;
            }
        }
    }

    // 3. Khusus Rute /admin atau /api/admin: Wajib Admin
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        if (!isAdminNextAuth && !isTelegramAdmin) {
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