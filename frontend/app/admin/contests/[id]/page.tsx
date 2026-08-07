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
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <StatusBadge status={contest.status} />
                            {isAnnounced && (
                                <span className="flex items-center gap-1.5 text-xs font-medium border border-[#2F6B3A] bg-[#E9F1E9] dark:bg-[#1A2A1D] text-[#2F6B3A] dark:text-[#7EBA88] px-2.5 py-0.5">
                                    <CheckCircle className="w-3.5 h-3.5" /> Leaderboard Published
                                </span>
                            )}
                        </div>
                        <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">{contest.title}</h1>
                        {contest.description && (
                            <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">{contest.description}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        {canEdit && (
                            <button onClick={() => setShowEdit(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C] border border-[#DEDCD3] dark:border-[#35352C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                                <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                        )}
                        {contest.status === "draft" && (
                            <button onClick={handlePublish}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] transition-colors">
                                <Play className="w-3.5 h-3.5" /> Publish
                            </button>
                        )}
                        {contest.status === "published" && (
                            <button onClick={handleForceStart}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2F6B3A] hover:bg-[#255A2E] transition-colors">
                                <Radio className="w-3.5 h-3.5" /> Force Start
                            </button>
                        )}
                        {contest.status === "live" && (
                            <button onClick={handleEnd}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#93670F] hover:bg-[#78540C] transition-colors">
                                <Square className="w-3.5 h-3.5" /> End Contest
                            </button>
                        )}
                        {contest.status === "ended" && !isAnnounced && (
                            <button onClick={handlePublishLeaderboard}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] transition-colors">
                                <Megaphone className="w-3.5 h-3.5" /> Publish Leaderboard
                            </button>
                        )}
                        <button onClick={load} title="Refresh"
                            className="p-2 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
                    {[
                        { label: "Topic", value: contest.topic },
                        { label: "Start Time", value: formatDate(contest.start_time) },
                        { label: "Duration", value: `${contest.duration_minutes} min` },
                        {
                            label: "Participants",
                            value: contest.max_participants
                                ? `${participants.length} / ${contest.max_participants}`
                                : `${participants.length} enrolled`,
                        },
                    ].map(m => (
                        <div key={m.label} className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-4 text-center">
                            <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C] uppercase tracking-widest mb-1">{m.label}</div>
                            <div className="font-heading text-base font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{m.value}</div>
                        </div>
                    ))}
                </div>

                {/* Publish reminder banner */}
                {contest.status === "ended" && !isAnnounced && (
                    <div className="mt-4 bg-[#F5EEDD] dark:bg-[#2B2110] border border-[#DEDCD3] dark:border-[#35352C] px-4 py-3 flex items-center justify-between gap-4">
                        <div className="text-xs text-[#93670F] dark:text-[#D4A94A]">
                            ⚡ Contest has ended. Review responses below, then click <strong>&quot;Publish Leaderboard&quot;</strong> to reveal results.
                        </div>
                        <button onClick={handlePublishLeaderboard}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] transition-colors">
                            <Megaphone className="w-3.5 h-3.5" /> Publish Now
                        </button>
                    </div>
                )}
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="flex gap-2 border-b border-[#DEDCD3] dark:border-[#35352C] pb-px overflow-x-auto">
                {(["participants", "results", "responses", "qstats"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                            tab === t
                            ? "border-[#6B2737] text-[#6B2737] dark:border-[#B5677A] dark:text-[#B5677A]"
                            : "border-transparent text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]"
                        }`}>
                        {t === "participants" ? `Participants (${participants.length})`
                            : t === "results" ? `Results (${results.length})`
                                : t === "responses" ? `Responses (${Object.keys(answersByUser).length})`
                                    : `Question Stats (${questions.length})`}
                    </button>
                ))}
            </div>

            {/* ── Participants tab ─────────────────────────────────────────── */}
            {tab === "participants" && (
                <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
                    {participants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Users className="w-10 h-10 text-[#8C8B82] mb-3" />
                            <p className="text-[#8C8B82] text-sm">No participants yet</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-6 py-3 border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
                                <div>#</div><div>Name</div><div>Email</div><div>Submitted?</div><div>Enrolled</div>
                            </div>
                            <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
                                {participants.map((p, i) => {
                                    const name = p.profiles?.full_name ?? "Unknown";
                                    const email = p.profiles?.email ?? "—";
                                    const submitted = results.some(r => r.user_id === p.user_id);
                                    return (
                                        <div key={p.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto] gap-4 px-6 py-3.5 items-center hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                                            <div className="w-7 h-7 bg-[#6B2737] flex items-center justify-center text-white text-xs font-medium">
                                                {name[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{name}</div>
                                            <div className="text-xs text-[#8C8B82]">{email}</div>
                                            <div>
                                                {submitted
                                                    ? <span className="flex items-center gap-1 text-xs font-medium text-[#2F6B3A] dark:text-[#7EBA88]"><CheckCircle className="w-3.5 h-3.5" /> Submitted</span>
                                                    : <span className="flex items-center gap-1 text-xs font-medium text-[#8C8B82]"><Clock className="w-3.5 h-3.5" /> Pending</span>
                                                }
                                            </div>
                                            <div className="text-xs text-[#8C8B82]">
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
                <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
                    {results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Trophy className="w-10 h-10 text-[#8C8B82] mb-3" />
                            <p className="text-[#8C8B82] text-sm">
                                {contest.status === "live" ? "Waiting for participants to submit…" : "No results yet"}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
                                <div>Rank</div><div>Participant</div><div>Score</div><div>Accuracy</div><div>Time</div><div>Submitted</div>
                            </div>
                            <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
                                {results.map((r, idx) => {
                                    const name = r.profiles?.full_name ?? "Unknown";
                                    const rank = idx + 1;
                                    const medal = MEDAL[rank];
                                    return (
                                        <div key={r.id}
                                            className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-4 items-center hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                                            <div className="w-10 text-base font-semibold text-center">
                                                {medal ?? <span className="text-xs text-[#8C8B82]">#{rank}</span>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{name}</div>
                                                <div className="text-xs text-[#8C8B82]">{r.profiles?.email}</div>
                                            </div>
                                            <div className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA] text-right">
                                                {r.score}<span className="text-[#8C8B82] text-xs">/{r.total_questions}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-sm font-semibold text-right">
                                                <span className={r.accuracy >= 70 ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}>
                                                    {Number(r.accuracy).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-sm text-[#8C8B82] text-right">
                                                {formatSeconds(r.time_taken_seconds)}
                                            </div>
                                            <div className="text-xs text-[#8C8B82] text-right">
                                                {r.submitted_at ? new Date(r.submitted_at).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}
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
                        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] flex flex-col items-center justify-center py-16 text-center">
                            <BookOpen className="w-10 h-10 text-[#8C8B82] mb-3" />
                            <p className="text-[#8C8B82] text-sm">No responses recorded yet</p>
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
                                <div key={uid} className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
                                    {/* User row header */}
                                    <button
                                        onClick={() => setExpandedUser(isExpanded ? null : uid)}
                                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                                {name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{name}</div>
                                                <div className="text-xs text-[#8C8B82]">{profile.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">{correct}/{total} correct</div>
                                                {result && <div className="text-xs text-[#8C8B82]">Time: {formatSeconds(result.time_taken_seconds)}</div>}
                                            </div>
                                            <span className="text-xs text-[#8C8B82]">{isExpanded ? "▲" : "▼"}</span>
                                        </div>
                                    </button>

                                    {/* Per-question breakdown */}
                                    {isExpanded && (
                                        <div className="border-t border-[#DEDCD3] dark:border-[#35352C] divide-y divide-[#EAE8E1] dark:divide-[#262620] bg-[#FAFAF8] dark:bg-[#14140F]">
                                            {questions.map((q, qi) => {
                                                const ans = userAnswers.find(a => a.question_id === q.id);
                                                const correctOption = q.options[q.correctIndex];
                                                return (
                                                    <div key={q.id} className="px-6 py-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-shrink-0 mt-0.5">
                                                                {ans?.is_correct
                                                                    ? <CheckCircle className="w-4 h-4 text-[#2F6B3A] dark:text-[#7EBA88]" />
                                                                    : <XCircle className="w-4 h-4 text-[#8C2E24] dark:text-[#D08A7E]" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest mb-1">Q{qi + 1}</div>
                                                                <div className="text-sm text-[#1B1B18] dark:text-[#F2F1EA] font-medium mb-2 leading-relaxed">{q.question}</div>
                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                    <div className={`px-3 py-1.5 border ${ans?.is_correct ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]" : "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]"}`}>
                                                                        <span className="font-semibold uppercase text-[10px] tracking-widest block mb-0.5">
                                                                            {ans ? "Answered" : "Skipped"}
                                                                        </span>
                                                                        {ans?.selected_answer || <em className="opacity-60">No answer</em>}
                                                                    </div>
                                                                    {!ans?.is_correct && (
                                                                        <div className="px-3 py-1.5 border bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]">
                                                                            <span className="font-semibold uppercase text-[10px] tracking-widest block mb-0.5">Correct Answer</span>
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
                const nameMap: Record<string, string> = {};
                [...participants, ...results].forEach(r => {
                    const uid = r.user_id;
                    if (!nameMap[uid]) {
                        nameMap[uid] = r.profiles?.full_name ?? r.profiles?.email ?? "Unknown";
                    }
                });

                return (
                    <div className="space-y-4">
                        {questions.length === 0 ? (
                            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] flex flex-col items-center justify-center py-16 text-center">
                                <BookOpen className="w-10 h-10 text-[#8C8B82] mb-3" />
                                <p className="text-[#8C8B82] text-sm">No questions found in this contest.</p>
                            </div>
                        ) : (
                            questions.map((q, qi) => {
                                const qAnswers = answers.filter(a => a.question_id === q.id);
                                const totalAnswered = qAnswers.length;
                                const correctCount = qAnswers.filter(a => a.is_correct).length;
                                const correctPct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

                                const optionUsers: Record<string, string[]> = {};
                                q.options.forEach(opt => { optionUsers[opt] = []; });
                                qAnswers.forEach(a => {
                                    if (a.selected_answer in optionUsers) {
                                        optionUsers[a.selected_answer].push(a.user_id);
                                    }
                                });

                                return (
                                    <div key={q.id} className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F]">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest">Q{qi + 1}</span>
                                                    {totalAnswered === 0 && (
                                                        <span className="text-[10px] font-semibold text-[#8C8B82]">No responses yet</span>
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] leading-relaxed">{q.question}</p>
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <div className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{correctPct}%</div>
                                                <div className="text-xs text-[#8C8B82]">correct rate ({correctCount}/{totalAnswered})</div>
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
                                                    <div key={oi} className={`border ${isCorrectOpt ? "border-[#2F6B3A] bg-[#E9F1E9]/30 dark:bg-[#1A2A1D]/30" : "border-[#DEDCD3] dark:border-[#35352C]"}`}>
                                                        {/* Bar row */}
                                                        <div className="flex items-center gap-3 px-3 py-2.5">
                                                            <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-semibold ${isCorrectOpt ? "bg-[#2F6B3A] text-white" : "bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border border-[#DEDCD3] dark:border-[#35352C]"}`}>
                                                                {["A", "B", "C", "D"][oi]}
                                                            </span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="relative h-7 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
                                                                    <div className="absolute inset-y-0 left-0 transition-all duration-700"
                                                                        style={{
                                                                            width: `${pct}%`,
                                                                            backgroundColor: isCorrectOpt ? "#2F6B3A" : "#6B2737",
                                                                            opacity: count > 0 ? 0.25 : 0,
                                                                        }} />
                                                                    <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-[#1B1B18] dark:text-[#F2F1EA] gap-1.5">
                                                                        {opt}
                                                                        {isCorrectOpt && <CheckCircle className="w-3.5 h-3.5 text-[#2F6B3A] dark:text-[#7EBA88] flex-shrink-0" />}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-semibold flex-shrink-0 w-8 text-right text-[#1B1B18] dark:text-[#F2F1EA]">
                                                                {pct}%
                                                            </span>
                                                        </div>

                                                        {/* Name chips — who chose this option */}
                                                        {count > 0 && (
                                                            <div className="flex flex-wrap gap-2 px-4 pb-3 pt-1 border-t border-[#DEDCD3] dark:border-[#35352C]">
                                                                {choosers.map(uid => {
                                                                    const name = nameMap[uid] ?? "Unknown";
                                                                    return (
                                                                        <div key={uid} className="flex items-center gap-1.5 border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] px-2.5 py-1 text-xs">
                                                                            <span className="font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{name}</span>
                                                                            {isCorrectOpt
                                                                                ? <CheckCircle className="w-3.5 h-3.5 text-[#2F6B3A] dark:text-[#7EBA88] flex-shrink-0" />
                                                                                : <XCircle className="w-3.5 h-3.5 text-[#8C2E24] dark:text-[#D08A7E] flex-shrink-0" />}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Explanation */}
                                        {q.explanation && (
                                            <div className="px-6 pb-4">
                                                <div className="text-xs text-[#5B5A52] dark:text-[#ABA99C] bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] p-3 leading-relaxed">
                                                    💡 <strong className="text-[#1B1B18] dark:text-[#F2F1EA]">Explanation:</strong> {q.explanation}
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
