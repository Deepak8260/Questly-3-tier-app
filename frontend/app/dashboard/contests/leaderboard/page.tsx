"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Trophy, Target, Clock, Swords, RefreshCw, Users, Crown } from "lucide-react";
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
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/dashboard/contests"
                            className="flex items-center gap-1 text-sm text-[#5B5A52] hover:text-[#1B1B18] transition-colors font-medium">
                            <ArrowLeft className="w-4 h-4" /> Live contests
                        </Link>
                        <span className="text-[#DEDCD3]">/</span>
                    </div>
                    <h1 className="font-heading text-2xl font-medium text-[#1B1B18] flex items-center gap-2.5">
                        <Trophy className="w-5 h-5 text-[#93670F]" /> Contest hall of fame
                    </h1>
                    <p className="text-sm text-[#5B5A52] mt-0.5">
                        All-time contest performance ranked by wins, win rate, and accuracy
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {myEntry && (
                        <div className="bg-[#F3E7E9] border border-[#DCC0C6] text-[#6B2737] text-sm font-semibold px-4 py-2">
                            Your rank: <span>#{myEntry.rank}</span>
                        </div>
                    )}
                    <button onClick={load} disabled={loading} className="p-2.5 border border-[#DEDCD3] bg-white text-[#5B5A52] hover:bg-[#FAFAF8] transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-32 text-[#8C8B82]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading rankings…
                </div>
            ) : stats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-[#DEDCD3] bg-white">
                    <Trophy className="w-14 h-14 text-[#DEDCD3] mb-4" />
                    <h2 className="font-heading text-xl font-medium text-[#3F3E38] mb-2">No contest results yet</h2>
                    <p className="text-[#8C8B82] text-sm mb-5">Participate in contests to claim your spot on the leaderboard.</p>
                    <Link href="/dashboard/contests"
                        className="flex items-center gap-2 bg-[#6B2737] text-white font-medium px-5 py-2.5 text-sm hover:bg-[#551F2C] transition-colors">
                        <Swords className="w-4 h-4" /> Browse contests
                    </Link>
                </div>
            ) : (
                <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-3 border-t border-l border-[#DEDCD3] mb-6">
                        {[
                            { label: "Total players", value: stats.length, icon: <Users className="w-4 h-4" /> },
                            { label: "Contests held", value: [...new Set(stats.flatMap(() => []))].length || "—", icon: <Trophy className="w-4 h-4" /> },
                            { label: "Avg win rate", value: `${Math.round(stats.reduce((s, e) => s + e.win_rate, 0) / stats.length)}%`, icon: <Target className="w-4 h-4" /> },
                        ].map(s => (
                            <div key={s.label} className="bg-white border-r border-b border-[#DEDCD3] p-4 text-center">
                                <div className="flex justify-center mb-1 text-[#6B2737]">{s.icon}</div>
                                <div className="font-heading text-2xl font-medium text-[#1B1B18]">{s.value}</div>
                                <div className="text-xs text-[#8C8B82]">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Podium */}
                    {top3.length >= 2 && (
                        <div className="bg-[#F5EEDD] border border-[#E3CE9C] p-6 mb-6">
                            <div className="text-center text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-5">All-time champions</div>
                            <div className="flex items-end justify-center gap-5">
                                {[top3[1], top3[0], top3[2]].filter(Boolean).map((e) => {
                                    const ri = (e.rank ?? 1) - 1;
                                    const isFirst = e.rank === 1;
                                    const bgColors = ["#3F3E38", "#6B2737", "#93670F"];
                                    const podiumColors = ["#EDECE6", "#F3E7E9", "#F5EEDD"];
                                    const displayName = e.full_name ?? e.email ?? "Unknown";
                                    return (
                                        <div key={e.user_id} className="text-center flex-1 max-w-[140px]">
                                            <div className={`flex items-center justify-center text-white font-semibold mx-auto mb-1 border-2 border-white ${isFirst ? "w-16 h-16 text-xl" : "w-12 h-12 text-base"}`}
                                                style={{ backgroundColor: bgColors[ri] ?? "#6B2737" }}>
                                                {displayName[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-xs font-semibold text-[#3F3E38] truncate">{displayName}</div>
                                            <div className="text-[10px] text-[#5B5A52]">{e.contests_won}W · {e.win_rate}%WR</div>
                                            <div className="w-full mx-auto mt-1 flex items-end justify-center pb-1"
                                                style={{ height: `${isFirst ? 80 : ri === 1 ? 56 : 40}px`, backgroundColor: podiumColors[ri] }}>
                                                <Crown className="w-5 h-5 text-[#6B2737]" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Your entry highlight */}
                    {myEntry && myEntry.rank > 3 && (
                        <div className="bg-[#F3E7E9] border border-[#6B2737] p-4 mb-5 flex items-center gap-4">
                            <div className="font-heading text-2xl font-medium text-[#6B2737] w-14 text-center">#{myEntry.rank}</div>
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-[#6B2737]">Your all-time stats</div>
                                <div className="flex items-center gap-4 mt-1 text-sm text-[#6B2737] flex-wrap">
                                    <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> {myEntry.contests_won}W / {myEntry.contests_participated} contests</span>
                                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {myEntry.win_rate}% WR</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {myEntry.avg_accuracy}% avg acc</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Full table */}
                    <div className="bg-white border border-[#DEDCD3] overflow-hidden">
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-3 bg-[#FAFAF8] border-b border-[#EAE8E1] text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
                            <div className="w-10">Rank</div>
                            <div>Player</div>
                            <div className="text-right">Wins/Played</div>
                            <div className="text-right">Win rate</div>
                            <div className="text-right hidden sm:block">Avg acc</div>
                            <div className="text-right hidden sm:block">Avg time</div>
                        </div>

                        <div className="divide-y divide-[#EAE8E1]">
                            {stats.map(e => {
                                const isMe = e.user_id === userId;
                                const displayName = e.full_name ?? e.email ?? "Unknown";
                                return (
                                    <div key={e.user_id}
                                        className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-4 items-center transition-colors ${isMe ? "bg-[#F3E7E9] border-l-2 border-l-[#6B2737]" : "hover:bg-[#FAFAF8]"}`}>
                                        <div className="w-10 flex items-center justify-center text-sm font-semibold text-[#8C8B82]">
                                            #{e.rank}
                                        </div>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold"
                                                style={{ backgroundColor: isMe ? "#6B2737" : "#8C8B82" }}>
                                                {displayName[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`text-sm font-semibold truncate ${isMe ? "text-[#6B2737]" : "text-[#1B1B18]"}`}>
                                                    {displayName}
                                                    {isMe && <span className="ml-1.5 text-[10px] font-semibold text-[#6B2737] bg-[#DCC0C6] px-1.5 py-0.5">you</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-[#1B1B18]">{e.contests_won}<span className="text-xs text-[#8C8B82] font-normal">/{e.contests_participated}</span></div>
                                            <div className="text-[10px] text-[#8C8B82]">W/T</div>
                                        </div>
                                        <div className={`text-right text-sm font-semibold ${e.win_rate >= 60 ? "text-[#2F6B3A]" : e.win_rate >= 30 ? "text-[#93670F]" : "text-[#8C2E24]"}`}>
                                            {e.win_rate}%
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm text-[#5B5A52]">{e.avg_accuracy.toFixed(1)}%</div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm text-[#5B5A52]">{formatTime(e.avg_time_seconds)}</div>
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