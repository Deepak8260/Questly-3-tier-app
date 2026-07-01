"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Trophy, Clock, Target,
    CheckCircle, Swords, Crown, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { QuizBattle, BattleResult } from "@/app/dashboard/battles/types";

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatTime(s: number) { return `${Math.floor(s / 60)}m ${pad(s % 60)}s`; }

function StatBar({ label, myVal, oppVal, higher = "better" }: {
    label: string;
    myVal: number;
    oppVal: number;
    higher?: "better" | "worse";
}) {
    const max = Math.max(myVal, oppVal, 1);
    const myPct = (myVal / max) * 100;
    const oppPct = (oppVal / max) * 100;
    const myWins = higher === "better" ? myVal >= oppVal : myVal <= oppVal;

    return (
        <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-[#6B7280] mb-1.5">
                <span className={myWins ? "text-[#6366F1]" : "text-[#9CA3AF]"}>{typeof myVal === "number" && !Number.isInteger(myVal) ? myVal.toFixed(1) : myVal}{label.includes("Accuracy") ? "%" : label.includes("Time") ? "s" : ""}</span>
                <span className="text-[#9CA3AF] font-medium">{label}</span>
                <span className={!myWins ? "text-[#EF4444]" : "text-[#9CA3AF]"}>{typeof oppVal === "number" && !Number.isInteger(oppVal) ? oppVal.toFixed(1) : oppVal}{label.includes("Accuracy") ? "%" : label.includes("Time") ? "s" : ""}</span>
            </div>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                <div className="bg-[#6366F1] rounded-full transition-all duration-700" style={{ width: `${myPct}%` }} />
                <div className="flex-1 bg-[#F3F4F6]" />
                <div className="bg-[#EF4444] rounded-full transition-all duration-700" style={{ width: `${oppPct}%` }} />
            </div>
        </div>
    );
}

export default function BattleResultsPage() {
    const { id } = useParams<{ id: string }>();
    const [battle, setBattle] = useState<QuizBattle | null>(null);
    const [results, setResults] = useState<BattleResult[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [waiting, setWaiting] = useState(false);

    const load = useCallback(async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);

        const [{ data: b }, { data: rawResults }] = await Promise.all([
            supabase.from("quiz_battles")
                .select(`*, player_one_profile:profiles!quiz_battles_player_one_fkey(full_name, email), player_two_profile:profiles!quiz_battles_player_two_fkey(full_name, email)`)
                .eq("id", id).single(),
            supabase.from("battle_results")
                .select("*, profiles(full_name, email)")
                .eq("battle_id", id),
        ]);

        if (b) setBattle(b as QuizBattle);
        setResults((rawResults as BattleResult[]) ?? []);

        // If both haven't submitted yet, wait
        if ((rawResults?.length ?? 0) < 2 && b?.status !== "ended") setWaiting(true);
        else setWaiting(false);

        setLoading(false);
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // Realtime — re-load when second player submits
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel(`battle-results-${id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "battle_results", filter: `battle_id=eq.${id}` }, () => load())
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "quiz_battles", filter: `id=eq.${id}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [id, load]);

    if (loading) return (
        <div className="flex items-center justify-center py-32 text-[#6B7280]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading results…
        </div>
    );

    if (!battle) return null;

    const isP1 = battle.player_one === userId;
    const myResult = results.find(r => r.user_id === userId);
    const oppResult = results.find(r => r.user_id !== userId);

    const myName = (isP1 ? battle.player_one_profile?.full_name : battle.player_two_profile?.full_name) ?? "You";
    const oppName = (isP1 ? battle.player_two_profile?.full_name : battle.player_one_profile?.full_name) ?? "Opponent";

    const iWon = battle.winner === userId;
    const isDraw = !battle.winner && battle.status === "ended";

    return (
        <div className="max-w-xl mx-auto animate-fade-in-up">
            <Link href="/dashboard/battles"
                className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#111827] text-sm font-medium mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> All Battles
            </Link>

            {/* Winner banner */}
            {!waiting && (
                <div className={`rounded-2xl p-6 mb-6 text-center relative overflow-hidden ${iWon
                    ? "bg-gradient-to-r from-[#FEF3C7] via-[#FDE68A] to-[#FEF3C7] border-2 border-[#FCD34D]"
                    : isDraw ? "bg-[#EEF2FF] border-2 border-[#C7D2FE]"
                        : "bg-gradient-to-r from-[#FEE2E2] to-[#FECACA] border-2 border-[#FECACA]"}`}>
                    <div className="text-5xl mb-3">
                        {iWon ? "🏆" : isDraw ? "🤝" : "💪"}
                    </div>
                    <h2 className={`text-2xl font-black mb-1 ${iWon ? "text-[#92400E]" : isDraw ? "text-[#4338CA]" : "text-[#991B1B]"}`}>
                        {iWon ? "You Won! 🎉" : isDraw ? "It's a Draw!" : "Better luck next time!"}
                    </h2>
                    <p className={`text-sm ${iWon ? "text-[#B45309]" : isDraw ? "text-[#6366F1]" : "text-[#EF4444]"}`}>
                        {iWon ? "Excellent performance — you outscored your opponent!" : isDraw ? "You both performed equally well!" : `${oppName} edged you out this time. Keep practising!`}
                    </p>
                </div>
            )}

            {/* Waiting for opponent */}
            {waiting && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 mb-6 text-center">
                    <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin mx-auto mb-3" />
                    <h2 className="text-lg font-black text-[#374151] mb-1">Waiting for opponent…</h2>
                    <p className="text-sm text-[#9CA3AF]">Your results are in! Waiting for {oppName} to finish.</p>
                    {myResult && (
                        <div className="mt-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-left">
                            <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Your Score</div>
                            <div className="flex gap-4 text-sm">
                                <span className="font-black text-[#111827]">{myResult.score}/{myResult.total_questions}</span>
                                <span className="text-[#10B981] font-bold">{Number(myResult.accuracy).toFixed(1)}%</span>
                                <span className="text-[#6B7280]">{formatTime(myResult.time_taken_seconds)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Side-by-side comparison */}
            {!waiting && myResult && oppResult && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden mb-5">
                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-5 py-4 border-b border-[#F3F4F6]">
                        <div className="text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-black mx-auto mb-1 ${iWon ? "bg-[#6366F1]" : "bg-[#9CA3AF]"}`}>
                                {myName[0]?.toUpperCase()}
                            </div>
                            <div className="text-sm font-black text-[#111827]">{myName}</div>
                            {iWon && <Crown className="w-4 h-4 text-[#F59E0B] mx-auto mt-1" />}
                        </div>
                        <div className="flex items-center text-2xl font-black text-[#E5E7EB]">VS</div>
                        <div className="text-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-black mx-auto mb-1 ${!iWon && !isDraw ? "bg-[#EF4444]" : "bg-[#9CA3AF]"}`}>
                                {oppName[0]?.toUpperCase()}
                            </div>
                            <div className="text-sm font-black text-[#111827]">{oppName}</div>
                            {!iWon && !isDraw && <Crown className="w-4 h-4 text-[#F59E0B] mx-auto mt-1" />}
                        </div>
                    </div>

                    {/* Stats comparison */}
                    <div className="px-5 py-5">
                        <StatBar label="Score" myVal={myResult.score} oppVal={oppResult.score} />
                        <StatBar label="Accuracy" myVal={Number(myResult.accuracy)} oppVal={Number(oppResult.accuracy)} />
                        <StatBar label="Time (seconds)" myVal={myResult.time_taken_seconds} oppVal={oppResult.time_taken_seconds} higher="worse" />
                    </div>

                    {/* Detailed row */}
                    <div className="px-5 pb-5">
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-center text-xs">
                            {[
                                { myV: `${myResult.score}/${myResult.total_questions}`, icon: <Target className="w-3.5 h-3.5 text-[#9CA3AF]" />, label: "Score", oppV: `${oppResult.score}/${oppResult.total_questions}` },
                                { myV: `${Number(myResult.accuracy).toFixed(1)}%`, icon: <CheckCircle className="w-3.5 h-3.5 text-[#9CA3AF]" />, label: "Accuracy", oppV: `${Number(oppResult.accuracy).toFixed(1)}%` },
                                { myV: formatTime(myResult.time_taken_seconds), icon: <Clock className="w-3.5 h-3.5 text-[#9CA3AF]" />, label: "Time", oppV: formatTime(oppResult.time_taken_seconds) },
                            ].map(row => (
                                <div key={row.label} className="bg-[#F9FAFB] rounded-xl p-3">
                                    <div className="font-black text-[#111827] mb-0.5">{row.myV}</div>
                                    <div className="flex items-center justify-center gap-1 text-[#9CA3AF]">{row.icon} {row.label}</div>
                                    <div className="font-black text-[#EF4444] mt-1">{row.oppV}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Battle info */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-5 py-4 mb-6 flex items-center gap-4 text-sm">
                <Swords className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
                <div>
                    <span className="font-bold text-[#374151]">{battle.topic}</span>
                    <span className="text-[#9CA3AF] mx-2">·</span>
                    <span className="capitalize text-[#6B7280]">{battle.difficulty}</span>
                    <span className="text-[#9CA3AF] mx-2">·</span>
                    <span className="text-[#6B7280]">{battle.questions_count} questions</span>
                </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-3">
                <Link href="/dashboard/battles"
                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-[#E5E7EB] text-[#6B7280] font-semibold px-5 py-3 rounded-xl hover:bg-[#F9FAFB] text-sm transition-all">
                    <ArrowLeft className="w-4 h-4" /> All Battles
                </Link>
                <Link href="/dashboard/battles/leaderboard"
                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-[#E5E7EB] text-[#6B7280] font-semibold px-5 py-3 rounded-xl hover:bg-[#F9FAFB] text-sm transition-all">
                    <Trophy className="w-4 h-4" /> Rankings
                </Link>
                <Link href="/dashboard/battles"
                    className="flex-1 flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold px-5 py-3 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-[#6366F1]/25">
                    <Zap className="w-4 h-4" /> Battle Again
                </Link>
            </div>
        </div>
    );
}
