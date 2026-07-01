"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Trophy, Clock, Target,
    CheckCircle, Zap, Swords, Lock, Bell, PartyPopper
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest, ContestResult } from "@/app/admin/contests/types";

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatTime(secs: number) {
    const m = Math.floor(secs / 60); const s = secs % 60;
    return `${m}m ${pad(s)}s`;
}

const MEDAL = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = [
    { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" },
    { bg: "#F1F5F9", border: "#CBD5E1", text: "#334155" },
    { bg: "#FEF2E4", border: "#F4B86A", text: "#92400E" },
];

function rankResults(raw: ContestResult[]): ContestResult[] {
    const sorted = [...raw].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.time_taken_seconds !== b.time_taken_seconds) return a.time_taken_seconds - b.time_taken_seconds;
        return (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "");
    });
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

function Podium({ results }: { results: ContestResult[] }) {
    const [first, second, third] = results;
    const order = [second, first, third].filter(Boolean);
    return (
        <div className="flex items-end justify-center gap-4 px-4 py-2 mb-6">
            {order.map((r) => {
                const rankIdx = (r.rank ?? 1) - 1;
                const mc = MEDAL_COLORS[rankIdx] ?? MEDAL_COLORS[2];
                const heights = [64, 96, 48];
                const posIdx = [second, first, third].indexOf(r);
                return (
                    <div key={r.id} className="text-center flex-1 max-w-[140px]">
                        <div className="w-14 h-14 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-white text-xl font-black mb-1 mx-auto"
                            style={{ backgroundColor: ["#8B5CF6", "#6366F1", "#10B981"][rankIdx] ?? "#6366F1" }}>
                            {(r.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div className="text-xs font-bold text-[#374151] truncate max-w-[120px] mx-auto">
                            {r.profiles?.full_name ?? "Unknown"}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF] mb-1">{r.score}/{r.total_questions}</div>
                        <div className="rounded-t-xl w-full flex items-end justify-center pb-1 shadow-sm"
                            style={{ height: `${heights[posIdx] ?? 48}px`, backgroundColor: mc.bg, border: `1px solid ${mc.border}` }}>
                            <span className="text-xl">{MEDAL[rankIdx]}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── The actual page content (uses useSearchParams so needs Suspense) ──
function LeaderboardContent() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const justSubmitted = searchParams.get("submitted") === "true";

    const [contest, setContest] = useState<Contest | null>(null);
    const [results, setResults] = useState<ContestResult[]>([]);
    const [myResult, setMyResult] = useState<ContestResult | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadResults = useCallback(async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);

        const [{ data: c }, { data: rawResults }] = await Promise.all([
            supabase.from("contests").select("*").eq("id", id).single(),
            supabase.from("contest_results")
                .select("id, contest_id, user_id, score, total_questions, accuracy, time_taken_seconds, rank, submitted_at")
                .eq("contest_id", id),
        ]);

        if (!c) { setLoading(false); return; }
        setContest(c as Contest);

        // Fetch profiles separately (avoids cross-table JOIN RLS blocking)
        const userIds = (rawResults ?? []).map(r => r.user_id);
        const { data: profilesData } = userIds.length > 0
            ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
            : { data: [] };

        const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
        (profilesData ?? []).forEach(pr => { profileMap[pr.id] = pr; });

        const merged = (rawResults ?? []).map(r => ({
            ...r,
            profiles: profileMap[r.user_id] ?? { full_name: null, email: null },
        }));

        const ranked = rankResults(merged as ContestResult[]);
        setResults(ranked);

        if (user) {
            setMyResult(ranked.find(r => r.user_id === user.id) ?? null);
        }

        setLoading(false);
    }, [id]);

    useEffect(() => { loadResults(); }, [loadResults]);

    // Poll every 8 seconds until leaderboard is published
    useEffect(() => {
        if (contest?.announced_at) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            return;
        }
        pollingRef.current = setInterval(loadResults, 8000);
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [contest?.announced_at, loadResults]);

    // Realtime: watch for announcement
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase.channel(`lb-contest-${id}`)
            .on("postgres_changes", {
                event: "UPDATE", schema: "public", table: "contests", filter: `id=eq.${id}`,
            }, () => { loadResults(); })
            .on("postgres_changes", {
                event: "*", schema: "public", table: "contest_results", filter: `contest_id=eq.${id}`,
            }, () => { loadResults(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, loadResults]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-[#6B7280]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
        );
    }

    const isAnnounced = Boolean(contest?.announced_at);

    // ── GATE: Leaderboard not yet published ────────────────────────
    if (!isAnnounced) {
        return (
            <div className="max-w-lg mx-auto animate-fade-in-up">
                <div className="flex items-center gap-2 mb-8">
                    <Link href="/dashboard/contests"
                        className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#111827] text-sm font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4" /> All Contests
                    </Link>
                </div>

                {justSubmitted ? (
                    /* ── Response Recorded Screen ── */
                    <div className="text-center py-10">
                        <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
                            <div className="absolute inset-0 rounded-full bg-[#D1FAE5] animate-ping opacity-40" />
                            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-xl shadow-[#10B981]/30">
                                <CheckCircle className="w-11 h-11 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-black text-[#111827] mb-2">Response Recorded! 🎉</h1>
                        <p className="text-[#6B7280] mb-1">
                            Your answers for <span className="font-bold text-[#111827]">&quot;{contest?.title}&quot;</span> have been saved.
                        </p>
                        <p className="text-sm text-[#9CA3AF] mb-8">
                            The admin is reviewing all responses and will publish the results soon.
                        </p>

                        {/* Your personal stats (visible immediately) */}
                        {myResult && (
                            <div className="bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] border border-[#C7D2FE] rounded-2xl p-5 mb-6 text-left">
                                <div className="text-xs font-black text-[#6366F1] uppercase tracking-widest mb-3">Your Performance</div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-[#4338CA]">{myResult.score}/{myResult.total_questions}</div>
                                        <div className="text-xs text-[#818CF8] mt-0.5">Score</div>
                                    </div>
                                    <div className="text-center border-x border-[#C7D2FE]">
                                        <div className="text-2xl font-black text-[#4338CA]">{Number(myResult.accuracy).toFixed(0)}%</div>
                                        <div className="text-xs text-[#818CF8] mt-0.5">Accuracy</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-[#4338CA]">{formatTime(myResult.time_taken_seconds)}</div>
                                        <div className="text-xs text-[#818CF8] mt-0.5">Time Taken</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-2 text-xs text-[#9CA3AF] bg-[#F9FAFB] border border-[#E5E7EB] rounded-full px-4 py-2 w-fit mx-auto mb-8">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6366F1]" />
                            Checking for results every 8 seconds…
                        </div>

                        <Link href="/dashboard/contests"
                            className="inline-flex items-center gap-2 bg-white border border-[#E5E7EB] text-[#6B7280] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#F9FAFB] text-sm transition-all">
                            <ArrowLeft className="w-4 h-4" /> Back to Contests
                        </Link>
                    </div>
                ) : (
                    /* ── Awaiting Results Screen (for non-submitters browsing) ── */
                    <div className="text-center py-10">
                        <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
                            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-xl shadow-[#6366F1]/30">
                                <Lock className="w-10 h-10 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-black text-[#111827] mb-2">Results Pending</h1>
                        <p className="text-[#6B7280] mb-2">
                            <span className="font-bold text-[#111827]">&quot;{contest?.title}&quot;</span> results haven&apos;t been published yet.
                        </p>
                        <p className="text-sm text-[#9CA3AF] mb-8">
                            The admin will publish the leaderboard once all submissions are reviewed.
                            You&apos;ll be notified automatically when it goes live.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-[#9CA3AF] bg-[#F9FAFB] border border-[#E5E7EB] rounded-full px-4 py-2 w-fit mx-auto mb-8">
                            <Bell className="w-3.5 h-3.5 text-[#6366F1]" />
                            Auto-checking for updates…
                        </div>
                        <Link href="/dashboard/contests"
                            className="inline-flex items-center gap-2 bg-white border border-[#E5E7EB] text-[#6B7280] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#F9FAFB] text-sm transition-all">
                            <ArrowLeft className="w-4 h-4" /> Back to Contests
                        </Link>
                    </div>
                )}
            </div>
        );
    }

    // ── LEADERBOARD PUBLISHED ──────────────────────────────────────
    return (
        <div className="max-w-3xl mx-auto animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
                <Link href="/dashboard/contests"
                    className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#111827] text-sm font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" /> All Contests
                </Link>
                <div className="flex items-center gap-1.5 text-xs font-black text-[#F59E0B] bg-[#FEF3C7] border border-[#FCD34D] px-3 py-1.5 rounded-full">
                    <PartyPopper className="w-3.5 h-3.5" /> Results Published!
                </div>
            </div>

            <div className="mb-5">
                <h1 className="text-2xl font-black text-[#111827] flex items-center gap-2.5">
                    <Trophy className="w-6 h-6 text-[#F59E0B]" /> {contest?.title}
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">
                    {contest?.topic} · {results.length} participant{results.length !== 1 ? "s" : ""} submitted
                </p>
            </div>

            {/* Winner banner */}
            {results.length > 0 && (
                <div className="bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#FEF3C7] border-2 border-[#FCD34D] rounded-2xl p-6 mb-6 text-center relative overflow-hidden">
                    <div className="text-4xl mb-2">🎉</div>
                    <h2 className="text-xl font-black text-[#92400E] mb-1">Contest Results Announced!</h2>
                    <p className="text-sm text-[#B45309] mb-4">Congratulations to our top performers!</p>
                    <div className="flex items-end justify-center gap-6">
                        {results.slice(0, 3).map((r, i) => (
                            <div key={r.id} className="text-center">
                                <div className="text-2xl mb-1">{MEDAL[i]}</div>
                                <div className="text-sm font-black text-[#92400E]">{r.profiles?.full_name ?? "Unknown"}</div>
                                <div className="text-xs text-[#B45309]">{r.score}/{r.total_questions} correct</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Podium */}
            {results.length >= 2 && (
                <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] rounded-2xl border border-[#E0E7FF] p-5 mb-6">
                    <div className="text-center text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-4">
                        🏆 Top {Math.min(3, results.length)}
                    </div>
                    <Podium results={results.slice(0, 3)} />
                </div>
            )}

            {/* My result */}
            {myResult && (
                <div className="bg-[#EEF2FF] border-2 border-[#6366F1] rounded-2xl p-4 mb-5 flex items-center gap-4">
                    <div className="text-2xl font-black text-[#6366F1] w-12 text-center">
                        {myResult.rank && myResult.rank <= 3 ? MEDAL[myResult.rank - 1] : `#${myResult.rank}`}
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-black text-[#4338CA]">Your Result</div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[#6366F1]">
                            <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {myResult.score}/{myResult.total_questions}</span>
                            <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {Number(myResult.accuracy).toFixed(1)}%</span>
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(myResult.time_taken_seconds)}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-[#6366F1]">{Number(myResult.accuracy).toFixed(0)}%</div>
                        <div className="text-xs text-[#818CF8]">accuracy</div>
                    </div>
                </div>
            )}

            {/* Full results table */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
                    <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest">All Results</h2>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 bg-[#F9FAFB] border-b border-[#F3F4F6] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                    <div className="w-10">Rank</div><div>Participant</div>
                    <div className="text-right">Score</div><div className="text-right hidden sm:block">Accuracy</div><div className="text-right">Time</div>
                </div>
                {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Swords className="w-12 h-12 text-[#E5E7EB] mb-3" />
                        <p className="text-[#9CA3AF] text-sm">No results yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#F9FAFB]">
                        {results.map((r) => {
                            const isMe = r.user_id === userId;
                            const rankN = r.rank ?? 0;
                            return (
                                <div key={r.id}
                                    className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-4 items-center ${isMe ? "bg-[#EEF2FF] border-l-4 border-l-[#6366F1]" : "hover:bg-[#FAFAFA]"}`}>
                                    <div className="w-10 flex items-center justify-center text-lg font-black">
                                        {rankN <= 3 ? MEDAL[rankN - 1] : <span className="text-sm text-[#9CA3AF]">#{rankN}</span>}
                                    </div>
                                    <div className="min-w-0 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                            style={{ backgroundColor: isMe ? "#6366F1" : ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"][rankN % 5] }}>
                                            {(r.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                                        </div>
                                        <div className={`text-sm font-bold truncate ${isMe ? "text-[#6366F1]" : "text-[#111827]"}`}>
                                            {r.profiles?.full_name ?? "Unknown"}
                                            {isMe && <span className="ml-1.5 text-[10px] font-black text-[#6366F1] bg-[#C7D2FE] px-1.5 py-0.5 rounded-full">you</span>}
                                        </div>
                                    </div>
                                    <div className={`text-sm font-black text-right ${isMe ? "text-[#6366F1]" : "text-[#111827]"}`}>
                                        {r.score}<span className="text-[#9CA3AF] text-xs font-normal">/{r.total_questions}</span>
                                    </div>
                                    <div className={`text-sm font-bold text-right hidden sm:block ${Number(r.accuracy) >= 70 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                                        {Number(r.accuracy).toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-[#6B7280] text-right">{formatTime(r.time_taken_seconds)}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
                <Link href="/dashboard/contests"
                    className="flex items-center gap-2 bg-white border border-[#E5E7EB] text-[#6B7280] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#F9FAFB] text-sm transition-all">
                    <ArrowLeft className="w-4 h-4" /> All Contests
                </Link>
                <Link href="/dashboard/generate"
                    className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-[#6366F1]/25">
                    <Zap className="w-4 h-4" /> Practice Quiz
                </Link>
            </div>
        </div>
    );
}

export default function ContestLeaderboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-32 text-[#6B7280]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading leaderboard…
            </div>
        }>
            <LeaderboardContent />
        </Suspense>
    );
}
