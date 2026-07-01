"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    Plus, Loader2, RefreshCw, Trophy, Calendar, Users,
    Edit2, Trash2, Play, Radio, Square, Eye, ChevronLeft,
    ChevronRight, Search, SlidersHorizontal
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import StatusBadge from "./_components/StatusBadge";
import ContestFormModal from "./_components/ContestFormModal";
import ParticipantsDrawer from "./_components/ParticipantsDrawer";
import type { Contest, ContestStatus } from "./types";

const PAGE_SIZE = 10;

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function DiffBadge({ diff }: { diff: string }) {
    const styles: Record<string, string> = {
        easy: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-800",
        medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-800",
        hard: "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/60 dark:text-red-400 dark:ring-red-800",
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${styles[diff] ?? styles.medium}`}>
            {diff}
        </span>
    );
}

type ConfirmAction = {
    label: string;
    message: string;
    intent: "danger" | "warning" | "success";
    onConfirm: () => Promise<void>;
} | null;

function ConfirmDialog({ action, onCancel }: { action: NonNullable<ConfirmAction>; onCancel: () => void }) {
    const [loading, setLoading] = useState(false);
    const intentStyles = {
        danger: { btn: "bg-red-600 hover:bg-red-700", emoji: "🗑️" },
        warning: { btn: "bg-amber-500 hover:bg-amber-600", emoji: "⚠️" },
        success: { btn: "bg-emerald-600 hover:bg-emerald-700", emoji: "✅" },
    }[action.intent];

    const run = async () => {
        setLoading(true);
        await action.onConfirm();
        setLoading(false);
        onCancel();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="text-3xl mb-3 text-center">{intentStyles.emoji}</div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white text-center mb-1">{action.label}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">{action.message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel}
                        className="flex-1 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                        Cancel
                    </button>
                    <button onClick={run} disabled={loading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-50 ${intentStyles.btn}`}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : action.label}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminContestsPage() {
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<ContestStatus | "all">("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingContest, setEditingContest] = useState<Contest | null>(null);
    const [participantsFor, setParticipantsFor] = useState<Contest | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
    const [resultsLiveCount, setResultsLiveCount] = useState(0);

    const STATUS_LABELS: Record<string, string> = {
        all: "All", draft: "Draft", published: "Open",
        live: "Live", ended: "Ended", cancelled: "Cancelled",
    };

    const fetchContests = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        let query = supabase
            .from("contests")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (filterStatus !== "all") query = query.eq("status", filterStatus);
        if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
        const { data, count } = await query;

        const ids = (data ?? []).map(c => c.id);
        const countMap: Record<string, number> = {};
        if (ids.length > 0) {
            const countResults = await Promise.all(
                ids.map(async cid => {
                    const { data: cnt } = await supabase.rpc("get_contest_participant_count", { contest_id_input: cid });
                    return { cid, count: (cnt as number) ?? 0 };
                })
            );
            countResults.forEach(({ cid, count }) => { countMap[cid] = count; });
        }
        setContests((data ?? []).map(c => ({ ...c, participant_count: countMap[c.id] ?? 0 })));
        setTotal(count ?? 0);
        setLoading(false);
    }, [page, search, filterStatus]);

    const fetchStatusCounts = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase.from("contests").select("status, announced_at");
        const counts: Record<string, number> = {};
        let resultsLive = 0;
        (data ?? []).forEach(c => {
            counts[c.status] = (counts[c.status] ?? 0) + 1;
            if (c.announced_at) resultsLive++;
        });
        setStatusCounts(counts);
        setResultsLiveCount(resultsLive);
    }, []);

    useEffect(() => { fetchContests(); fetchStatusCounts(); }, [fetchContests, fetchStatusCounts]);

    const supabaseAction = async (
        id: string, update: Partial<Contest>,
        label: string, message: string, intent: "danger" | "warning" | "success"
    ) => {
        setConfirmAction({
            label, message, intent,
            onConfirm: async () => {
                const supabase = createClient();
                if ("_delete" in update) {
                    await supabase.from("contests").delete().eq("id", id);
                } else {
                    await supabase.from("contests").update(update).eq("id", id);
                }
                await Promise.all([fetchContests(), fetchStatusCounts()]);
            },
        });
    };

    const handlePublish    = (c: Contest) => supabaseAction(c.id, { status: "published" }, "Open for Enrollment", `"${c.title}" will be visible and enrollable by participants.`, "success");
    const handleForceStart = (c: Contest) => supabaseAction(c.id, { status: "live" }, "Force Start", `"${c.title}" will go live immediately, overriding the scheduled start time.`, "warning");
    const handleEnd        = (c: Contest) => supabaseAction(c.id, { status: "ended" }, "End Contest", `This will permanently end "${c.title}" and finalise the leaderboard.`, "warning");
    const handleDelete     = (c: Contest) => supabaseAction(c.id, { _delete: true } as Partial<Contest>, "Delete Contest", `"${c.title}" will be permanently deleted. This cannot be undone.`, "danger");

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const statusDots: Record<string, string> = {
        draft: "bg-slate-400", published: "bg-emerald-500",
        live: "bg-red-500 animate-pulse", ended: "bg-slate-600", cancelled: "bg-red-300",
    };

    const statCards = [
        { key: "draft",     label: "Draft",        dot: "bg-slate-400",   count: statusCounts["draft"] ?? 0 },
        { key: "published", label: "Open",         dot: "bg-emerald-500", count: statusCounts["published"] ?? 0 },
        { key: "live",      label: "Live",         dot: "bg-red-500",     count: statusCounts["live"] ?? 0 },
        { key: "ended",     label: "Ended",        dot: "bg-slate-500",   count: statusCounts["ended"] ?? 0 },
        { key: "cancelled", label: "Cancelled",    dot: "bg-red-400",     count: statusCounts["cancelled"] ?? 0 },
        { key: "results",   label: "Results Live", dot: "bg-violet-500",  count: resultsLiveCount, noFilter: true },
    ];

    return (
        <div>
            {/* Modals */}
            {(showCreateModal || editingContest) && (
                <ContestFormModal
                    contest={editingContest}
                    onClose={() => { setShowCreateModal(false); setEditingContest(null); }}
                    onSaved={() => { setShowCreateModal(false); setEditingContest(null); fetchContests(); }}
                />
            )}
            {participantsFor && (
                <ParticipantsDrawer
                    contestId={participantsFor.id}
                    contestTitle={participantsFor.title}
                    onClose={() => setParticipantsFor(null)}
                />
            )}
            {confirmAction && (
                <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} />
            )}

            {/* ── Page Header ─────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/25 flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Live Quiz Contests</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Create and manage live competitive quiz contests</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md hover:shadow-indigo-600/20 hover:-translate-y-px active:translate-y-0"
                >
                    <Plus className="w-4 h-4" /> New Contest
                </button>
            </div>

            {/* ── Search + Filter Row ─────────────────────────────── */}
            <div className="flex items-center gap-3 mb-4">
                {/* Search */}
                <div className="relative w-72 flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Search contests…"
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-2 py-1.5 flex-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 mx-1 flex-shrink-0" />
                    {(["all", "draft", "published", "live", "ended", "cancelled"] as const).map(s => {
                        const active = filterStatus === s;
                        return (
                            <button key={s}
                                onClick={() => { setFilterStatus(s); setPage(0); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    active
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-white"
                                }`}>
                                {s !== "all" && (
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-white/70" : statusDots[s]}`} />
                                )}
                                {STATUS_LABELS[s] ?? s}
                            </button>
                        );
                    })}
                </div>

                {/* Refresh */}
                <button onClick={() => { fetchContests(); fetchStatusCounts(); }} disabled={loading}
                    className="p-2.5 text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-gray-300 dark:hover:border-slate-600 hover:text-gray-700 dark:hover:text-white transition-all disabled:opacity-40 group"
                    title="Refresh">
                    <RefreshCw className={`w-4 h-4 transition-transform duration-500 ${loading ? "animate-spin" : "group-hover:rotate-180"}`} />
                </button>
            </div>

            {/* ── Table ───────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">

                {/* Table header */}
                <div className="grid grid-cols-[2.5fr_1.2fr_1.3fr_0.75fr_0.75fr_auto] gap-4 px-6 py-3 bg-gray-50 dark:bg-slate-900/80 border-b border-gray-100 dark:border-slate-800">
                    {[
                        { label: "Contest" },
                        { label: "Status" },
                        { label: "Start Time" },
                        { label: "Members", icon: <Users className="w-3 h-3" /> },
                        { label: "Level" },
                        { label: "Actions" },
                    ].map(({ label, icon }, i) => (
                        <div key={i} className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                            {icon}{label}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mb-3">
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        </div>
                        <p className="text-sm text-gray-400 dark:text-slate-500">Loading contests…</p>
                    </div>
                ) : contests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center mb-4">
                            <Trophy className="w-6 h-6 text-gray-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-white mb-1">No contests found</p>
                        <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">
                            {filterStatus === "all"
                                ? "Create your first contest to get started."
                                : `No contests with status "${STATUS_LABELS[filterStatus] ?? filterStatus}".`}
                        </p>
                        {filterStatus !== "all" && (
                            <button onClick={() => setFilterStatus("all")}
                                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                                ← Clear filter
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-slate-800/60">
                        {contests.map((contest) => {
                            const canEdit = contest.status === "draft" || contest.status === "published";
                            const canDelete = contest.status === "draft";
                            const isResultsLive = Boolean(contest.announced_at);

                            return (
                                <div key={contest.id}
                                    className="grid grid-cols-[2.5fr_1.2fr_1.3fr_0.75fr_0.75fr_auto] gap-4 px-6 py-4 items-center group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors duration-100">

                                    {/* Contest name */}
                                    <div className="min-w-0">
                                        <Link href={`/admin/contests/${contest.id}`}
                                            className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1">
                                            {contest.title}
                                        </Link>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">{contest.topic}</span>
                                            {isResultsLive && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200 dark:ring-violet-800">
                                                    🏆 Results Live
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div><StatusBadge status={contest.status} /></div>

                                    {/* Start time */}
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                                        <Calendar className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                                        {formatDate(contest.start_time)}
                                    </div>

                                    {/* Participants */}
                                    <div className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600" />
                                        <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{contest.participant_count ?? 0}</span>
                                        {contest.max_participants && (
                                            <span className="text-xs text-gray-400 dark:text-slate-500">/ {contest.max_participants}</span>
                                        )}
                                    </div>

                                    {/* Difficulty */}
                                    <div><DiffBadge diff={contest.difficulty} /></div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-0.5">
                                        <Link href={`/admin/contests/${contest.id}`}
                                            className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all" title="View">
                                            <Eye className="w-3.5 h-3.5" />
                                        </Link>
                                        <button onClick={() => setParticipantsFor(contest)}
                                            className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-all" title="Participants">
                                            <Users className="w-3.5 h-3.5" />
                                        </button>
                                        {canEdit && (
                                            <button onClick={() => setEditingContest(contest)}
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-all" title="Edit">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {contest.status === "draft" && (
                                            <button onClick={() => handlePublish(contest)}
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all" title="Open for Enrollment">
                                                <Play className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {contest.status === "published" && (
                                            <button onClick={() => handleForceStart(contest)}
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all" title="Force Start">
                                                <Radio className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {contest.status === "live" && (
                                            <button onClick={() => handleEnd(contest)}
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all" title="End Contest">
                                                <Square className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => handleDelete(contest)}
                                                className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all" title="Delete">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                            Showing <span className="font-semibold text-gray-600 dark:text-slate-300">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span> of <span className="font-semibold text-gray-600 dark:text-slate-300">{total}</span> contests
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setPage((p: number) => p - 1)} disabled={page === 0}
                                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-semibold text-gray-600 dark:text-slate-300 px-2">{page + 1} / {totalPages}</span>
                            <button onClick={() => setPage((p: number) => p + 1)} disabled={page >= totalPages - 1}
                                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Stats Summary (bottom) ───────────────────────────── */}
            <div className="grid grid-cols-6 gap-3 mt-4">
                {statCards.map(card => {
                    const active = !card.noFilter && filterStatus === card.key;
                    return (
                        <button
                            key={card.key}
                            onClick={() => {
                                if (!card.noFilter) {
                                    setFilterStatus(active ? "all" : card.key as ContestStatus);
                                    setPage(0);
                                }
                            }}
                            className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl border transition-all text-center ${
                                card.noFilter ? "cursor-default" : "cursor-pointer hover:-translate-y-px"
                            } ${
                                active
                                    ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-sm"
                                    : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${card.dot}`} />
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">{card.count}</span>
                            </div>
                            <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400">{card.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
