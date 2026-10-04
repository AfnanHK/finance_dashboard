'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  TrendingUp, TrendingDown, Wallet, LogOut, Download,
  ArrowUpRight, ArrowDownRight, BarChart3, Receipt, Loader2,
  AlertCircle, ShieldCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

// ─── Types ───────────────────────────────────────────────
interface Transaction {
  id: number;
  type: 'income' | 'expense';
  amount: string;
  description?: string;
  category?: string;
  created_at: string;
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
}

interface ApiData {
  summary: Summary;
  transactions: Transaction[];
}

// ─── Helpers ─────────────────────────────────────────────
function decodeJWT(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRupiahShort(amount: number): string {
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1)}jt`;
  if (amount >= 1_000) return `Rp${(amount / 1_000).toFixed(0)}rb`;
  return formatRupiah(amount);
}

// ─── Custom Tooltip ──────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name === 'income' ? '📈 Pemasukan' : '📉 Pengeluaran'}:{' '}
          <span className="font-semibold">{formatRupiah(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('User');
  const [filterMonth, setFilterMonth] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Fetch data (Telegram token ATAU session admin) ──
  useEffect(() => {
    if (status === 'loading') return;

    // 1. Tangkap token dari URL parameter (?token=...) jika datang dari link bot
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
      // Simpan ke LocalStorage & Cookie agar Middleware Next.js ikut mengenali
      localStorage.setItem('finance_token', tokenFromUrl);
      document.cookie = `finance_token=${tokenFromUrl}; path=/; max-age=86400; SameSite=Lax`;

      // Bersihkan query string dari URL agar bersih
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Ambil token dari storage
    const token = localStorage.getItem('finance_token');
    const isNextAuthAdmin = (session?.user as any)?.role === 'admin';

    // Tidak login lewat Telegram maupun admin
    if (!token && !isNextAuthAdmin) {
      setError('no_token');
      setLoading(false);
      return;
    }

    let activeToken: string | null = token;

    if (token) {
      const payload = decodeJWT(token);
      if (payload?.username) setUsername(payload.username);

      // Cek apakah Telegram ID cocok dengan ID Admin
      const currentTgId = String(payload?.telegram_id ?? payload?.id ?? '').trim();
      const envAdminId = String(process.env.NEXT_PUBLIC_ADMIN_TELEGRAM_ID || '').trim();
      if (envAdminId && currentTgId && currentTgId === envAdminId) {
        setIsAdmin(true);
      }

      // Token Telegram kadaluarsa
      if (payload?.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('finance_token');
        document.cookie = 'finance_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        activeToken = null;
        if (!isNextAuthAdmin) {
          setError('expired');
          setLoading(false);
          return;
        }
      }
    }

    if (isNextAuthAdmin) {
      setIsAdmin(true);
      if (!activeToken) setUsername('admin');
    }

    // Verifikasi kepastian hak akses admin dari server (/api/admin/me)
    fetch('/api/admin/me', {
      headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.isAdmin) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});

    fetch('/api/keuangan', {
      headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('finance_token');
          document.cookie = 'finance_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          throw new Error(isNextAuthAdmin ? 'Admin belum punya akses ke /api/keuangan' : 'expired');
        }
        if (!res.ok) throw new Error('fetch_failed');
        return res.json();
      })
      .then((resData) => {
        if (resData.success) {
          setData(resData.data);
        } else {
          setError(resData.message || 'Gagal memuat data');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, session]);

  // ── Redirect ke login (di useEffect, bukan saat render) ──
  useEffect(() => {
    if (error === 'no_token' || error === 'expired') {
      router.replace('/login');
    }
  }, [error, router]);

  // ── Compute monthly chart data ──
  const chartData = useMemo(() => {
    if (!data?.transactions?.length) return [];

    const monthly: Record<string, { income: number; expense: number }> = {};

    data.transactions.forEach((tx) => {
      const date = new Date(tx.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };

      const amount = parseFloat(tx.amount);
      if (tx.type === 'income') monthly[key].income += amount;
      else monthly[key].expense += amount;
    });

    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month: new Date(month + '-01').toLocaleDateString('id-ID', {
          month: 'short',
          year: '2-digit',
        }),
        ...values,
      }));
  }, [data]);

  // ── Available months for filter ──
  const availableMonths = useMemo(() => {
    if (!data?.transactions?.length) return [];
    const months = new Set<string>();
    data.transactions.forEach((tx) => {
      const date = new Date(tx.created_at);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [data]);

  // ── Filter transactions ──
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return [];
    if (filterMonth === 'all') return data.transactions;

    return data.transactions.filter((tx) => {
      const date = new Date(tx.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return key === filterMonth;
    });
  }, [data, filterMonth]);

  // ── Export CSV ──
  const exportCSV = () => {
    if (!filteredTransactions.length) return;

    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah'];
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.created_at).toLocaleDateString('id-ID'),
      tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      tx.category || '-',
      tx.description || '-',
      parseFloat(tx.amount).toString(),
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keuangan_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Logout (Telegram + Admin) ──
  const handleLogout = async () => {
    localStorage.removeItem('finance_token');
    document.cookie = 'finance_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    await signOut({ callbackUrl: '/login' });
  };

  // ── Loading State ──
  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    const isAuth = error === 'no_token' || error === 'expired';

    // Redirect sudah ditangani useEffect di atas
    if (isAuth) return null;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-400 mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={handleLogout}
            className="mt-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  if (!data) return null;
  const { summary } = data;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">FlowBot Finance</h1>
              <p className="text-xs text-slate-500 -mt-0.5">Dashboard Keuangan</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">
              👤 <span className="text-cyan-400 font-medium">@{username}</span>
            </span>

            {/* Tombol Khusus Admin: Hanya muncul jika ID Telegram adalah Admin atau Login NextAuth Admin */}
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 rounded-lg transition-all cursor-pointer shadow-sm shadow-cyan-500/10"
                title="Buka Dashboard Admin"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Admin</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Income */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Total Pemasukan</span>
              <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {formatRupiah(summary.totalIncome)}
            </p>
          </div>

          {/* Expense */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-red-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Total Pengeluaran</span>
              <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-400">
              {formatRupiah(summary.totalExpense)}
            </p>
          </div>

          {/* Balance */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Sisa Saldo</span>
              <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <p className={`text-2xl font-bold ${summary.netCashflow >= 0 ? 'text-cyan-400' : 'text-orange-400'}`}>
              {formatRupiah(summary.netCashflow)}
            </p>
          </div>
        </div>

        {/* ── Chart ── */}
        {chartData.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-200">Tren Keuangan</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                    tickFormatter={(v) => formatRupiahShort(v)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-sm text-slate-300">
                        {value === 'income' ? '📈 Pemasukan' : '📉 Pengeluaran'}
                      </span>
                    )}
                  />
                  <Bar dataKey="income" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" fill="#f87171" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Transactions ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-semibold text-slate-200">Riwayat Transaksi</h2>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredTransactions.length} data
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Month Filter */}
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="all">Semua Bulan</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('id-ID', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>

              {/* Export */}
              <button
                onClick={exportCSV}
                disabled={!filteredTransactions.length}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Table */}
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada transaksi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="pb-3 font-medium">Tanggal</th>
                    <th className="pb-3 font-medium">Deskripsi</th>
                    <th className="pb-3 font-medium hidden sm:table-cell">Kategori</th>
                    <th className="pb-3 font-medium text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-slate-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                          <span className="text-slate-200 truncate max-w-[200px]">
                            {tx.description || tx.category || 'Transaksi'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-slate-500 hidden sm:table-cell">
                        {tx.category || '-'}
                      </td>
                      <td className={`py-3 text-right font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                        {tx.type === 'income' ? '+' : '-'}{' '}
                        {formatRupiah(parseFloat(tx.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-600">
          FlowBot Finance &copy; {new Date().getFullYear()} &mdash; Terintegrasi dengan Telegram Bot
        </div>
      </footer>
    </div>
  );
}