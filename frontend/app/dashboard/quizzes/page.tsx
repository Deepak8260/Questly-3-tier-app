"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Clock, Zap, Trophy, XCircle, Award, Loader2,
  AlertTriangle, RefreshCw, Filter, ChevronDown, Search
} from "lucide-react";
import { createClient } from "@/lib/supabase";

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
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtTime(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** "2 hours ago" / "just now" / "Mar 9, 2026 at 4:35 PM" */
function relativeDate(iso: string) {
  const date = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000); // seconds
  if (diff < 60)  return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/** Full timestamp for tooltip */
function fullDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const LEVEL_STYLE = {
  easy:   { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  medium: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  hard:   { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
} as const;

type Difficulty = "all" | "easy" | "medium" | "hard";
type StatusFilter = "all" | "passed" | "failed";
type SortKey = "newest" | "oldest" | "highest" | "lowest";

// ── Main Component ────────────────────────────────────────────────
export default function QuizzesPage() {
  const [quizzes, setQuizzes]   = useState<QuizAttempt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  // Filters
  const [search,     setSearch]     = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [status,     setStatus]     = useState<StatusFilter>("all");
  const [sort,       setSort]       = useState<SortKey>("newest");
  const [certOnly,   setCertOnly]   = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

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

  // ── Filtered + sorted list ──────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...quizzes];

    if (search.trim())
      list = list.filter(q => q.topic.toLowerCase().includes(search.toLowerCase()));

    if (difficulty !== "all")
      list = list.filter(q => q.difficulty.toLowerCase() === difficulty);

    if (status === "passed") list = list.filter(q => q.passed);
    if (status === "failed") list = list.filter(q => !q.passed);
    if (certOnly)            list = list.filter(q => q.certificate_earned);

    list.sort((a, b) => {
      if (sort === "newest")  return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "oldest")  return +new Date(a.created_at) - +new Date(b.created_at);
      if (sort === "highest") return b.score_pct - a.score_pct;
      if (sort === "lowest")  return a.score_pct - b.score_pct;
      return 0;
    });
    return list;
  }, [quizzes, search, difficulty, status, certOnly, sort]);

  // Stats are always from unfiltered data
  const passed   = quizzes.filter(q => q.passed).length;
  const avgScore = quizzes.length
    ? Math.round(quizzes.reduce((s, q) => s + q.score_pct, 0) / quizzes.length)
    : 0;
  const certs = quizzes.filter(q => q.certificate_earned).length;

  return (
    <div className="animate-fade-in-up">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#111827] dark:text-[#f8fafc] mb-1">My Quizzes</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#94a3b8]">
            {quizzes.length} quizzes taken · {passed} passed · {avgScore}% avg
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh"
            className="p-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#1e293b] text-[#6B7280] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard/generate"
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] px-4 py-2 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md">
            <Zap className="w-3.5 h-3.5" /> New Quiz
          </Link>
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Quizzes", value: quizzes.length,  color: "text-[#6366F1]" },
          { label: "Passed (≥70%)", value: passed,           color: "text-[#10B981]" },
          { label: "Average Score", value: `${avgScore}%`,  color: "text-[#F59E0B]" },
          { label: "Certificates",  value: certs,            color: "text-[#8B5CF6]" },
        ].map(s => (
          <div key={s.label}
            className="bg-white dark:bg-[#1e293b] rounded-xl border border-[#E5E7EB] dark:border-[#334155] p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-[#6B7280] dark:text-[#94a3b8] font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      {quizzes.length > 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] px-5 py-4 mb-5 flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] bg-[#F9FAFB] dark:bg-[#0f172a] rounded-xl border border-[#E5E7EB] dark:border-[#334155] px-3 py-2">
            <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topic…"
              className="bg-transparent text-sm text-[#111827] dark:text-[#f8fafc] placeholder:text-[#9CA3AF] outline-none w-full"
            />
          </div>

          {/* Difficulty */}
          <FilterSelect
            icon={<Filter className="w-3 h-3" />}
            label="Level"
            value={difficulty}
            options={[
              { label: "All Levels", value: "all" },
              { label: "Easy",       value: "easy" },
              { label: "Medium",     value: "medium" },
              { label: "Hard",       value: "hard" },
            ]}
            onChange={v => setDifficulty(v as Difficulty)}
          />

          {/* Status */}
          <FilterSelect
            label="Status"
            value={status}
            options={[
              { label: "All Status", value: "all" },
              { label: "Passed",     value: "passed" },
              { label: "Failed",     value: "failed" },
            ]}
            onChange={v => setStatus(v as StatusFilter)}
          />

          {/* Sort */}
          <FilterSelect
            label="Sort"
            value={sort}
            options={[
              { label: "Newest first",  value: "newest" },
              { label: "Oldest first",  value: "oldest" },
              { label: "Highest score", value: "highest" },
              { label: "Lowest score",  value: "lowest" },
            ]}
            onChange={v => setSort(v as SortKey)}
          />

          {/* Cert toggle */}
          <button
            onClick={() => setCertOnly(c => !c)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
              certOnly
                ? "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]"
                : "bg-[#F9FAFB] dark:bg-[#0f172a] text-[#6B7280] dark:text-[#94a3b8] border-[#E5E7EB] dark:border-[#334155]"
            }`}
          >
            <Trophy className="w-3 h-3" />
            Cert only
          </button>

          {/* Clear filters */}
          {(search || difficulty !== "all" || status !== "all" || certOnly || sort !== "newest") && (
            <button
              onClick={() => { setSearch(""); setDifficulty("all"); setStatus("all"); setCertOnly(false); setSort("newest"); }}
              className="text-xs text-[#6366F1] hover:text-[#4F46E5] font-semibold ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-[#9CA3AF]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-white dark:bg-[#1e293b] border border-[#FECACA] dark:border-[#7f1d1d] rounded-2xl overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 bg-[#FEF2F2] dark:bg-[#1c0809]">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-[#DC2626]">Table not found — run setup SQL</p>
              <p className="text-xs text-[#EF4444] font-mono mt-1">{error}</p>
              <details className="mt-3">
                <summary className="text-xs font-semibold text-[#DC2626] cursor-pointer">Show setup SQL ▶</summary>
                <pre className="mt-2 bg-[#0F172A] text-[#94A3B8] p-4 rounded-xl text-xs overflow-x-auto leading-relaxed">{`CREATE TABLE IF NOT EXISTS questly_quiz_attempts (
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
  created_at         timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE questly_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own attempts" ON questly_quiz_attempts;
CREATE POLICY "Own attempts" ON questly_quiz_attempts
  FOR ALL USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);`}</pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty (no data at all) ───────────────────────────────── */}
      {!loading && !error && quizzes.length === 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-16 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#f8fafc] mb-2">No quizzes yet</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#94a3b8] mb-6">
            Generate a quiz and it will appear here automatically.
          </p>
          <Link href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg text-sm">
            <Zap className="w-4 h-4" /> Generate First Quiz
          </Link>
        </div>
      )}

      {/* ── No filter results ───────────────────────────────────── */}
      {!loading && !error && quizzes.length > 0 && filtered.length === 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc]">No quizzes match your filters</p>
          <p className="text-xs text-[#6B7280] dark:text-[#94a3b8] mt-1">Try adjusting the search or filters above.</p>
        </div>
      )}

      {/* ── Quiz table ──────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-center px-6 py-3 border-b border-[#F3F4F6] dark:border-[#334155] text-xs font-black text-[#9CA3AF] uppercase tracking-widest gap-4">
            <div className="flex-1">Quiz</div>
            <div className="w-24 text-center">Level</div>
            <div className="w-16 text-center">Score</div>
            <div className="w-20 text-center hidden md:block">Time</div>
            <div className="w-32 text-center hidden lg:block">Attempted</div>
            <div className="w-10 text-center">Cert</div>
            <div className="w-16 text-right">Action</div>
          </div>

          {/* Rows */}
          {filtered.map((q) => {
            const lc = LEVEL_STYLE[(q.difficulty?.toLowerCase() ?? "medium") as keyof typeof LEVEL_STYLE] ?? LEVEL_STYLE.medium;
            return (
              <div key={q.id}
                className="flex items-center px-6 py-4 gap-4 border-b border-[#F9FAFB] dark:border-[#334155] last:border-b-0 hover:bg-[#FAFAFA] dark:hover:bg-[#263348] transition-colors">

                {/* Quiz name */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc] truncate">{q.topic}</div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5 flex items-center gap-1.5">
                    <span className="capitalize">{q.question_type ?? "MCQ"}</span>
                    <span className="text-[#E5E7EB] dark:text-[#334155]">·</span>
                    <span>{q.correct_answers}/{q.total_questions} correct</span>
                  </div>
                </div>

                {/* Level */}
                <div className="w-24 flex justify-center">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full border capitalize whitespace-nowrap"
                    style={{ backgroundColor: lc.bg, color: lc.text, borderColor: lc.border }}>
                    {q.difficulty}
                  </span>
                </div>

                {/* Score */}
                <div className={`w-16 text-center text-sm font-black ${q.passed ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                  {q.score_pct}%
                </div>

                {/* Quiz duration */}
                <div className="w-20 text-center text-xs text-[#9CA3AF] hidden md:block">
                  {fmtTime(q.time_taken_secs)}
                </div>

                {/* Last attempted — relative time with full timestamp on hover */}
                <div className="w-32 text-center hidden lg:block" title={fullDate(q.created_at)}>
                  <div className="text-xs font-medium text-[#6B7280] dark:text-[#94a3b8]">
                    {relativeDate(q.created_at)}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                    {new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>

                {/* Cert icon */}
                <div className="w-10 flex justify-center" title={q.certificate_earned ? "Certificate earned" : "Score < 70%"}>
                  {q.certificate_earned
                    ? <Trophy className="w-4 h-4 text-[#F59E0B]" />
                    : <XCircle className="w-4 h-4 text-[#D1D5DB] dark:text-[#334155]" />}
                </div>

                {/* Action */}
                <div className="w-16 flex justify-end">
                  {q.certificate_earned
                    ? (
                      <Link href="/dashboard/generate"
                        className="text-xs text-[#10B981] hover:text-[#059669] font-semibold flex items-center gap-0.5">
                        <Award className="w-3.5 h-3.5" /> Cert
                      </Link>
                    ) : (
                      <Link href="/dashboard/generate"
                        className="text-xs text-[#6366F1] hover:text-[#4F46E5] font-semibold">
                        Retry
                      </Link>
                    )}
                </div>
              </div>
            );
          })}

          {/* Footer count */}
          {filtered.length < quizzes.length && (
            <div className="px-6 py-2.5 text-xs text-[#9CA3AF] border-t border-[#F9FAFB] dark:border-[#334155]">
              Showing {filtered.length} of {quizzes.length} quizzes
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reusable filter select ────────────────────────────────────────
function FilterSelect({ label, value, options, onChange, icon }: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center gap-1.5 bg-[#F9FAFB] dark:bg-[#0f172a] rounded-xl border border-[#E5E7EB] dark:border-[#334155] px-3 py-2 text-xs text-[#374151] dark:text-[#94a3b8] cursor-pointer">
      {icon && <span className="text-[#9CA3AF]">{icon}</span>}
      <span className="font-semibold text-[#9CA3AF] mr-0.5">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent outline-none cursor-pointer font-semibold text-[#111827] dark:text-[#f8fafc] pr-4 appearance-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-[#9CA3AF] absolute right-2 pointer-events-none" />
    </div>
  );
}
