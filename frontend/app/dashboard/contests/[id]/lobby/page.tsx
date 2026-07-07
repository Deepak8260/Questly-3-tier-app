"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Users, Clock, Swords,
    CheckCircle, AlertCircle, BookOpen, Zap, Trophy, ClipboardList
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
                <div className="font-heading text-5xl font-medium text-[#2F6B3A] mb-1">Starting…</div>
                <div className="text-sm text-[#5B5A52]">Contest is going live</div>
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
                        {i > 0 && <div className="text-2xl font-medium text-[#DEDCD3] -mt-5">:</div>}
                        <div className="text-center">
                            <div className="w-20 h-20 bg-[#1B1B18] flex items-center justify-center font-heading text-3xl font-medium text-white">
                                {pad(v)}
                            </div>
                            <div className="text-xs font-semibold text-[#8C8B82] mt-1.5">{l}</div>
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
            <div className="flex items-center justify-center py-32 text-[#8C8B82]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading lobby…
            </div>
        );
    }

    if (!contest) return null;

    // Not enrolled
    if (isEnrolled === false) {
        return (
            <div className="max-w-md mx-auto text-center py-20">
                <AlertCircle className="w-12 h-12 text-[#8C2E24] mx-auto mb-4" />
                <h2 className="font-heading text-xl font-medium text-[#1B1B18] mb-2">Not enrolled</h2>
                <p className="text-[#5B5A52] mb-5">You need to enroll before you can enter the lobby.</p>
                <Link href="/dashboard/contests"
                    className="inline-flex items-center gap-2 bg-[#6B2737] text-white font-medium px-5 py-2.5 hover:bg-[#551F2C] transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to contests
                </Link>
            </div>
        );
    }

    const endTime = new Date(new Date(contest.start_time).getTime() + contest.duration_minutes * 60_000);

    return (
        <div className="max-w-2xl mx-auto">

            {/* Back link */}
            <Link href="/dashboard/contests"
                className="inline-flex items-center gap-1.5 text-[#5B5A52] hover:text-[#1B1B18] text-sm font-medium mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> All contests
            </Link>

            {/* Contest header */}
            <div className="bg-white border border-[#DEDCD3] overflow-hidden mb-5">
                <div className={`px-6 py-4 ${contest.status === "live" ? "bg-[#1B2A1F]" : "bg-[#1B1B18]"}`}>
                    <div className="flex items-center gap-2 mb-1">
                        {contest.status === "live" ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#2F6B3A] bg-white px-2.5 py-1 border border-[#B8D8B8]">
                                <span className="w-1.5 h-1.5 bg-[#2F6B3A] animate-pulse" /> LIVE
                            </span>
                        ) : (
                            <span className="text-xs font-semibold text-[#B5677A] bg-[#2E1A20] px-2.5 py-1 border border-[#4A2A30]">
                                LOBBY
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs font-semibold text-white bg-white/10 px-2 py-0.5 border border-white/20">
                            <CheckCircle className="w-3 h-3" /> Enrolled
                        </span>
                    </div>
                    <h1 className="font-heading text-xl font-medium text-white">
                        {contest.title}
                    </h1>
                    {contest.description && (
                        <p className="text-sm mt-1 text-[#ABA99C]">
                            {contest.description}
                        </p>
                    )}
                </div>

                <div className="px-6 py-4 grid grid-cols-4 gap-4 border-b border-[#EAE8E1]">
                    {[
                        { icon: <BookOpen className="w-4 h-4" />, label: "Topic", value: contest.topic },
                        { icon: <Zap className="w-4 h-4" />, label: "Questions", value: `${contest.questions_count} Qs` },
                        { icon: <Clock className="w-4 h-4" />, label: "Duration", value: `${contest.duration_minutes} min` },
                        { icon: <Users className="w-4 h-4" />, label: "Enrolled", value: `${participantCount}` },
                    ].map(m => (
                        <div key={m.label} className="text-center">
                            <div className="flex justify-center text-[#8C8B82] mb-1">{m.icon}</div>
                            <div className="text-sm font-semibold text-[#1B1B18] truncate">{m.value}</div>
                            <div className="text-[10px] text-[#8C8B82]">{m.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Countdown or "live" clock */}
            <div className="bg-white border border-[#DEDCD3] p-8 mb-5 text-center">
                {contest.status === "live" ? (
                    <div>
                        <Trophy className="w-9 h-9 text-[#2F6B3A] mx-auto mb-3" />
                        <h2 className="font-heading text-xl font-medium text-[#2F6B3A] mb-1">Contest is live</h2>
                        <p className="text-sm text-[#5B5A52] mb-2">
                            Ends at {endTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-5">
                            Starts in
                        </div>
                        <CountdownDisplay targetIso={contest.start_time} />
                        <p className="text-xs text-[#8C8B82] mt-6">
                            The Start button unlocks automatically when the contest begins.
                        </p>
                    </div>
                )}
            </div>

            {/* Live participant counter */}
            <div className="bg-white border border-[#DEDCD3] px-5 py-3 flex items-center gap-3 mb-5">
                <div className="w-2 h-2 bg-[#2F6B3A] animate-pulse" />
                <div className="flex-1 text-sm text-[#5B5A52]">
                    <strong className="text-[#1B1B18] text-base">{participantCount}</strong> participant{participantCount !== 1 ? "s" : ""} in the lobby
                </div>
                <div className="text-xs text-[#8C8B82]">Live count</div>
            </div>

            {/* Contest rules card */}
            <div className="bg-[#FAFAF8] border border-[#DEDCD3] p-5 mb-6">
                <h3 className="text-sm font-semibold text-[#3F3E38] mb-3 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-[#6B2737]" /> Contest rules</h3>
                <ul className="space-y-2 text-sm text-[#5B5A52]">
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> All participants start the quiz simultaneously when it goes live</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> You have {contest.duration_minutes} minutes — the quiz auto-submits when time runs out</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> You can navigate between questions freely before submitting</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> If your browser crashes, your answers are saved locally and restored</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" /> Rankings: highest score, then fastest time, then alphabetical name</li>
                </ul>
            </div>

            {/* Start button */}
            <button
                onClick={() => router.push(`/dashboard/contests/${id}/quiz`)}
                disabled={!canStart}
                className={`w-full flex items-center justify-center gap-3 py-4 font-medium text-lg transition-colors ${canStart
                    ? "bg-[#2F6B3A] text-white hover:bg-[#255A2E] cursor-pointer"
                    : "bg-[#EDECE6] text-[#8C8B82] cursor-not-allowed"
                    }`}
            >
                {canStart ? (
                    <><Swords className="w-5 h-5" /> Start contest</>
                ) : (
                    <><Clock className="w-5 h-5" /> Waiting for contest to start…</>
                )}
            </button>
        </div>
    );
}