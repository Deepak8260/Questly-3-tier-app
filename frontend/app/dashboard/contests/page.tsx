"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Swords, Clock, Users, Zap, CheckCircle, Loader2,
    Calendar, Filter, AlertCircle, X, BookOpen, Trophy, ArrowRight
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest, ContestDifficulty } from "@/app/admin/contests/types";

// Helper: time until / since a date
function countdown(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return "Started";
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

const DIFF_STYLE: Record<ContestDifficulty, { bg: string; text: string; label: string }> = {
    easy: { bg: "#D1FAE5", text: "#065F46", label: "🟢 Easy" },
    medium: { bg: "#FEF3C7", text: "#92400E", label: "🟡 Medium" },
    hard: { bg: "#FEE2E2", text: "#991B1B", label: "🔴 Hard" },
};

// ── Enroll Confirmation Modal ────────────────────────────────────
function EnrollModal({
    contest, onConfirm, onCancel, loading,
}: {
    contest: Contest;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#E5E7EB] animate-fade-in-up">
                <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] px-6 py-5 border-b border-[#E5E7EB]">
                    <div className="text-3xl mb-2">🏆</div>
                    <h2 className="text-lg font-black text-[#111827]">Enroll in Contest?</h2>
                    <p className="text-sm text-[#6B7280] mt-0.5">{contest.title}</p>
                </div>
                <div className="px-6 py-5 space-y-3">
                    <div className="text-sm font-bold text-[#374151] mb-1">Contest Rules</div>
                    <ul className="space-y-2 text-sm text-[#6B7280]">
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> You must be present at the scheduled start time</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> Once you start the quiz, you cannot pause it</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> You can only submit answers once — no re-attempts</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> The quiz auto-submits when the timer runs out</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> Rankings: highest score wins; ties broken by fastest time, then name</li>
                    </ul>
                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-[#9CA3AF]">Duration</span><br /><strong className="text-[#111827]">{contest.duration_minutes} min</strong></div>
                        <div><span className="text-[#9CA3AF]">Questions</span><br /><strong className="text-[#111827]">{contest.questions_count}</strong></div>
                        <div><span className="text-[#9CA3AF]">Difficulty</span><br /><strong className="text-[#111827] capitalize">{contest.difficulty}</strong></div>
                        <div><span className="text-[#9CA3AF]">Max Players</span><br /><strong className="text-[#111827]">{contest.max_participants ?? "Unlimited"}</strong></div>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 py-3 text-sm font-semibold text-[#6B7280] border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-all">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-xl transition-all disabled:opacity-60 hover:shadow-lg hover:shadow-[#6366F1]/25">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Enroll Now</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Contest Card ─────────────────────────────────────────────────
function ContestCard({
    contest,
    isEnrolled,
    participantCount,
    onEnroll,
    onJoin,
}: {
    contest: Contest;
    isEnrolled: boolean;
    participantCount: number;
    onEnroll: () => void;
    onJoin: () => void;
}) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 30_000);
        return () => clearInterval(t);
    }, []);
    void tick; // force re-render for countdown

    const isLive = contest.status === "live";
    const diff = DIFF_STYLE[contest.difficulty];
    const full = contest.max_participants != null && participantCount >= contest.max_participants;

    return (
        <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden ${isLive ? "border-[#10B981] shadow-[#10B981]/10" : "border-[#E5E7EB]"
            }`}>
            {/* Live banner */}
            {isLive && (
                <div className="bg-[#10B981] px-4 py-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span className="text-white text-xs font-black tracking-wider uppercase">Live Now</span>
                </div>
            )}

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h3 className="text-base font-black text-[#111827] leading-snug">{contest.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-semibold text-[#6B7280] flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> {contest.topic}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                style={{ backgroundColor: diff.bg, color: diff.text }}>
                                {diff.label}
                            </span>
                        </div>
                    </div>
                    {isEnrolled && (
                        <span className="flex items-center gap-1 text-xs font-bold text-[#10B981] bg-[#D1FAE5] px-2.5 py-1 rounded-full flex-shrink-0">
                            <CheckCircle className="w-3 h-3" /> Enrolled
                        </span>
                    )}
                </div>

                {contest.description && (
                    <p className="text-sm text-[#6B7280] mb-3 line-clamp-2">{contest.description}</p>
                )}

                {/* Meta info */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-[#F9FAFB] rounded-xl p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#9CA3AF] mb-1">
                            <Calendar className="w-3 h-3" />
                        </div>
                        <div className="text-xs font-bold text-[#111827]">
                            {isLive ? "Now" : countdown(contest.start_time)}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF]">{isLive ? "Live" : "Starts in"}</div>
                    </div>
                    <div className="bg-[#F9FAFB] rounded-xl p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#9CA3AF] mb-1">
                            <Clock className="w-3 h-3" />
                        </div>
                        <div className="text-xs font-bold text-[#111827]">{contest.duration_minutes}m</div>
                        <div className="text-[10px] text-[#9CA3AF]">Duration</div>
                    </div>
                    <div className="bg-[#F9FAFB] rounded-xl p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#9CA3AF] mb-1">
                            <Users className="w-3 h-3" />
                        </div>
                        <div className="text-xs font-bold text-[#111827]">
                            {participantCount}{contest.max_participants ? `/${contest.max_participants}` : ""}
                        </div>
                        <div className="text-[10px] text-[#9CA3AF]">Players</div>
                    </div>
                </div>

                {/* CTA button */}
                {isLive && isEnrolled ? (
                    <button onClick={onJoin}
                        className="w-full bg-[#10B981] hover:bg-[#059669] text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#10B981]/25">
                        <Swords className="w-4 h-4" /> Join Contest Now!
                    </button>
                ) : isEnrolled ? (
                    <button disabled
                        className="w-full bg-[#EEF2FF] text-[#6366F1] font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-default">
                        <CheckCircle className="w-4 h-4" /> Enrolled — Waiting for Start
                    </button>
                ) : isLive ? (
                    <button disabled
                        className="w-full bg-[#F9FAFB] text-[#9CA3AF] font-semibold py-3 rounded-xl text-sm cursor-not-allowed border border-[#E5E7EB]">
                        Contest already started
                    </button>
                ) : full ? (
                    <button disabled
                        className="w-full bg-[#FEF2F2] text-[#EF4444] font-semibold py-3 rounded-xl text-sm cursor-not-allowed border border-[#FECACA]">
                        Contest Full
                    </button>
                ) : (
                    <button onClick={onEnroll}
                        className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#6366F1]/25 hover:-translate-y-0.5">
                        <Zap className="w-4 h-4" /> Enroll Now
                    </button>
                )}

                {/* Date line */}
                <div className="mt-2.5 text-center text-xs text-[#9CA3AF] flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatDate(contest.start_time)}
                    {!isLive && !isEnrolled && ` · ${contest.questions_count} questions`}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────
export default function ContestsPage() {
    const router = useRouter();

    const [contests, setContests] = useState<(Contest & { participant_count: number })[]>([]);
    const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "upcoming" | "live">("all");
    const [toEnroll, setToEnroll] = useState<Contest | null>(null);
    const [enrolling, setEnrolling] = useState(false);
    const [flashMsg, setFlashMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // ── localStorage enrollment cache helpers ─────────────────────
    // Because the RLS policy on contest_participants only lets users
    // see their OWN rows (after the fix), and before the SQL migration
    // runs the recursive policy returns 0 rows, we keep a localStorage
    // cache of enrollments as a reliable fallback.
    const LS_ENROLLED_KEY = (uid: string) => `questly_enrolled_${uid}`;

    const readLocalEnrolled = (uid: string): Set<string> => {
        try {
            const raw = localStorage.getItem(LS_ENROLLED_KEY(uid));
            return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
        } catch { return new Set(); }
    };

    const writeLocalEnrolled = (uid: string, set: Set<string>) => {
        try { localStorage.setItem(LS_ENROLLED_KEY(uid), JSON.stringify([...set])); }
        catch { /* quota */ }
    };

    const load = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        // Load published + live contests
        const { data: contestData } = await supabase
            .from("contests")
            .select("*")
            .in("status", ["published", "live"])
            .eq("visibility", "public")
            .order("start_time", { ascending: true });

        const contestList = contestData ?? [];
        const ids = contestList.map(c => c.id);

        if (ids.length === 0) {
            setEnrolled(new Set());
            setContests([]);
            setLoading(false);
            return;
        }

        // ── Participant counts via SECURITY DEFINER RPC ────────────
        // The RPC bypasses RLS so it always returns the true count.
        // Falls back to 0 if the function doesn't exist yet (pre-migration).
        const countResults = await Promise.all(
            ids.map(async (cid) => {
                const { data, error } = await supabase
                    .rpc("get_contest_participant_count", { contest_id_input: cid });
                // If RPC doesn't exist yet (migration not run), fall back to 0
                if (error) return { cid, count: 0 };
                return { cid, count: (data as number) ?? 0 };
            })
        );

        // ── Enrollment check: DB + localStorage merge ──────────────
        // DB query works after the RLS fix; localStorage acts as reliable
        // fallback in case the migration hasn't been applied yet.
        const { data: myParts } = await supabase
            .from("contest_participants")
            .select("contest_id")
            .in("contest_id", ids)
            .eq("user_id", user.id);

        const dbEnrolled = new Set((myParts ?? []).map(p => p.contest_id));
        const localEnrolled = readLocalEnrolled(user.id);
        // Merge: trust DB when it returns data; supplement with localStorage
        // Remove contests from localStorage that no longer exist
        const validIds = new Set(ids);
        const mergedEnrolled = new Set([
            ...dbEnrolled,
            ...[...localEnrolled].filter(id => validIds.has(id)),
        ]);
        // If DB returned rows, sync localStorage to match DB (DB is source of truth)
        if (dbEnrolled.size > 0) {
            writeLocalEnrolled(user.id, mergedEnrolled);
        }

        const countMap: Record<string, number> = {};
        countResults.forEach(({ cid, count }) => { countMap[cid] = count; });

        setEnrolled(mergedEnrolled);
        setContests(contestList.map(c => ({ ...c, participant_count: countMap[c.id] ?? 0 })));
        setLoading(false);
    }, [router]);

    useEffect(() => { load(); }, [load]);

    const flash = (type: "success" | "error", text: string) => {
        setFlashMsg({ type, text });
        setTimeout(() => setFlashMsg(null), 4000);
    };

    const handleEnroll = async (contest: Contest) => {
        if (!userId) return;
        setEnrolling(true);
        const supabase = createClient();

        // Guard: re-fetch latest contest status to prevent enrolling into a live contest
        const { data: freshContest } = await supabase
            .from("contests")
            .select("status")
            .eq("id", contest.id)
            .single();

        if (freshContest?.status === "live") {
            flash("error", "This contest has already started — enrollment is closed.");
            setEnrolling(false);
            setToEnroll(null);
            await load(); // Refresh UI to reflect the live state
            return;
        }

        if (freshContest?.status === "ended" || freshContest?.status === "cancelled") {
            flash("error", "This contest is no longer accepting enrollments.");
            setEnrolling(false);
            setToEnroll(null);
            await load();
            return;
        }

        // Enforce max_participants
        if (contest.max_participants != null) {
            const { count } = await supabase
                .from("contest_participants")
                .select("*", { count: "exact", head: true })
                .eq("contest_id", contest.id);
            if ((count ?? 0) >= contest.max_participants) {
                flash("error", "This contest is now full — no more spots available.");
                setEnrolling(false);
                setToEnroll(null);
                return;
            }
        }

        const { error } = await supabase
            .from("contest_participants")
            .insert({ contest_id: contest.id, user_id: userId });

        if (error) {
            flash("error", error.message.includes("duplicate key")
                ? "You're already enrolled in this contest." : error.message);
        } else {
            flash("success", `Successfully enrolled in "${contest.title}"! Head to the lobby when it starts.`);
            // ── Write enrollment to localStorage immediately ───────
            // This ensures the UI reflects enrollment even before the
            // DB SELECT query catches up (RLS fix may not be deployed yet).
            if (userId) {
                const local = readLocalEnrolled(userId);
                local.add(contest.id);
                writeLocalEnrolled(userId, local);
                // Optimistically update enrolled state right now (no wait needed)
                setEnrolled(prev => new Set([...prev, contest.id]));
                setContests(prev => prev.map(c =>
                    c.id === contest.id ? { ...c, participant_count: c.participant_count + 1 } : c
                ));
            }
            // Also do a background reload after delay to sync counts from DB
            await new Promise(res => setTimeout(res, 500));
            await load();
        }
        setEnrolling(false);
        setToEnroll(null);
    };

    const handleJoin = (contest: Contest & { participant_count: number }) => {
        // Always go to lobby — lobby handles live/upcoming state and lets user click Start
        router.push(`/dashboard/contests/${contest.id}/lobby`);
    };

    const displayed = contests.filter(c => {
        if (filter === "live") return c.status === "live";
        if (filter === "upcoming") return c.status === "published";
        return true;
    });

    return (
        <div className="animate-fade-in-up">

            {/* Enroll modal */}
            {toEnroll && (
                <EnrollModal
                    contest={toEnroll}
                    onConfirm={() => handleEnroll(toEnroll)}
                    onCancel={() => setToEnroll(null)}
                    loading={enrolling}
                />
            )}

            {/* Flash message */}
            {flashMsg && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold max-w-sm animate-fade-in ${flashMsg.type === "success"
                    ? "bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]"
                    : "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                    }`}>
                    {flashMsg.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span className="flex-1">{flashMsg.text}</span>
                    <button onClick={() => setFlashMsg(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Page header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-black text-[#111827] mb-1 flex items-center gap-2.5">
                        <Swords className="w-6 h-6 text-[#6366F1]" /> Live Contests
                    </h1>
                    <p className="text-sm text-[#6B7280]">
                        Compete against other learners in real-time timed quizzes. Top scorers win!
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {(["all", "upcoming", "live"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${filter === f
                                ? "bg-[#6366F1] text-white shadow-sm"
                                : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:border-[#6366F1] hover:text-[#6366F1]"
                                }`}>
                            <Filter className={`w-3.5 h-3.5 inline mr-1.5 ${filter === f ? "text-white" : "text-[#9CA3AF]"}`} />
                            {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : "🔴 Live"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Your enrolled contests highlight */}
            {enrolled.size > 0 && (() => {
                // Find enrolled contests that are currently live
                const liveEnrolled = contests.filter(
                    c => enrolled.has(c.id) && c.status === "live"
                );
                const hasLive = liveEnrolled.length > 0;
                // Link to the first live enrolled contest's quiz
                const liveQuizHref = hasLive
                    ? `/dashboard/contests/${liveEnrolled[0].id}/quiz`
                    : null;

                return hasLive ? (
                    // 🔴 Urgent banner — contest is live right now!
                    <div className="mb-6 bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5] border border-[#6EE7B7] rounded-2xl p-4 flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping flex-shrink-0" />
                        <div className="flex-1">
                            <span className="text-sm font-bold text-[#065F46]">
                                {liveEnrolled.length === 1
                                    ? `"${liveEnrolled[0].title}" is live right now!`
                                    : `${liveEnrolled.length} of your enrolled contests are live!`}
                            </span>
                            <span className="text-sm text-[#059669] ml-2">Don&apos;t miss it!</span>
                        </div>
                        <button
                            onClick={() => router.push(liveQuizHref!)}
                            className="flex items-center gap-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black px-4 py-2 rounded-xl transition-all hover:shadow-lg hover:shadow-[#10B981]/25 whitespace-nowrap flex-shrink-0"
                        >
                            Go to Quiz Now! <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    // 📋 Default banner — enrolled but waiting for start
                    <div className="mb-6 bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] border border-[#C7D2FE] rounded-2xl p-4 flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-[#6366F1] flex-shrink-0" />
                        <div>
                            <span className="text-sm font-bold text-[#4338CA]">
                                You&apos;re enrolled in {enrolled.size} contest{enrolled.size > 1 ? "s" : ""}
                            </span>
                            <span className="text-sm text-[#6366F1] ml-2">— visit the lobby when it goes live!</span>
                        </div>
                    </div>
                );
            })()}

            {/* Contest grid */}
            {loading ? (
                <div className="flex items-center justify-center py-24 text-[#6B7280]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading contests…
                </div>
            ) : displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Swords className="w-16 h-16 text-[#E5E7EB] mb-4" />
                    <h2 className="text-xl font-black text-[#374151] mb-2">
                        {filter === "live" ? "No live contests right now" : "No contests yet"}
                    </h2>
                    <p className="text-[#9CA3AF] text-sm max-w-sm">
                        {filter === "live"
                            ? "Check back later or switch to \"Upcoming\" to see what's scheduled."
                            : "Contests are created by admins. Check back soon!"}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {displayed.map(c => (
                        <ContestCard
                            key={c.id}
                            contest={c}
                            isEnrolled={enrolled.has(c.id)}
                            participantCount={c.participant_count}
                            onEnroll={() => setToEnroll(c)}
                            onJoin={() => handleJoin(c)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
