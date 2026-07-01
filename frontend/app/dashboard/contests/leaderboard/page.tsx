"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trophy, Target, Clock, Swords, RefreshCw, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface ContestStat {
    user_id: string;
    full_name: string | null;
    email: string | null;
    contests_participated: number;
    contests_won: number;
    win_rate: number;
    avg_accuracy: number;
    avg_time_seconds: number;
    rank: number;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatTime(s: number) { return `${Math.floor(s / 60)}m ${pad(s % 60)}s`; }

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GlobalContestLeaderboardPage() {
    const [stats, setStats] = useState<ContestStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);

        // Fetch all contest results with profiles
        const { data: rawResults } = await supabase
            .from("contest_results")
            .select("contest_id, user_id, score, accuracy, time_taken_seconds, rank, profiles(full_name, email)");

        if (!rawResults) { setLoading(false); return; }

        // Aggregate per user
        const statsMap: Record<string, {
            user_id: string;
            full_name: string | null;
            email: string | null;
            contests: Set<string>;
            wins: number;
            totalAccuracy: number;
            totalTime: number;
        }> = {};

        for (const r of rawResults) {
            if (!statsMap[r.user_id]) {
                statsMap[r.user_id] = {
                    user_id: r.user_id,
                    full_name: null,
                    email: null,
                    contests: new Set(),
                    wins: 0,
                    totalAccuracy: 0,
                    totalTime: 0,
                };
            }
            const p = (r as unknown as { profiles?: { full_name: string | null; email: string | null } | null }).profiles;
            if (p) { statsMap[r.user_id].full_name = p.full_name; statsMap[r.user_id].email = p.email; }
            statsMap[r.user_id].contests.add(r.contest_id);
            if (r.rank === 1) statsMap[r.user_id].wins++;
            statsMap[r.user_id].totalAccuracy += Number(r.accuracy);
            statsMap[r.user_id].totalTime += r.time_taken_seconds;
        }

        const list: ContestStat[] = Object.values(statsMap)
            .filter(s => s.contests.size > 0)
            .map(s => ({
                user_id: s.user_id,
                full_name: s.full_name,
                email: s.email,
                contests_participated: s.contests.size,
                contests_won: s.wins,
                win_rate: s.contests.size > 0 ? Math.round((s.wins / s.contests.size) * 100) : 0,
                avg_accuracy: s.contests.size > 0 ? Math.round((s.totalAccuracy / s.contests.size) * 10) / 10 : 0,
                avg_time_seconds: s.contests.size > 0 ? Math.round(s.totalTime / s.contests.size) : 0,
                rank: 0,
            }))
            .sort((a, b) => {
                if (b.contests_won !== a.contests_won) return b.contests_won - a.contests_won;
                if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
                return b.avg_accuracy - a.avg_accuracy;
            })
            .map((e, i) => ({ ...e, rank: i + 1 }));

        setStats(list);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const myEntry = stats.find(e => e.user_id === userId);
    const top3 = stats.slice(0, 3);

    return (
        <div className="animate-fade-in-up max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/dashboard/contests"
                            className="flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#111827] transition-colors font-medium">
                            <ArrowLeft className="w-4 h-4" /> Live Contests
                        </Link>
                        <span className="text-[#D1D5DB]">/</span>
                    </div>
                    <h1 className="text-2xl font-black text-[#111827] flex items-center gap-2.5">
                        <Trophy className="w-6 h-6 text-[#F59E0B]" /> Contest Hall of Fame
                    </h1>
                    <p className="text-sm text-[#6B7280] mt-0.5">
                        All-time contest performance ranked by wins, win rate, and accuracy
                    </p>
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
            ) : stats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Trophy className="w-16 h-16 text-[#E5E7EB] mb-4" />
                    <h2 className="text-xl font-black text-[#374151] mb-2">No contest results yet</h2>
                    <p className="text-[#9CA3AF] text-sm mb-5">Participate in contests to claim your spot on the leaderboard!</p>
                    <Link href="/dashboard/contests"
                        className="flex items-center gap-2 bg-[#6366F1] text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-[#4F46E5] transition-all">
                        <Swords className="w-4 h-4" /> Browse Contests
                    </Link>
                </div>
            ) : (
                <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                            { label: "Total Players", value: stats.length, icon: <Users className="w-4 h-4" />, color: "#6366F1" },
                            { label: "Contests Held", value: [...new Set(stats.flatMap(() => []))].length || "—", icon: <Trophy className="w-4 h-4" />, color: "#F59E0B" },
                            { label: "Avg Win Rate", value: `${Math.round(stats.reduce((s, e) => s + e.win_rate, 0) / stats.length)}%`, icon: <Target className="w-4 h-4" />, color: "#10B981" },
                        ].map(s => (
                            <div key={s.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4 text-center">
                                <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
                                <div className="text-2xl font-black text-[#111827]">{s.value}</div>
                                <div className="text-xs text-[#9CA3AF]">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Podium */}
                    {top3.length >= 2 && (
                        <div className="bg-gradient-to-br from-[#FEF3C7] via-[#FFFBEB] to-[#FEF3C7] rounded-2xl border border-[#FDE68A] p-6 mb-6">
                            <div className="text-center text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-5">🏆 All-Time Champions</div>
                            <div className="flex items-end justify-center gap-5">
                                {[top3[1], top3[0], top3[2]].filter(Boolean).map((e) => {
                                    const ri = (e.rank ?? 1) - 1;
                                    const isFirst = e.rank === 1;
                                    const bgColors = ["#6366F1", "#8B5CF6", "#10B981"];
                                    const podiumColors = ["#FDE68A", "#E5E7EB", "#FED7AA"];
                                    const displayName = e.full_name ?? e.email ?? "Unknown";
                                    return (
                                        <div key={e.user_id} className="text-center flex-1 max-w-[140px]">
                                            <div className={`rounded-full flex items-center justify-center text-white font-black mx-auto mb-1 border-4 border-white shadow-lg ${isFirst ? "w-16 h-16 text-xl" : "w-12 h-12 text-base"}`}
                                                style={{ backgroundColor: bgColors[ri] ?? "#8B5CF6" }}>
                                                {displayName[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-xs font-bold text-[#374151] truncate">{displayName}</div>
                                            <div className="text-[10px] text-[#6B7280]">{e.contests_won}W · {e.win_rate}%WR</div>
                                            <div className="rounded-t-xl w-full mx-auto mt-1 flex items-end justify-center pb-1"
                                                style={{ height: `${isFirst ? 80 : ri === 1 ? 56 : 40}px`, backgroundColor: podiumColors[ri] }}>
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
                                <div className="text-sm font-black text-[#4338CA]">Your All-Time Stats</div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-[#6366F1] flex-wrap">
                                    <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {myEntry.contests_won}W / {myEntry.contests_participated} contests</span>
                                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {myEntry.win_rate}% WR</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {myEntry.avg_accuracy}% avg acc</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Full table */}
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-3 bg-[#F9FAFB] border-b border-[#F3F4F6] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                            <div className="w-10">Rank</div>
                            <div>Player</div>
                            <div className="text-right">Wins/Played</div>
                            <div className="text-right">Win Rate</div>
                            <div className="text-right hidden sm:block">Avg Acc</div>
                            <div className="text-right hidden sm:block">Avg Time</div>
                        </div>

                        <div className="divide-y divide-[#F9FAFB]">
                            {stats.map(e => {
                                const isMe = e.user_id === userId;
                                const isTop3 = (e.rank ?? 99) <= 3;
                                const ri = (e.rank ?? 99) - 1;
                                const displayName = e.full_name ?? e.email ?? "Unknown";
                                return (
                                    <div key={e.user_id}
                                        className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-4 items-center transition-all ${isMe ? "bg-[#EEF2FF] border-l-4 border-l-[#6366F1]" : "hover:bg-[#FAFAFA]"}`}>
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
                                            <div className="text-sm font-black text-[#111827]">{e.contests_won}<span className="text-xs text-[#9CA3AF] font-normal">/{e.contests_participated}</span></div>
                                            <div className="text-[10px] text-[#9CA3AF]">W/T</div>
                                        </div>
                                        <div className={`text-right text-sm font-bold ${e.win_rate >= 60 ? "text-[#10B981]" : e.win_rate >= 30 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>
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
