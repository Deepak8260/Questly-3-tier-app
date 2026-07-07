"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Clock, Zap, Trophy, XCircle, Award, Loader2,
  AlertTriangle, RefreshCw, Filter, ChevronDown, Search, FileQuestion, Eye, X, CheckCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import CertificateModal from "@/components/CertificateModal";

interface QuizAttempt {
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
  questions_data?: any[];
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtTime(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function relativeDate(iso: string) {
  const date = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  });
}

const LEVEL_STYLE = {
  easy: { bg: "#E9F1E9", text: "#2F6B3A", border: "#B8D8B8" },
  medium: { bg: "#F5EEDD", text: "#93670F", border: "#E3CE9C" },
  hard: { bg: "#F5E7E4", text: "#8C2E24", border: "#E0B8AF" },
} as const;

type Difficulty = "all" | "easy" | "medium" | "hard";
type StatusFilter = "all" | "passed" | "failed";
type SortKey = "newest" | "oldest" | "highest" | "lowest";

function makeCertId(attemptId: string, createdAt: string) {
  const date = new Date(createdAt);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = attemptId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `QLST-${ymd}-${suffix}`;
}

// Review Modal Component
function ReviewModal({ attempt, onClose, userName }: { attempt: QuizAttempt, onClose: () => void, userName: string }) {
  const hasData = attempt.questions_data && attempt.questions_data.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#1C1C16] max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-[#DEDCD3] dark:border-[#35352C] rounded-sm" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1C1C16] border-b border-[#DEDCD3] dark:border-[#35352C] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-heading text-xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">Quiz Review: {attempt.topic}</h2>
            <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Score: {attempt.score_pct}% ({attempt.correct_answers}/{attempt.total_questions} correct)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
            <X className="w-5 h-5 text-[#5B5A52]" />
          </button>
        </div>
        <div className="p-6">
          {hasData ? (
            <div className="space-y-4">
              {attempt.questions_data!.map((q, i) => {
                const isCorrect = q.isCorrect;
                return (
                  <div key={q.id || i} className={`bg-white dark:bg-[#1C1C16] border p-5 ${
                    isCorrect ? "border-[#2F6B3A]" : "border-[#8C2E24]"
                  }`}>
                    <div className="flex items-start gap-3 mb-3">
                      {isCorrect
                        ? <CheckCircle className="w-5 h-5 text-[#2F6B3A] flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-5 h-5 text-[#8C2E24] flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-[#8C8B82] mb-1">Q{i + 1}</div>
                        <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{q.question}</p>
                        {q.code && (
                          <pre className="bg-[#1B1B18] text-[#E8E6DE] text-xs font-mono p-4 my-3 overflow-x-auto leading-relaxed border border-[#35352C]">
                            <code>{q.code}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      {(q.options || []).filter((o: any) => o).map((opt: string, oi: number) => {
                        const isCorrectOpt = oi === q.correctIndex;
                        const isUserOpt = oi === q.userAnswerIndex;
                        return (
                          <div key={oi} className={`text-xs px-3 py-2 border font-medium ${
                            isCorrectOpt ? "bg-[#E9F1E9] border-[#2F6B3A] text-[#2F6B3A]"
                            : isUserOpt && !isCorrectOpt ? "bg-[#F5E7E4] border-[#8C2E24] text-[#8C2E24]"
                            : "bg-[#FAFAF8] border-[#EAE8E1] text-[#5B5A52]"
                          }`}>
                            {["A", "B", "C", "D"][oi]}. {opt}
                            {isCorrectOpt && " ✓"}
                            {isUserOpt && !isCorrectOpt && " ✗"}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="flex gap-2 bg-[#FAFAF8] border border-[#DEDCD3] p-3">
                        <Zap className="w-3.5 h-3.5 text-[#6B2737] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[#5B5A52] leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] p-8 text-center">
              <FileQuestion className="w-10 h-10 text-[#8C8B82] mx-auto mb-4" />
              <p className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Question data not available</p>
              <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C]">This quiz was taken before review feature was added.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Learner");
  const [activeCert, setActiveCert] = useState<QuizAttempt | null>(null);
  const [activeReview, setActiveReview] = useState<QuizAttempt | null>(null);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [certOnly, setCertOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const name =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "Learner";
    setUserName(name);

    const { data, error: dbErr } = await supabase
      .from("questly_quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbErr) setError(dbErr.message);
    else setQuizzes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = [...quizzes];

    if (search.trim())
      list = list.filter(q => q.topic.toLowerCase().includes(search.toLowerCase()));
    if (difficulty !== "all")
      list = list.filter(q => q.difficulty.toLowerCase() === difficulty);
    if (status === "passed") list = list.filter(q => q.passed);
    if (status === "failed") list = list.filter(q => !q.passed);
    if (certOnly) list = list.filter(q => q.certificate_earned);

    list.sort((a, b) => {
      if (sort === "newest") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "oldest") return +new Date(a.created_at) - +new Date(b.created_at);
      if (sort === "highest") return b.score_pct - a.score_pct;
      if (sort === "lowest") return a.score_pct - b.score_pct;
      return 0;
    });
    return list;
  }, [quizzes, search, difficulty, status, certOnly, sort]);

  const passed = quizzes.filter(q => q.passed).length;
  const avgScore = quizzes.length
    ? Math.round(quizzes.reduce((s, q) => s + q.score_pct, 0) / quizzes.length)
    : 0;
  const certs = quizzes.filter(q => q.certificate_earned).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">My quizzes</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">
            {quizzes.length} quizzes taken · {passed} passed · {avgScore}% avg
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh" className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard/generate" className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] px-4 py-2.5 transition-colors">
            <Zap className="w-3.5 h-3.5" /> New quiz
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C] mb-6">
        {[
          { label: "Total quizzes", value: quizzes.length },
          { label: "Passed (≥70%)", value: passed },
          { label: "Average score", value: `${avgScore}%` },
          { label: "Certificates", value: certs },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-4 text-center">
            <div className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{s.value}</div>
            <div className="text-xs text-[#5B5A52] dark:text-[#ABA99C] font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {quizzes.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[160px] bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2">
            <Search className="w-3.5 h-3.5 text-[#8C8B82]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topic…" className="bg-transparent text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none w-full" />
          </div>
          <FilterSelect icon={<Filter className="w-3 h-3" />} label="Level" value={difficulty} options={[
            { label: "All levels", value: "all" },
            { label: "Easy", value: "easy" },
            { label: "Medium", value: "medium" },
            { label: "Hard", value: "hard" },
          ]} onChange={(v) => setDifficulty(v as Difficulty)} />
          <FilterSelect label="Status" value={status} options={[
            { label: "All status", value: "all" },
            { label: "Passed", value: "passed" },
            { label: "Failed", value: "failed" },
          ]} onChange={(v) => setStatus(v as StatusFilter)} />
          <FilterSelect label="Sort" value={sort} options={[
            { label: "Newest first", value: "newest" },
            { label: "Oldest first", value: "oldest" },
            { label: "Highest score", value: "highest" },
            { label: "Lowest score", value: "lowest" },
          ]} onChange={(v) => setSort(v as SortKey)} />
          <button onClick={() => setCertOnly(c => !c)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border transition-colors ${certOnly ? "bg-[#F5EEDD] dark:bg-[#2B2110] text-[#93670F] dark:text-[#D4A94A] border-[#93670F] dark:border-[#4A3A10]" : "bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border-[#DEDCD3] dark:border-[#35352C]" }`}>
            <Trophy className="w-3 h-3" /> Cert only
          </button>
          {(search || difficulty !== "all" || status !== "all" || certOnly || sort !== "newest") && (
            <button onClick={() => { setSearch(""); setDifficulty("all"); setStatus("all"); setCertOnly(false); setSort("newest"); }} className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] dark:hover:text-[#C77E8F] font-medium ml-auto">
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#E0B8AF] dark:border-[#4A2A24] overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 bg-[#F5E7E4] dark:bg-[#2B1512]">
            <AlertTriangle className="w-5 h-5 text-[#8C2E24] dark:text-[#D08A7E] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#8C2E24] dark:text-[#D08A7E]">Table not found — run setup SQL</p>
              <p className="text-xs text-[#8C2E24] dark:text-[#D08A7E] font-mono mt-1">{error}</p>
              <details className="mt-3">
                <summary className="text-xs font-semibold text-[#8C2E24] dark:text-[#D08A7E] cursor-pointer">Show setup SQL ▶</summary>
                <pre className="mt-2 bg-[#1B1B18] text-[#ABA99C] p-4 text-xs overflow-x-auto leading-relaxed border border-[#35352C]">
                  {`CREATE TABLE IF NOT EXISTS questly_quiz_attempts (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic              text NOT NULL,
  difficulty         text NOT NULL,
  question_type      text,
  total_questions    int  NOT NULL,
  correct_answers    int  NOT NULL,
  score_pct          int  NOT NULL,
  time_taken_secs    int,
  passed             boolean NOT NULL DEFAULT false,
  certificate_earned boolean NOT NULL DEFAULT false,
  questions_data     jsonb,
  created_at         timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE questly_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own attempts" ON questly_quiz_attempts;
CREATE POLICY "Own attempts" ON questly_quiz_attempts
  FOR ALL USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);`}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && quizzes.length === 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-16 text-center">
          <FileQuestion className="w-10 h-10 text-[#8C8B82] mx-auto mb-4" />
          <h3 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2">No quizzes yet</h3>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] mb-6">Generate a quiz and it will appear here automatically.</p>
          <Link href="/dashboard/generate" className="inline-flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium px-6 py-3 transition-colors text-sm">
            <Zap className="w-4 h-4" /> Generate first quiz
          </Link>
        </div>
      )}

      {!loading && !error && quizzes.length > 0 && filtered.length === 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-12 text-center">
          <Search className="w-8 h-8 text-[#8C8B82] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">No quizzes match your filters</p>
          <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] mt-1">Try adjusting the search or filters above.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FAFAF8] dark:bg-[#14140F] border-b border-[#DEDCD3] dark:border-[#35352C]">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest" style={{ minWidth: "240px" }}>Quiz</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest" style={{ minWidth: "100px" }}>Level</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest" style={{ minWidth: "80px" }}>Score</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest hidden md:table-cell" style={{ minWidth: "80px" }}>Time</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest hidden lg:table-cell" style={{ minWidth: "140px" }}>Attempted</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest" style={{ minWidth: "60px" }}>Cert</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-[#8C8B82] uppercase tracking-widest" style={{ minWidth: "180px" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
                {filtered.map((q) => {
                  const lc = LEVEL_STYLE[(q.difficulty?.toLowerCase() ?? "medium") as keyof typeof LEVEL_STYLE] ?? LEVEL_STYLE.medium;
                  const hasReviewData = q.questions_data && q.questions_data.length > 0;
                  return (
                    <tr key={q.id} className="hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{q.topic}</div>
                          <div className="text-xs text-[#8C8B82] mt-1 flex items-center gap-1.5">
                            <span className="capitalize">{q.question_type ?? "MCQ"}</span>
                            <span className="text-[#DEDCD3] dark:text-[#35352C]">·</span>
                            <span>{q.correct_answers ?? 0}/{q.total_questions ?? 0} correct</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-center">
                          <span className="text-xs font-semibold px-3 py-1 border capitalize whitespace-nowrap rounded" style={{ backgroundColor: lc.bg, color: lc.text, borderColor: lc.border }}>
                            {q.difficulty}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className={`text-center text-sm font-semibold ${q.passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]" }`}>
                          {q.score_pct}%
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top hidden md:table-cell">
                        <div className="text-center text-xs text-[#8C8B82]">
                          {fmtTime(q.time_taken_secs)}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top hidden lg:table-cell">
                        <div className="text-center" title={fullDate(q.created_at)}>
                          <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">{relativeDate(q.created_at)}</div>
                          <div className="text-[10px] text-[#8C8B82] mt-0.5">{new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-center" title={q.certificate_earned ? "Certificate earned" : "Score < 70%"}>
                          {q.certificate_earned
                            ? <Trophy className="w-4 h-4 text-[#93670F] dark:text-[#D4A94A]" />
                            : <XCircle className="w-4 h-4 text-[#DEDCD3] dark:text-[#35352C]" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center justify-end gap-3">
                          {hasReviewData && (
                            <button onClick={() => setActiveReview(q)} className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] font-medium flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer" aria-label="Review quiz">
                              <Eye className="w-3.5 h-3.5" /> Review
                            </button>
                          )}
                          {q.certificate_earned
                            ? (
                              <button onClick={() => setActiveCert(q)} className="text-xs text-[#2F6B3A] dark:text-[#7EBA88] hover:text-[#255A2E] font-medium flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer" aria-label="View certificate">
                                <Award className="w-3.5 h-3.5" /> Cert
                              </button>
                            ) : (
                              <Link href="/dashboard/generate" className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] font-medium">
                                Retry
                              </Link>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length < quizzes.length && (
            <div className="px-6 py-2.5 text-xs text-[#8C8B82] border-t border-[#EAE8E1] dark:border-[#262620]">
              Showing {filtered.length} of {quizzes.length} quizzes
            </div>
          )}
        </div>
      )}

      {activeCert && (
        <CertificateModal
          topic={activeCert.topic}
          scorePct={activeCert.score_pct}
          correctAnswers={activeCert.correct_answers}
          totalQuestions={activeCert.total_questions}
          difficulty={activeCert.difficulty}
          userName={userName}
          earnedAt={activeCert.created_at}
          certId={makeCertId(activeCert.id, activeCert.created_at)}
          onClose={() => setActiveCert(null)}
        />
      )}

      {activeReview && (
        <ReviewModal
          attempt={activeReview}
          onClose={() => setActiveReview(null)}
          userName={userName}
        />
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange, icon }: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center gap-1.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2 text-xs text-[#5B5A52] dark:text-[#ABA99C] cursor-pointer">
      {icon && <span className="text-[#8C8B82]">{icon}</span>}
      <span className="font-semibold text-[#8C8B82] mr-0.5">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none cursor-pointer font-semibold text-[#1B1B18] dark:text-[#F2F1EA] pr-4 appearance-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-[#8C8B82] absolute right-2 pointer-events-none" />
    </div>
  );
}
