"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Clock, ChevronLeft, ChevronRight, Trophy, AlertCircle,
    CheckCircle, XCircle, Loader2, Brain, Swords, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { QuizBattle } from "@/app/dashboard/battles/types";
import type { ContestQuestion } from "@/app/admin/contests/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

const LS_KEY = (bid: string, uid: string) => `questly_battle_${bid}_${uid}`;

interface SavedState { answers: (number | null)[]; startedAt: number; }

function loadFromLS(bid: string, uid: string): SavedState | null {
    try { const r = localStorage.getItem(LS_KEY(bid, uid)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveToLS(bid: string, uid: string, s: SavedState) {
    try { localStorage.setItem(LS_KEY(bid, uid), JSON.stringify(s)); } catch { }
}
function clearLS(bid: string, uid: string) {
    try { localStorage.removeItem(LS_KEY(bid, uid)); } catch { }
}

// Timer
function Timer({ endMs, onExpire }: { endMs: number; onExpire: () => void }) {
    const [rem, setRem] = useState(Math.max(0, endMs - Date.now()));
    const firedRef = useRef(false);
    useEffect(() => {
        const t = setInterval(() => {
            const r = Math.max(0, endMs - Date.now());
            setRem(r);
            if (r === 0 && !firedRef.current) { firedRef.current = true; onExpire(); }
        }, 1000);
        return () => clearInterval(t);
    }, [endMs, onExpire]);
    const secs = Math.ceil(rem / 1000);
    const m = Math.floor(secs / 60), s = secs % 60;
    const urgent = rem < 60_000;
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-bold text-sm transition-all ${urgent ? "bg-[#FEE2E2] text-[#EF4444] border border-[#FECACA] animate-pulse" : "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"}`}>
            <Clock className="w-3.5 h-3.5" />{pad(m)}:{pad(s)}
        </div>
    );
}

// Opponent progress indicator (live from Realtime)
function OpponentProgress({ answersCount, total, name }: { answersCount: number; total: number; name: string }) {
    const pct = Math.round((answersCount / total) * 100);
    return (
        <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl px-4 py-2.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#EF4444] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {name[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-[#991B1B]">{name}</span>
                    <span className="text-[#EF4444] font-bold">{answersCount}/{total}</span>
                </div>
                <div className="h-1.5 bg-[#FECACA] rounded-full overflow-hidden">
                    <div className="h-full bg-[#EF4444] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
            </div>
            <Swords className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
        </div>
    );
}

export default function BattleQuizPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [battle, setBattle] = useState<QuizBattle | null>(null);
    const [questions, setQuestions] = useState<ContestQuestion[]>([]);
    const [answers, setAnswers] = useState<(number | null)[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);
    const [opponentName, setOpponentName] = useState("Opponent");
    const [opponentAnswersCount, setOpponentAnswersCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [endMs, setEndMs] = useState(0);
    const [startedAt, setStartedAt] = useState(0);
    const submittedRef = useRef(false);

    const load = useCallback(async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const [{ data: b }, { data: myResult }] = await Promise.all([
            supabase.from("quiz_battles")
                .select(`*, player_one_profile:profiles!quiz_battles_player_one_fkey(full_name, email), player_two_profile:profiles!quiz_battles_player_two_fkey(full_name, email)`)
                .eq("id", id).single(),
            supabase.from("battle_results").select("id").eq("battle_id", id).eq("user_id", user.id).maybeSingle(),
        ]);

        if (myResult) { router.replace(`/dashboard/battles/${id}/results`); return; }

        if (!b || b.status !== "live") {
            if (b?.status === "ended") { router.replace(`/dashboard/battles/${id}/results`); return; }
            setError(b ? `Battle is not live yet (status: ${b.status}).` : "Battle not found.");
            setLoading(false); return;
        }

        if (b.player_one !== user.id && b.player_two !== user.id) {
            setError("You are not a participant in this battle."); setLoading(false); return;
        }

        const isP1 = b.player_one === user.id;
        const opp = isP1 ? b.player_two_profile : b.player_one_profile;
        setOpponentName(opp?.full_name ?? opp?.email ?? "Opponent");

        const qs: ContestQuestion[] = b.question_set ?? [];
        if (qs.length === 0) { setError("No questions found."); setLoading(false); return; }

        // Battle ends 10 minutes after started_at (or custom — use 10min fixed for battles)
        const BATTLE_DURATION_MS = 10 * 60_000;
        const startedMs = b.started_at ? new Date(b.started_at).getTime() : Date.now();
        const end = startedMs + BATTLE_DURATION_MS;
        setEndMs(end);

        const saved = loadFromLS(id, user.id);
        const sa = saved?.startedAt ?? Date.now();
        setStartedAt(sa);
        setAnswers(saved?.answers ?? Array(qs.length).fill(null));

        // Count opponent's answers
        const opponentId = isP1 ? b.player_two : b.player_one;
        if (opponentId) {
            const { count } = await supabase
                .from("battle_answers")
                .select("*", { count: "exact", head: true })
                .eq("battle_id", id)
                .eq("user_id", opponentId);
            setOpponentAnswersCount(count ?? 0);
        }

        setBattle(b as QuizBattle);
        setQuestions(qs);
        setLoading(false);
    }, [id, router]);

    useEffect(() => { load(); }, [load]);

    // Persist answers to localStorage
    useEffect(() => {
        if (!userId || answers.length === 0) return;
        saveToLS(id, userId, { answers, startedAt });
    }, [answers, id, userId, startedAt]);

    // Realtime — watch opponent's battle_answers for progress
    useEffect(() => {
        if (!userId || !battle) return;
        const supabase = createClient();
        const opponentId = battle.player_one === userId ? battle.player_two : battle.player_one;
        if (!opponentId) return;

        const ch = supabase.channel(`battle-opponent-${id}`)
            .on("postgres_changes", {
                event: "INSERT", schema: "public", table: "battle_answers",
                filter: `battle_id=eq.${id}`,
            }, (payload) => {
                const ans = payload.new as { user_id: string };
                if (ans.user_id === opponentId) {
                    setOpponentAnswersCount(prev => prev + 1);
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [id, userId, battle]);

    const handleSubmit = useCallback(async () => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        setSubmitting(true);

        const timeTaken = Math.round((Date.now() - startedAt) / 1000);
        const supabase = createClient();
        const score = answers.filter((a, i) => a === questions[i].correctIndex).length;
        const totalQs = questions.length;
        const accuracy = Math.round((score / totalQs) * 100 * 100) / 100;

        const answerRows = questions.map((q, i) => ({
            battle_id: id,
            user_id: userId!,
            question_id: q.id,
            selected_answer: answers[i] != null ? q.options[answers[i]!] : "",
            is_correct: answers[i] === q.correctIndex,
        }));

        await supabase.from("battle_answers").insert(answerRows);

        const { error: dbErr } = await supabase.from("battle_results").upsert(
            { battle_id: id, user_id: userId!, score, total_questions: totalQs, accuracy, time_taken_seconds: timeTaken },
            { onConflict: "battle_id,user_id" }
        );

        if (dbErr) { setError(dbErr.message); setSubmitting(false); submittedRef.current = false; return; }

        // Check if opponent already submitted — if so, declare winner and end battle
        const { data: allResults } = await supabase.from("battle_results").select("*").eq("battle_id", id);
        if (allResults && allResults.length >= 2) {
            // Both submitted — determine winner (score DESC, time ASC)
            const sorted = [...allResults].sort((a, b) => b.score - a.score || a.time_taken_seconds - b.time_taken_seconds);
            const winner = sorted[0].user_id;
            await supabase.from("quiz_battles").update({ status: "ended", ended_at: new Date().toISOString(), winner }).eq("id", id);
        }

        clearLS(id, userId!);
        router.replace(`/dashboard/battles/${id}/results`);
    }, [id, userId, questions, answers, startedAt, router]);

    const handleTimerExpire = useCallback(() => handleSubmit(), [handleSubmit]);

    const selectAnswer = (optIdx: number) => {
        if (submitting) return;
        setAnswers(prev => { const next = [...prev]; next[currentQ] = optIdx; return next; });
    };

    if (loading) return (
        <div className="flex items-center justify-center py-32 text-[#6B7280]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading battle…
        </div>
    );

    if (error) return (
        <div className="max-w-md mx-auto text-center py-20">
            <AlertCircle className="w-14 h-14 text-[#EF4444] mx-auto mb-4" />
            <h2 className="text-xl font-black text-[#111827] mb-2">Cannot Enter Battle</h2>
            <p className="text-[#6B7280]">{error}</p>
        </div>
    );

    if (submitting) return (
        <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in-up">
            <div className="text-4xl mb-4">⚔️</div>
            <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin mb-3" />
            <h2 className="text-lg font-black text-[#111827] mb-1">Submitting your answers…</h2>
            <p className="text-sm text-[#6B7280]">Calculating who won the battle!</p>
        </div>
    );

    const q = questions[currentQ];
    const userAnswer = answers[currentQ];
    const answeredCount = answers.filter(a => a !== null).length;
    const answeredAll = answers.every(a => a !== null);
    const progress = (answeredCount / questions.length) * 100;

    return (
        <div className="max-w-2xl mx-auto animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-base font-black text-[#111827]">⚔️ {battle!.topic} Battle</h1>
                    <p className="text-xs text-[#9CA3AF] capitalize">{battle!.difficulty}</p>
                </div>
                <Timer endMs={endMs} onExpire={handleTimerExpire} />
            </div>

            {/* Opponent progress */}
            <div className="mb-4">
                <OpponentProgress answersCount={opponentAnswersCount} total={questions.length} name={opponentName} />
            </div>

            {/* My progress bar */}
            <div className="bg-[#F3F4F6] rounded-full h-2 mb-5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>

            {/* Question navigation dots */}
            <div className="flex gap-1.5 mb-5 flex-wrap">
                {questions.map((_, i) => (
                    <button key={i} onClick={() => setCurrentQ(i)}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${i === currentQ ? "bg-[#6366F1] text-white scale-110 shadow-md" : answers[i] !== null ? "bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]" : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]"}`}>
                        {i + 1}
                    </button>
                ))}
            </div>

            {/* Question card */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-[#6366F1] uppercase tracking-wider">Question {currentQ + 1} of {questions.length}</span>
                    <span className="text-xs text-[#9CA3AF]">{answeredCount}/{questions.length} answered</span>
                </div>
                <p className="text-base font-semibold text-[#111827] leading-relaxed mb-4">{q.question}</p>
                {q.code && (
                    <pre className="bg-[#0F172A] text-[#E2E8F0] text-xs font-mono rounded-xl p-4 mb-4 overflow-x-auto border border-[#1E293B]">
                        <code>{q.code}</code>
                    </pre>
                )}
                <div className="grid grid-cols-1 gap-2.5">
                    {q.options.filter(o => o).map((opt, i) => {
                        const isSelected = userAnswer === i;
                        return (
                            <button key={i} onClick={() => selectAnswer(i)}
                                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all
                  ${isSelected
                                        ? "border-[#6366F1] bg-[#EEF2FF] text-[#4338CA] ring-2 ring-[#6366F1]/20"
                                        : "border-[#E5E7EB] hover:border-[#6366F1] hover:bg-[#F5F3FF] text-[#374151] cursor-pointer"}`}>
                                <span className={`font-black mr-2.5 ${isSelected ? "text-[#6366F1]" : "text-[#9CA3AF]"}`}>{["A", "B", "C", "D"][i]}.</span>
                                {opt}
                                {isSelected && <CheckCircle className="w-4 h-4 text-[#6366F1] inline ml-2" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Unanswered warning */}
            {!answeredAll && (
                <div className="flex items-center gap-2 text-xs text-[#F59E0B] bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-2.5 mb-4">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {questions.length - answeredCount} unanswered — unanswered = wrong
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
                <button onClick={() => setCurrentQ(i => i - 1)} disabled={currentQ === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#6B7280] border border-[#E5E7EB] bg-white rounded-xl hover:bg-[#F9FAFB] disabled:opacity-40 disabled:pointer-events-none transition-all">
                    <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <div className="flex items-center gap-2">
                    {currentQ < questions.length - 1 && (
                        <button onClick={() => setCurrentQ(i => i + 1)}
                            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl transition-all">
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => handleSubmit()} disabled={submitting}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-xl transition-all hover:shadow-lg disabled:opacity-50">
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Swords className="w-4 h-4" /> Submit</>}
                    </button>
                </div>
            </div>

            {/* Summary bar */}
            <div className="mt-6 border border-[#E5E7EB] bg-white rounded-xl px-5 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[#10B981] font-bold"><CheckCircle className="w-3.5 h-3.5" /> {answeredCount} answered</span>
                    {questions.length - answeredCount > 0 && (
                        <span className="flex items-center gap-1 text-[#F59E0B] font-bold"><XCircle className="w-3.5 h-3.5" /> {questions.length - answeredCount} skipped</span>
                    )}
                </div>
                <span className="flex items-center gap-1 text-[#9CA3AF] text-xs"><Brain className="w-3.5 h-3.5" /> {battle!.topic}</span>
            </div>
        </div>
    );
}
