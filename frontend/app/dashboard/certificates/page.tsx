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
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Certificates</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">
            {loading ? "Loading…" : `${earned.length} earned · Score 70%+ on any quiz to earn one.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh"
            className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {earned.length > 0 && (
            <div className="flex items-center gap-1.5 border border-[#2F6B3A] bg-[#E9F1E9] dark:bg-[#1A2A1D] text-[#2F6B3A] dark:text-[#7EBA88] text-xs font-semibold px-3 py-1.5">
              <Trophy className="w-3.5 h-3.5" /> {earned.length} Earned
            </div>
          )}
          <Link href="/dashboard/generate"
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] px-4 py-2 transition-colors">
            <Zap className="w-3.5 h-3.5" /> New Quiz
          </Link>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading certificates…
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#8C2E24] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#8C2E24] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#8C2E24]">Could not load certificates</p>
              <p className="text-xs text-[#8C2E24] font-mono mt-1">{error}</p>
              <p className="text-xs text-[#8C8B82] mt-2">
                Make sure you have run the Supabase setup SQL from the <strong>My Quizzes</strong> page first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────── */}
      {!loading && !error && earned.length === 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-16 text-center">
          <div className="text-5xl mb-4">🎓</div>
          <h3 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2">No certificates yet</h3>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] mb-6">
            Score <strong>70% or above</strong> on any quiz to earn a certificate.
          </p>
          <Link href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white text-xs font-medium px-5 py-2.5 transition-colors">
            <Zap className="w-4 h-4" /> Generate a Quiz
          </Link>
        </div>
      )}

      {/* ── Earned certificates grid ─────────────────────────────── */}
      {!loading && !error && earned.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-[#93670F] dark:text-[#D4A94A]" /> Earned Certificates
          </h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {earned.map((cert) => {
              const certId = makeCertId(cert.id, cert.created_at);

              return (
                <div key={cert.id}
                  className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden group">

                  {/* Visual banner */}
                  <div className="h-32 bg-[#6B2737] relative flex items-center justify-center overflow-hidden">
                    <div className="absolute top-2 left-2 w-20 h-20 border border-white/10 rounded-full" />
                    <div className="absolute bottom-2 right-2 w-14 h-14 border border-white/10 rounded-full" />
                    <div className="relative text-center">
                      <div className="text-3xl mb-1">🏆</div>
                      <div className="text-white text-[9px] font-semibold tracking-[3px] uppercase opacity-90">Certificate</div>
                      <div className="text-white text-[9px] opacity-60 mt-0.5 font-mono">{certId}</div>
                    </div>
                    <div className="absolute top-3 right-3 bg-white/15 text-white text-[10px] font-semibold px-2 py-0.5 border border-white/20 capitalize">
                      {cert.difficulty}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-heading font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2 text-sm leading-snug">{cert.topic}</h3>
                    <div className="flex items-center justify-between text-xs text-[#5B5A52] dark:text-[#ABA99C] mb-3">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-[#2F6B3A] dark:text-[#7EBA88]" />
                        Score: <strong className="text-[#2F6B3A] dark:text-[#7EBA88]">{cert.score_pct}%</strong>
                        <span className="text-[#8C8B82] mx-1">·</span>
                        {cert.correct_answers}/{cert.total_questions} correct
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#8C8B82] mb-4">
                      <Clock className="w-3.5 h-3.5" />
                      <span title={new Date(cert.created_at).toLocaleString()}>{relativeDate(cert.created_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActive(cert)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-[#1B1B18] dark:text-[#F2F1EA] border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] hover:bg-[#EAE8E1] dark:hover:bg-[#262620] py-2 transition-colors"
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
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#8C8B82]" /> In Progress — Retry to Unlock
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {inProgress.map((q) => (
              <div key={q.id}
                className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] flex items-center justify-center text-xl flex-shrink-0">
                  📚
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#1B1B18] dark:text-[#F2F1EA] text-sm mb-1.5 truncate">{q.topic}</h3>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden mb-1">
                    <div
                      className="h-full bg-[#6B2737] transition-all"
                      style={{ width: `${(q.score_pct / 70) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#8C8B82]">
                    {q.score_pct}% · Need <strong>70%</strong> to unlock
                  </p>
                </div>
                <Link href="/dashboard/generate"
                  className="text-xs font-medium text-[#6B2737] dark:text-[#B5677A] border border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] px-3 py-1.5 hover:bg-[#EAE8E1] dark:hover:bg-[#262620] transition-colors whitespace-nowrap">
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
