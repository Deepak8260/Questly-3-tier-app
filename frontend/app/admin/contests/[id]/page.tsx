"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Trophy, Users, Clock, Calendar,
    Radio, Square, Play, Edit2, Megaphone, RefreshCw,
    Target, CheckCircle, AlertTriangle, XCircle, BookOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import StatusBadge from "../_components/StatusBadge";
import ContestFormModal from "../_components/ContestFormModal";
import type { Contest, ContestResult, ContestParticipant, ContestQuestion } from "../types";

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        month: "long", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function formatSeconds(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}

type ConfirmOpts = {
    title: string;
    message: string;
    confirmLabel: string;
    intent: "danger" | "warning" | "success";
    onConfirm: () => Promise<void>;
} | null;

function ConfirmModal({ opts, onCancel }: { opts: NonNullable<ConfirmOpts>; onCancel: () => void }) {
    const [busy, setBusy] = useState(false);
    const colors = { danger: "#EF4444", warning: "#F59E0B", success: "#10B981" };
    const color = colors[opts.intent];
    const run = async () => { setBusy(true); await opts.onConfirm(); setBusy(false); onCancel(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <h3 className="text-lg font-black text-white mb-2">{opts.title}</h3>
                <p className="text-sm text-[#94a3b8] mb-6">{opts.message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel}
                        className="flex-1 py-2.5 text-sm font-semibold text-[#64748B] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] transition-all">
                        Cancel
                    </button>
                    <button onClick={run} disabled={busy}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl transition-all disabled:opacity-50"
                        style={{ backgroundColor: color }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : opts.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

// ── Per-question answer record ─────────────────────────────────────
interface AnswerRecord {
    user_id: string;
    question_id: string;
    selected_answer: string;
    is_correct: boolean;
    answered_at: string;
}

export default function ContestDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [contest, setContest] = useState<Contest | null>(null);
    const [participants, setParticipants] = useState<ContestParticipant[]>([]);
    const [results, setResults] = useState<ContestResult[]>([]);
    const [answers, setAnswers] = useState<AnswerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [confirmOpts, setConfirmOpts] = useState<ConfirmOpts>(null);
    const [tab, setTab] = useState<"participants" | "results" | "responses" | "qstats">("participants");
    // Which user's answers are expanded in Responses tab
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        const [{ data: c }, { data: partsRaw }, { data: ressRaw }, { data: answersRaw }] = await Promise.all([
            supabase.from("contests").select("*").eq("id", id).single(),
            supabase.from("contest_participants")
                .select("id, contest_id, user_id, enrolled_at")
                .eq("contest_id", id)
                .order("enrolled_at", { ascending: false }),
            supabase.from("contest_results")
                .select("id, contest_id, user_id, score, total_questions, accuracy, time_taken_seconds, rank, submitted_at")
                .eq("contest_id", id)
                .order("score", { ascending: false }),
            supabase.from("contest_answers")
                .select("user_id, question_id, selected_answer, is_correct, answered_at")
                .eq("contest_id", id)
                .order("answered_at", { ascending: true }),
        ]);

        if (!c) { router.replace("/admin/contests"); return; }

        // Fetch profiles separately to avoid cross-table RLS JOIN blocking
        const allUserIds = [
            ...new Set([
                ...(partsRaw ?? []).map(p => p.user_id),
                ...(ressRaw ?? []).map(r => r.user_id),
            ])
        ];
        const { data: profilesData } = allUserIds.length > 0
            ? await supabase.from("profiles").select("id, full_name, email").in("id", allUserIds)
            : { data: [] };

        const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
        (profilesData ?? []).forEach(pr => { profileMap[pr.id] = pr; });

        const parts = (partsRaw ?? []).map(p => ({ ...p, profiles: profileMap[p.user_id] ?? { full_name: null, email: null } }));
        const ress = (ressRaw ?? []).map(r => ({ ...r, profiles: profileMap[r.user_id] ?? { full_name: null, email: null } }));

        setContest(c as Contest);
        setParticipants(parts as ContestParticipant[]);
        setResults(ress as ContestResult[]);
        setAnswers((answersRaw ?? []) as AnswerRecord[]);
        setLoading(false);
    }, [id, router]);

    useEffect(() => { load(); }, [load]);

    // ── Action helpers ──────────────────────────────────────────────
    const supabaseUpdate = (update: Partial<Contest>) => async () => {
        const supabase = createClient();
        await supabase.from("contests").update(update).eq("id", id);
        await load();
    };

    const handlePublish = () => setConfirmOpts({ title: "Publish Contest", message: "This makes the contest visible and enrollable by users.", confirmLabel: "Publish", intent: "success", onConfirm: supabaseUpdate({ status: "published" }) });
    const handleForceStart = () => setConfirmOpts({ title: "Force Start", message: "The contest will go live immediately regardless of its schedule.", confirmLabel: "Go Live", intent: "warning", onConfirm: supabaseUpdate({ status: "live" }) });
    const handleEnd = () => setConfirmOpts({ title: "End Contest", message: "This finalises submissions. Participants can no longer answer. Review responses then publish the leaderboard.", confirmLabel: "End Contest", intent: "warning", onConfirm: supabaseUpdate({ status: "ended" }) });
    const handlePublishLeaderboard = () => setConfirmOpts({
        title: "Publish Leaderboard",
        message: "This will make the leaderboard visible to all participants. They'll see their score, rank, and the winner announcement. This cannot be undone.",
        confirmLabel: "Publish Results!",
        intent: "success",
        onConfirm: supabaseUpdate({ announced_at: new Date().toISOString() }),
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-[#64748B]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading contest…
            </div>
        );
    }

    if (!contest) return null;

    const canEdit = contest.status === "draft" || contest.status === "published";
    const isAnnounced = Boolean(contest.announced_at);
    const questions: ContestQuestion[] = (contest as unknown as { question_set: ContestQuestion[] }).question_set ?? [];

    // Group answers by user for the Responses tab
    const answersByUser: Record<string, AnswerRecord[]> = {};
    answers.forEach(a => {
        if (!answersByUser[a.user_id]) answersByUser[a.user_id] = [];
        answersByUser[a.user_id].push(a);
    });

    return (
        <div className="animate-fade-in-up max-w-5xl mx-auto">

            {/* Modals */}
            {showEdit && (
                <ContestFormModal
                    contest={contest}
                    onClose={() => setShowEdit(false)}
                    onSaved={() => { setShowEdit(false); load(); }}
                />
            )}
            {confirmOpts && (
                <ConfirmModal opts={confirmOpts} onCancel={() => setConfirmOpts(null)} />
            )}

            {/* ── Back + breadcrumb ── */}
            <div className="flex items-center gap-2 mb-6">
                <Link href="/admin/contests"
                    className="flex items-center gap-1.5 text-[#64748B] hover:text-white text-sm font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Contests
                </Link>
                <span className="text-[#334155]">/</span>
                <span className="text-sm text-white font-semibold truncate max-w-xs">{contest.title}</span>
            </div>

            {/* ── Header card ───────────────────────────────────────────── */}
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <StatusBadge status={contest.status} />
                            {isAnnounced && (
                                <span className="flex items-center gap-1.5 text-xs font-bold bg-[#052e16] text-[#4ade80] px-3 py-1 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Leaderboard Published
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-black text-white mb-1">{contest.title}</h1>
                        {contest.description && (
                            <p className="text-sm text-[#94a3b8]">{contest.description}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        {canEdit && (
                            <button onClick={() => setShowEdit(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#94a3b8] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] hover:text-white transition-all">
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                        )}
                        {contest.status === "draft" && (
                            <button onClick={handlePublish}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-xl transition-all">
                                <Play className="w-3.5 h-3.5" /> Publish
                            </button>
                        )}
                        {contest.status === "published" && (
                            <button onClick={handleForceStart}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#16a34a] hover:bg-[#15803d] rounded-xl transition-all">
                                <Radio className="w-3.5 h-3.5" /> Force Start
                            </button>
                        )}
                        {contest.status === "live" && (
                            <button onClick={handleEnd}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#D97706] hover:bg-[#B45309] rounded-xl transition-all">
                                <Square className="w-3.5 h-3.5" /> End Contest
                            </button>
                        )}
                        {/* ── Publish Leaderboard (was "Announce Winners") ── */}
                        {contest.status === "ended" && !isAnnounced && (
                            <button onClick={handlePublishLeaderboard}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#4F46E5] hover:to-[#7C3AED] rounded-xl transition-all shadow-lg shadow-[#6366F1]/20">
                                <Megaphone className="w-3.5 h-3.5" /> Publish Leaderboard
                            </button>
                        )}
                        <button onClick={load}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-[#64748B] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] transition-all">
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    </div>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: <Target className="w-4 h-4" />, label: "Topic", value: contest.topic, color: "#6366F1" },
                        { icon: <Calendar className="w-4 h-4" />, label: "Start Time", value: formatDate(contest.start_time), color: "#60a5fa" },
                        { icon: <Clock className="w-4 h-4" />, label: "Duration", value: `${contest.duration_minutes} min`, color: "#fbbf24" },
                        {
                            icon: <Users className="w-4 h-4" />, label: "Participants",
                            value: contest.max_participants
                                ? `${participants.length} / ${contest.max_participants}`
                                : `${participants.length} enrolled`,
                            color: "#4ade80"
                        },
                    ].map(m => (
                        <div key={m.label} className="bg-[#0B1120] rounded-xl p-4 border border-[#1E293B]">
                            <div className="flex items-center gap-1.5 text-xs font-black text-[#475569] uppercase tracking-widest mb-2">
                                <span style={{ color: m.color }}>{m.icon}</span>
                                {m.label}
                            </div>
                            <div className="text-sm font-bold text-white">{m.value}</div>
                        </div>
                    ))}
                </div>

                {/* Publish reminder banner */}
                {contest.status === "ended" && !isAnnounced && (
                    <div className="mt-4 bg-[#1e1a2e] border border-[#6366F1]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                        <div className="text-sm text-[#a5b4fc]">
                            ⚡ Contest has ended. Review all responses below, then click <strong>&quot;Publish Leaderboard&quot;</strong> to reveal results to participants.
                        </div>
                        <button onClick={handlePublishLeaderboard}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-xl transition-all">
                            <Megaphone className="w-3.5 h-3.5" /> Publish Now
                        </button>
                    </div>
                )}
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-[#0F172A] border border-[#1E293B] rounded-xl p-1 mb-5 w-fit overflow-x-auto">
                {(["participants", "results", "responses", "qstats"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold capitalize whitespace-nowrap transition-all ${tab === t ? "bg-[#6366F1] text-white" : "text-[#64748B] hover:text-white"}`}>
                        {t === "participants" ? `Participants (${participants.length})`
                            : t === "results" ? `Results (${results.length})`
                                : t === "responses" ? `Responses (${Object.keys(answersByUser).length})`
                                    : `Question Stats (${questions.length})`}
                    </button>
                ))}
            </div>

            {/* ── Participants tab ─────────────────────────────────────────── */}
            {tab === "participants" && (
                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
                    {participants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Users className="w-12 h-12 text-[#1E293B] mb-3" />
                            <p className="text-[#64748B]">No participants yet</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-6 py-3 border-b border-[#1E293B] text-[10px] font-black text-[#475569] uppercase tracking-widest">
                                <div>#</div><div>Name</div><div>Email</div><div>Submitted?</div><div>Enrolled</div>
                            </div>
                            <div className="divide-y divide-[#1E293B]">
                                {participants.map((p, i) => {
                                    const name = p.profiles?.full_name ?? "Unknown";
                                    const email = p.profiles?.email ?? "—";
                                    const submitted = results.some(r => r.user_id === p.user_id);
                                    const colors = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];
                                    const col = colors[i % colors.length];
                                    return (
                                        <div key={p.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-6 py-3.5 items-center hover:bg-[#1E293B]/40 transition-colors">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: col }}>
                                                {name[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-sm font-semibold text-white">{name}</div>
                                            <div className="text-sm text-[#64748B]">{email}</div>
                                            <div>
                                                {submitted
                                                    ? <span className="flex items-center gap-1 text-xs font-bold text-[#4ade80]"><CheckCircle className="w-3.5 h-3.5" /> Submitted</span>
                                                    : <span className="flex items-center gap-1 text-xs font-bold text-[#64748B]"><Clock className="w-3.5 h-3.5" /> Pending</span>
                                                }
                                            </div>
                                            <div className="text-xs text-[#475569]">
                                                {new Date(p.enrolled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Results tab ─────────────────────────────────────────────── */}
            {tab === "results" && (
                <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
                    {results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Trophy className="w-12 h-12 text-[#1E293B] mb-3" />
                            <p className="text-[#64748B]">
                                {contest.status === "live" ? "Waiting for participants to submit…" : "No results yet"}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-[#1E293B] text-[10px] font-black text-[#475569] uppercase tracking-widest">
                                <div>Rank</div><div>Participant</div><div>Score</div><div>Accuracy</div><div>Time</div><div>Submitted</div>
                            </div>
                            <div className="divide-y divide-[#1E293B]">
                                {results.map((r, idx) => {
                                    const name = r.profiles?.full_name ?? "Unknown";
                                    const rank = idx + 1;
                                    const medal = MEDAL[rank];
                                    const isTop3 = rank <= 3;
                                    return (
                                        <div key={r.id}
                                            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-4 items-center transition-colors ${isTop3 ? "bg-[#422006]/20 border-l-4 border-l-[#F59E0B]" : "hover:bg-[#1E293B]/40"}`}>
                                            <div className="w-10 text-lg font-black text-center">
                                                {medal ?? <span className="text-sm text-[#64748B]">#{rank}</span>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-white">{name}</div>
                                                <div className="text-xs text-[#64748B]">{r.profiles?.email}</div>
                                            </div>
                                            <div className="text-sm font-black text-white text-right">
                                                {r.score}<span className="text-[#64748B] text-xs">/{r.total_questions}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-sm font-semibold text-right">
                                                {r.accuracy >= 70
                                                    ? <CheckCircle className="w-3.5 h-3.5 text-[#4ade80]" />
                                                    : <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24]" />}
                                                <span className={r.accuracy >= 70 ? "text-[#4ade80]" : "text-[#fbbf24]"}>
                                                    {Number(r.accuracy).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-sm text-[#64748B] text-right">
                                                {formatSeconds(r.time_taken_seconds)}
                                            </div>
                                            <div className="text-xs text-[#475569] text-right">
                                                {r.submitted_at ? new Date(r.submitted_at).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Responses tab (per-question breakdown) ───────────────────── */}
            {tab === "responses" && (
                <div className="space-y-3">
                    {Object.keys(answersByUser).length === 0 ? (
                        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                            <BookOpen className="w-12 h-12 text-[#1E293B] mb-3" />
                            <p className="text-[#64748B]">No responses recorded yet</p>
                        </div>
                    ) : (
                        Object.entries(answersByUser).map(([uid, userAnswers]) => {
                            const profile = participants.find(p => p.user_id === uid)?.profiles
                                ?? results.find(r => r.user_id === uid)?.profiles
                                ?? { full_name: null, email: null };
                            const result = results.find(r => r.user_id === uid);
                            const name = profile.full_name ?? "Unknown";
                            const correct = userAnswers.filter(a => a.is_correct).length;
                            const total = userAnswers.length;
                            const isExpanded = expandedUser === uid;

                            return (
                                <div key={uid} className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
                                    {/* User row header */}
                                    <button
                                        onClick={() => setExpandedUser(isExpanded ? null : uid)}
                                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#1E293B]/50 transition-colors text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-[#6366F1] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                                {name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">{name}</div>
                                                <div className="text-xs text-[#64748B]">{profile.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm font-black text-white">{correct}/{total} correct</div>
                                                {result && <div className="text-xs text-[#64748B]">Time: {formatSeconds(result.time_taken_seconds)}</div>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: total }, (_, i) => (
                                                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${userAnswers[i]?.is_correct ? "bg-[#4ade80]" : "bg-[#EF4444]"}`} />
                                                ))}
                                            </div>
                                            <span className="text-xs text-[#64748B]">{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </button>

                                    {/* Per-question breakdown */}
                                    {isExpanded && (
                                        <div className="border-t border-[#1E293B] divide-y divide-[#1E293B]">
                                            {questions.map((q, qi) => {
                                                const ans = userAnswers.find(a => a.question_id === q.id);
                                                const correctOption = q.options[q.correctIndex];
                                                return (
                                                    <div key={q.id} className="px-6 py-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${ans?.is_correct ? "bg-[#052e16] text-[#4ade80]" : "bg-[#2d0a0a] text-[#f87171]"}`}>
                                                                {ans?.is_correct
                                                                    ? <CheckCircle className="w-3.5 h-3.5" />
                                                                    : <XCircle className="w-3.5 h-3.5" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-black text-[#475569] uppercase tracking-widest mb-1">Q{qi + 1}</div>
                                                                <div className="text-sm text-white font-medium mb-2 leading-relaxed">{q.question}</div>
                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                    <div className={`px-3 py-1.5 rounded-lg ${ans?.is_correct ? "bg-[#052e16] text-[#4ade80]" : "bg-[#2d0a0a] text-[#f87171]"}`}>
                                                                        <span className="font-black uppercase text-[10px] tracking-widest block mb-0.5">
                                                                            {ans ? "Answered" : "Skipped"}
                                                                        </span>
                                                                        {ans?.selected_answer || <em className="opacity-60">No answer</em>}
                                                                    </div>
                                                                    {!ans?.is_correct && (
                                                                        <div className="px-3 py-1.5 rounded-lg bg-[#052e16] text-[#4ade80]">
                                                                            <span className="font-black uppercase text-[10px] tracking-widest block mb-0.5">Correct Answer</span>
                                                                            {correctOption}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
            {/* ── Question Stats tab ────────────────────────────────────── */}
            {tab === "qstats" && (() => {
                // Build a name + color lookup from participants + results
                const avatarColors = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899"];
                const nameMap: Record<string, string> = {};
                const colorMap: Record<string, string> = {};
                let ci = 0;
                [...participants, ...results].forEach(r => {
                    const uid = r.user_id;
                    if (!nameMap[uid]) {
                        nameMap[uid] = r.profiles?.full_name ?? r.profiles?.email ?? "Unknown";
                        colorMap[uid] = avatarColors[ci % avatarColors.length];
                        ci++;
                    }
                });

                return (
                    <div className="space-y-4">
                        {questions.length === 0 ? (
                            <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                                <BookOpen className="w-12 h-12 text-[#1E293B] mb-3" />
                                <p className="text-[#64748B]">No questions found in this contest.</p>
                            </div>
                        ) : (
                            questions.map((q, qi) => {
                                const qAnswers = answers.filter(a => a.question_id === q.id);
                                const totalAnswered = qAnswers.length;
                                const correctCount = qAnswers.filter(a => a.is_correct).length;
                                const correctPct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

                                // Track which user IDs chose each option (by option text)
                                const optionUsers: Record<string, string[]> = {};
                                q.options.forEach(opt => { optionUsers[opt] = []; });
                                qAnswers.forEach(a => {
                                    if (a.selected_answer in optionUsers) {
                                        optionUsers[a.selected_answer].push(a.user_id);
                                    }
                                });

                                const diffColor = correctPct >= 70 ? "#4ade80" : correctPct >= 40 ? "#fbbf24" : "#f87171";
                                const diffLabel = correctPct >= 70 ? "Easy" : correctPct >= 40 ? "Medium" : "Hard";

                                return (
                                    <div key={q.id} className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#1E293B]">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-black text-[#475569] uppercase tracking-widest">Q{qi + 1}</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ backgroundColor: `${diffColor}20`, color: diffColor }}>
                                                        {diffLabel}
                                                    </span>
                                                    {totalAnswered === 0 && (
                                                        <span className="text-[10px] font-bold text-[#475569] bg-[#1E293B] px-2 py-0.5 rounded-full">No responses yet</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-semibold text-white leading-relaxed">{q.question}</p>
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <div className="text-2xl font-black" style={{ color: diffColor }}>{correctPct}%</div>
                                                <div className="text-xs text-[#64748B]">correct rate</div>
                                                <div className="text-xs text-[#475569] mt-0.5">{correctCount}/{totalAnswered} answered</div>
                                            </div>
                                        </div>

                                        {/* Per-option rows */}
                                        <div className="px-6 py-4 space-y-3">
                                            {q.options.map((opt, oi) => {
                                                const choosers = optionUsers[opt] ?? [];
                                                const count = choosers.length;
                                                const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
                                                const isCorrectOpt = oi === q.correctIndex;

                                                return (
                                                    <div key={oi} className={`rounded-xl border overflow-hidden ${isCorrectOpt ? "border-[#10B981]/40" : "border-[#1E293B]"}`}>
                                                        {/* Bar row */}
                                                        <div className="flex items-center gap-3 px-3 py-2.5">
                                                            <span className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${isCorrectOpt ? "bg-[#10B981] text-white" : "bg-[#1E293B] text-[#475569]"}`}>
                                                                {["A", "B", "C", "D"][oi]}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="relative h-7 bg-[#0B1120] rounded-lg overflow-hidden">
                                                                    <div className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700"
                                                                        style={{
                                                                            width: `${pct}%`,
                                                                            backgroundColor: isCorrectOpt ? "#10B981" : "#6366F1",
                                                                            opacity: count > 0 ? 0.3 : 0,
                                                                        }} />
                                                                    <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-white gap-1.5">
                                                                        {opt}
                                                                        {isCorrectOpt && <CheckCircle className="w-3 h-3 text-[#4ade80] flex-shrink-0" />}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className={`text-xs font-black flex-shrink-0 w-8 text-right ${isCorrectOpt ? "text-[#4ade80]" : count > 0 ? "text-[#94a3b8]" : "text-[#334155]"}`}>
                                                                {pct}%
                                                            </span>
                                                        </div>

                                                        {/* Name chips — who chose this option */}
                                                        {count > 0 && (
                                                            <div className={`flex flex-wrap gap-2 px-4 pb-3 pt-1 border-t ${isCorrectOpt ? "border-[#10B981]/20 bg-[#052e16]/40" : "border-[#1E293B] bg-[#0B1120]/60"}`}>
                                                                {choosers.map(uid => {
                                                                    const name = nameMap[uid] ?? "Unknown";
                                                                    const color = colorMap[uid] ?? "#6366F1";
                                                                    const initials = name.split(" ").map((w: string) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
                                                                    return (
                                                                        <div key={uid} className="flex items-center gap-1.5 bg-[#1E293B] border border-[#334155] rounded-full px-2.5 py-1">
                                                                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-black flex-shrink-0"
                                                                                style={{ backgroundColor: color }}>
                                                                                {initials}
                                                                            </div>
                                                                            <span className="text-xs font-semibold text-[#CBD5E1] whitespace-nowrap">{name}</span>
                                                                            {isCorrectOpt
                                                                                ? <CheckCircle className="w-3 h-3 text-[#4ade80] flex-shrink-0" />
                                                                                : <XCircle className="w-3 h-3 text-[#f87171] flex-shrink-0" />}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {totalAnswered === 0 && (
                                                <p className="text-center text-sm text-[#475569] py-2">No one has answered this question yet.</p>
                                            )}
                                        </div>

                                        {/* Explanation */}
                                        {q.explanation && (
                                            <div className="px-6 pb-4">
                                                <div className="text-xs text-[#64748B] bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 leading-relaxed">
                                                    💡 <strong className="text-[#94a3b8]">Explanation:</strong> {q.explanation}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
