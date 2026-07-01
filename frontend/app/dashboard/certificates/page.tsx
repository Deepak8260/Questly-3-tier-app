"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy, Download, Lock, Loader2, AlertTriangle,
  RefreshCw, Zap, CheckCircle, Clock
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import CertificateModal from "@/components/CertificateModal";

interface Attempt {
  id: string;
  topic: string;
  difficulty: string;
  question_type: string;
  total_questions: number;
  correct_answers: number;
  score_pct: number;
  time_taken_secs: number;
  passed: boolean;
  certificate_earned: boolean;
  created_at: string;
}

/** Generate a stable certificate ID from the attempt UUID */
function makeCertId(attemptId: string, createdAt: string) {
  const date = new Date(createdAt);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = attemptId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `QLST-${ymd}-${suffix}`;
}

function relativeDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const LEVEL_GRADIENT = {
  easy:   "from-[#10B981] to-[#059669]",
  medium: "from-[#6366F1] to-[#8B5CF6]",
  hard:   "from-[#EF4444] to-[#DC2626]",
};

export default function CertificatesPage() {
  const [earned,    setEarned]    = useState<Attempt[]>([]);
  const [inProgress, setInProgress] = useState<Attempt[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [userName,  setUserName]  = useState("Learner");

  // Modal state
  const [active, setActive] = useState<Attempt | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Derive display name
    const name =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "Learner";
    setUserName(name);

    // Fetch all quiz attempts for this user
    const { data, error: dbErr } = await supabase
      .from("questly_quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbErr) {
      setError(dbErr.message);
    } else {
      const all = data ?? [];
      setEarned(all.filter(a => a.certificate_earned));

      // "In Progress" = failed attempts not already covered by a passing attempt on same topic
      const passedTopics = new Set(all.filter(a => a.passed).map(a => a.topic.toLowerCase()));
      const inProg = all
        .filter(a => !a.passed)
        .filter(a => !passedTopics.has(a.topic.toLowerCase()))
        // deduplicate by topic, keep highest score
        .reduce<Attempt[]>((acc, cur) => {
          const existing = acc.find(a => a.topic.toLowerCase() === cur.topic.toLowerCase());
          if (!existing || cur.score_pct > existing.score_pct) {
            return [...acc.filter(a => a.topic.toLowerCase() !== cur.topic.toLowerCase()), cur];
          }
          return acc;
        }, [])
        .slice(0, 6);
      setInProgress(inProg);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="animate-fade-in-up">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-[#111827] dark:text-[#f8fafc] mb-1">Certificates</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#94a3b8]">
            {loading ? "Loading…" : `${earned.length} earned · Score 70%+ on any quiz to earn one.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh"
            className="p-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#1e293b] text-[#6B7280] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          {earned.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#D1FAE5] border border-[#6EE7B7] text-[#065F46] text-xs font-bold px-3 py-1.5 rounded-full">
              <Trophy className="w-3 h-3" /> {earned.length} Earned
            </div>
          )}
          <Link href="/dashboard/generate"
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] px-4 py-2 rounded-xl transition-all hover:shadow-md">
            <Zap className="w-3.5 h-3.5" /> New Quiz
          </Link>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-[#9CA3AF]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading certificates…
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-white dark:bg-[#1e293b] border border-[#FECACA] dark:border-[#7f1d1d] rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-[#DC2626]">Could not load certificates</p>
              <p className="text-xs text-[#EF4444] font-mono mt-1">{error}</p>
              <p className="text-xs text-[#6B7280] mt-2">
                Make sure you have run the Supabase setup SQL from the <strong>My Quizzes</strong> page first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────── */}
      {!loading && !error && earned.length === 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-16 text-center mb-8">
          <div className="text-5xl mb-4">🎓</div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#f8fafc] mb-2">No certificates yet</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#94a3b8] mb-6">
            Score <strong>70% or above</strong> on any quiz to earn a certificate.
          </p>
          <Link href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg text-sm">
            <Zap className="w-4 h-4" /> Generate a Quiz
          </Link>
        </div>
      )}

      {/* ── Earned certificates grid ─────────────────────────────── */}
      {!loading && !error && earned.length > 0 && (
        <>
          <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" /> Earned Certificates
          </h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 mb-10">
            {earned.map((cert) => {
              const grad = LEVEL_GRADIENT[(cert.difficulty?.toLowerCase() ?? "medium") as keyof typeof LEVEL_GRADIENT] ?? LEVEL_GRADIENT.medium;
              const certId = makeCertId(cert.id, cert.created_at);

              return (
                <div key={cert.id}
                  className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] shadow-sm overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 group">

                  {/* Visual banner */}
                  <div className={`h-36 bg-gradient-to-br ${grad} relative flex items-center justify-center overflow-hidden`}>
                    {/* Decorative rings */}
                    <div className="absolute top-2 left-2 w-20 h-20 border-2 border-white/20 rounded-full" />
                    <div className="absolute bottom-2 right-2 w-14 h-14 border-2 border-white/20 rounded-full" />
                    <div className="absolute -top-4 -right-4 w-24 h-24 border-2 border-white/10 rounded-full" />
                    <div className="relative text-center">
                      <div className="text-4xl mb-1.5">🏆</div>
                      <div className="text-white text-[10px] font-black tracking-[3px] uppercase opacity-80">Certificate</div>
                      <div className="text-white text-[9px] opacity-50 mt-0.5 font-mono">{certId}</div>
                    </div>
                    <div className="absolute top-3 right-3 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                      {cert.difficulty}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-[#111827] dark:text-[#f8fafc] mb-2 text-sm leading-snug">{cert.topic}</h3>
                    <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#94a3b8] mb-3">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-[#10B981]" />
                        Score: <strong className="text-[#10B981]">{cert.score_pct}%</strong>
                        <span className="text-[#D1D5DB] dark:text-[#475569] mx-1">·</span>
                        {cert.correct_answers}/{cert.total_questions} correct
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF] mb-3">
                      <Clock className="w-3 h-3" />
                      <span title={new Date(cert.created_at).toLocaleString()}>{relativeDate(cert.created_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActive(cert)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#6366F1] border border-[#E0E7FF] dark:border-[#3730a3] rounded-lg py-2 hover:bg-[#EEF2FF] dark:hover:bg-[#1e1b4b] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> View & Download
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── In Progress ─────────────────────────────────────────── */}
      {!loading && !error && inProgress.length > 0 && (
        <div>
          <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" /> In Progress — Retry to Unlock
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {inProgress.map((q) => (
              <div key={q.id}
                className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#F3F4F6] dark:bg-[#334155] rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  📚
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#111827] dark:text-[#f8fafc] text-sm mb-1.5 truncate">{q.topic}</h3>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-[#F3F4F6] dark:bg-[#334155] rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-[#F59E0B] rounded-full transition-all"
                      style={{ width: `${(q.score_pct / 70) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    {q.score_pct}% · Need <strong>70%</strong> to unlock
                  </p>
                </div>
                <Link href="/dashboard/generate"
                  className="text-xs font-semibold text-[#6366F1] bg-[#EEF2FF] dark:bg-[#1e1b4b] px-3 py-1.5 rounded-lg hover:bg-[#E0E7FF] dark:hover:bg-[#312e81] transition-colors whitespace-nowrap">
                  Retry →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Certificate modal ────────────────────────────────────── */}
      {active && (
        <CertificateModal
          topic={active.topic}
          scorePct={active.score_pct}
          correctAnswers={active.correct_answers}
          totalQuestions={active.total_questions}
          difficulty={active.difficulty}
          userName={userName}
          earnedAt={active.created_at}
          certId={makeCertId(active.id, active.created_at)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
