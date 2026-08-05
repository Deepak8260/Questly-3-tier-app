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
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Live Quiz Contests</h1>
                    <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Create and manage live competitive quiz contests</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button onClick={() => { fetchContests(); fetchStatusCounts(); }} disabled={loading} title="Refresh"
                        className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] px-4 py-2.5 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> New Contest
                    </button>
                </div>
            </div>

            {/* ── Search + Filter Row ─────────────────────────────── */}
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 mb-5 flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-[#8C8B82]" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Search contests…"
                        className="bg-transparent text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none w-full"
                    />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1 flex-wrap">
                    {(["all", "draft", "published", "live", "ended", "cancelled"] as const).map(s => {
                        const active = filterStatus === s;
                        return (
                            <button key={s}
                                onClick={() => { setFilterStatus(s); setPage(0); }}
                                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                                    active
                                    ? "bg-[#F3E7E9] dark:bg-[#2E1A20] text-[#6B2737] dark:text-[#B5677A] border-[#6B2737] dark:border-[#B5677A]"
                                    : "bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border-[#DEDCD3] dark:border-[#35352C] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]"
                                }`}>
                                {STATUS_LABELS[s] ?? s}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Table ───────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">

                {/* Table header */}
                <div className="grid grid-cols-[2.5fr_1.2fr_1.3fr_0.75fr_0.75fr_auto] gap-4 px-6 py-3 bg-[#FAFAF8] dark:bg-[#14140F] border-b border-[#DEDCD3] dark:border-[#35352C]">
                    {[
                        { label: "Contest" },
                        { label: "Status" },
                        { label: "Start Time" },
                        { label: "Members", icon: <Users className="w-3 h-3" /> },
                        { label: "Level" },
                        { label: "Actions" },
                    ].map(({ label, icon }, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
                            {icon}{label}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-5 h-5 animate-spin text-[#6B2737] dark:text-[#B5677A] mb-3" />
                        <p className="text-sm text-[#8C8B82]">Loading contests…</p>
                    </div>
                ) : contests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <Trophy className="w-10 h-10 text-[#8C8B82] mb-3" />
                        <p className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA] mb-1">No contests found</p>
                        <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] mb-4">
                            {filterStatus === "all"
                                ? "Create your first contest to get started."
                                : `No contests with status "${STATUS_LABELS[filterStatus] ?? filterStatus}".`}
                        </p>
                        {filterStatus !== "all" && (
                            <button onClick={() => setFilterStatus("all")}
                                className="text-xs font-semibold text-[#6B2737] dark:text-[#B5677A] hover:underline">
                                ← Clear filter
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
                        {contests.map((contest) => {
                            const canEdit = contest.status === "draft" || contest.status === "published";
                            const canDelete = contest.status === "draft";
                            const isResultsLive = Boolean(contest.announced_at);

                            return (
                                <div key={contest.id}
                                    className="grid grid-cols-[2.5fr_1.2fr_1.3fr_0.75fr_0.75fr_auto] gap-4 px-6 py-4 items-center hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">

                                    {/* Contest name */}
                                    <div className="min-w-0">
                                        <Link href={`/admin/contests/${contest.id}`}
                                            className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] hover:text-[#6B2737] dark:hover:text-[#B5677A] transition-colors line-clamp-1">
                                            {contest.title}
                                        </Link>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-[#8C8B82] capitalize">{contest.topic}</span>
                                            {isResultsLive && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 border border-[#DEDCD3] dark:border-[#35352C] bg-[#F5EEDD] dark:bg-[#2B2110] text-[#93670F] dark:text-[#D4A94A]">
                                                    🏆 Results Live
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div><StatusBadge status={contest.status} /></div>

                                    {/* Start time */}
                                    <div className="flex items-center gap-1.5 text-xs text-[#8C8B82]">
                                        <Calendar className="w-3.5 h-3.5 text-[#8C8B82] flex-shrink-0" />
                                        {formatDate(contest.start_time)}
                                    </div>

                                    {/* Participants */}
                                    <div className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-[#8C8B82]" />
                                        <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{contest.participant_count ?? 0}</span>
                                        {contest.max_participants && (
                                            <span className="text-xs text-[#8C8B82]">/ {contest.max_participants}</span>
                                        )}
                                    </div>

                                    {/* Difficulty */}
                                    <div><DiffBadge diff={contest.difficulty} /></div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <Link href={`/admin/contests/${contest.id}`}
                                            className="p-1.5 text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#6B2737] dark:hover:text-[#B5677A] transition-colors" title="View">
                                            <Eye className="w-4 h-4" />
                                        </Link>
                                        <button onClick={() => setParticipantsFor(contest)}
                                            className="p-1.5 text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#6B2737] dark:hover:text-[#B5677A] transition-colors" title="Participants">
                                            <Users className="w-4 h-4" />
                                        </button>
                                        {canEdit && (
                                            <button onClick={() => setEditingContest(contest)}
                                                className="p-1.5 text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#6B2737] dark:hover:text-[#B5677A] transition-colors" title="Edit">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {contest.status === "draft" && (
                                            <button onClick={() => handlePublish(contest)}
                                                className="p-1.5 text-[#2F6B3A] dark:text-[#7EBA88] hover:text-[#255A2E] transition-colors" title="Open for Enrollment">
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}
                                        {contest.status === "published" && (
                                            <button onClick={() => handleForceStart(contest)}
                                                className="p-1.5 text-[#8C2E24] dark:text-[#D08A7E] transition-colors" title="Force Start">
                                                <Radio className="w-4 h-4" />
                                            </button>
                                        )}
                                        {contest.status === "live" && (
                                            <button onClick={() => handleEnd(contest)}
                                                className="p-1.5 text-[#93670F] dark:text-[#D4A94A] transition-colors" title="End Contest">
                                                <Square className="w-4 h-4" />
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => handleDelete(contest)}
                                                className="p-1.5 text-[#8C8B82] hover:text-[#8C2E24] transition-colors" title="Delete">
                                                <Trash2 className="w-4 h-4" />
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
                    <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-xs text-[#5B5A52] dark:text-[#ABA99C]">
                        <span>
                            Showing <span className="font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span> of <span className="font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{total}</span> contests
                        </span>
                        <div className="flex gap-2">
                            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
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
