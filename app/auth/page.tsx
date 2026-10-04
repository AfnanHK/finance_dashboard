'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // 1. Simpan ke LocalStorage
      localStorage.setItem('finance_token', token);

      // 2. Wajib simpan ke Cookie agar dibaca oleh middleware.ts di Server
      document.cookie = `finance_token=${token}; path=/; max-age=86400; SameSite=Lax`;

      // 3. Gunakan window.location.href agar browser memicu reload & mengirim cookie baru ke server
      window.location.href = '/';
    } else {
      setError('Token tidak ditemukan di URL. Silakan gunakan link dari Telegram Bot.');
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold text-red-400 mb-2">Akses Ditolak</h2>
          <p className="text-sm text-slate-400">{error}</p>
          <p className="text-xs text-slate-500 mt-4">
            Ketik <code className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400">/web</code> di bot Telegram untuk mendapatkan link akses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold text-cyan-400">Memverifikasi Akses...</h2>
        <p className="text-xs text-slate-400 mt-1">Menghubungkan ke FlowBot Finance</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthHandler />
    </Suspense>
  );
}