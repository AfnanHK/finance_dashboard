import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://70.153.80.223:3000';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

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
