import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

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
        return JSON.parse(payloadText);
    } catch {
        return null;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname, searchParams } = req.nextUrl;

    if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        searchParams.has("token")
    ) {
        return NextResponse.next();
    }

    const session = await auth();
    const isAdminNextAuth = (session?.user as any)?.role === "admin";

    // Ambil & decode cookie finance_token ATAU header Authorization
    const authHeader = req.headers.get("authorization");
    let telegramToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
    if (!telegramToken) {
        const rawCookie = req.cookies.get("finance_token")?.value;
        telegramToken = rawCookie ? decodeURIComponent(rawCookie) : undefined;
    }

    const secret = process.env.BOT_JWT_SECRET || process.env.JWT_SECRET;
    const adminId = process.env.ADMIN_TELEGRAM_ID;

    let isTelegramUser = false;
    let isTelegramAdmin = false;

    if (telegramToken && secret) {
        const payload = await verifyTelegramJWT(telegramToken, secret);

        // LOG PAKSA UNTUK DITEKADKAN DI VERCEL LOGS
        console.log("=== CHECK TOKEN ===", {
            hasPayload: !!payload,
            payloadId: payload?.telegram_id || payload?.id,
            envAdminId: adminId,
        });

        if (payload) {
            isTelegramUser = true;
            const userTelegramId = String(payload.telegram_id || payload.id || "").trim();
            const targetAdminId = String(adminId || "").trim();

            if (userTelegramId && targetAdminId && userTelegramId === targetAdminId) {
                isTelegramAdmin = true;
            }
        }
    } else {
        console.log("=== NO TOKEN / SECRET ===", { hasCookie: !!telegramToken, hasSecret: !!secret });
    }

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        // Biarkan /api/admin/me lewat agar route handler bisa mengembalikan { isAdmin: true/false }
        if (pathname === "/api/admin/me") {
            return NextResponse.next();
        }

        if (!isAdminNextAuth && !isTelegramAdmin) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
            }
            return NextResponse.redirect(new URL("/", req.url));
        }
        return NextResponse.next();
    }

    if (session || isTelegramUser) {
        return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};