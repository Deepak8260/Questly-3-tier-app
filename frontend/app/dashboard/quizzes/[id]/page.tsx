"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle, XCircle, Brain, Clock, Zap, Loader2, AlertTriangle, Award, Trophy
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

function fmtTime(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function makeCertId(attemptId: string, createdAt: string) {
  const date = new Date(createdAt);
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = attemptId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `QLST-${ymd}-${suffix}`;
}

export default function QuizReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Learner");
  const [showCert, setShowCert] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] ||
        "Learner";
      setUserName(name);

      const { data, error: dbErr } = await supabase
        .from("questly_quiz_attempts")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (dbErr) setError(dbErr.message);
      else setAttempt(data);
      setLoading(false);
    };
    load();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8C8B82]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading quiz review...
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertTriangle className="w-12 h-12 text-[#8C2E24] mb-4" />
        <h2 className="font-heading text-xl font-medium text-[#3F3E38] mb-2">Quiz not found</h2>
        <p className="text-sm text-[#5B5A52] mb-4">{error || "No such quiz attempt"}</p>
        <button onClick={() => router.push("/dashboard/quizzes")}
          className="flex items-center gap-2 px-4 py-2 bg-[#6B2737] hover:bg-[#551F2C] text-white text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to My Quizzes
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/quizzes")}
            className="flex items-center gap-2 text-sm font-medium text-[#5B5A52] hover:text-[#1B1B18] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to My Quizzes
          </button>
        </div>
        {attempt.certificate_earned && (
          <button onClick={() => setShowCert(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2F6B3A] hover:bg-[#255A2E] text-white text-sm font-medium transition-colors">
            <Award className="w-4 h-4" /> View Certificate
          </button>
        )}
      </div>

      {/* Score Card */}
      <div className={`p-6 mb-6 border ${
        attempt.passed
          ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A]"
          : "bg-[#F5EEDD] dark:bg-[#2B2110] border-[#93670F]"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-heading text-2xl font-medium text-[#1B1B18]">{attempt.topic}</h1>
            <p className="text-sm text-[#5B5A52] capitalize mt-1">
              {attempt.difficulty} · {attempt.question_type} · {attempt.total_questions} questions
            </p>
          </div>
          <div className="text-right">
            <div className={`font-heading text-4xl font-medium ${attempt.passed ? "text-[#2F6B3A]" : "text-[#93670F]"}`}>
              {attempt.score_pct}%
            </div>
            <div className="text-sm mt-1" style={{ color: attempt.passed ? "#1E4425" : "#5C4508" }}>
              {attempt.correct_answers}/{attempt.total_questions} correct
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-[#5B5A52]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {fmtTime(attempt.time_taken_secs)}
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Taken on {new Date(attempt.created_at).toLocaleDateString()} at {new Date(attempt.created_at).toLocaleTimeString()}
          </div>
          {attempt.certificate_earned && (
            <div className="flex items-center gap-2 text-[#2F6B3A] font-medium">
              <Trophy className="w-4 h-4" />
              Certificate earned
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      {attempt.questions_data && attempt.questions_data.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-medium text-[#1B1B18]">Question Review</h2>
          {attempt.questions_data.map((q, i) => {
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
                    <Brain className="w-3.5 h-3.5 text-[#6B2737] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#5B5A52] leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] p-8 text-center">
          <p className="text-sm text-[#5B5A52]">Question data not available for this attempt.</p>
        </div>
      )}

      {/* Certificate Modal */}
      {showCert && attempt && (
        <CertificateModal
          topic={attempt.topic}
          scorePct={attempt.score_pct}
          correctAnswers={attempt.correct_answers}
          totalQuestions={attempt.total_questions}
          difficulty={attempt.difficulty}
          userName={userName}
          earnedAt={attempt.created_at}
          certId={makeCertId(attempt.id, attempt.created_at)}
          onClose={() => setShowCert(false)}
        />
      )}
    </div>
  );
}
