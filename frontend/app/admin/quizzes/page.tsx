"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Search, Filter, Trash2, ChevronDown, Loader2,
  RefreshCw, ChevronLeft, ChevronRight as ChevronRight2, Trophy
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Attempt {
  id: string;
  user_id: string;
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

const PAGE_SIZE = 20;
const DIFF_COLOR: Record<string, string> = { easy: "#10B981", medium: "#6366F1", hard: "#EF4444" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(s: number) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function AdminQuizzes() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [diffFilter, setDiffFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("questly_quiz_attempts")
      .select("*")
      .order("created_at", { ascending: false });
    setAttempts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteAttempt = async (id: string) => {
    if (!confirm("Delete this quiz attempt?")) return;
    const supabase = createClient();
    await supabase.from("questly_quiz_attempts").delete().eq("id", id);
    setAttempts(prev => prev.filter(a => a.id !== id));
  };

  const filtered = useMemo(() => {
    let list = attempts;
    if (search.trim()) list = list.filter(a => a.topic.toLowerCase().includes(search.toLowerCase()));
    if (diffFilter !== "all") list = list.filter(a => a.difficulty?.toLowerCase() === diffFilter);
    if (statusFilter === "passed") list = list.filter(a => a.passed);
    if (statusFilter === "failed") list = list.filter(a => !a.passed);
    if (statusFilter === "certs")  list = list.filter(a => a.certificate_earned);
    return list;
  }, [attempts, search, diffFilter, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // Stats from filtered
  const avgScore = filtered.length ? Math.round(filtered.reduce((s,a)=>s+a.score_pct,0)/filtered.length) : 0;
  const passRate = filtered.length ? Math.round(filtered.filter(a=>a.passed).length/filtered.length*100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Quiz Database</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">
            {attempts.length} total attempts · Avg {avgScore}% · {passRate}% pass rate
          </p>
        </div>
        <button onClick={load} title="Refresh" className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#8C8B82]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by topic…"
            className="bg-transparent text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none w-full" />
        </div>

        {[
          { label: "Difficulty", value: diffFilter, setter: setDiffFilter, opts: [["all","All Levels"],["easy","Easy"],["medium","Medium"],["hard","Hard"]] },
          { label: "Status",     value: statusFilter, setter: setStatusFilter, opts: [["all","All"],["passed","Passed"],["failed","Failed"],["certs","Certs Only"]] },
        ].map(f => (
          <div key={f.label} className="relative flex items-center gap-1.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2 text-xs text-[#5B5A52] dark:text-[#ABA99C]">
            <Filter className="w-3 h-3 text-[#8C8B82]" />
            <span className="text-[#8C8B82] font-medium">{f.label}:</span>
            <select value={f.value} onChange={e => { f.setter(e.target.value); setPage(1); }}
              className="bg-transparent outline-none font-medium text-[#1B1B18] dark:text-[#F2F1EA] pr-4 appearance-none cursor-pointer">
              {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-[#8C8B82] absolute right-2 pointer-events-none" />
          </div>
        ))}

        {(search || diffFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setDiffFilter("all"); setStatusFilter("all"); setPage(1); }}
            className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] font-medium ml-auto">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
          <div>Topic</div><div>Level</div><div>Score</div><div>Questions</div><div>Time</div><div>Date</div><div>Del</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#8C8B82]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : paged.length === 0 ? (
          <div className="py-12 text-center text-[#8C8B82] text-sm">No results</div>
        ) : (
          <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
            {paged.map(a => {
              return (
                <div key={a.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{a.topic}</div>
                    <div className="text-xs text-[#8C8B82] font-mono">User: {a.user_id.slice(0,8)}…</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 border border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] capitalize">
                      {a.difficulty}
                    </span>
                  </div>
                  <div className={`text-sm font-semibold flex items-center gap-1 ${a.passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                    {a.score_pct}%
                    {a.certificate_earned && <Trophy className="w-3.5 h-3.5 text-[#93670F] dark:text-[#D4A94A]" />}
                  </div>
                  <div className="text-sm text-[#1B1B18] dark:text-[#F2F1EA]">{a.correct_answers}/{a.total_questions}</div>
                  <div className="text-xs text-[#8C8B82]">{fmtTime(a.time_taken_secs)}</div>
                  <div className="text-xs text-[#8C8B82]">{fmtDate(a.created_at)}</div>
                  <button onClick={() => deleteAttempt(a.id)} title="Delete attempt"
                    className="p-1.5 text-[#8C8B82] hover:text-[#8C2E24] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-xs text-[#5B5A52] dark:text-[#ABA99C]">
            <span>Page {page} of {pages} · {filtered.length} records</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p+1)}
                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                <ChevronRight2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
