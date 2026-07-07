"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Swords, Clock, Users, Zap, CheckCircle, Loader2,
    Calendar, Filter, AlertCircle, X, BookOpen, Trophy, ArrowRight, Radio
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
    easy: { bg: "#E9F1E9", text: "#2F6B3A", label: "Easy" },
    medium: { bg: "#F5EEDD", text: "#93670F", label: "Medium" },
    hard: { bg: "#F5E7E4", text: "#8C2E24", label: "Hard" },
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div className="bg-white max-w-md w-full overflow-hidden border border-[#DEDCD3]">
                <div className="bg-[#1B1B18] px-6 py-5 border-b border-[#35352C]">
                    <Trophy className="w-6 h-6 text-[#B5677A] mb-2" />
                    <h2 className="font-heading text-lg font-medium text-white">Enroll in contest?</h2>
                    <p className="text-sm text-[#ABA99C] mt-0.5">{contest.title}</p>
                </div>
                <div className="px-6 py-5 space-y-3">
                    <div className="text-sm font-semibold text-[#3F3E38] mb-1">Contest rules</div>
                    <ul className="space-y-2 text-sm text-[#5B5A52]">
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> You must be present at the scheduled start time</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> Once you start the quiz, you cannot pause it</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> You can only submit answers once — no re-attempts</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> The quiz auto-submits when the timer runs out</li>
                        <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> Rankings: highest score wins; ties broken by fastest time, then name</li>
                    </ul>
                    <div className="bg-[#FAFAF8] border border-[#DEDCD3] p-3 mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-[#8C8B82]">Duration</span><br /><strong className="text-[#1B1B18]">{contest.duration_minutes} min</strong></div>
                        <div><span className="text-[#8C8B82]">Questions</span><br /><strong className="text-[#1B1B18]">{contest.questions_count}</strong></div>
                        <div><span className="text-[#8C8B82]">Difficulty</span><br /><strong className="text-[#1B1B18] capitalize">{contest.difficulty}</strong></div>
                        <div><span className="text-[#8C8B82]">Max players</span><br /><strong className="text-[#1B1B18]">{contest.max_participants ?? "Unlimited"}</strong></div>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onCancel} disabled={loading}
                        className="flex-1 py-3 text-sm font-medium text-[#5B5A52] border border-[#DEDCD3] hover:bg-[#FAFAF8] transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] transition-colors disabled:opacity-60">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Enroll now</>}
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
        <div className={`bg-white border transition-colors overflow-hidden ${isLive ? "border-[#2F6B3A]" : "border-[#DEDCD3]"
            }`}>
            {/* Live banner */}
            {isLive && (
                <div className="bg-[#2F6B3A] px-4 py-1.5 flex items-center gap-2">
                    <Radio className="w-3 h-3 text-white animate-pulse" />
                    <span className="text-white text-xs font-semibold tracking-wider uppercase">Live now</span>
                </div>
            )}

            <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h3 className="font-heading text-base font-medium text-[#1B1B18] leading-snug">{contest.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-medium text-[#5B5A52] flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> {contest.topic}
                            </span>
                            <span className="text-xs px-2 py-0.5 font-semibold"
                                style={{ backgroundColor: diff.bg, color: diff.text }}>
                                {diff.label}
                            </span>
                        </div>
                    </div>
                    {isEnrolled && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-[#2F6B3A] bg-[#E9F1E9] px-2.5 py-1 flex-shrink-0">
                            <CheckCircle className="w-3 h-3" /> Enrolled
                        </span>
                    )}
                </div>

                {contest.description && (
                    <p className="text-sm text-[#5B5A52] mb-3 line-clamp-2">{contest.description}</p>
                )}

                {/* Meta info */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-[#FAFAF8] p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#8C8B82] mb-1">
                            <Calendar className="w-3 h-3" />
                        </div>
                        <div className="text-xs font-semibold text-[#1B1B18]">
                            {isLive ? "Now" : countdown(contest.start_time)}
                        </div>
                        <div className="text-[10px] text-[#8C8B82]">{isLive ? "Live" : "Starts in"}</div>
                    </div>
                    <div className="bg-[#FAFAF8] p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#8C8B82] mb-1">
                            <Clock className="w-3 h-3" />
                        </div>
                        <div className="text-xs font-semibold text-[#1B1B18]">{contest.duration_minutes}m</div>
                        <div className="text-[10px] text-[#8C8B82]">Duration</div>
                    </div>
                    <div className="bg-[#FAFAF8] p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 text-[#8C8B82] mb-1">
                            <Users className="w-3 h-3" />
                        </div>
                        <div className="text-xs font-semibold text-[#1B1B18]">
                            {participantCount}{contest.max_participants ? `/${contest.max_participants}` : ""}
                        </div>
                        <div className="text-[10px] text-[#8C8B82]">Players</div>
                    </div>
                </div>

                {/* CTA button */}
                {isLive && isEnrolled ? (
                    <button onClick={onJoin}
                        className="w-full bg-[#2F6B3A] hover:bg-[#255A2E] text-white font-medium py-3 text-sm transition-colors flex items-center justify-center gap-2">
                        <Swords className="w-4 h-4" /> Join contest now
                    </button>
                ) : isEnrolled ? (
                    <button disabled
                        className="w-full bg-[#F3E7E9] text-[#6B2737] font-medium py-3 text-sm flex items-center justify-center gap-2 cursor-default">
                        <CheckCircle className="w-4 h-4" /> Enrolled — waiting for start
                    </button>
                ) : isLive ? (
                    <button disabled
                        className="w-full bg-[#FAFAF8] text-[#8C8B82] font-medium py-3 text-sm cursor-not-allowed border border-[#DEDCD3]">
                        Contest already started
                    </button>
                ) : full ? (
                    <button disabled
                        className="w-full bg-[#F5E7E4] text-[#8C2E24] font-medium py-3 text-sm cursor-not-allowed border border-[#E0B8AF]">
                        Contest full
                    </button>
                ) : (
                    <button onClick={onEnroll}
                        className="w-full bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium py-3 text-sm transition-colors flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" /> Enroll now
                    </button>
                )}

                {/* Date line */}
                <div className="mt-2.5 text-center text-xs text-[#8C8B82] flex items-center justify-center gap-1">
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
        <div>

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
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 text-sm font-medium max-w-sm border ${flashMsg.type === "success"
                    ? "bg-[#E9F1E9] text-[#2F6B3A] border-[#B8D8B8]"
                    : "bg-[#F5E7E4] text-[#8C2E24] border-[#E0B8AF]"
                    }`}>
                    {flashMsg.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span className="flex-1">{flashMsg.text}</span>
                    <button onClick={() => setFlashMsg(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Page header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="font-heading text-2xl font-medium text-[#1B1B18] mb-1 flex items-center gap-2.5">
                        <Swords className="w-5 h-5 text-[#6B2737]" /> Live contests
                    </h1>
                    <p className="text-sm text-[#5B5A52]">
                        Compete against other learners in real-time timed quizzes. Top scorers win.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {(["all", "upcoming", "live"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${filter === f
                                ? "bg-[#6B2737] text-white"
                                : "bg-white text-[#5B5A52] border border-[#DEDCD3] hover:border-[#ABA99C]"
                                }`}>
                            <Filter className={`w-3.5 h-3.5 inline mr-1.5 ${filter === f ? "text-white" : "text-[#8C8B82]"}`} />
                            {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : "Live"}
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
                    // Urgent banner — contest is live right now
                    <div className="mb-6 bg-[#E9F1E9] border border-[#B8D8B8] p-4 flex items-center gap-3">
                        <Radio className="w-4 h-4 text-[#2F6B3A] animate-pulse flex-shrink-0" />
                        <div className="flex-1">
                            <span className="text-sm font-semibold text-[#2F6B3A]">
                                {liveEnrolled.length === 1
                                    ? `"${liveEnrolled[0].title}" is live right now`
                                    : `${liveEnrolled.length} of your enrolled contests are live`}
                            </span>
                            <span className="text-sm text-[#2F6B3A] ml-2">Don&apos;t miss it.</span>
                        </div>
                        <button
                            onClick={() => router.push(liveQuizHref!)}
                            className="flex items-center gap-1.5 bg-[#2F6B3A] hover:bg-[#255A2E] text-white text-xs font-semibold px-4 py-2 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                            Go to quiz now <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    // Default banner — enrolled but waiting for start
                    <div className="mb-6 bg-[#F3E7E9] border border-[#DCC0C6] p-4 flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-[#6B2737] flex-shrink-0" />
                        <div>
                            <span className="text-sm font-semibold text-[#6B2737]">
                                You&apos;re enrolled in {enrolled.size} contest{enrolled.size > 1 ? "s" : ""}
                            </span>
                            <span className="text-sm text-[#6B2737] ml-2">— visit the lobby when it goes live.</span>
                        </div>
                    </div>
                );
            })()}

            {/* Contest grid */}
            {loading ? (
                <div className="flex items-center justify-center py-24 text-[#8C8B82]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading contests…
                </div>
            ) : displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border border-[#DEDCD3] bg-white">
                    <Swords className="w-12 h-12 text-[#DEDCD3] mb-4" />
                    <h2 className="font-heading text-xl font-medium text-[#3F3E38] mb-2">
                        {filter === "live" ? "No live contests right now" : "No contests yet"}
                    </h2>
                    <p className="text-[#8C8B82] text-sm max-w-sm">
                        {filter === "live"
                            ? "Check back later or switch to \"Upcoming\" to see what's scheduled."
                            : "Contests are created by admins. Check back soon."}
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