'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Database, Search, Pencil, Trash2, X, Loader2, ArrowLeft,
    ChevronLeft, ChevronRight, AlertCircle, AlertTriangle,
} from 'lucide-react';

const TABS = [
    { key: 'users', label: 'Users' },
    { key: 'transactions', label: 'Transaksi' },
    { key: 'financial_targets', label: 'Target' },
];

type Row = Record<string, any>;

interface ListData {
    rows: Row[];
    total: number;
    page: number;
    limit: number;
    pk: string;
    editable: string[];
}

function formatCell(v: any): string {
    if (v === null || v === undefined) return '—';
    return String(v);
}

export default function AdminPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    // Status otorisasi gabungan (NextAuth Admin ATAU Token Telegram)
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    const [table, setTable] = useState('users');
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [data, setData] = useState<ListData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editing, setEditing] = useState<Row | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const [deleting, setDeleting] = useState<Row | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // ── Guard Perbaikan: Cek NextAuth ATAU LocalStorage Telegram Token ──
    useEffect(() => {
        if (status === 'loading') return;

        const isNextAuthAdmin = (session?.user as any)?.role === 'admin';
        const hasTelegramToken = !!localStorage.getItem('finance_token');

        // Loloskan jika NextAuth Admin ATAU Punya Token Telegram
        if (isNextAuthAdmin || hasTelegramToken) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            router.replace('/login');
        }
    }, [status, session, router]);

    // Helper header Authorization untuk fetch API
    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('finance_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    // ── Load data ──
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(
                `/api/admin/${table}?page=${page}&q=${encodeURIComponent(search)}`,
                { headers: getAuthHeaders() }
            );
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Gagal memuat data');
            setData(json.data);
        } catch (e: any) {
            setError(e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [table, page, search, getAuthHeaders]);

    useEffect(() => {
        if (isAuthorized) load();
    }, [isAuthorized, load]);

    const changeTable = (key: string) => {
        setTable(key);
        setPage(1);
        setQuery('');
        setSearch('');
    };

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSearch(query.trim());
    };

    // ── Edit ──
    const openEdit = (row: Row) => {
        if (!data) return;
        const f: Record<string, string> = {};
        data.editable.forEach((c) => (f[c] = row[c] === null || row[c] === undefined ? '' : String(row[c])));
        setForm(f);
        setSaveError('');
        setEditing(row);
    };

    const save = async () => {
        if (!data || !editing) return;
        setSaving(true);
        setSaveError('');
        try {
            const res = await fetch(`/api/admin/${table}/${editing[data.pk]}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Gagal menyimpan');
            setEditing(null);
            await load();
        } catch (e: any) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // ── Hapus ──
    const isUsersTable = table === 'users';

    const openDelete = (row: Row) => {
        setConfirmText('');
        setDeleteError('');
        setDeleting(row);
    };

    const confirmDelete = async () => {
        if (!data || !deleting) return;
        setDeleteLoading(true);
        setDeleteError('');
        try {
            const res = await fetch(`/api/admin/${table}/${deleting[data.pk]}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Gagal menghapus');
            setDeleting(null);

            if (data.rows.length === 1 && page > 1) setPage(page - 1);
            else await load();
        } catch (e: any) {
            setDeleteError(e.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    if (status === 'loading' || isAuthorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
        );
    }

    if (!isAuthorized) return null;

    const columns = data?.rows?.length ? Object.keys(data.rows[0]) : [];
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
    const deleteReady =
        !isUsersTable || (deleting && data && confirmText.trim() === String(deleting[data.pk]));

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                            <Database className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-100">Admin Database</h1>
                            <p className="text-xs text-slate-500 -mt-0.5">Kelola data bot</p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Dashboard
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
                {/* Tabs + search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex gap-2">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => changeTable(t.key)}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer ${table === t.key
                                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/40'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submitSearch} className="flex gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari..."
                            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                        />
                        <button
                            type="submit"
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-cyan-400 cursor-pointer"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                {/* Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    {loading ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="py-10 text-center">
                            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    ) : !data?.rows.length ? (
                        <p className="py-10 text-center text-sm text-slate-500">Tidak ada data</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-800">
                                        {columns.map((c) => (
                                            <th key={c} className="pb-3 pr-4 font-medium whitespace-nowrap">{c}</th>
                                        ))}
                                        <th className="pb-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {data.rows.map((row) => (
                                        <tr key={row[data.pk]} className="hover:bg-slate-800/30">
                                            {columns.map((c) => (
                                                <td key={c} className="py-2.5 pr-4 text-slate-300 whitespace-nowrap max-w-[220px] truncate">
                                                    {formatCell(row[c])}
                                                </td>
                                            ))}
                                            <td className="py-2.5 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => openEdit(row)}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openDelete(row)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {data && data.total > 0 && (
                        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
                            <span>{data.total} data</span>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span>{page} / {totalPages}</span>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Edit modal */}
            {editing && data && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-slate-100">
                                Edit {data.pk} = {String(editing[data.pk])}
                            </h2>
                            <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {data.editable.map((c) => (
                                <div key={c}>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">{c}</label>
                                    <input
                                        value={form[c] ?? ''}
                                        onChange={(e) => setForm({ ...form, [c]: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            ))}
                        </div>

                        {saveError && (
                            <p className="mt-3 text-xs text-red-400 bg-red-950/50 border border-red-800/50 p-2.5 rounded-lg">
                                {saveError}
                            </p>
                        )}

                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={save}
                                disabled={saving}
                                className="px-4 py-2 text-sm bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete modal */}
            {deleting && data && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 border border-red-900/50 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <h2 className="text-base font-semibold text-slate-100">
                                Hapus data ini?
                            </h2>
                        </div>

                        <div className="text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 mb-3 space-y-0.5">
                            {Object.keys(deleting)
                                .slice(0, 6)
                                .map((c) => (
                                    <div key={c} className="truncate">
                                        <span className="text-slate-500">{c}:</span> {formatCell(deleting[c])}
                                    </div>
                                ))}
                        </div>

                        <p className="text-sm text-slate-400 mb-3">
                            Tindakan ini <span className="text-red-400 font-medium">tidak bisa dibatalkan</span>.
                        </p>

                        {isUsersTable && (
                            <div className="mb-3">
                                <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/50 p-2.5 rounded-lg mb-2">
                                    Menghapus user juga menghapus <b>semua transaksi dan target</b> milik user ini.
                                </p>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Ketik <span className="font-mono text-slate-200">{String(deleting[data.pk])}</span> untuk konfirmasi
                                </label>
                                <input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-red-500"
                                />
                            </div>
                        )}

                        {deleteError && (
                            <p className="mb-3 text-xs text-red-400 bg-red-950/50 border border-red-800/50 p-2.5 rounded-lg">
                                {deleteError}
                            </p>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleting(null)}
                                className="px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleteLoading || !deleteReady}
                                className="px-4 py-2 text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}