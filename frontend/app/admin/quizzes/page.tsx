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
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Quiz Database</h1>
          <p className="text-sm text-[#64748B]">
            {attempts.length} total attempts · Avg {avgScore}% · {passRate}% pass rate
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-[#94a3b8] bg-[#1E293B] border border-[#334155] px-4 py-2 rounded-xl hover:border-[#6366F1] transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] px-5 py-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#475569]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by topic…"
            className="bg-transparent text-sm text-white placeholder:text-[#475569] outline-none w-full" />
        </div>

        {[
          { label: "Difficulty", value: diffFilter, setter: setDiffFilter, opts: [["all","All Levels"],["easy","Easy"],["medium","Medium"],["hard","Hard"]] },
          { label: "Status",     value: statusFilter, setter: setStatusFilter, opts: [["all","All"],["passed","Passed"],["failed","Failed"],["certs","Certs Only"]] },
        ].map(f => (
          <div key={f.label} className="relative flex items-center gap-1.5 bg-[#1E293B] border border-[#334155] rounded-xl px-3 py-2 text-xs">
            <Filter className="w-3 h-3 text-[#475569]" />
            <span className="text-[#475569] font-semibold">{f.label}:</span>
            <select value={f.value} onChange={e => { f.setter(e.target.value); setPage(1); }}
              className="bg-transparent outline-none font-semibold text-white pr-4 appearance-none cursor-pointer">
              {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-[#475569] absolute right-2 pointer-events-none" />
          </div>
        ))}

        {(search || diffFilter !== "all" || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setDiffFilter("all"); setStatusFilter("all"); setPage(1); }}
            className="text-xs text-[#6366F1] font-semibold ml-auto">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-[#1E293B] text-[9px] font-black text-[#475569] uppercase tracking-widest">
          <div>Topic</div><div>Level</div><div>Score</div><div>Questions</div><div>Time</div><div>Date</div><div>Del</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#475569]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : paged.length === 0 ? (
          <div className="py-12 text-center text-[#475569] text-sm">No results</div>
        ) : (
          <div className="divide-y divide-[#1E293B]">
            {paged.map(a => {
              const col = DIFF_COLOR[a.difficulty?.toLowerCase()] ?? "#6366F1";
              return (
                <div key={a.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 items-center hover:bg-[#1E293B]/40 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.topic}</div>
                    <div className="text-xs text-[#475569] font-mono">{a.user_id.slice(0,8)}…</div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full capitalize inline-block w-fit"
                    style={{ backgroundColor: col+"20", color: col }}>{a.difficulty}</span>
                  <div className={`text-sm font-black flex items-center gap-1 ${a.passed ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                    {a.score_pct}%
                    {a.certificate_earned && <Trophy className="w-3 h-3 text-[#F59E0B]" />}
                  </div>
                  <div className="text-sm text-[#94a3b8]">{a.correct_answers}/{a.total_questions}</div>
                  <div className="text-xs text-[#64748B]">{fmtTime(a.time_taken_secs)}</div>
                  <div className="text-xs text-[#475569]">{fmtDate(a.created_at)}</div>
                  <button onClick={() => deleteAttempt(a.id)}
                    className="p-1.5 rounded-lg text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#1E293B] text-xs text-[#475569]">
            <span>Page {page} of {pages} · {filtered.length} records</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-[#1E293B] text-[#94a3b8] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p+1)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-[#1E293B] text-[#94a3b8] transition-colors">
                <ChevronRight2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
