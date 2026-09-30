import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_finance_123';

function verifyTelegramLogin(data: Record<string, any>): boolean {
  const { hash, ...rest } = data;

  if (!hash || !BOT_TOKEN) return false;

  // Buat data_check_string (sorted alphabetically, joined by \n)
  const checkString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('\n');

  // Secret key = SHA256(bot_token)
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  // HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  // Verify hash
  if (hmac !== hash) return false;

  // Cek auth_date tidak terlalu lama (max 1 hari)
  const authDate = parseInt(rest.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) return false;

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!BOT_TOKEN) {
      console.error('BOT_TOKEN not configured');
      return NextResponse.json(
        { success: false, message: 'Konfigurasi server belum lengkap' },
        { status: 500 }
      );
    }

    if (!verifyTelegramLogin(body)) {
      return NextResponse.json(
        { success: false, message: 'Verifikasi Telegram gagal atau login expired' },
        { status: 403 }
      );
    }

    // Buat JWT token (sama persis formatnya dengan yang dari bot)
    const token = jwt.sign(
      {
        telegram_id: body.id,
        username: body.username || body.first_name || 'User',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error('Telegram auth error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
