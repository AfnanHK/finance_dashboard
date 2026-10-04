import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '../../../auth';

const API_URL = process.env.API_URL || 'http://70.153.80.223:3000';

// ─── JWT HS256 sederhana (tanpa library tambahan) ────────
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJWT(payload: Record<string, unknown>, secret: string, expiresInSec = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };

  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(signature)}`;
}

export async function GET(request: NextRequest) {
  let authHeader = request.headers.get('authorization');

  // Tidak ada token Telegram → cek apakah ini admin (session NextAuth)
  if (!authHeader) {
    const session = await auth();
    const isAdmin = (session?.user as any)?.role === 'admin';

    if (isAdmin) {
      const secret = process.env.BOT_JWT_SECRET;
      const telegramId = process.env.ADMIN_TELEGRAM_ID;

      if (!secret || !telegramId) {
        return NextResponse.json(
          { success: false, message: 'BOT_JWT_SECRET / ADMIN_TELEGRAM_ID belum diisi di .env.local' },
          { status: 500 }
        );
      }

      // Bot membaca req.user.telegram_id dari token
      const token = signJWT(
        { telegram_id: telegramId, username: 'admin' },
        secret
      );
      authHeader = `Bearer ${token}`;
    }
  }

  if (!authHeader) {
    return NextResponse.json(
      { success: false, message: 'Token tidak ditemukan' },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(`${API_URL}/api/keuangan`, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy API error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghubungi server API' },
      { status: 502 }
    );
  }
}