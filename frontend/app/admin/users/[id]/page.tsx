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

  return (
    <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
      {/* Attempt header — always visible */}
      <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors text-left"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{a.topic}</span>
            {a.certificate_earned && <Trophy className="w-3.5 h-3.5 text-[#93670F] dark:text-[#D4A94A] flex-shrink-0"/>}
          </div>
          <div className="text-xs text-[#8C8B82]">{fmtDate(a.created_at)}</div>
        </div>

        {/* Level badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 border border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] capitalize shrink-0">
          {a.difficulty}
        </span>

        {/* Score */}
        <div className={`text-base font-semibold w-14 text-right ${a.passed?"text-[#2F6B3A] dark:text-[#7EBA88]":"text-[#93670F] dark:text-[#D4A94A]"}`}>
          {a.score_pct}%
        </div>

        {/* Q count */}
        <div className="text-xs text-[#8C8B82] w-20 text-right">
          {a.correct_answers}/{a.total_questions} correct
        </div>

        {/* Time */}
        <div className="text-xs text-[#8C8B82] w-16 text-right">{fmtTime(a.time_taken_secs)}</div>

        {/* Expand */}
        <div className="text-[#8C8B82] ml-2 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </div>
      </button>

      {/* Full Q&A breakdown */}
      {expanded && (
        <div className="border-t border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 bg-[#FAFAF8] dark:bg-[#14140F]">
          {!a.questions_data || a.questions_data.length === 0 ? (
            <p className="text-xs text-[#8C8B82] italic py-4 text-center">
              No question-level data available for this attempt.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest mb-3">
                Question-by-Question Breakdown
              </div>
              {a.questions_data.map((q, qi) => {
                const letters = ["A","B","C","D","E"];
                return (
                  <div key={q.id ?? qi}
                    className={`border p-4 bg-white dark:bg-[#1C1C16] ${q.isCorrect ? "border-[#2F6B3A]/40" : "border-[#8C2E24]/40"}`}>
                    {/* Question header */}
                    <div className="flex items-start gap-2 mb-3">
                      {q.isCorrect
                        ? <CheckCircle className="w-4 h-4 text-[#2F6B3A] dark:text-[#7EBA88] flex-shrink-0 mt-0.5"/>
                        : <XCircle    className="w-4 h-4 text-[#8C2E24] dark:text-[#D08A7E] flex-shrink-0 mt-0.5"/>}
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold text-[#8C8B82] mb-1">Q{qi+1}</div>
                        <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] leading-relaxed">{q.question}</p>
                      </div>
                    </div>

                    {/* Options grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {(q.options ?? []).filter(Boolean).map((opt, oi) => {
                        const isCorrectOpt = oi === q.correctIndex;
                        const isUserOpt    = oi === q.userAnswerIndex;
                        let styleClass = "bg-[#FAFAF8] dark:bg-[#14140F] border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C]";

                        if (isCorrectOpt) {
                          styleClass = "bg-[#2F6B3A] text-white border-[#2F6B3A]";
                        } else if (isUserOpt && !isCorrectOpt) {
                          styleClass = "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]";
                        }

                        return (
                          <div key={oi} className={`flex items-center gap-2 px-3 py-2 border text-xs font-medium ${styleClass}`}>
                            <span className="font-semibold text-[10px] shrink-0">{letters[oi]}.</span>
                            <span className="leading-tight">{opt}</span>
                            {isCorrectOpt && <span className="ml-auto shrink-0 text-[10px] font-semibold">✓ Correct</span>}
                            {isUserOpt && !isCorrectOpt && <span className="ml-auto shrink-0 text-[10px] font-semibold">✗ User picked</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* User was unanswered check */}
                    {q.userAnswerIndex === null && (
                      <div className="text-xs text-[#93670F] dark:text-[#D4A94A] italic mb-2">⚠ Not answered</div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="flex gap-2 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] p-3 mt-2">
                        <Brain className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A] flex-shrink-0 mt-0.5"/>
                        <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] leading-relaxed">{q.explanation}</p>
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
    <div className="space-y-6">
      {/* Back */}
      <button onClick={()=>router.push("/admin/users")}
        className="flex items-center gap-2 text-sm text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA] transition-colors">
        <ArrowLeft className="w-4 h-4"/> Back to User Management
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2"/> Loading user data…
        </div>
      ) : (
        <>
          {/* User header card */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-[#6B2737] flex items-center justify-center text-white text-lg font-semibold">
                {(profile?.full_name ?? profile?.email ?? "?")[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="font-heading text-xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{profile?.full_name ?? "Unknown User"}</h1>
                <p className="text-sm text-[#8C8B82]">{profile?.email ?? id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 border ${profile?.role==="super_admin"?"bg-[#F5E7E4] dark:bg-[#2B1512] text-[#8C2E24] dark:text-[#D08A7E] border-[#E0B8AF] dark:border-[#4A2A24]":"bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border-[#DEDCD3] dark:border-[#35352C]"}`}>
                    {profile?.role ?? "user"}
                  </span>
                  <span className="text-xs text-[#8C8B82]">
                    Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : "—"}
                  </span>
                </div>
              </div>
              <button onClick={load} title="Refresh" className="ml-auto p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                <RefreshCw className="w-4 h-4"/>
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
              {[
                { label:"Quizzes Taken", value:total },
                { label:"Passed",        value:passed },
                { label:"Certs Earned",  value:certs },
                { label:"Avg Score",     value:`${avgScore}%` },
              ].map(s=>(
                <div key={s.label} className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-4 text-center">
                  <div className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-0.5">{s.value}</div>
                  <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quiz history */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest">
              Quiz History ({total})
            </h2>
            <div className="flex items-center gap-3 text-xs text-[#8C8B82]">
              <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-[#2F6B3A] dark:text-[#7EBA88]"/> Correct</span>
              <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-[#8C2E24] dark:text-[#D08A7E]"/> Wrong</span>
              <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-[#93670F] dark:text-[#D4A94A]"/> Certificate</span>
            </div>
          </div>

          {total === 0 ? (
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] py-16 text-center text-[#8C8B82] text-sm">
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
