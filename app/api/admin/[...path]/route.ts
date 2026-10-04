import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';

const API_URL = process.env.API_URL || 'http://70.153.80.223:3000';

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, ctx: Ctx, method: 'GET' | 'PATCH' | 'DELETE') {
    // 1. Hanya admin yang boleh lewat
    if (!(await isAdminRequest(request))) {
        return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const key = process.env.BOT_ADMIN_KEY;
    if (!key) {
        return NextResponse.json(
            { success: false, message: 'BOT_ADMIN_KEY belum diisi di .env.local' },
            { status: 500 }
        );
    }

    // 2. Validasi path
    const { path } = await ctx.params;
    if (!path.every((s) => /^[A-Za-z0-9_-]+$/.test(s))) {
        return NextResponse.json({ success: false, message: 'Path tidak valid' }, { status: 400 });
    }

    // 3. Teruskan ke bot
    const url = `${API_URL}/admin/${path.join('/')}${request.nextUrl.search}`;
    const init: RequestInit = {
        method,
        headers: { 'X-Admin-Key': key, 'Content-Type': 'application/json' },
        cache: 'no-store',
    };
    if (method === 'PATCH') init.body = await request.text();

    try {
        const res = await fetch(url, init);
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('Admin proxy error:', error);
        return NextResponse.json(
            { success: false, message: 'Gagal menghubungi server bot' },
            { status: 502 }
        );
    }
}

export async function GET(request: NextRequest, ctx: Ctx) {
    return forward(request, ctx, 'GET');
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
    return forward(request, ctx, 'PATCH');
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
    return forward(request, ctx, 'DELETE');
}