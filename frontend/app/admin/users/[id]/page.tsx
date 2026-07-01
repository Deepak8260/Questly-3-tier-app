"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Trophy, CheckCircle, XCircle, Clock,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Brain, Award
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface QuestionData {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  userAnswerIndex: number | null;
  isCorrect: boolean;
  explanation: string | null;
}

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
  questions_data: QuestionData[] | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

const DIFF_COLOR: Record<string,string> = { easy:"#10B981", medium:"#6366F1", hard:"#EF4444" };

function fmtTime(s: number) {
  if (!s) return "—";
  return `${Math.floor(s/60)}m ${s%60}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US",{ month:"long", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Collapsible quiz attempt row with full Q&A breakdown
function AttemptRow({ a }: { a: Attempt }) {
  const [expanded, setExpanded] = useState(false);
  const col = DIFF_COLOR[a.difficulty?.toLowerCase()] ?? "#6366F1";

  return (
    <div className="bg-[#0B1120] border border-[#1E293B] rounded-2xl overflow-hidden">
      {/* Attempt header — always visible */}
      <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1E293B]/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-white truncate">{a.topic}</span>
            {a.certificate_earned && <Trophy className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0"/>}
          </div>
          <div className="text-xs text-[#475569]">{fmtDate(a.created_at)}</div>
        </div>

        {/* Level badge */}
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full capitalize shrink-0"
          style={{backgroundColor:col+"20",color:col}}>{a.difficulty}</span>

        {/* Score */}
        <div className={`text-lg font-black w-14 text-right ${a.passed?"text-[#10B981]":"text-[#F59E0B]"}`}>
          {a.score_pct}%
        </div>

        {/* Q count */}
        <div className="text-xs text-[#475569] w-20 text-right">
          {a.correct_answers}/{a.total_questions} correct
        </div>

        {/* Time */}
        <div className="text-xs text-[#475569] w-16 text-right">{fmtTime(a.time_taken_secs)}</div>

        {/* Expand */}
        <div className="text-[#475569] ml-2 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </div>
      </button>

      {/* Full Q&A breakdown */}
      {expanded && (
        <div className="border-t border-[#1E293B] px-5 py-4">
          {!a.questions_data || a.questions_data.length === 0 ? (
            <p className="text-xs text-[#475569] italic py-4 text-center">
              No question-level data available for this attempt.<br/>
              (Only quizzes taken after the latest update are tracked at this level.)
            </p>
          ) : (
            <div className="space-y-4">
              <div className="text-[9px] font-black text-[#475569] uppercase tracking-widest mb-3">
                Question-by-Question Breakdown
              </div>
              {a.questions_data.map((q, qi) => {
                const letters = ["A","B","C","D","E"];
                return (
                  <div key={q.id ?? qi}
                    className={`rounded-xl border p-4 ${q.isCorrect ? "border-[#10B981]/30 bg-[#10B981]/5" : "border-[#EF4444]/30 bg-[#EF4444]/5"}`}>
                    {/* Question header */}
                    <div className="flex items-start gap-2 mb-3">
                      {q.isCorrect
                        ? <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5"/>
                        : <XCircle    className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5"/>}
                      <div className="flex-1">
                        <div className="text-[10px] font-black text-[#475569] mb-1">Q{qi+1}</div>
                        <p className="text-sm font-semibold text-white leading-relaxed">{q.question}</p>
                      </div>
                    </div>

                    {/* Options grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {(q.options ?? []).filter(Boolean).map((opt, oi) => {
                        const isCorrectOpt = oi === q.correctIndex;
                        const isUserOpt    = oi === q.userAnswerIndex;
                        let bg = "#1E293B"; let border = "#334155"; let textCol = "#94a3b8";

                        if (isCorrectOpt)            { bg="#10B981"; border="#10B981"; textCol="#fff"; }
                        else if (isUserOpt && !isCorrectOpt) { bg="#EF444420"; border="#EF4444"; textCol="#fca5a5"; }

                        return (
                          <div key={oi} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium"
                            style={{backgroundColor:bg, borderColor:border, color:textCol}}>
                            <span className="font-black text-[10px] shrink-0">{letters[oi]}.</span>
                            <span className="leading-tight">{opt}</span>
                            {isCorrectOpt && <span className="ml-auto shrink-0 text-[10px] font-black">✓ Correct</span>}
                            {isUserOpt && !isCorrectOpt && <span className="ml-auto shrink-0 text-[10px] font-black">✗ User picked</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* User was unanswered check */}
                    {q.userAnswerIndex === null && (
                      <div className="text-xs text-[#F59E0B] italic mb-2">⚠ Not answered</div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="flex gap-2 bg-[#1E293B] rounded-xl p-3 mt-2">
                        <Brain className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0 mt-0.5"/>
                        <p className="text-xs text-[#94a3b8] leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page
export default function AdminUserDetail() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [profileRes, attemptsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase.from("questly_quiz_attempts").select("*").eq("user_id", id).order("created_at",{ascending:false}),
    ]);
    setProfile(profileRes.data ?? null);
    setAttempts(attemptsRes.data ?? []);
    setLoading(false);
  };
  useEffect(() => { if (id) load(); }, [id]);

  // Stats
  const total   = attempts.length;
  const passed  = attempts.filter(a=>a.passed).length;
  const certs   = attempts.filter(a=>a.certificate_earned).length;
  const avgScore = total ? Math.round(attempts.reduce((s,a)=>s+a.score_pct,0)/total) : 0;

  return (
    <div className="animate-fade-in-up">
      {/* Back */}
      <button onClick={()=>router.push("/admin/users")}
        className="flex items-center gap-2 text-sm text-[#64748B] hover:text-[#94a3b8] mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4"/> Back to User Management
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#475569]">
          <Loader2 className="w-5 h-5 animate-spin mr-2"/> Loading user data…
        </div>
      ) : (
        <>
          {/* User header card */}
          <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-black">
                {(profile?.full_name ?? profile?.email ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-black text-white">{profile?.full_name ?? "Unknown User"}</h1>
                <p className="text-sm text-[#64748B]">{profile?.email ?? id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${profile?.role==="super_admin"?"bg-[#EF4444]/15 text-[#EF4444]":"bg-[#1E293B] text-[#64748B]"}`}>
                    {profile?.role ?? "user"}
                  </span>
                  <span className="text-[10px] text-[#475569]">
                    Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : "—"}
                  </span>
                </div>
              </div>
              <button onClick={load} className="ml-auto flex items-center gap-2 text-sm text-[#64748B] bg-[#1E293B] border border-[#334155] px-3 py-1.5 rounded-xl hover:border-[#6366F1] transition-all">
                <RefreshCw className="w-3.5 h-3.5"/>
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label:"Quizzes Taken", value:total,    color:"#6366F1" },
                { label:"Passed",        value:passed,   color:"#10B981" },
                { label:"Certs Earned",  value:certs,    color:"#F59E0B" },
                { label:"Avg Score",     value:`${avgScore}%`, color: avgScore>=70?"#10B981":"#F59E0B" },
              ].map(s=>(
                <div key={s.label} className="bg-[#0B1120] rounded-xl border border-[#1E293B] p-3 text-center">
                  <div className="text-xl font-black mb-0.5" style={{color:s.color}}>{s.value}</div>
                  <div className="text-[10px] text-[#475569]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quiz history */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-[#64748B] uppercase tracking-widest">
              Quiz History ({total})
            </h2>
            <div className="flex items-center gap-3 text-xs text-[#475569]">
              <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-[#10B981]"/> Correct</span>
              <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-[#EF4444]"/> Wrong</span>
              <span className="flex items-center gap-1"><Trophy className="w-3 h-3 text-[#F59E0B]"/> Certificate</span>
            </div>
          </div>

          {total === 0 ? (
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl py-16 text-center text-[#475569] text-sm">
              This user hasn't taken any quizzes yet.
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.map(a => <AttemptRow key={a.id} a={a}/>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
