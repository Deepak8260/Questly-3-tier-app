"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Loader2, Clock, Swords,
    CheckCircle, AlertCircle, BookOpen, Zap, Radio, Mail, Hourglass
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { QuizBattle } from "@/app/dashboard/battles/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

function Countdown({ targetMs, onExpire }: { targetMs: number; onExpire: () => void }) {
    const [diff, setDiff] = useState(Math.max(0, targetMs - Date.now()));
    const firedRef = useRef(false);

    useEffect(() => {
        const t = setInterval(() => {
            const d = Math.max(0, targetMs - Date.now());
            setDiff(d);
            if (d === 0 && !firedRef.current) { firedRef.current = true; onExpire(); }
        }, 1000);
        return () => clearInterval(t);
    }, [targetMs, onExpire]);

    const secs = Math.ceil(diff / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;

    return (
        <div className="flex items-center justify-center gap-3">
            {[{ v: m, l: "Min" }, { v: s, l: "Sec" }].map(({ v, l }, i) => (
                <div key={l} className="flex items-center gap-3">
                    {i > 0 && <div className="text-2xl font-medium text-[#DEDCD3] -mt-6">:</div>}
                    <div className="text-center">
                        <div className="w-20 h-20 bg-[#1B1B18] flex items-center justify-center font-heading text-3xl font-medium text-white">
                            {pad(v)}
                        </div>
                        <div className="text-xs font-semibold text-[#8C8B82] mt-1.5">{l}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function BattleLobbyPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [battle, setBattle] = useState<QuizBattle | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [canStart, setCanStart] = useState(false);
    const [countdown30, setCountdown30] = useState<number | null>(null); // 30s auto countdown after accepted

    const load = useCallback(async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const { data: b } = await supabase
            .from("quiz_battles")
            .select(`
        *,
        player_one_profile:profiles!quiz_battles_player_one_fkey(full_name, email),
        player_two_profile:profiles!quiz_battles_player_two_fkey(full_name, email)
      `)
            .eq("id", id)
            .single();

        if (!b) { setError("Battle not found."); setLoading(false); return; }

        // Guard: user must be a participant
        if (b.player_one !== user.id && b.player_two !== user.id) {
            setError("You are not a participant in this battle.");
            setLoading(false); return;
        }

        // Already submitted → results
        const { data: myResult } = await supabase
            .from("battle_results")
            .select("id")
            .eq("battle_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
        if (myResult) { router.replace(`/dashboard/battles/${id}/results`); return; }

        setBattle(b as QuizBattle);

        if (b.status === "live") { router.replace(`/dashboard/battles/${id}/quiz`); return; }
        if (b.status === "ended") { router.replace(`/dashboard/battles/${id}/results`); return; }
        if (["declined", "cancelled"].includes(b.status)) {
            setError(`Battle was ${b.status}.`); setLoading(false); return;
        }

        // If accepted, start 30s countdown
        if (b.status === "accepted") {
            setCountdown30(Date.now() + 30_000);
        }

        setLoading(false);
    }, [id, router]);

    useEffect(() => { load(); }, [load]);

    // Realtime — watch battle status
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel(`battle-lobby-${id}`)
            .on("postgres_changes", {
                event: "UPDATE", schema: "public", table: "quiz_battles",
                filter: `id=eq.${id}`,
            }, (payload) => {
                const updated = payload.new as QuizBattle;
                setBattle(updated as QuizBattle);
                if (updated.status === "live") { router.replace(`/dashboard/battles/${id}/quiz`); }
                if (updated.status === "ended") { router.replace(`/dashboard/battles/${id}/results`); }
                if (updated.status === "accepted") { setCountdown30(Date.now() + 30_000); }
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [id, router]);

    const handleStartBattle = async () => {
        const supabase = createClient();
        await supabase.from("quiz_battles").update({ status: "live", started_at: new Date().toISOString() }).eq("id", id);
        router.push(`/dashboard/battles/${id}/quiz`);
    };

    if (loading) return (
        <div className="flex items-center justify-center py-32 text-[#8C8B82]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading battle lobby…
        </div>
    );

    if (error) return (
        <div className="max-w-md mx-auto text-center py-20">
            <AlertCircle className="w-12 h-12 text-[#8C2E24] mx-auto mb-4" />
            <h2 className="font-heading text-xl font-medium text-[#1B1B18] mb-2">Battle unavailable</h2>
            <p className="text-[#5B5A52] mb-5">{error}</p>
            <Link href="/dashboard/battles"
                className="inline-flex items-center gap-2 bg-[#6B2737] text-white font-medium px-5 py-2.5 hover:bg-[#551F2C] transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to battles
            </Link>
        </div>
    );

    if (!battle) return null;

    const isPlayerOne = battle.player_one === userId;
    const myProfile = isPlayerOne ? battle.player_one_profile : battle.player_two_profile;
    const opponentProfile = isPlayerOne ? battle.player_two_profile : battle.player_one_profile;
    const opponentName = opponentProfile?.full_name ?? opponentProfile?.email ?? (battle.player_two ? "Opponent" : "Waiting for opponent…");
    const myName = myProfile?.full_name ?? myProfile?.email ?? "You";
    const isPending = battle.status === "pending";
    const isAccepted = battle.status === "accepted";
    const hasOpponent = Boolean(battle.player_two);

    return (
        <div className="max-w-xl mx-auto">
            <Link href="/dashboard/battles"
                className="inline-flex items-center gap-1.5 text-[#5B5A52] hover:text-[#1B1B18] text-sm font-medium mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> All battles
            </Link>

            {/* Battle header card */}
            <div className="bg-white border border-[#DEDCD3] overflow-hidden mb-5">
                <div className="bg-[#1B1B18] px-6 py-5">
                    <div className="flex items-center gap-2 mb-2">
                        {isAccepted ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#2F6B3A] bg-white px-2.5 py-1 border border-[#B8D8B8]">
                                <CheckCircle className="w-3 h-3" /> Ready
                            </span>
                        ) : (
                            <span className="text-xs font-semibold text-[#B5677A] bg-[#2E1A20] px-2.5 py-1 border border-[#4A2A30]">
                                LOBBY
                            </span>
                        )}
                    </div>
                    <h1 className="font-heading text-xl font-medium text-white flex items-center gap-2">
                        <Swords className="w-4 h-4 text-[#B5677A]" /> {battle.topic}
                    </h1>
                    <p className="text-sm text-[#ABA99C] mt-0.5 capitalize">{battle.difficulty} · {battle.questions_count} questions · {battle.mode} match</p>
                </div>

                {/* Players vs */}
                <div className="px-6 py-5">
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex-1 text-center">
                            <div className="w-14 h-14 bg-[#6B2737] flex items-center justify-center text-white text-xl font-semibold mx-auto mb-2">
                                {myName[0]?.toUpperCase()}
                            </div>
                            <div className="text-sm font-semibold text-[#1B1B18]">{myName}</div>
                            <div className="text-xs text-[#8C8B82]">You</div>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className="font-heading text-2xl font-medium text-[#DEDCD3]">VS</div>
                            <Swords className="w-4 h-4 text-[#6B2737] mt-1" />
                        </div>

                        <div className="flex-1 text-center">
                            {hasOpponent ? (
                                <>
                                    <div className="w-14 h-14 bg-[#3F3E38] flex items-center justify-center text-white text-xl font-semibold mx-auto mb-2">
                                        {opponentName[0]?.toUpperCase()}
                                    </div>
                                    <div className="text-sm font-semibold text-[#1B1B18]">{opponentName}</div>
                                    <div className="text-xs text-[#8C8B82]">Opponent</div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="w-14 h-14 border-2 border-dashed border-[#DEDCD3] flex items-center justify-center text-lg text-[#8C8B82] mx-auto mb-2">
                                        ?
                                    </div>
                                    <div className="text-xs text-[#8C8B82]">Waiting for opponent…</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="px-6 py-4 grid grid-cols-3 gap-4 border-t border-[#EAE8E1]">
                    {[
                        { icon: <BookOpen className="w-4 h-4" />, label: "Topic", value: battle.topic },
                        { icon: <Zap className="w-4 h-4" />, label: "Questions", value: `${battle.questions_count} Qs` },
                        { icon: <Clock className="w-4 h-4" />, label: "Mode", value: battle.mode === "friend" ? "Friend" : "Random" },
                    ].map(m => (
                        <div key={m.label} className="text-center">
                            <div className="flex justify-center text-[#8C8B82] mb-1">{m.icon}</div>
                            <div className="text-sm font-semibold text-[#1B1B18] truncate">{m.value}</div>
                            <div className="text-[10px] text-[#8C8B82]">{m.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Countdown / Status */}
            <div className="bg-white border border-[#DEDCD3] p-8 mb-5 text-center">
                {isPending && !hasOpponent && (
                    <div>
                        <Hourglass className="w-9 h-9 text-[#8C8B82] mx-auto mb-3" />
                        <h2 className="font-heading text-lg font-medium text-[#3F3E38] mb-1">Waiting for opponent to join…</h2>
                        <p className="text-sm text-[#8C8B82]">
                            {battle.mode === "random" ? "We'll match you with someone soon." : "Your friend needs to accept the challenge."}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6B2737] bg-[#F3E7E9] px-4 py-2 mx-auto w-fit">
                            <Radio className="w-3 h-3 animate-pulse" /> Live — refreshes automatically
                        </div>
                    </div>
                )}
                {isPending && hasOpponent && (
                    <div>
                        <Mail className="w-9 h-9 text-[#8C8B82] mx-auto mb-3" />
                        <h2 className="font-heading text-lg font-medium text-[#3F3E38] mb-1">Challenge sent to {opponentName}</h2>
                        <p className="text-sm text-[#8C8B82]">Waiting for them to accept…</p>
                    </div>
                )}
                {isAccepted && (
                    <div>
                        <div className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-5">Battle begins in</div>
                        {countdown30 && (
                            <Countdown targetMs={countdown30} onExpire={() => setCanStart(true)} />
                        )}
                        <p className="text-xs text-[#8C8B82] mt-5">Both players are ready. Start when the countdown ends.</p>
                    </div>
                )}
            </div>

            {/* Rules */}
            <div className="bg-[#FAFAF8] border border-[#DEDCD3] p-5 mb-6">
                <h3 className="text-sm font-semibold text-[#3F3E38] mb-3 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5 text-[#6B2737]" /> Battle rules</h3>
                <ul className="space-y-2 text-sm text-[#5B5A52]">
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" />Both players receive identical questions</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" />Ranking: highest score, then fastest completion time</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" />No re-attempts — each player submits once</li>
                    <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#2F6B3A] flex-shrink-0 mt-0.5" />Unanswered questions count as wrong</li>
                </ul>
            </div>

            {/* Start button */}
            {isAccepted && (
                <button
                    onClick={handleStartBattle}
                    disabled={!canStart && !isPlayerOne}
                    className={`w-full flex items-center justify-center gap-3 py-4 font-medium text-lg transition-colors
            ${canStart || isPlayerOne
                            ? "bg-[#6B2737] text-white hover:bg-[#551F2C] cursor-pointer"
                            : "bg-[#EDECE6] text-[#8C8B82] cursor-not-allowed"
                        }`}>
                    {canStart || isPlayerOne ? (
                        <><Swords className="w-5 h-5" /> Start battle now</>
                    ) : (
                        <><Clock className="w-5 h-5" /> Waiting for countdown…</>
                    )}
                </button>
            )}
        </div>
    );
}