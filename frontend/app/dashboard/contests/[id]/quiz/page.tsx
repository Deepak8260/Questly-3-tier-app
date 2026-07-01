"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Clock, ChevronLeft, ChevronRight, Trophy, AlertCircle,
    CheckCircle, XCircle, Loader2, Brain, Zap, Swords
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest, ContestQuestion } from "@/app/admin/contests/types";

// ── Helpers ──────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }

const LS_KEY = (cid: string, uid: string) => `questly_contest_${cid}_${uid}`;

interface SavedState {
    answers: (number | null)[];
    startedAt: number;            // epoch ms when user opened the quiz
}

function loadFromLS(contestId: string, userId: string): SavedState | null {
    try {
        const raw = localStorage.getItem(LS_KEY(contestId, userId));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveToLS(contestId: string, userId: string, state: SavedState) {
    try { localStorage.setItem(LS_KEY(contestId, userId), JSON.stringify(state)); }
    catch { /* quota exceeded — ignore */ }
}

function clearLS(contestId: string, userId: string) {
    try { localStorage.removeItem(LS_KEY(contestId, userId)); }
    catch { /* ignore */ }
}

// ── Submission helper ────────────────────────────────────────────
async function submitContest(params: {
    contestId: string;
    userId: string;
    questions: ContestQuestion[];
    answers: (number | null)[];
    timeTaken: number;
}) {
    const supabase = createClient();
    const { contestId, userId, questions, answers, timeTaken } = params;

    const score = answers.filter((a, i) => a === questions[i].correctIndex).length;
    const totalQs = questions.length;
    const accuracy = Math.round((score / totalQs) * 100 * 100) / 100;

    // 1. Save individual answers
    const answerRows = questions.map((q, i) => ({
        contest_id: contestId,
        user_id: userId,
        question_id: q.id,
        selected_answer: answers[i] != null ? q.options[answers[i]!] : "",
        is_correct: answers[i] === q.correctIndex,
        answered_at: new Date().toISOString(),
    }));

    await supabase.from("contest_answers").insert(answerRows);

    // 2. Upsert result (idempotent — prevents double-submit)
    const { error } = await supabase.from("contest_results").upsert(
        {
            contest_id: contestId,
            user_id: userId,
            score,
            total_questions: totalQs,
            accuracy,
            time_taken_seconds: timeTaken,
            submitted_at: new Date().toISOString(),
            rank: null, // rank is computed server-side via trigger (or recomputed on leaderboard)
        },
        { onConflict: "contest_id,user_id" }
    );

    if (error) throw error;
    return { score, totalQs, accuracy };
}

// ── Timer component ───────────────────────────────────────────────
function Timer({
    endMs,
    onExpire,
}: {
    endMs: number;    // absolute epoch ms when time runs out
    onExpire: () => void;
}) {
    const [remaining, setRemaining] = useState(Math.max(0, endMs - Date.now()));
    const firedRef = useRef(false);

    useEffect(() => {
        const tick = () => {
            const r = Math.max(0, endMs - Date.now());
            setRemaining(r);
            if (r === 0 && !firedRef.current) {
                firedRef.current = true;
                onExpire();
            }
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [endMs, onExpire]);

    const totalSecs = Math.ceil(remaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const urgent = remaining < 60_000;  // last minute

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-bold text-sm transition-all ${urgent
                ? "bg-[#FEE2E2] text-[#EF4444] border border-[#FECACA] animate-pulse"
                : "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"
            }`}>
            <Clock className="w-3.5 h-3.5" />
            {pad(mins)}:{pad(secs)}
        </div>
    );
}

// ── Main Quiz Screen ──────────────────────────────────────────────
export default function ContestQuizPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [contest, setContest] = useState<Contest | null>(null);
    const [questions, setQuestions] = useState<ContestQuestion[]>([]);
    const [answers, setAnswers] = useState<(number | null)[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [waitingForLive, setWaitingForLive] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [endMs, setEndMs] = useState(0);
    const [startedAt, setStartedAt] = useState(0);
    const submittedRef = useRef(false);

    // ── Load + guard ──────────────────────────────────────────────
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

        // Guard: already submitted
        if (submitted) { router.replace(`/dashboard/contests/${id}/leaderboard`); return; }

        // Guard: not enrolled
        // Check DB + localStorage fallback (same pattern as lobby page)
        const dbEnrolled = Boolean(enrollment);
        let localEnrolled = false;
        try {
            const LS_KEY = `questly_enrolled_${user.id}`;
            const raw = localStorage.getItem(LS_KEY);
            const arr: string[] = raw ? JSON.parse(raw) : [];
            localEnrolled = arr.includes(id);
        } catch { /* ignore */ }
        const isEnrolled = dbEnrolled || localEnrolled;

        if (!isEnrolled) {
            setError("You are not enrolled in this contest. Please enroll first.");
            setLoading(false);
            return;
        }

        // Guard: not live
        if (!c || c.status !== "live") {
            if (c?.status === "ended" || c?.status === "cancelled") {
                router.replace(`/dashboard/contests/${id}/leaderboard`);
                return;
            }
            if (!c) {
                setError("Contest not found.");
                setLoading(false);
                return;
            }
            // Contest is published but not yet live — show waiting screen, auto-retry
            setWaitingForLive(true);
            setLoading(false);
            return;
        }
        // Contest is now live — clear waiting state if we polled into it
        setWaitingForLive(false);

        const qs: ContestQuestion[] = c.question_set ?? [];
        if (qs.length === 0) {
            setError("This contest has no questions assigned yet.");
            setLoading(false);
            return;
        }

        // Compute end time
        const contestEnd = new Date(c.start_time).getTime() + c.duration_minutes * 60_000;
        setEndMs(contestEnd);

        // Restore from localStorage if available
        const saved = loadFromLS(id, user.id);
        const now = Date.now();
        const sa = saved?.startedAt ?? now;
        setStartedAt(sa);
        setAnswers(saved?.answers ?? Array(qs.length).fill(null));

        setContest(c as Contest);
        setQuestions(qs);
        setLoading(false);
    }, [id, router]);

    useEffect(() => { load(); }, [load]);

    // ── Auto-poll when waiting for contest to go live ─────────────
    useEffect(() => {
        if (!waitingForLive) return;
        const interval = setInterval(() => {
            load(); // Re-run the full load; it will clear waitingForLive when status === "live"
        }, 3000);
        return () => clearInterval(interval);
    }, [waitingForLive, load]);

    // ── Persist answers to localStorage on every change ───────────
    useEffect(() => {
        if (!userId || answers.length === 0) return;
        saveToLS(id, userId, { answers, startedAt });
    }, [answers, id, userId, startedAt]);

    // ── Auto-submit on timer expiry ───────────────────────────────
    const handleSubmit = useCallback(async (fromTimer = false) => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        setSubmitting(true);

        const timeTaken = Math.round((Date.now() - startedAt) / 1000);
        const effectiveAnswers = fromTimer ? answers : answers;   // same — just for clarity

        try {
            await submitContest({
                contestId: id,
                userId: userId!,
                questions,
                answers: effectiveAnswers,
                timeTaken,
            });
            clearLS(id, userId!);
            router.replace(`/dashboard/contests/${id}/leaderboard?submitted=true`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Submission failed";
            setError(msg);
            setSubmitting(false);
            submittedRef.current = false;
        }
    }, [id, userId, questions, answers, startedAt, router]);

    const handleTimerExpire = useCallback(() => {
        handleSubmit(true);
    }, [handleSubmit]);

    const selectAnswer = (optIdx: number) => {
        if (submitting) return;
        setAnswers(prev => {
            const next = [...prev];
            next[currentQ] = optIdx;
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-[#6B7280]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading contest quiz…
            </div>
        );
    }

    if (waitingForLive) {
        return (
            <div className="max-w-md mx-auto text-center py-20 animate-fade-in-up">
                <div className="relative inline-flex items-center justify-center w-20 h-20 mb-5">
                    <div className="absolute inset-0 rounded-full bg-[#EEF2FF] animate-ping opacity-50" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#6366F1]/30">
                        <Swords className="w-9 h-9 text-white" />
                    </div>
                </div>
                <h2 className="text-xl font-black text-[#111827] mb-2">Contest Starting Soon…</h2>
                <p className="text-[#6B7280] mb-2">You&apos;re enrolled and ready to go!</p>
                <p className="text-sm text-[#9CA3AF] mb-6">This page will automatically load your quiz the moment the contest goes live. No need to refresh.</p>
                <div className="flex items-center justify-center gap-2 text-xs text-[#6366F1] font-semibold bg-[#EEF2FF] px-4 py-2 rounded-full">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Checking every 3 seconds…
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-md mx-auto text-center py-20 animate-fade-in-up">
                <AlertCircle className="w-14 h-14 text-[#EF4444] mx-auto mb-4" />
                <h2 className="text-xl font-black text-[#111827] mb-2">Cannot Enter Quiz</h2>
                <p className="text-[#6B7280] mb-5">{error}</p>
                <button onClick={() => router.push(`/dashboard/contests/${id}/lobby`)}
                    className="inline-flex items-center gap-2 bg-[#6366F1] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#4F46E5] transition-all">
                    Back to Lobby
                </button>
            </div>
        );
    }

    if (submitting) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in-up">
                <div className="text-4xl mb-4">🏆</div>
                <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin mb-3" />
                <h2 className="text-lg font-black text-[#111827] mb-1">Submitting your answers…</h2>
                <p className="text-sm text-[#6B7280]">Calculating your score and updating the leaderboard.</p>
            </div>
        );
    }

    const q = questions[currentQ];
    const userAnswer = answers[currentQ];
    const answered = userAnswer !== null;
    const answeredAll = answers.every(a => a !== null);
    const answeredCount = answers.filter(a => a !== null).length;
    const progress = (answeredCount / questions.length) * 100;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in-up">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-5">
                <div className="min-w-0">
                    <h1 className="text-base font-black text-[#111827] truncate">{contest!.title}</h1>
                    <p className="text-xs text-[#9CA3AF] capitalize">{contest!.topic} · {contest!.difficulty}</p>
                </div>
                <Timer endMs={endMs} onExpire={handleTimerExpire} />
            </div>

            {/* ── Progress bar ────────────────────────────────────────── */}
            <div className="bg-[#F3F4F6] rounded-full h-2 mb-5 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* ── Question navigation dots ─────────────────────────────── */}
            <div className="flex gap-1.5 mb-5 flex-wrap">
                {questions.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentQ(i)}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${i === currentQ
                                ? "bg-[#6366F1] text-white scale-110 shadow-md"
                                : answers[i] !== null
                                    ? "bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]"
                                    : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]"
                            }`}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>

            {/* ── Question card ────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-[#6366F1] uppercase tracking-wider">
                        Question {currentQ + 1} of {questions.length}
                    </span>
                    <span className="text-xs text-[#9CA3AF]">
                        {answeredCount}/{questions.length} answered
                    </span>
                </div>

                {/* Question text */}
                <p className="text-base font-semibold text-[#111827] leading-relaxed mb-4">{q.question}</p>

                {/* Optional code block */}
                {q.code && (
                    <pre className="bg-[#0F172A] text-[#E2E8F0] text-xs font-mono rounded-xl p-4 mb-4 overflow-x-auto leading-relaxed border border-[#1E293B]">
                        <code>{q.code}</code>
                    </pre>
                )}

                {/* Options */}
                <div className="grid grid-cols-1 gap-2.5">
                    {q.options.filter(o => o).map((opt, i) => {
                        const isSelected = userAnswer === i;
                        let cls = "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ";
                        if (isSelected) {
                            cls += "border-[#6366F1] bg-[#EEF2FF] text-[#4338CA] ring-2 ring-[#6366F1]/20";
                        } else {
                            cls += "border-[#E5E7EB] hover:border-[#6366F1] hover:bg-[#F5F3FF] text-[#374151] cursor-pointer";
                        }
                        return (
                            <button key={i} className={cls} onClick={() => selectAnswer(i)}>
                                <span className={`font-black mr-2.5 ${isSelected ? "text-[#6366F1]" : "text-[#9CA3AF]"}`}>
                                    {["A", "B", "C", "D"][i]}.
                                </span>
                                {opt}
                                {isSelected && <CheckCircle className="w-4 h-4 text-[#6366F1] inline ml-2" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Unanswered warning ──────────────────────────────────── */}
            {!answeredAll && (
                <div className="flex items-center gap-2 text-xs text-[#F59E0B] bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-2.5 mb-4">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? "s" : ""} unanswered — you can still submit, unanswered = wrong
                </div>
            )}

            {/* ── Navigation row ──────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setCurrentQ(i => i - 1)}
                    disabled={currentQ === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#6B7280] border border-[#E5E7EB] bg-white rounded-xl hover:bg-[#F9FAFB] disabled:opacity-40 disabled:pointer-events-none transition-all"
                >
                    <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex items-center gap-2">
                    {currentQ < questions.length - 1 ? (
                        <button
                            onClick={() => setCurrentQ(i => i + 1)}
                            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl transition-all"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : null}

                    {/* Submit button */}
                    <button
                        onClick={() => handleSubmit(false)}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white rounded-xl transition-all hover:shadow-lg disabled:opacity-50"
                    >
                        {submitting
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><Trophy className="w-4 h-4" /> Submit</>
                        }
                    </button>
                </div>
            </div>

            {/* ── Summary bar ─────────────────────────────────────────── */}
            <div className="mt-6 border border-[#E5E7EB] bg-white rounded-xl px-5 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[#10B981] font-bold">
                        <CheckCircle className="w-3.5 h-3.5" /> {answeredCount} answered
                    </span>
                    {questions.length - answeredCount > 0 && (
                        <span className="flex items-center gap-1 text-[#F59E0B] font-bold">
                            <XCircle className="w-3.5 h-3.5" /> {questions.length - answeredCount} skipped
                        </span>
                    )}
                </div>
                <span className="flex items-center gap-1 text-[#9CA3AF] text-xs">
                    <Brain className="w-3.5 h-3.5" /> {contest!.topic}
                </span>
            </div>
        </div>
    );
}
