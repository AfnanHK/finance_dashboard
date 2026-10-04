'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, MessageCircle, Loader2, ShieldCheck, Lock } from 'lucide-react';
import { signIn } from 'next-auth/react';

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

  // State Telegram Login
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State Admin Login (NextAuth)
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    // Kalau sudah login via Telegram, langsung ke dashboard
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

  // Handler Login Admin via NextAuth Credentials
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError('');

    const res = await signIn('credentials', {
      username: adminUser,
      password: adminPass,
      redirect: false,
    });

    console.log('signIn result:', res);

    if (res?.error) {
      setAdminError('Username atau password Admin salah!');
      setAdminLoading(false);
    } else {
      setAdminLoading(false);
      window.location.href = '/admin';
    }
  };

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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-left">
          <h2 className="text-lg font-semibold text-slate-200 mb-2 text-center">Masuk ke Dashboard</h2>
          <p className="text-sm text-slate-400 mb-6 text-center">
            Pilih cara login untuk mengakses dashboard keuangan.
          </p>

          {/* Option 1: Open Bot */}
          <a
            href="https://t.me/ahkFlowBot?start=web"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-medium rounded-xl transition-colors mb-2 text-center"
          >
            <MessageCircle className="w-5 h-5" />
            Buka Bot Telegram
          </a>
          <p className="text-xs text-slate-500 mb-6 text-center">
            Ketik <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-400">/web</code> di bot → klik link yang dikirim
          </p>

          {/* Option 2: Telegram Widget */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-3 mb-6">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-slate-300">Memverifikasi...</span>
            </div>
          ) : (
            <div ref={telegramRef} className="flex justify-center min-h-[40px] mb-6" />
          )}

          {error && (
            <p className="text-sm text-red-400 mb-6 text-center">{error}</p>
          )}

          {/* Divider Admin */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Admin Access
            </span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Form Login Admin */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {adminError && (
              <p className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 p-2.5 rounded-lg text-center">
                {adminError}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Username Admin
              </label>
              <input
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="Masukkan username"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Password Admin
              </label>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={adminLoading}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-cyan-400 border border-slate-700 hover:border-cyan-500/50 font-medium text-sm rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {adminLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Masuk Admin
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}