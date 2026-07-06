"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Clock, Zap, Trophy, XCircle, Award, Loader2,
  AlertTriangle, RefreshCw, Filter, ChevronDown, Search, FileQuestion
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
  easy:   { bg: "#E9F1E9", text: "#2F6B3A", border: "#B8D8B8" },
  medium: { bg: "#F5EEDD", text: "#93670F", border: "#E3CE9C" },
  hard:   { bg: "#F5E7E4", text: "#8C2E24", border: "#E0B8AF" },
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
    <div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">My quizzes</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">
            {quizzes.length} quizzes taken · {passed} passed · {avgScore}% avg
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh"
            className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard/generate"
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] px-4 py-2.5 transition-colors">
            <Zap className="w-3.5 h-3.5" /> New quiz
          </Link>
        </div>
      </div>

      {/* ── Stats cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C] mb-6">
        {[
          { label: "Total quizzes", value: quizzes.length },
          { label: "Passed (≥70%)", value: passed },
          { label: "Average score", value: `${avgScore}%` },
          { label: "Certificates",  value: certs },
        ].map(s => (
          <div key={s.label}
            className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-4 text-center">
            <div className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{s.value}</div>
            <div className="text-xs text-[#5B5A52] dark:text-[#ABA99C] font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      {quizzes.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 mb-5 flex flex-wrap items-center gap-3">

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2">
            <Search className="w-3.5 h-3.5 text-[#8C8B82]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topic…"
              className="bg-transparent text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none w-full"
            />
          </div>

          {/* Difficulty */}
          <FilterSelect
            icon={<Filter className="w-3 h-3" />}
            label="Level"
            value={difficulty}
            options={[
              { label: "All levels", value: "all" },
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
              { label: "All status", value: "all" },
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
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border transition-colors ${
              certOnly
                ? "bg-[#F5EEDD] dark:bg-[#2B2110] text-[#93670F] dark:text-[#D4A94A] border-[#93670F] dark:border-[#4A3A10]"
                : "bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border-[#DEDCD3] dark:border-[#35352C]"
            }`}
          >
            <Trophy className="w-3 h-3" />
            Cert only
          </button>

          {/* Clear filters */}
          {(search || difficulty !== "all" || status !== "all" || certOnly || sort !== "newest") && (
            <button
              onClick={() => { setSearch(""); setDifficulty("all"); setStatus("all"); setCertOnly(false); setSort("newest"); }}
              className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] dark:hover:text-[#C77E8F] font-medium ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#E0B8AF] dark:border-[#4A2A24] overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4 bg-[#F5E7E4] dark:bg-[#2B1512]">
            <AlertTriangle className="w-5 h-5 text-[#8C2E24] dark:text-[#D08A7E] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#8C2E24] dark:text-[#D08A7E]">Table not found — run setup SQL</p>
              <p className="text-xs text-[#8C2E24] dark:text-[#D08A7E] font-mono mt-1">{error}</p>
              <details className="mt-3">
                <summary className="text-xs font-semibold text-[#8C2E24] dark:text-[#D08A7E] cursor-pointer">Show setup SQL ▶</summary>
                <pre className="mt-2 bg-[#1B1B18] text-[#ABA99C] p-4 text-xs overflow-x-auto leading-relaxed border border-[#35352C]">{`CREATE TABLE IF NOT EXISTS questly_quiz_attempts (
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
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-16 text-center">
          <FileQuestion className="w-10 h-10 text-[#8C8B82] mx-auto mb-4" />
          <h3 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2">No quizzes yet</h3>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] mb-6">
            Generate a quiz and it will appear here automatically.
          </p>
          <Link href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium px-6 py-3 transition-colors text-sm">
            <Zap className="w-4 h-4" /> Generate first quiz
          </Link>
        </div>
      )}

      {/* ── No filter results ───────────────────────────────────── */}
      {!loading && !error && quizzes.length > 0 && filtered.length === 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-12 text-center">
          <Search className="w-8 h-8 text-[#8C8B82] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">No quizzes match your filters</p>
          <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] mt-1">Try adjusting the search or filters above.</p>
        </div>
      )}

      {/* ── Quiz table ──────────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">

          {/* Header */}
          <div className="flex items-center px-6 py-3 border-b border-[#DEDCD3] dark:border-[#35352C] text-xs font-semibold text-[#8C8B82] uppercase tracking-widest gap-4">
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
                className="flex items-center px-6 py-4 gap-4 border-b border-[#EAE8E1] dark:border-[#262620] last:border-b-0 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">

                {/* Quiz name */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{q.topic}</div>
                  <div className="text-xs text-[#8C8B82] mt-0.5 flex items-center gap-1.5">
                    <span className="capitalize">{q.question_type ?? "MCQ"}</span>
                    <span className="text-[#DEDCD3] dark:text-[#35352C]">·</span>
                    <span>{q.correct_answers}/{q.total_questions} correct</span>
                  </div>
                </div>

                {/* Level */}
                <div className="w-24 flex justify-center">
                  <span className="text-xs font-semibold px-2.5 py-1 border capitalize whitespace-nowrap"
                    style={{ backgroundColor: lc.bg, color: lc.text, borderColor: lc.border }}>
                    {q.difficulty}
                  </span>
                </div>

                {/* Score */}
                <div className={`w-16 text-center text-sm font-semibold ${q.passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                  {q.score_pct}%
                </div>

                {/* Quiz duration */}
                <div className="w-20 text-center text-xs text-[#8C8B82] hidden md:block">
                  {fmtTime(q.time_taken_secs)}
                </div>

                {/* Last attempted — relative time with full timestamp on hover */}
                <div className="w-32 text-center hidden lg:block" title={fullDate(q.created_at)}>
                  <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">
                    {relativeDate(q.created_at)}
                  </div>
                  <div className="text-[10px] text-[#8C8B82] mt-0.5">
                    {new Date(q.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>

                {/* Cert icon */}
                <div className="w-10 flex justify-center" title={q.certificate_earned ? "Certificate earned" : "Score < 70%"}>
                  {q.certificate_earned
                    ? <Trophy className="w-4 h-4 text-[#93670F] dark:text-[#D4A94A]" />
                    : <XCircle className="w-4 h-4 text-[#DEDCD3] dark:text-[#35352C]" />}
                </div>

                {/* Action */}
                <div className="w-16 flex justify-end">
                  {q.certificate_earned
                    ? (
                      <Link href="/dashboard/generate"
                        className="text-xs text-[#2F6B3A] dark:text-[#7EBA88] hover:text-[#255A2E] font-medium flex items-center gap-0.5">
                        <Award className="w-3.5 h-3.5" /> Cert
                      </Link>
                    ) : (
                      <Link href="/dashboard/generate"
                        className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] font-medium">
                        Retry
                      </Link>
                    )}
                </div>
              </div>
            );
          })}

          {/* Footer count */}
          {filtered.length < quizzes.length && (
            <div className="px-6 py-2.5 text-xs text-[#8C8B82] border-t border-[#EAE8E1] dark:border-[#262620]">
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
    <div className="relative flex items-center gap-1.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2 text-xs text-[#5B5A52] dark:text-[#ABA99C] cursor-pointer">
      {icon && <span className="text-[#8C8B82]">{icon}</span>}
      <span className="font-semibold text-[#8C8B82] mr-0.5">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent outline-none cursor-pointer font-semibold text-[#1B1B18] dark:text-[#F2F1EA] pr-4 appearance-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 text-[#8C8B82] absolute right-2 pointer-events-none" />
    </div>
  );
}