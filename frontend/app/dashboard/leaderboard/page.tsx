"use client";
import { useEffect, useState, useCallback } from "react";
import {
    Trophy, Loader2, ChevronDown, ChevronUp, Clock, Target,
    CheckCircle, Flame, Medal, Swords, BookOpen, XCircle,
    BarChart2, ChevronRight
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest, ContestResult, ContestQuestion } from "@/app/admin/contests/types";

function pad(n: number) { return String(n).padStart(2, "0"); }
function formatTime(secs: number) { const m = Math.floor(secs / 60); return `${m}m ${pad(secs % 60)}s`; }
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const COLORS = ["#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899"];

// ── Types ─────────────────────────────────────────────────────────
interface ContestWithResults extends Contest {
    results: (ContestResult & { profiles?: { full_name: string | null; email: string | null } })[];
}

interface AnswerRecord {
    question_id: string;
    selected_answer: string;
    is_correct: boolean;
}

// ── My Answers Review Panel ───────────────────────────────────────
function MyAnswersPanel({
    contest,
    userId,
}: {
    contest: ContestWithResults;
    userId: string | null;
}) {
    const [answers, setAnswers] = useState<AnswerRecord[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedQ, setExpandedQ] = useState<number | null>(null);

    const questions: ContestQuestion[] = (contest.question_set ?? []) as ContestQuestion[];
    const myResult = contest.results.find(r => r.user_id === userId);

    useEffect(() => {
        if (!userId) { setLoading(false); return; }
        const fetch = async () => {
            setLoading(true);
            const supabase = createClient();
            const { data } = await supabase
                .from("contest_answers")
                .select("question_id, selected_answer, is_correct")
                .eq("contest_id", contest.id)
                .eq("user_id", userId);
            setAnswers((data ?? []) as AnswerRecord[]);
            setLoading(false);
        };
        fetch();
    }, [contest.id, userId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10 text-[#9CA3AF]">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading your answers…
            </div>
        );
    }

    if (!myResult) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center text-[#9CA3AF]">
                <BookOpen className="w-8 h-8 mb-2 text-[#E5E7EB]" />
                <p className="text-sm">You didn&apos;t participate in this contest.</p>
            </div>
        );
    }

    if (!answers || answers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center text-[#9CA3AF]">
                <BookOpen className="w-8 h-8 mb-2 text-[#E5E7EB]" />
                <p className="text-sm">No answer records found for this contest.</p>
            </div>
        );
    }

    const answerMap: Record<string, AnswerRecord> = {};
    answers.forEach(a => { answerMap[a.question_id] = a; });

    const correctCount = answers.filter(a => a.is_correct).length;

    return (
        <div className="px-6 py-4">
            {/* Score summary */}
            <div className="flex items-center gap-4 mb-5 bg-[#F9FAFB] rounded-xl p-4">
                <div className="text-center px-4 border-r border-[#E5E7EB]">
                    <div className="text-2xl font-black text-[#6366F1]">{correctCount}/{questions.length}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">Correct</div>
                </div>
                <div className="text-center px-4 border-r border-[#E5E7EB]">
                    <div className="text-2xl font-black text-[#10B981]">{Number(myResult.accuracy).toFixed(0)}%</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">Accuracy</div>
                </div>
                <div className="text-center px-4">
                    <div className="text-2xl font-black text-[#F59E0B]">{formatTime(myResult.time_taken_seconds)}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">Time Taken</div>
                </div>
                {/* Result bar */}
                <div className="flex-1 hidden sm:flex gap-1 items-center">
                    {answers.map((a, i) => (
                        <div key={i} className={`flex-1 h-3 rounded-full ${a.is_correct ? "bg-[#10B981]" : "bg-[#EF4444]"}`} title={`Q${i + 1}: ${a.is_correct ? "Correct" : "Wrong"}`} />
                    ))}
                </div>
            </div>

            {/* Per-question list */}
            <div className="space-y-2">
                {questions.map((q, qi) => {
                    const ans = answerMap[q.id];
                    const isCorrect = ans?.is_correct ?? false;
                    const skipped = !ans || ans.selected_answer === "";
                    const isOpen = expandedQ === qi;

                    return (
                        <div key={q.id} className={`rounded-xl border overflow-hidden transition-all ${isCorrect ? "border-[#6EE7B7] bg-[#F0FDF4]" : skipped ? "border-[#E5E7EB] bg-[#FAFAFA]" : "border-[#FECACA] bg-[#FFF5F5]"}`}>
                            {/* Question row */}
                            <button
                                onClick={() => setExpandedQ(isOpen ? null : qi)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity">
                                {/* Status icon */}
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isCorrect ? "bg-[#10B981] text-white" : skipped ? "bg-[#9CA3AF] text-white" : "bg-[#EF4444] text-white"}`}>
                                    {isCorrect ? <CheckCircle className="w-3.5 h-3.5" /> : skipped ? <span className="text-[10px] font-black">—</span> : <XCircle className="w-3.5 h-3.5" />}
                                </div>
                                {/* Q label */}
                                <span className="text-xs font-black text-[#9CA3AF] flex-shrink-0 w-6">Q{qi + 1}</span>
                                {/* Question text preview */}
                                <span className={`flex-1 text-sm font-medium line-clamp-1 ${isCorrect ? "text-[#065F46]" : skipped ? "text-[#6B7280]" : "text-[#7F1D1D]"}`}>
                                    {q.question}
                                </span>
                                {/* Your answer preview */}
                                {!isOpen && (
                                    <span className={`text-xs font-semibold flex-shrink-0 max-w-[160px] truncate ${isCorrect ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                                        {skipped ? "Skipped" : ans.selected_answer}
                                    </span>
                                )}
                                <ChevronRight className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            </button>

                            {/* Expanded detail */}
                            {isOpen && (
                                <div className="px-4 pb-4 border-t border-[#E5E7EB]/60">
                                    {/* Full question */}
                                    <p className="text-sm font-semibold text-[#374151] mt-3 mb-3 leading-relaxed">{q.question}</p>

                                    {/* Options grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                        {q.options.map((opt, oi) => {
                                            const isCorrectOpt = oi === q.correctIndex;
                                            const isChosen = ans?.selected_answer === opt;
                                            let cls = "border border-[#E5E7EB] bg-white text-[#374151]";
                                            if (isCorrectOpt) cls = "border-2 border-[#10B981] bg-[#F0FDF4] text-[#065F46] font-bold";
                                            else if (isChosen && !isCorrectOpt) cls = "border-2 border-[#EF4444] bg-[#FFF5F5] text-[#7F1D1D] line-through";
                                            return (
                                                <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${cls}`}>
                                                    <span className="text-xs font-black text-[#9CA3AF] flex-shrink-0">
                                                        {["A", "B", "C", "D"][oi]}
                                                    </span>
                                                    <span className="flex-1">{opt}</span>
                                                    {isCorrectOpt && <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />}
                                                    {isChosen && !isCorrectOpt && <XCircle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Result label */}
                                    <div className={`flex items-center gap-2 text-xs font-bold mb-2 ${isCorrect ? "text-[#10B981]" : skipped ? "text-[#9CA3AF]" : "text-[#EF4444]"}`}>
                                        {isCorrect ? <><CheckCircle className="w-3.5 h-3.5" /> Correct!</>
                                            : skipped ? <>— Skipped</>
                                                : <><XCircle className="w-3.5 h-3.5" /> Incorrect — correct answer: <span className="text-[#065F46]">{q.options[q.correctIndex]}</span></>}
                                    </div>

                                    {/* Explanation */}
                                    {q.explanation && (
                                        <div className="text-xs text-[#6B7280] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2 leading-relaxed">
                                            💡 <strong>Explanation:</strong> {q.explanation}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Contest card with expandable leaderboard + review ─────────────
function ContestLeaderboardCard({
    contest, userId,
}: { contest: ContestWithResults; userId: string | null }) {
    const [open, setOpen] = useState(false);
    const [subTab, setSubTab] = useState<"rankings" | "review">("rankings");
    const results = contest.results;
    const myResult = results.find(r => r.user_id === userId);
    const myRank = myResult ? results.findIndex(r => r.user_id === userId) + 1 : null;
    const participated = Boolean(myResult);

    return (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            {/* Card header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-[#FAFAFA] transition-colors text-left">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="text-base font-black text-[#111827]">{contest.title}</div>
                        <div className="text-xs text-[#9CA3AF] mt-0.5 flex items-center gap-2">
                            <span className="capitalize">{contest.topic}</span>
                            <span>·</span>
                            <span>{results.length} participant{results.length !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>{formatDate(contest.announced_at!)}</span>
                            {participated && (
                                <span className="ml-1 text-[#6366F1] font-bold">· You participated</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                    {myRank !== null && (
                        <div className={`text-center px-3 py-1.5 rounded-xl ${myRank <= 3 ? "bg-[#FEF3C7] border border-[#FCD34D]" : "bg-[#EEF2FF]"}`}>
                            <div className="text-lg font-black text-[#6366F1]">
                                {myRank <= 3 ? MEDAL_EMOJI[myRank - 1] : `#${myRank}`}
                            </div>
                            <div className="text-[10px] text-[#9CA3AF] font-bold">your rank</div>
                        </div>
                    )}
                    <div className="hidden sm:flex items-center gap-1">
                        {results.slice(0, 3).map((r, i) => (
                            <div key={r.id} className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: COLORS[i] }}>
                                {(r.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                            </div>
                        ))}
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                </div>
            </button>

            {/* Expanded content */}
            {open && (
                <div className="border-t border-[#F3F4F6]">
                    {/* Sub-tabs */}
                    <div className="flex gap-1 p-3 border-b border-[#F3F4F6] bg-[#F9FAFB]">
                        <button
                            onClick={() => setSubTab("rankings")}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subTab === "rankings" ? "bg-white text-[#6366F1] shadow-sm border border-[#E5E7EB]" : "text-[#9CA3AF] hover:text-[#6B7280]"}`}>
                            <BarChart2 className="w-3.5 h-3.5" /> Rankings
                        </button>
                        <button
                            onClick={() => setSubTab("review")}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${subTab === "review" ? "bg-white text-[#6366F1] shadow-sm border border-[#E5E7EB]" : "text-[#9CA3AF] hover:text-[#6B7280]"}`}>
                            <BookOpen className="w-3.5 h-3.5" /> My Answers
                        </button>
                    </div>

                    {/* Rankings tab */}
                    {subTab === "rankings" && (
                        <>
                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-6 py-3 bg-[#F9FAFB] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                                <div className="w-10">Rank</div>
                                <div>Participant</div>
                                <div className="text-right">Score</div>
                                <div className="text-right hidden sm:block">Accuracy</div>
                                <div className="text-right">Time</div>
                            </div>
                            <div className="divide-y divide-[#F9FAFB]">
                                {results.map((r, idx) => {
                                    const rank = idx + 1;
                                    const isMe = r.user_id === userId;
                                    return (
                                        <div key={r.id}
                                            className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-6 py-3.5 items-center ${isMe ? "bg-[#EEF2FF] border-l-4 border-l-[#6366F1]" : "hover:bg-[#FAFAFA]"}`}>
                                            <div className="w-10 text-center text-lg font-black">
                                                {rank <= 3 ? MEDAL_EMOJI[rank - 1] : <span className="text-sm text-[#9CA3AF]">#{rank}</span>}
                                            </div>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                                    style={{ backgroundColor: isMe ? "#6366F1" : COLORS[rank % COLORS.length] }}>
                                                    {(r.profiles?.full_name ?? "?")[0]?.toUpperCase()}
                                                </div>
                                                <div className={`text-sm font-bold truncate ${isMe ? "text-[#6366F1]" : "text-[#111827]"}`}>
                                                    {r.profiles?.full_name ?? "Unknown"}
                                                    {isMe && <span className="ml-1.5 text-[10px] font-black bg-[#C7D2FE] text-[#6366F1] px-1.5 py-0.5 rounded-full">you</span>}
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
                        </>
                    )}

                    {/* My Answers tab */}
                    {subTab === "review" && (
                        <MyAnswersPanel contest={contest} userId={userId} />
                    )}
                </div>
            )}
        </div>
    );
}

// ── Weekly aggregate ──────────────────────────────────────────────
interface WeeklyEntry {
    user_id: string;
    name: string;
    totalScore: number;
    totalContests: number;
    avgAccuracy: number;
}

// ── Main Leaderboard page ─────────────────────────────────────────
export default function LeaderboardPage() {
    const [contests, setContests] = useState<ContestWithResults[]>([]);
    const [weekly, setWeekly] = useState<WeeklyEntry[]>([]);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (user) setMyUserId(user.id);

        // Fetch all contests with published leaderboards
        const { data: contestsRaw } = await supabase
            .from("contests")
            .select("*")
            .not("announced_at", "is", null)
            .order("announced_at", { ascending: false });

        if (!contestsRaw || contestsRaw.length === 0) {
            setContests([]); setWeekly([]); setLoading(false);
            return;
        }

        const contestIds = contestsRaw.map(c => c.id);

        // Fetch all results for those contests
        const { data: allResRaw } = await supabase
            .from("contest_results")
            .select("id, contest_id, user_id, score, total_questions, accuracy, time_taken_seconds, rank, submitted_at")
            .in("contest_id", contestIds);

        // Fetch all user profiles in one shot
        const allUserIds = [...new Set((allResRaw ?? []).map(r => r.user_id))];
        const { data: profilesData } = allUserIds.length > 0
            ? await supabase.from("profiles").select("id, full_name, email").in("id", allUserIds)
            : { data: [] };

        const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
        (profilesData ?? []).forEach(pr => { profileMap[pr.id] = pr; });

        // Group results by contest and sort each group by score desc
        const resultsByContest: Record<string, ContestWithResults["results"]> = {};
        (allResRaw ?? []).forEach(r => {
            if (!resultsByContest[r.contest_id]) resultsByContest[r.contest_id] = [];
            resultsByContest[r.contest_id].push({
                ...r,
                profiles: profileMap[r.user_id] ?? { full_name: null, email: null },
            });
        });
        Object.keys(resultsByContest).forEach(cid => {
            resultsByContest[cid].sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.time_taken_seconds - b.time_taken_seconds;
            });
        });

        const merged: ContestWithResults[] = contestsRaw.map(c => ({
            ...(c as Contest),
            results: resultsByContest[c.id] ?? [],
        }));
        setContests(merged);

        // Weekly aggregate (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const weeklyResults = (allResRaw ?? []).filter(r => r.submitted_at >= weekAgo);
        const weekMap: Record<string, { scores: number[]; accuracies: number[] }> = {};
        weeklyResults.forEach(r => {
            if (!weekMap[r.user_id]) weekMap[r.user_id] = { scores: [], accuracies: [] };
            weekMap[r.user_id].scores.push(r.score);
            weekMap[r.user_id].accuracies.push(Number(r.accuracy));
        });
        const weeklyEntries: WeeklyEntry[] = Object.entries(weekMap).map(([uid, d]) => ({
            user_id: uid,
            name: profileMap[uid]?.full_name ?? "Unknown",
            totalScore: d.scores.reduce((a, b) => a + b, 0),
            totalContests: d.scores.length,
            avgAccuracy: d.accuracies.length > 0 ? d.accuracies.reduce((a, b) => a + b, 0) / d.accuracies.length : 0,
        }));
        weeklyEntries.sort((a, b) => b.totalScore - a.totalScore || b.avgAccuracy - a.avgAccuracy);
        setWeekly(weeklyEntries);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const myWeeklyRank = weekly.findIndex(e => e.user_id === myUserId) + 1;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-[#6B7280]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading leaderboard…
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up max-w-4xl mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-black text-[#111827] mb-1 flex items-center gap-2.5">
                        <Trophy className="w-6 h-6 text-[#F59E0B]" /> Leaderboard
                    </h1>
                    <p className="text-sm text-[#6B7280]">
                        All published contest results · Click any contest to view rankings and review your answers.
                    </p>
                </div>
                {myWeeklyRank > 0 && (
                    <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl px-4 py-2 text-sm text-[#6B7280]">
                        Weekly rank: <strong className="text-[#6366F1]">#{myWeeklyRank}</strong>
                    </div>
                )}
            </div>

            {/* Section 1: Contest Results */}
            <div className="mb-10">
                <h2 className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Medal className="w-4 h-4 text-[#6366F1]" /> Contest Results
                    <span className="text-[#D1D5DB] font-normal normal-case tracking-normal">
                        — expand a contest to see rankings &amp; your answer review
                    </span>
                </h2>

                {contests.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center py-20 text-center">
                        <Swords className="w-12 h-12 text-[#E5E7EB] mb-3" />
                        <p className="text-[#9CA3AF] font-semibold mb-1">No results published yet</p>
                        <p className="text-sm text-[#D1D5DB]">Once the admin publishes a contest leaderboard, it will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {contests.map(c => (
                            <ContestLeaderboardCard key={c.id} contest={c} userId={myUserId} />
                        ))}
                    </div>
                )}
            </div>

            {/* Section 2: Weekly Top */}
            <div>
                <h2 className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#F59E0B]" /> Top This Week (All Contests)
                </h2>

                {weekly.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center py-14 text-center">
                        <Trophy className="w-10 h-10 text-[#E5E7EB] mb-3" />
                        <p className="text-sm text-[#9CA3AF]">No contest activity in the past 7 days.</p>
                    </div>
                ) : (
                    <>
                        {/* Top 3 podium */}
                        {weekly.length >= 2 && (
                            <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] rounded-2xl border border-[#E0E7FF] p-6 mb-4">
                                <div className="text-center text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-5">🏆 Top 3 This Week</div>
                                <div className="flex items-end justify-center gap-5">
                                    {weekly[1] && (
                                        <div className="text-center flex-1 max-w-[120px]">
                                            <div className="w-12 h-12 rounded-xl bg-[#8B5CF6] flex items-center justify-center text-white text-lg font-black mb-1 mx-auto">
                                                {weekly[1].name[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-xs font-bold text-[#374151] truncate">{weekly[1].name}</div>
                                            <div className="text-[10px] text-[#9CA3AF]">{weekly[1].totalScore} pts</div>
                                            <div className="h-14 bg-[#DDD6FE] rounded-t-lg w-12 mx-auto mt-1 flex items-end justify-center pb-1"><span className="text-xl">🥈</span></div>
                                        </div>
                                    )}
                                    <div className="text-center flex-1 max-w-[130px]">
                                        <div className="w-16 h-16 rounded-xl bg-[#6366F1] flex items-center justify-center text-white text-2xl font-black mb-1 mx-auto shadow-lg shadow-[#6366F1]/30">
                                            {weekly[0].name[0]?.toUpperCase()}
                                        </div>
                                        <div className="text-sm font-black text-[#374151] truncate">{weekly[0].name}</div>
                                        <div className="text-xs text-[#6366F1] font-semibold">{weekly[0].totalScore} pts</div>
                                        <div className="h-20 bg-[#6366F1] rounded-t-lg w-16 mx-auto mt-1 flex items-end justify-center pb-1"><span className="text-2xl">🥇</span></div>
                                    </div>
                                    {weekly[2] && (
                                        <div className="text-center flex-1 max-w-[120px]">
                                            <div className="w-12 h-12 rounded-xl bg-[#10B981] flex items-center justify-center text-white text-lg font-black mb-1 mx-auto">
                                                {weekly[2].name[0]?.toUpperCase()}
                                            </div>
                                            <div className="text-xs font-bold text-[#374151] truncate">{weekly[2].name}</div>
                                            <div className="text-[10px] text-[#9CA3AF]">{weekly[2].totalScore} pts</div>
                                            <div className="h-10 bg-[#A7F3D0] rounded-t-lg w-12 mx-auto mt-1 flex items-end justify-center pb-1"><span className="text-xl">🥉</span></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Full table */}
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-[#F3F4F6] text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                                <div className="w-10">Rank</div>
                                <div>Participant</div>
                                <div className="text-right">Contests</div>
                                <div className="text-right hidden sm:block">Avg Accuracy</div>
                                <div className="text-right">Total Score</div>
                            </div>
                            <div className="divide-y divide-[#F9FAFB]">
                                {weekly.map((entry, idx) => {
                                    const rank = idx + 1;
                                    const isMe = entry.user_id === myUserId;
                                    return (
                                        <div key={entry.user_id}
                                            className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-6 py-4 items-center ${isMe ? "bg-[#EEF2FF] border-l-4 border-l-[#6366F1]" : "hover:bg-[#FAFAFA]"}`}>
                                            <div className="w-10 text-center text-lg font-black">
                                                {rank <= 3 ? MEDAL_EMOJI[rank - 1] : <span className="text-sm text-[#9CA3AF]">#{rank}</span>}
                                            </div>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                                                    style={{ backgroundColor: isMe ? "#6366F1" : COLORS[rank % COLORS.length] }}>
                                                    {entry.name[0]?.toUpperCase()}
                                                </div>
                                                <div className={`text-sm font-bold truncate ${isMe ? "text-[#6366F1]" : "text-[#111827]"}`}>
                                                    {entry.name}
                                                    {isMe && <span className="ml-1.5 text-[10px] font-black bg-[#C7D2FE] text-[#6366F1] px-1.5 py-0.5 rounded-full">you</span>}
                                                </div>
                                            </div>
                                            <div className="text-sm text-[#6B7280] text-right flex items-center gap-1 justify-end">
                                                <Target className="w-3 h-3" /> {entry.totalContests}
                                            </div>
                                            <div className={`text-sm font-bold text-right hidden sm:flex items-center gap-1 justify-end ${entry.avgAccuracy >= 70 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                                                <CheckCircle className="w-3 h-3" /> {entry.avgAccuracy.toFixed(1)}%
                                            </div>
                                            <div className={`text-sm font-black text-right ${isMe ? "text-[#6366F1]" : "text-[#374151]"}`}>
                                                {entry.totalScore} pts
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {myWeeklyRank > 0 && (
                            <div className="mt-4 bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] border border-[#C7D2FE] rounded-2xl p-4 flex items-center gap-4">
                                <div className="text-2xl">{myWeeklyRank <= 3 ? MEDAL_EMOJI[myWeeklyRank - 1] : `#${myWeeklyRank}`}</div>
                                <div className="flex-1">
                                    <div className="text-sm font-black text-[#4338CA]">
                                        {myWeeklyRank === 1 ? "You're #1 this week! 🎉" : `You're ranked #${myWeeklyRank} this week.`}
                                    </div>
                                    <div className="text-xs text-[#818CF8] mt-0.5">
                                        {weekly[myWeeklyRank - 1]?.totalContests} contest{weekly[myWeeklyRank - 1]?.totalContests !== 1 ? "s" : ""} completed
                                        · {weekly[myWeeklyRank - 1]?.totalScore} total points
                                        · {weekly[myWeeklyRank - 1]?.avgAccuracy.toFixed(1)}% avg accuracy
                                    </div>
                                </div>
                                <Clock className="w-5 h-5 text-[#C7D2FE]" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
