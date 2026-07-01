"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Users, Clock, Swords,
    CheckCircle, AlertCircle, BookOpen, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest } from "@/app/admin/contests/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

function CountdownDisplay({ targetIso }: { targetIso: string }) {
    const [diff, setDiff] = useState(new Date(targetIso).getTime() - Date.now());

    useEffect(() => {
        const t = setInterval(() => {
            setDiff(new Date(targetIso).getTime() - Date.now());
        }, 1000);
        return () => clearInterval(t);
    }, [targetIso]);

    if (diff <= 0) {
        return (
            <div className="text-center">
                <div className="text-5xl font-black text-[#10B981] mb-1">Starting…</div>
                <div className="text-sm text-[#6B7280]">Contest is going live</div>
            </div>
        );
    }

    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    const secs = Math.floor((diff % 60_000) / 1_000);

    const units = days > 0
        ? [{ v: days, l: "Days" }, { v: hours, l: "Hours" }, { v: mins, l: "Min" }, { v: secs, l: "Sec" }]
        : [{ v: hours, l: "Hours" }, { v: mins, l: "Min" }, { v: secs, l: "Sec" }];

    return (
        <div className="flex items-center justify-center gap-3">
            {units.map(({ v, l }, i) => (
                <div key={l}>
                    <div className="flex items-center gap-3">
                        {i > 0 && <div className="text-2xl font-black text-[#C7D2FE] -mt-5">:</div>}
                        <div className="text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-[#6366F1]/30">
                                {pad(v)}
                            </div>
                            <div className="text-xs font-bold text-[#9CA3AF] mt-1.5">{l}</div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function LobbyPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [contest, setContest] = useState<Contest | null>(null);
    const [participantCount, setCount] = useState(0);
    const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [canStart, setCanStart] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const realtimeRef = useRef<ReturnType<typeof createClient> | null>(null);
    // Stable ref so Realtime callbacks always read the current enrollment value
    const enrolledRef = useRef<boolean>(false);

    const load = useCallback(async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const [{ data: c }, { data: enrollment }, { data: submitted }] = await Promise.all([
            supabase.from("contests").select("*").eq("id", id).single(),
            supabase.from("contest_participants").select("id").eq("contest_id", id).eq("user_id", user.id).maybeSingle(),
            supabase.from("contest_results").select("id").eq("contest_id", id).eq("user_id", user.id).maybeSingle(),
        ]);

        // Fetch participant count via SECURITY DEFINER RPC (bypasses RLS)
        const { data: countData } = await supabase
            .rpc("get_contest_participant_count", { contest_id_input: id });
        const pCount = (countData as number | null) ?? 0;

        if (!c) { router.replace("/dashboard/contests"); return; }

        // If already submitted → go to leaderboard
        if (submitted) { router.replace(`/dashboard/contests/${id}/leaderboard`); return; }

        setContest(c as Contest);
        setCount(pCount);
        // Check enrollment: DB query + localStorage fallback
        const dbEnrolled = Boolean(enrollment);
        const LS_KEY = `questly_enrolled_${user.id}`;
        let localEnrolled = false;
        try {
            const raw = localStorage.getItem(LS_KEY);
            const arr: string[] = raw ? JSON.parse(raw) : [];
            localEnrolled = arr.includes(id);
        } catch { /* ignore */ }
        const enrolled = dbEnrolled || localEnrolled;
        setIsEnrolled(enrolled);
        enrolledRef.current = enrolled; // keep ref in sync for Realtime callbacks

        // If contest is already live → enable the Start button (don't auto-redirect)
        // The user will see the lobby in live state and manually click "Start Contest!"
        if (c.status === "live") {
            setCanStart(true);
        }
        if (c.status === "ended" || c.status === "cancelled") {
            router.replace(`/dashboard/contests/${id}/leaderboard`);
            return;
        }

        setLoading(false);
    }, [id, router]);

    useEffect(() => { load(); }, [load]);

    // ── Realtime: watch contest status + participant count ──────────
    useEffect(() => {
        const supabase = createClient();
        realtimeRef.current = supabase;

        // Contest status changes (published → live)
        const contestChannel = supabase
            .channel(`lobby-contest-${id}`)
            .on("postgres_changes", {
                event: "UPDATE", schema: "public", table: "contests",
                filter: `id=eq.${id}`,
            }, (payload) => {
                const updated = payload.new as Contest;
                setContest(updated);
                if (updated.status === "live") {
                    // Enable the Start button — user clicks when ready
                    setCanStart(true);
                }
                if (updated.status === "ended" || updated.status === "cancelled") {
                    router.replace(`/dashboard/contests/${id}/leaderboard`);
                }
            })
            .subscribe();

        // Participant count changes
        const partChannel = supabase
            .channel(`lobby-participants-${id}`)
            .on("postgres_changes", {
                event: "*", schema: "public", table: "contest_participants",
                filter: `contest_id=eq.${id}`,
            }, () => {
                // Re-fetch count via RPC
                supabase
                    .rpc("get_contest_participant_count", { contest_id_input: id })
                    .then(({ data }) => setCount((data as number | null) ?? 0));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(contestChannel);
            supabase.removeChannel(partChannel);
        };
    }, [id, router]);

    // ── Auto-unlock when start_time passes ─────────────────────────
    useEffect(() => {
        if (!contest || canStart) return;
        const ms = new Date(contest.start_time).getTime() - Date.now();
        if (ms <= 0) { setCanStart(true); return; }
        const t = setTimeout(() => setCanStart(true), ms);
        return () => clearTimeout(t);
    }, [contest, canStart]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-[#6B7280]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading lobby…
            </div>
        );
    }

    if (!contest) return null;

    // Not enrolled
    if (isEnrolled === false) {
        return (
            <div className="max-w-md mx-auto text-center py-20 animate-fade-in-up">
                <AlertCircle className="w-14 h-14 text-[#EF4444] mx-auto mb-4" />
                <h2 className="text-xl font-black text-[#111827] mb-2">Not Enrolled</h2>
                <p className="text-[#6B7280] mb-5">You need to enroll before you can enter the lobby.</p>
                <Link href="/dashboard/contests"
                    className="inline-flex items-center gap-2 bg-[#6366F1] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#4F46E5] transition-all">
                    <ArrowLeft className="w-4 h-4" /> Back to Contests
                </Link>
            </div>
        );
    }

    const endTime = new Date(new Date(contest.start_time).getTime() + contest.duration_minutes * 60_000);

    return (
        <div className="max-w-2xl mx-auto animate-fade-in-up">

            {/* Back link */}
            <Link href="/dashboard/contests"
                className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#111827] text-sm font-medium mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> All Contests
            </Link>

            {/* Contest header */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm mb-5">
                <div className={`px-6 py-4 ${contest.status === "live"
                    ? "bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5]"
                    : "bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF]"
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                        {contest.status === "live" ? (
                            <span className="flex items-center gap-1.5 text-xs font-black text-[#10B981] bg-white px-2.5 py-1 rounded-full border border-[#6EE7B7]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" /> LIVE
                            </span>
                        ) : (
                            <span className="text-xs font-black text-[#6366F1] bg-white px-2.5 py-1 rounded-full border border-[#C7D2FE]">
                                LOBBY
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs font-bold text-[#10B981] bg-[#D1FAE5] px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Enrolled
                        </span>
                    </div>
                    <h1 className={`text-xl font-black ${contest.status === "live" ? "text-[#065F46]" : "text-[#1E1B4B]"}`}>
                        {contest.title}
                    </h1>
                    {contest.description && (
                        <p className={`text-sm mt-1 ${contest.status === "live" ? "text-[#065F46]/70" : "text-[#4338CA]/70"}`}>
                            {contest.description}
                        </p>
                    )}
                </div>

                <div className="px-6 py-4 grid grid-cols-4 gap-4 border-b border-[#F3F4F6]">
                    {[
                        { icon: <BookOpen className="w-4 h-4" />, label: "Topic", value: contest.topic },
                        { icon: <Zap className="w-4 h-4" />, label: "Questions", value: `${contest.questions_count} Qs` },
                        { icon: <Clock className="w-4 h-4" />, label: "Duration", value: `${contest.duration_minutes} min` },
                        { icon: <Users className="w-4 h-4" />, label: "Enrolled", value: `${participantCount}` },
                    ].map(m => (
                        <div key={m.label} className="text-center">
                            <div className="flex justify-center text-[#9CA3AF] mb-1">{m.icon}</div>
                            <div className="text-sm font-black text-[#111827]">{m.value}</div>
                            <div className="text-[10px] text-[#9CA3AF]">{m.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Countdown or "live" clock */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 mb-5 shadow-sm text-center">
                {contest.status === "live" ? (
                    <div>
                        <div className="text-4xl mb-3">🏆</div>
                        <h2 className="text-xl font-black text-[#10B981] mb-1">Contest is Live!</h2>
                        <p className="text-sm text-[#6B7280] mb-2">
                            Ends at {endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-5">
                            Starts In
                        </div>
                        <CountdownDisplay targetIso={contest.start_time} />
                        <p className="text-xs text-[#9CA3AF] mt-6">
                            The Start button unlocks automatically when the contest begins.
                        </p>
                    </div>
                )}
            </div>

            {/* Live participant counter */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-3 flex items-center gap-3 mb-5 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <div className="flex-1 text-sm text-[#6B7280]">
                    <strong className="text-[#111827] text-base">{participantCount}</strong> participant{participantCount !== 1 ? "s" : ""} in the lobby
                </div>
                <div className="text-xs text-[#9CA3AF]">Live count</div>
            </div>

            {/* Contest rules card */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-5 mb-6">
                <h3 className="text-sm font-black text-[#374151] mb-3">📋 Contest Rules</h3>
                <ul className="space-y-2 text-sm text-[#6B7280]">
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> All participants start the quiz simultaneously when it goes live</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> You have {contest.duration_minutes} minutes — the quiz auto-submits when time runs out</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> You can navigate between questions freely before submitting</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> If your browser crashes, your answers are saved locally and restored</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" /> Rankings: highest score → fastest time → alphabetical name (deterministic)</li>
                </ul>
            </div>

            {/* Start button */}
            <button
                onClick={() => router.push(`/dashboard/contests/${id}/quiz`)}
                disabled={!canStart}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-lg transition-all ${canStart
                    ? "bg-gradient-to-r from-[#10B981] to-[#059669] text-white hover:shadow-xl hover:shadow-[#10B981]/30 hover:-translate-y-1 cursor-pointer"
                    : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                    }`}
            >
                {canStart ? (
                    <><Swords className="w-6 h-6" /> Start Contest!</>
                ) : (
                    <><Clock className="w-5 h-5" /> Waiting for contest to start…</>
                )}
            </button>
        </div>
    );
}
