'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, MessageCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function LoginPage() {
  const router = useRouter();
  const telegramRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Kalau sudah login, langsung ke dashboard
    const token = localStorage.getItem('finance_token');
    if (token) {
      router.push('/');
      return;
    }

    // Callback saat user login via Telegram Widget
    window.onTelegramAuth = async (user: TelegramUser) => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });

        const data = await res.json();

        if (data.success && data.token) {
          localStorage.setItem('finance_token', data.token);
          router.push('/');
        } else {
          setError(data.message || 'Login gagal');
        }
      } catch {
        setError('Gagal menghubungi server');
      } finally {
        setLoading(false);
      }
    };

    // Load Telegram Login Widget script
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || '';
    if (botUsername && telegramRef.current) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '12');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      telegramRef.current.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        {/* Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
          <Wallet className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1">FlowBot Finance</h1>
        <p className="text-sm text-slate-400 mb-8">Dashboard Keuangan Personal</p>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-200 mb-2">Masuk ke Dashboard</h2>
          <p className="text-sm text-slate-400 mb-6">
            Pilih cara login untuk mengakses dashboard keuangan.
          </p>

          {/* Option 1: Open Bot (Primary - always works) */}
          <a
            href="https://t.me/ahkFlowBot?start=web"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium rounded-xl transition-colors mb-4"
          >
            <MessageCircle className="w-5 h-5" />
            Buka Bot Telegram
          </a>
          <p className="text-xs text-slate-500 mb-6">
            Ketik <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-400">/web</code> di bot → klik link yang dikirim
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">atau login langsung</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Option 2: Telegram Widget */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-slate-300">Memverifikasi...</span>
            </div>
          ) : (
            <div ref={telegramRef} className="flex justify-center min-h-[40px]" />
          )}

          {error && (
            <p className="text-sm text-red-400 mt-4">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
