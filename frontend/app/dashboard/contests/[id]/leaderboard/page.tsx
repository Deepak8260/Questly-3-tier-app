"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Trophy, Clock, Target,
    CheckCircle, Zap, Swords, Lock, Bell, PartyPopper, Crown
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest, ContestResult } from "@/app/admin/contests/types";

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatTime(secs: number) {
    const m = Math.floor(secs / 60); const s = secs % 60;
    return `${m}m ${pad(s)}s`;
}

const MEDAL_COLORS = [
    { bg: "#F5EEDD", border: "#93670F", text: "#5C4508" },
    { bg: "#EDECE6", border: "#8C8B82", text: "#3F3E38" },
    { bg: "#F3E7E9", border: "#6B2737", text: "#6B2737" },
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
                const avatarBg = ["#3F3E38", "#6B2737", "#93670F"][rankIdx] ?? "#6B2737";
                return (
                    <div key={r.id} className="text-center flex-1 max-w-[140px]">
                        <div className="w-14 h-14 border-2 border-white flex items-center justify-center text-white text-xl font-semibold mb-1 mx-auto"
                            style={{ backgroundColor: avatarBg }}>
                            {(r.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div className="text-xs font-semibold text-[#3F3E38] truncate max-w-[120px] mx-auto">
                            {r.profiles?.full_name ?? "Unknown"}
                        </div>
                        <div className="text-[10px] text-[#8C8B82] mb-1">{r.score}/{r.total_questions}</div>
                        <div className="w-full flex items-end justify-center pb-1"
                            style={{ height: `${heights[posIdx] ?? 48}px`, backgroundColor: mc.bg, border: `1px solid ${mc.border}` }}>
                            <Crown className="w-5 h-5" style={{ color: mc.text }} />
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
            <div className="flex items-center justify-center py-32 text-[#8C8B82]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
        );
    }

    const isAnnounced = Boolean(contest?.announced_at);

    // ── GATE: Leaderboard not yet published ────────────────────────
    if (!isAnnounced) {
        return (
            <div className="max-w-lg mx-auto">
                <div className="flex items-center gap-2 mb-8">
                    <Link href="/dashboard/contests"
                        className="inline-flex items-center gap-1.5 text-[#5B5A52] hover:text-[#1B1B18] text-sm font-medium transition-colors">
                        <ArrowLeft className="w-4 h-4" /> All contests
                    </Link>
                </div>

                {justSubmitted ? (
                    /* ── Response Recorded Screen ── */
                    <div className="text-center py-10">
                        <div className="w-20 h-20 bg-[#2F6B3A] flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="font-heading text-2xl font-medium text-[#1B1B18] mb-2">Response recorded</h1>
                        <p className="text-[#5B5A52] mb-1">
                            Your answers for <span className="font-semibold text-[#1B1B18]">&quot;{contest?.title}&quot;</span> have been saved.
                        </p>
                        <p className="text-sm text-[#8C8B82] mb-8">
                            The admin is reviewing all responses and will publish the results soon.
                        </p>

                        {/* Your personal stats (visible immediately) */}
                        {myResult && (
                            <div className="bg-[#F3E7E9] border border-[#DCC0C6] p-5 mb-6 text-left">
                                <div className="text-xs font-semibold text-[#6B2737] uppercase tracking-widest mb-3">Your performance</div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="font-heading text-2xl font-medium text-[#6B2737]">{myResult.score}/{myResult.total_questions}</div>
                                        <div className="text-xs text-[#8A5A66] mt-0.5">Score</div>
                                    </div>
                                    <div className="text-center border-x border-[#DCC0C6]">
                                        <div className="font-heading text-2xl font-medium text-[#6B2737]">{Number(myResult.accuracy).toFixed(0)}%</div>
                                        <div className="text-xs text-[#8A5A66] mt-0.5">Accuracy</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-heading text-2xl font-medium text-[#6B2737]">{formatTime(myResult.time_taken_seconds)}</div>
                                        <div className="text-xs text-[#8A5A66] mt-0.5">Time taken</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-2 text-xs text-[#8C8B82] bg-[#FAFAF8] border border-[#DEDCD3] px-4 py-2 w-fit mx-auto mb-8">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6B2737]" />
                            Checking for results every 8 seconds…
                        </div>

                        <Link href="/dashboard/contests"
                            className="inline-flex items-center gap-2 bg-white border border-[#DEDCD3] text-[#5B5A52] font-medium px-5 py-2.5 hover:bg-[#FAFAF8] text-sm transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to contests
                        </Link>
                    </div>
                ) : (
                    /* ── Awaiting Results Screen (for non-submitters browsing) ── */
                    <div className="text-center py-10">
                        <div className="w-20 h-20 bg-[#1B1B18] flex items-center justify-center mx-auto mb-6">
                            <Lock className="w-9 h-9 text-white" />
                        </div>
                        <h1 className="font-heading text-2xl font-medium text-[#1B1B18] mb-2">Results pending</h1>
                        <p className="text-[#5B5A52] mb-2">
                            <span className="font-semibold text-[#1B1B18]">&quot;{contest?.title}&quot;</span> results haven&apos;t been published yet.
                        </p>
                        <p className="text-sm text-[#8C8B82] mb-8">
                            The admin will publish the leaderboard once all submissions are reviewed.
                            You&apos;ll be notified automatically when it goes live.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-xs text-[#8C8B82] bg-[#FAFAF8] border border-[#DEDCD3] px-4 py-2 w-fit mx-auto mb-8">
                            <Bell className="w-3.5 h-3.5 text-[#6B2737]" />
                            Auto-checking for updates…
                        </div>
                        <Link href="/dashboard/contests"
                            className="inline-flex items-center gap-2 bg-white border border-[#DEDCD3] text-[#5B5A52] font-medium px-5 py-2.5 hover:bg-[#FAFAF8] text-sm transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to contests
                        </Link>
                    </div>
                )}
            </div>
        );
    }

    // ── LEADERBOARD PUBLISHED ──────────────────────────────────────
    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <Link href="/dashboard/contests"
                    className="inline-flex items-center gap-1.5 text-[#5B5A52] hover:text-[#1B1B18] text-sm font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" /> All contests
                </Link>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#93670F] bg-[#F5EEDD] border border-[#E3CE9C] px-3 py-1.5">
                    <PartyPopper className="w-3.5 h-3.5" /> Results published
                </div>
            </div>

            <div className="mb-5">
                <h1 className="font-heading text-2xl font-medium text-[#1B1B18] flex items-center gap-2.5">
                    <Trophy className="w-5 h-5 text-[#93670F]" /> {contest?.title}
                </h1>
                <p className="text-sm text-[#5B5A52] mt-1">
                    {contest?.topic} · {results.length} participant{results.length !== 1 ? "s" : ""} submitted
                </p>
            </div>

            {/* Winner banner */}
            {results.length > 0 && (
                <div className="bg-[#F5EEDD] border border-[#93670F] p-6 mb-6 text-center">
                    <PartyPopper className="w-9 h-9 text-[#93670F] mx-auto mb-2" />
                    <h2 className="font-heading text-xl font-medium text-[#5C4508] mb-1">Contest results announced</h2>
                    <p className="text-sm text-[#93670F] mb-4">Congratulations to the top performers.</p>
                    <div className="flex items-end justify-center gap-6">
                        {results.slice(0, 3).map((r, i) => (
                            <div key={r.id} className="text-center">
                                <Crown className="w-5 h-5 text-[#93670F] mx-auto mb-1" />
                                <div className="text-sm font-semibold text-[#5C4508]">{r.profiles?.full_name ?? "Unknown"}</div>
                                <div className="text-xs text-[#93670F]">{r.score}/{r.total_questions} correct</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Podium */}
            {results.length >= 2 && (
                <div className="bg-[#FAFAF8] border border-[#DEDCD3] p-5 mb-6">
                    <div className="text-center text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-4">
                        Top {Math.min(3, results.length)}
                    </div>
                    <Podium results={results.slice(0, 3)} />
                </div>
            )}

            {/* My result */}
            {myResult && (
                <div className="bg-[#F3E7E9] border border-[#6B2737] p-4 mb-5 flex items-center gap-4">
                    <div className="font-heading text-2xl font-medium text-[#6B2737] w-14 text-center">
                        #{myResult.rank}
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-semibold text-[#6B2737]">Your result</div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[#6B2737]">
                            <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {myResult.score}/{myResult.total_questions}</span>
                            <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {Number(myResult.accuracy).toFixed(1)}%</span>
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatTime(myResult.time_taken_seconds)}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-heading text-2xl font-medium text-[#6B2737]">{Number(myResult.accuracy).toFixed(0)}%</div>
                        <div className="text-xs text-[#8A5A66]">accuracy</div>
                    </div>
                </div>
            )}

            {/* Full results table */}
            <div className="bg-white border border-[#DEDCD3] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#EAE8E1] flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest">All results</h2>
                </div>
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 bg-[#FAFAF8] border-b border-[#EAE8E1] text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
                    <div className="w-10">Rank</div><div>Participant</div>
                    <div className="text-right">Score</div><div className="text-right hidden sm:block">Accuracy</div><div className="text-right">Time</div>
                </div>
                {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Swords className="w-12 h-12 text-[#DEDCD3] mb-3" />
                        <p className="text-[#8C8B82] text-sm">No results yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#EAE8E1]">
                        {results.map((r) => {
                            const isMe = r.user_id === userId;
                            const rankN = r.rank ?? 0;
                            return (
                                <div key={r.id}
                                    className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-4 items-center ${isMe ? "bg-[#F3E7E9] border-l-2 border-l-[#6B2737]" : "hover:bg-[#FAFAF8]"}`}>
                                    <div className="w-10 flex items-center justify-center text-sm font-semibold text-[#8C8B82]">
                                        #{rankN}
                                    </div>
                                    <div className="min-w-0 flex items-center gap-3">
                                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                                            style={{ backgroundColor: isMe ? "#6B2737" : "#8C8B82" }}>
                                            {(r.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                                        </div>
                                        <div className={`text-sm font-semibold truncate ${isMe ? "text-[#6B2737]" : "text-[#1B1B18]"}`}>
                                            {r.profiles?.full_name ?? "Unknown"}
                                            {isMe && <span className="ml-1.5 text-[10px] font-semibold text-[#6B2737] bg-[#DCC0C6] px-1.5 py-0.5">you</span>}
                                        </div>
                                    </div>
                                    <div className={`text-sm font-semibold text-right ${isMe ? "text-[#6B2737]" : "text-[#1B1B18]"}`}>
                                        {r.score}<span className="text-[#8C8B82] text-xs font-normal">/{r.total_questions}</span>
                                    </div>
                                    <div className={`text-sm font-semibold text-right hidden sm:block ${Number(r.accuracy) >= 70 ? "text-[#2F6B3A]" : "text-[#93670F]"}`}>
                                        {Number(r.accuracy).toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-[#5B5A52] text-right">{formatTime(r.time_taken_seconds)}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
                <Link href="/dashboard/contests"
                    className="flex items-center gap-2 bg-white border border-[#DEDCD3] text-[#5B5A52] font-medium px-5 py-2.5 hover:bg-[#FAFAF8] text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4" /> All contests
                </Link>
                <Link href="/dashboard/generate"
                    className="flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium px-5 py-2.5 text-sm transition-colors">
                    <Zap className="w-4 h-4" /> Practice quiz
                </Link>
            </div>
        </div>
    );
}

export default function ContestLeaderboardPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-32 text-[#8C8B82]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading leaderboard…
            </div>
        }>
            <LeaderboardContent />
        </Suspense>
    );
}