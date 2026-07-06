"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Swords, Loader2, Zap, Users, Clock, Trophy,
    Search, RefreshCw, CheckCircle, XCircle,
    Radio, BookOpen, AlertCircle, X, Shield, Info
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { QuizBattle, BattleDifficulty } from "./types";

const TOPICS = [
    "Python Basics", "JavaScript ES6", "Machine Learning", "SQL",
    "React.js", "Data Structures", "Linear Algebra", "World History",
    "Biology", "Calculus", "TypeScript", "Node.js",
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

const STATUS_COLOR: Record<string, string> = {
    pending: "bg-[#F5EEDD] text-[#93670F] border-[#E3CE9C]",
    accepted: "bg-[#F3E7E9] text-[#6B2737] border-[#DCC0C6]",
    live: "bg-[#E9F1E9] text-[#2F6B3A] border-[#B8D8B8]",
    ended: "bg-[#EDECE6] text-[#5B5A52] border-[#DEDCD3]",
    declined: "bg-[#F5E7E4] text-[#8C2E24] border-[#E0B8AF]",
    cancelled: "bg-[#EDECE6] text-[#8C8B82] border-[#DEDCD3]",
};

const DIFF_STYLE: Record<BattleDifficulty, string> = {
    easy: "text-[#2F6B3A]",
    medium: "text-[#93670F]",
    hard: "text-[#8C2E24]",
};

// ── Challenge Modal ────────────────────────────────────────────
function ChallengeModal({ userId, onClose, onCreated }: {
    userId: string;
    onClose: () => void;
    onCreated: (id: string) => void;
}) {
    const [email, setEmail] = useState("");
    const [topic, setTopic] = useState("");
    const [difficulty, setDifficulty] = useState<BattleDifficulty>("medium");
    const [count, setCount] = useState(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChallenge = async () => {
        if (!email.trim()) { setError("Enter opponent's email."); return; }
        if (!topic.trim()) { setError("Select a topic."); return; }
        setError(""); setLoading(true);
        const supabase = createClient();

        // Look up opponent by email in profiles
        const { data: opponent } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email.trim().toLowerCase())
            .maybeSingle();

        if (!opponent) {
            setError("No user found with that email. They must have logged in at least once.");
            setLoading(false); return;
        }
        if (opponent.id === userId) {
            setError("You cannot challenge yourself.");
            setLoading(false); return;
        }

        // Generate questions
        const res = await fetch("/api/quiz/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, difficulty, numQuestions: count, questionType: "mcq", aiMode: "standard" }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error ?? "Failed to generate questions."); setLoading(false); return; }

        const { data: battle, error: dbErr } = await supabase
            .from("quiz_battles")
            .insert({
                player_one: userId,
                player_two: opponent.id,
                topic,
                difficulty,
                questions_count: count,
                question_set: data.quiz.questions,
                mode: "friend",
                status: "pending",
            })
            .select("id")
            .single();

        if (dbErr) { setError(dbErr.message); setLoading(false); return; }
        setLoading(false);
        onCreated(battle.id);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white max-w-md w-full border border-[#DEDCD3] overflow-hidden">
                <div className="bg-[#1B1B18] px-6 py-5 border-b border-[#35352C]">
                    <Swords className="w-6 h-6 text-white mb-2" />
                    <h2 className="font-heading text-lg font-medium text-white">Challenge a friend</h2>
                    <p className="text-sm text-[#ABA99C]">Enter their email to send a battle invite</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-[#8C2E24] bg-[#F5E7E4] border border-[#E0B8AF] px-4 py-2.5">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-1.5">Opponent email</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8B82]" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="friend@example.com"
                                className="w-full pl-9 pr-4 py-2.5 border border-[#DEDCD3] text-sm focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-1.5">Topic</label>
                        <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                            placeholder="e.g. Python Basics" list="challenge-topics"
                            className="w-full px-4 py-2.5 border border-[#DEDCD3] text-sm focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all" />
                        <datalist id="challenge-topics">{TOPICS.map(t => <option key={t} value={t} />)}</datalist>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-1.5">Difficulty</label>
                            <div className="flex gap-1.5">
                                {(["easy", "medium", "hard"] as BattleDifficulty[]).map(d => (
                                    <button key={d} onClick={() => setDifficulty(d)}
                                        className={`flex-1 py-2 text-xs font-semibold border capitalize transition-colors ${difficulty === d ? "border-[#6B2737] bg-[#F3E7E9] text-[#6B2737]" : "border-[#DEDCD3] text-[#5B5A52] hover:border-[#ABA99C]"}`}>
                                        {d[0].toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-1.5">Questions: {count}</label>
                            <input type="range" min={5} max={20} step={5} value={count} onChange={e => setCount(+e.target.value)}
                                className="w-full accent-[#6B2737] mt-2" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onClose} disabled={loading}
                        className="flex-1 py-3 text-sm font-medium text-[#5B5A52] border border-[#DEDCD3] hover:bg-[#FAFAF8] transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleChallenge} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] transition-colors disabled:opacity-60">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Swords className="w-4 h-4" /> Send challenge</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Quick Match Modal ─────────────────────────────────────────
function QuickMatchModal({ userId, onClose, onJoined }: {
    userId: string;
    onClose: () => void;
    onJoined: (id: string) => void;
}) {
    const [topic, setTopic] = useState("Python Basics");
    const [difficulty, setDifficulty] = useState<BattleDifficulty>("medium");
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState("");

    const handleMatch = async () => {
        setError(""); setSearching(true);
        const supabase = createClient();

        // Look for an existing random battle waiting for player 2
        const { data: existing } = await supabase
            .from("quiz_battles")
            .select("id")
            .eq("mode", "random")
            .eq("status", "pending")
            .eq("topic", topic)
            .eq("difficulty", difficulty)
            .is("player_two", null)
            .neq("player_one", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        if (existing) {
            // Join existing battle
            const { error: e } = await supabase
                .from("quiz_battles")
                .update({ player_two: userId, status: "accepted" })
                .eq("id", existing.id);
            if (e) { setError(e.message); setSearching(false); return; }
            setSearching(false);
            onJoined(existing.id);
            return;
        }

        // No match found — create a new random battle and wait
        const res = await fetch("/api/quiz/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, difficulty, numQuestions: 10, questionType: "mcq", aiMode: "standard" }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setError(data.error ?? "Failed to generate quiz."); setSearching(false); return; }

        const { data: battle, error: dbErr } = await supabase
            .from("quiz_battles")
            .insert({
                player_one: userId,
                topic, difficulty,
                questions_count: 10,
                question_set: data.quiz.questions,
                mode: "random",
                status: "pending",
            })
            .select("id")
            .single();

        if (dbErr) { setError(dbErr.message); setSearching(false); return; }
        setSearching(false);
        onJoined(battle.id);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white max-w-sm w-full border border-[#DEDCD3] overflow-hidden">
                <div className="bg-[#1B1B18] px-6 py-5 border-b border-[#35352C]">
                    <Zap className="w-6 h-6 text-white mb-2" />
                    <h2 className="font-heading text-lg font-medium text-white">Quick match</h2>
                    <p className="text-sm text-[#ABA99C]">Get matched with a random opponent</p>
                </div>
                <div className="px-6 py-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-[#8C2E24] bg-[#F5E7E4] border border-[#E0B8AF] px-4 py-2.5">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-1.5">Topic</label>
                        <select value={topic} onChange={e => setTopic(e.target.value)}
                            className="w-full px-4 py-2.5 border border-[#DEDCD3] text-sm focus:outline-none focus:border-[#6B2737] bg-white">
                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-1.5">Difficulty</label>
                        <div className="flex gap-2">
                            {(["easy", "medium", "hard"] as BattleDifficulty[]).map(d => (
                                <button key={d} onClick={() => setDifficulty(d)}
                                    className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${difficulty === d ? "bg-[#6B2737] text-white" : "border border-[#DEDCD3] text-[#5B5A52] hover:border-[#ABA99C]"}`}>
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="bg-[#FAFAF8] border border-[#DEDCD3] p-3 text-xs text-[#5B5A52] flex gap-2">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#6B2737]" />
                        <span>10 questions. We&apos;ll find you an opponent instantly or create a room for others to join.</span>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-5">
                    <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-[#5B5A52] border border-[#DEDCD3] hover:bg-[#FAFAF8] transition-colors">Cancel</button>
                    <button onClick={handleMatch} disabled={searching}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] transition-colors disabled:opacity-60">
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Find match</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Battle Row ────────────────────────────────────────────────
function BattleRow({ battle, userId, onAccept, onDecline }: {
    battle: QuizBattle;
    userId: string;
    onAccept: (id: string) => void;
    onDecline: (id: string) => void;
}) {
    const opponent = battle.player_one === userId
        ? battle.player_two_profile
        : battle.player_one_profile;
    const opponentName = opponent?.full_name ?? opponent?.email ?? "Unknown";
    const isChallenger = battle.player_one === userId;
    const isPending = battle.status === "pending";
    const isLive = battle.status === "live";
    const isAccepted = battle.status === "accepted";

    let href = `/dashboard/battles/${battle.id}/lobby`;
    if (isLive) href = `/dashboard/battles/${battle.id}/quiz`;
    if (battle.status === "ended") href = `/dashboard/battles/${battle.id}/results`;

    return (
        <div className={`bg-white border px-5 py-4 flex items-center gap-4 transition-colors
      ${isLive ? "border-[#2F6B3A]" : isPending && !isChallenger ? "border-[#6B2737]" : "border-[#DEDCD3]"}`}>
            {/* Opponent avatar */}
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-white text-base font-semibold"
                style={{ backgroundColor: isLive ? "#2F6B3A" : "#6B2737" }}>
                {opponentName[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#1B1B18] truncate">vs {opponentName}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 border capitalize ${STATUS_COLOR[battle.status] ?? ""}`}>
                        {isLive ? "Live now" : battle.status}
                    </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#8C8B82] mt-0.5">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {battle.topic}</span>
                    <span className={`font-medium capitalize ${DIFF_STYLE[battle.difficulty] ?? ""}`}>{battle.difficulty}</span>
                    <span>{timeAgo(battle.created_at)}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {/* Pending and I'm challenged */}
                {isPending && !isChallenger && (
                    <>
                        <button onClick={() => onDecline(battle.id)}
                            className="p-2 text-[#8C2E24] hover:bg-[#F5E7E4] transition-colors" title="Decline">
                            <XCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => onAccept(battle.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#2F6B3A] hover:bg-[#255A2E] text-white text-xs font-medium transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> Accept
                        </button>
                    </>
                )}
                {/* Pending and I'm challenger — waiting */}
                {isPending && isChallenger && (
                    <span className="text-xs text-[#8C8B82] italic flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Waiting…
                    </span>
                )}
                {/* Accepted or live — enter */}
                {(isAccepted || isLive) && (
                    <Link href={href}
                        className={`flex items-center gap-1.5 px-3 py-2 text-white text-xs font-medium transition-colors
              ${isLive ? "bg-[#2F6B3A] hover:bg-[#255A2E]" : "bg-[#6B2737] hover:bg-[#551F2C]"}`}>
                        <Swords className="w-3.5 h-3.5" />
                        {isLive ? "Enter battle" : "View lobby"}
                    </Link>
                )}
                {/* Ended */}
                {battle.status === "ended" && (
                    <Link href={href}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#FAFAF8] border border-[#DEDCD3] text-[#5B5A52] text-xs font-medium hover:bg-white transition-colors">
                        <Trophy className="w-3.5 h-3.5" /> Results
                    </Link>
                )}
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────
export default function BattlesPage() {
    const router = useRouter();
    const [battles, setBattles] = useState<QuizBattle[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showChallenge, setShowChallenge] = useState(false);
    const [showQuickMatch, setShowQuickMatch] = useState(false);
    const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const showFlash = (type: "success" | "error", text: string) => {
        setFlash({ type, text });
        setTimeout(() => setFlash(null), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        setUserId(user.id);

        const { data } = await supabase
            .from("quiz_battles")
            .select(`
        *,
        player_one_profile:profiles!quiz_battles_player_one_fkey(full_name, email),
        player_two_profile:profiles!quiz_battles_player_two_fkey(full_name, email)
      `)
            .or(`player_one.eq.${user.id},player_two.eq.${user.id}`)
            .order("created_at", { ascending: false })
            .limit(30);

        setBattles((data as QuizBattle[]) ?? []);
        setLoading(false);
    }, [router]);

    useEffect(() => { load(); }, [load]);

    // Realtime: refresh when battle status changes
    useEffect(() => {
        const supabase = createClient();
        const ch = supabase.channel("my-battles")
            .on("postgres_changes", { event: "*", schema: "public", table: "quiz_battles" }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [load]);

    const handleAccept = async (battleId: string) => {
        const supabase = createClient();
        const { error } = await supabase
            .from("quiz_battles")
            .update({ status: "accepted" })
            .eq("id", battleId);
        if (error) showFlash("error", error.message);
        else { showFlash("success", "Challenge accepted! Head to the lobby."); await load(); }
    };

    const handleDecline = async (battleId: string) => {
        const supabase = createClient();
        await supabase.from("quiz_battles").update({ status: "declined" }).eq("id", battleId);
        await load();
    };

    const activeBattles = battles.filter(b => ["pending", "accepted", "live"].includes(b.status));
    const pastBattles = battles.filter(b => ["ended", "declined", "cancelled"].includes(b.status));
    const pendingIncoming = activeBattles.filter(b => b.status === "pending" && b.player_two === userId);

    return (
        <div className="max-w-3xl mx-auto">

            {/* Modals */}
            {showChallenge && userId && (
                <ChallengeModal userId={userId} onClose={() => setShowChallenge(false)}
                    onCreated={(id) => { setShowChallenge(false); showFlash("success", "Challenge sent! Waiting for opponent."); router.push(`/dashboard/battles/${id}/lobby`); }} />
            )}
            {showQuickMatch && userId && (
                <QuickMatchModal userId={userId} onClose={() => setShowQuickMatch(false)}
                    onJoined={(id) => { setShowQuickMatch(false); router.push(`/dashboard/battles/${id}/lobby`); }} />
            )}

            {/* Flash */}
            {flash && (
                <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3 text-sm font-medium max-w-sm border
          ${flash.type === "success" ? "bg-[#E9F1E9] text-[#2F6B3A] border-[#B8D8B8]" : "bg-[#F5E7E4] text-[#8C2E24] border-[#E0B8AF]"}`}>
                    {flash.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span className="flex-1">{flash.text}</span>
                    <button onClick={() => setFlash(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="font-heading text-2xl font-medium text-[#1B1B18] mb-1 flex items-center gap-2.5">
                        <Swords className="w-5 h-5 text-[#6B2737]" /> 1v1 battle mode
                    </h1>
                    <p className="text-sm text-[#5B5A52]">Challenge friends or get matched for a head-to-head quiz duel.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/battles/leaderboard"
                        className="flex items-center gap-1.5 px-3 py-2.5 border border-[#DEDCD3] bg-white text-[#5B5A52] text-sm font-medium hover:bg-[#FAFAF8] transition-colors">
                        <Trophy className="w-4 h-4" /> Rankings
                    </Link>
                    <button onClick={() => load()} className="p-2.5 border border-[#DEDCD3] bg-white text-[#5B5A52] hover:bg-[#FAFAF8] transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-2 gap-4 mb-7">
                <button onClick={() => setShowChallenge(true)}
                    className="bg-[#1B1B18] text-white p-5 text-left hover:bg-[#0E0E0B] transition-colors border border-[#1B1B18]">
                    <Swords className="w-6 h-6 mb-3 text-[#B5677A]" />
                    <div className="font-heading text-base font-medium">Challenge a friend</div>
                    <div className="text-xs text-[#ABA99C] mt-0.5">Send a quiz duel invite by email</div>
                </button>
                <button onClick={() => setShowQuickMatch(true)}
                    className="bg-white text-[#1B1B18] p-5 text-left border border-[#DEDCD3] hover:border-[#ABA99C] transition-colors">
                    <Zap className="w-6 h-6 mb-3 text-[#6B2737]" />
                    <div className="font-heading text-base font-medium">Quick match</div>
                    <div className="text-xs text-[#8C8B82] mt-0.5">Get matched with a random opponent</div>
                </button>
            </div>

            {/* Pending Challenges Banner */}
            {pendingIncoming.length > 0 && (
                <div className="mb-5 bg-[#F3E7E9] border border-[#DCC0C6] px-5 py-4 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[#6B2737] flex-shrink-0" />
                    <div className="text-sm font-medium text-[#6B2737]">
                        You have {pendingIncoming.length} pending challenge{pendingIncoming.length > 1 ? "s" : ""}
                    </div>
                </div>
            )}

            {/* Active Battles */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-[#8C8B82]">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your battles…
                </div>
            ) : (
                <>
                    {activeBattles.length > 0 && (
                        <div className="mb-7">
                            <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Radio className="w-3.5 h-3.5 text-[#2F6B3A]" /> Active battles ({activeBattles.length})
                            </h2>
                            <div className="space-y-3">
                                {activeBattles.map(b => (
                                    <BattleRow key={b.id} battle={b} userId={userId!}
                                        onAccept={handleAccept} onDecline={handleDecline} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Past Battles */}
                    {pastBattles.length > 0 && (
                        <div>
                            <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" /> Battle history ({pastBattles.length})
                            </h2>
                            <div className="space-y-2">
                                {pastBattles.map(b => (
                                    <BattleRow key={b.id} battle={b} userId={userId!}
                                        onAccept={handleAccept} onDecline={handleDecline} />
                                ))}
                            </div>
                        </div>
                    )}

                    {battles.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center border border-[#DEDCD3] bg-white">
                            <Swords className="w-12 h-12 text-[#DEDCD3] mb-4" />
                            <h2 className="font-heading text-xl font-medium text-[#3F3E38] mb-2">No battles yet</h2>
                            <p className="text-[#8C8B82] text-sm max-w-xs">Challenge a friend or find a random opponent to start your first quiz duel.</p>
                            <div className="flex gap-3 mt-5">
                                <button onClick={() => setShowChallenge(true)}
                                    className="flex items-center gap-2 bg-[#6B2737] text-white font-medium px-5 py-2.5 text-sm transition-colors hover:bg-[#551F2C]">
                                    <Swords className="w-4 h-4" /> Challenge friend
                                </button>
                                <button onClick={() => setShowQuickMatch(true)}
                                    className="flex items-center gap-2 border border-[#DEDCD3] text-[#3F3E38] font-medium px-5 py-2.5 text-sm transition-colors hover:bg-[#FAFAF8]">
                                    <Zap className="w-4 h-4" /> Quick match
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Stats row */}
                    {battles.length > 0 && (
                        <div className="mt-6 grid grid-cols-3 border-t border-l border-[#DEDCD3]">
                            {[
                                { label: "Total battles", value: battles.length, icon: <Swords className="w-4 h-4" /> },
                                { label: "Battles won", value: battles.filter(b => b.winner === userId).length, icon: <Trophy className="w-4 h-4" /> },
                                { label: "Win rate", value: battles.length > 0 ? `${Math.round(battles.filter(b => b.winner === userId).length / battles.filter(b => b.status === "ended").length * 100) || 0}%` : "—", icon: <Users className="w-4 h-4" /> },
                            ].map(s => (
                                <div key={s.label} className="bg-white border-r border-b border-[#DEDCD3] p-4 text-center">
                                    <div className="flex justify-center mb-1 text-[#6B2737]">{s.icon}</div>
                                    <div className="font-heading text-2xl font-medium text-[#1B1B18]">{s.value}</div>
                                    <div className="text-xs text-[#8C8B82]">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}