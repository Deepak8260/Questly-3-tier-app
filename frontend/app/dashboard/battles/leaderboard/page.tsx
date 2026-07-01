"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Swords, ArrowLeft, Loader2, Trophy, Target, Clock, Crown, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { BattleLeaderboardEntry } from "@/app/dashboard/battles/types";

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatTime(s: number) { return `${Math.floor(s / 60)}m ${pad(s % 60)}s`; }

const MEDALS = ["🥇", "🥈", "🥉"];
const COLORS = ["#F59E0B", "#9CA3AF", "#CD7C32"];

export default function BattleLeaderboardPage() {
    const [entries, setEntries] = useState<BattleLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);

        // Fetch all battle_results joined with profiles, then aggregate client-side
        const { data: rawResults } = await supabase
            .from("battle_results")
            .select("battle_id, user_id, score, accuracy, time_taken_seconds, profiles(full_name, email)");

        // Fetch all ended battles to know winners
        const { data: rawBattles } = await supabase
            .from("quiz_battles")
            .select("id, winner, player_one, player_two")
            .eq("status", "ended");

        if (!rawResults || !rawBattles) { setLoading(false); return; }

        // Aggregate per user
        const statsMap: Record<string, {
            user_id: string;
            full_name: string | null;
            email: string | null;
            battles: Set<string>;
            wins: number;
            totalAccuracy: number;
            totalTime: number;
            resultCount: number;
        }> = {};

        // Count total battles and wins using the battles table
        for (const b of rawBattles) {
            for (const pid of [b.player_one, b.player_two].filter(Boolean)) {
                if (!statsMap[pid]) {
                    statsMap[pid] = { user_id: pid, full_name: null, email: null, battles: new Set(), wins: 0, totalAccuracy: 0, totalTime: 0, resultCount: 0 };
                }
                statsMap[pid].battles.add(b.id);
                if (b.winner === pid) statsMap[pid].wins++;
            }
        }

        // Add accuracy and time from results
        for (const r of rawResults) {
            if (!statsMap[r.user_id]) {
                statsMap[r.user_id] = { user_id: r.user_id, full_name: null, email: null, battles: new Set(), wins: 0, totalAccuracy: 0, totalTime: 0, resultCount: 0 };
            }
            const p = (r as unknown as { profiles?: { full_name: string | null; email: string | null } | null }).profiles;
            if (p) { statsMap[r.user_id].full_name = p.full_name; statsMap[r.user_id].email = p.email; }
            statsMap[r.user_id].totalAccuracy += Number(r.accuracy);
            statsMap[r.user_id].totalTime += r.time_taken_seconds;
            statsMap[r.user_id].resultCount++;
        }

        // Build ranked list  
        const list: BattleLeaderboardEntry[] = Object.values(statsMap)
            .filter(s => s.battles.size > 0)
            .map(s => ({
                user_id: s.user_id,
                full_name: s.full_name,
                email: s.email,
                total_battles: s.battles.size,
                battles_won: s.wins,
                win_rate: s.battles.size > 0 ? Math.round((s.wins / s.battles.size) * 100) : 0,
                avg_accuracy: s.resultCount > 0 ? Math.round((s.totalAccuracy / s.resultCount) * 10) / 10 : 0,
                avg_time_seconds: s.resultCount > 0 ? Math.round(s.totalTime / s.resultCount) : 0,
                rank: 0,
            }))
            .sort((a, b) => {
                // Primary: wins DESC → win_rate DESC → avg_accuracy DESC
                if (b.battles_won !== a.battles_won) return b.battles_won - a.battles_won;
                if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
                return b.avg_accuracy - a.avg_accuracy;
            })
            .map((e, i) => ({ ...e, rank: i + 1 }));

        setEntries(list);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const myEntry = entries.find(e => e.user_id === userId);
    const top3 = entries.slice(0, 3);

    return (
        <div className="animate-fade-in-up max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/dashboard/battles"
                            className="flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#111827] transition-colors font-medium">
                            <ArrowLeft className="w-4 h-4" /> Battles
                        </Link>
                        <span className="text-[#D1D5DB]">/</span>
                    </div>
                    <h1 className="text-2xl font-black text-[#111827] flex items-center gap-2.5">
                        <Swords className="w-6 h-6 text-[#6366F1]" /> Battle Rankings
                    </h1>
                    <p className="text-sm text-[#6B7280] mt-0.5">Global 1v1 battle leaderboard — ranked by wins, win rate, and accuracy</p>
                </div>
                <div className="flex items-center gap-2">
                    {myEntry && (
                        <div className="bg-[#EEF2FF] border border-[#C7D2FE] text-[#4338CA] text-sm font-bold px-4 py-2 rounded-xl">
                            Your Rank: <span className="text-[#6366F1]">#{myEntry.rank}</span>
                        </div>
                    )}
                    <button onClick={load} disabled={loading} className="p-2.5 border border-[#E5E7EB] bg-white text-[#6B7280] rounded-xl hover:bg-[#F9FAFB] transition-all">
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24 text-[#6B7280]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading rankings…
                </div>
            ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Swords className="w-16 h-16 text-[#E5E7EB] mb-4" />
                    <h2 className="text-xl font-black text-[#374151] mb-2">No battles yet</h2>
                    <p className="text-[#9CA3AF] text-sm mb-5">Be the first to battle and claim the top spot!</p>
                    <Link href="/dashboard/battles"
                        className="flex items-center gap-2 bg-[#6366F1] text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-[#4F46E5] transition-all">
                        <Swords className="w-4 h-4" /> Start Battling
                    </Link>
                </div>
            ) : (
                <>
                    {/* Podium top 3 */}
                    {top3.length >= 2 && (
                        <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] rounded-2xl border border-[#E0E7FF] p-6 mb-6">
                            <div className="text-center text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-5">⚔️ Top Challengers</div>
                            <div className="flex items-end justify-center gap-5">
                                {/* 2nd, 1st, 3rd visual order */}
                                {[top3[1], top3[0], top3[2]].filter(Boolean).map((e) => {
                                    const ri = (e.rank ?? 1) - 1;
                                    const isFirst = e.rank === 1;
                                    return (
                                        <div key={e.user_id} className="text-center flex-1 max-w-[140px]">
                                            <div className={`rounded-full flex items-center justify-center text-white font-black mx-auto mb-1 border-4 border-white shadow-lg
                        ${isFirst ? "w-16 h-16 text-xl" : "w-12 h-12 text-base"}`}
                                                style={{ backgroundColor: ["#6366F1", "#8B5CF6", "#10B981"][ri] ?? "#8B5CF6" }}>
                                                {(e.full_name ?? e.email ?? "?")[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-xs font-bold text-[#374151] truncate">{e.full_name ?? e.email ?? "Unknown"}</div>
                                            <div className="text-[10px] text-[#9CA3AF]">{e.battles_won}W · {e.win_rate}%</div>
                                            <div className="rounded-t-xl w-full mx-auto mt-1 flex items-end justify-center pb-1"
                                                style={{ height: `${isFirst ? 80 : ri === 1 ? 56 : 40}px`, backgroundColor: `${COLORS[ri]}22`, border: `1px solid ${COLORS[ri]}44` }}>
                                                <span className="text-xl">{MEDALS[ri]}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Your entry highlight */}
                    {myEntry && myEntry.rank > 3 && (
                        <div className="bg-[#EEF2FF] border-2 border-[#6366F1] rounded-2xl p-4 mb-5 flex items-center gap-4">
                            <div className="text-2xl font-black text-[#6366F1] w-12 text-center">#{myEntry.rank}</div>
                            <div className="flex-1">
                                <div className="text-sm font-black text-[#4338CA]">Your Standing</div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-[#6366F1]">
                                    <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {myEntry.battles_won}W / {myEntry.total_battles}</span>
                                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {myEntry.win_rate}% WR</span>
                                    <span className="flex items-center gap-1"><Crown className="w-3.5 h-3.5" /> {myEntry.avg_accuracy}% acc</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Full table */}
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-3 bg-[#F9FAFB] border-b border-[#F3F4F6] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                            <div className="w-10">Rank</div>
                            <div>Player</div>
                            <div className="text-right">Battles</div>
                            <div className="text-right">Win Rate</div>
                            <div className="text-right hidden sm:block">Avg Acc</div>
                            <div className="text-right hidden sm:block">Avg Time</div>
                        </div>

                        <div className="divide-y divide-[#F9FAFB]">
                            {entries.map(e => {
                                const isMe = e.user_id === userId;
                                const isTop3 = (e.rank ?? 99) <= 3;
                                const ri = (e.rank ?? 99) - 1;
                                const displayName = e.full_name ?? e.email ?? "Unknown";
                                return (
                                    <div key={e.user_id}
                                        className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-4 items-center transition-all
                      ${isMe ? "bg-[#EEF2FF] border-l-4 border-l-[#6366F1]" : "hover:bg-[#FAFAFA]"}`}>
                                        <div className="w-10 flex items-center justify-center text-lg font-black">
                                            {isTop3 ? <span>{MEDALS[ri]}</span> : <span className="text-sm text-[#9CA3AF]">#{e.rank}</span>}
                                        </div>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                                style={{ backgroundColor: isMe ? "#6366F1" : ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"][ri % 5] }}>
                                                {displayName[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`text-sm font-bold truncate ${isMe ? "text-[#6366F1]" : "text-[#111827]"}`}>
                                                    {displayName}
                                                    {isMe && <span className="ml-1.5 text-[10px] font-black text-[#6366F1] bg-[#C7D2FE] px-1.5 py-0.5 rounded-full">you</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-[#111827]">{e.battles_won}<span className="text-xs text-[#9CA3AF] font-normal">/{e.total_battles}</span></div>
                                            <div className="text-[10px] text-[#9CA3AF]">W/T</div>
                                        </div>
                                        <div className={`text-right text-sm font-bold ${e.win_rate >= 60 ? "text-[#10B981]" : e.win_rate >= 40 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>
                                            {e.win_rate}%
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm text-[#6B7280]">{e.avg_accuracy.toFixed(1)}%</div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm text-[#6B7280]">{formatTime(e.avg_time_seconds)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
