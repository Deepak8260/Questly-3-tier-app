"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, ChevronRight, ChevronLeft,
  Trophy, RotateCcw, Brain, Clock, Zap, Download, Award, BookOpen, AlertTriangle
} from "lucide-react";
import type { GeneratedQuiz, QuizQuestion } from "@/lib/quiz";
import { createClient } from "@/lib/supabase";
import { API_BASE_URL } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-[#1B1B18] text-[#E8E6DE] text-xs font-mono p-4 my-3 overflow-x-auto leading-relaxed whitespace-pre border border-[#35352C]">
      <code>{code}</code>
    </pre>
  );
}

function QuestionText({ question, code }: { question: string; code?: string }) {
  return (
    <div className="mb-5">
      <p className="text-base font-medium text-[#1B1B18] dark:text-[#F2F1EA] leading-relaxed">{question}</p>
      {code && <CodeBlock code={code} />}
    </div>
  );
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// ── Certificate Component ─────────────────────────────────────────
function CertificateView({
  topic, score, total, difficulty, userName, onClose
}: {
  topic: string; score: number; total: number; difficulty: string;
  userName: string; onClose: () => void;
}) {
  const certRef = useRef<HTMLDivElement>(null);
  const pct = Math.round((score / total) * 100);
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const handleDownload = () => {
    if (!certRef.current) return;
    const printContent = certRef.current.outerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Questly Certificate – ${topic}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, serif; background: #fff; }
            .cert { width: 900px; margin: 0 auto; padding: 60px; border: 4px solid #6B2737; min-height: 600px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: #F5F4F0; }
            .issuer { font-size: 14px; color: #6B2737; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 24px; }
            .title { font-size: 44px; font-weight: 600; color: #1B1B18; margin-bottom: 8px; }
            .sub { font-size: 16px; color: #5B5A52; margin-bottom: 40px; }
            .name { font-size: 34px; color: #6B2737; font-style: italic; margin: 16px 0; border-bottom: 2px solid #6B2737; padding-bottom: 8px; display: inline-block; }
            .body-text { font-size: 18px; color: #3F3E38; margin-bottom: 8px; }
            .topic { font-size: 22px; font-weight: 600; color: #1B1B18; margin: 8px 0 24px; }
            .score { font-size: 44px; font-weight: 600; color: #2F6B3A; margin: 16px 0 8px; }
            .score-label { font-size: 14px; color: #5B5A52; margin-bottom: 32px; }
            .footer { display: flex; justify-content: space-between; width: 100%; margin-top: 48px; padding-top: 24px; border-top: 1px solid #DEDCD3; font-size: 13px; color: #5B5A52; }
            .cert-id { font-family: monospace; font-size: 11px; color: #8C8B82; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="cert">
            <div class="issuer">Questly — Learning Platform</div>
            <div class="title">Certificate of Achievement</div>
            <div class="sub">This certifies that</div>
            <div class="name">${userName}</div>
            <div class="body-text">has successfully completed the quiz on</div>
            <div class="topic">${topic}</div>
            <div class="body-text">with a score of</div>
            <div class="score">${pct}%</div>
            <div class="score-label">${score} out of ${total} questions correct · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty</div>
            <div class="footer">
              <span>Issued: ${date}</span>
              <span>Passing criteria: 70% or above</span>
              <span>Verified by Questly</span>
            </div>
            <div class="cert-id">Certificate ID: QUIZAI-${Date.now().toString(36).toUpperCase()}</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white max-w-2xl w-full overflow-hidden">
        {/* Certificate preview */}
        <div
          ref={certRef}
          className="bg-[#F5F4F0] p-10 border-4 border-[#6B2737] text-center"
        >
          <div className="text-xs font-semibold text-[#6B2737] tracking-[4px] uppercase mb-4">
            Questly · Learning Platform
          </div>
          <h2 className="font-heading text-3xl font-medium text-[#1B1B18] mb-1">Certificate of Achievement</h2>
          <p className="text-[#5B5A52] mb-5">This certifies that</p>
          <div className="font-heading text-3xl font-medium text-[#6B2737] italic border-b-2 border-[#6B2737] inline-block pb-1 mb-5">
            {userName}
          </div>
          <p className="text-[#3F3E38] mb-1">has successfully completed the quiz on</p>
          <p className="text-xl font-semibold text-[#1B1B18] mb-4">{topic}</p>
          <div className="font-heading text-5xl font-medium text-[#2F6B3A] mb-1">{pct}%</div>
          <div className="text-sm text-[#5B5A52] mb-4">
            {score}/{total} correct · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty
          </div>
          <div className="flex items-center justify-between text-xs text-[#8C8B82] border-t border-[#DEDCD3] pt-4 mt-2">
            <span>{date}</span>
            <span>Passing: 70%+</span>
            <span>Verified by Questly</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 bg-[#FAFAF8]">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium py-3 transition-colors text-sm"
          >
            <Download className="w-4 h-4" /> Download certificate (PDF)
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 border border-[#DEDCD3] bg-white text-[#3F3E38] font-medium hover:bg-[#FAFAF8] text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Results Component ─────────────────────────────────────────────
function QuizResults({ quiz, answers, timeTaken, onRetry, userName, saving, saveError }: {
  quiz: GeneratedQuiz;
  answers: (number | null)[];
  timeTaken: number;
  onRetry: () => void;
  userName: string;
  saving: boolean;
  saveError: string | null;
}) {
  const router = useRouter();
  const [showCert, setShowCert] = useState(false);

  const correct = answers.filter((a, i) => a === quiz.questions[i].correctIndex).length;
  const total = quiz.questions.length;
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= 70;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Certificate modal */}
      {showCert && (
        <CertificateView
          topic={quiz.topic}
          score={correct}
          total={total}
          difficulty={quiz.difficulty}
          userName={userName}
          onClose={() => setShowCert(false)}
        />
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-xs text-[#5B5A52] dark:text-[#ABA99C] bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-4 py-2.5 mb-4">
          <div className="w-3 h-3 border-2 border-[#6B2737]/30 border-t-[#6B2737] rounded-full animate-spin flex-shrink-0" />
          Saving quiz result...
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-start gap-3 bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#8C2E24] dark:text-[#D08A7E] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#8C2E24] dark:text-[#D08A7E]">Quiz not saved</p>
            <p className="text-xs text-[#8C2E24] dark:text-[#D08A7E] mt-0.5 font-mono">{saveError}</p>
            <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] mt-1">
              Go to <strong>Supabase → SQL Editor</strong> and run the migration SQL from My Quizzes page.
            </p>
          </div>
        </div>
      )}

      {/* Score card */}
      <div className={`p-8 mb-6 text-center border ${
        passed
          ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] dark:border-[#2E4A32]"
          : "bg-[#F5EEDD] dark:bg-[#2B2110] border-[#93670F] dark:border-[#4A3A10]"
      }`}>
        <div className={`font-heading text-7xl font-medium mb-2 ${passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>{pct}%</div>
        <div className="text-lg font-semibold mb-1" style={{ color: passed ? "#1E4425" : "#5C4508" }}>
          {correct} / {total} correct
        </div>
        <div className="text-sm" style={{ color: passed ? "#2F6B3A" : "#93670F" }}>
          {passed ? "Great job — you've passed." : "You need 70% to pass. Keep practicing."}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm" style={{ color: passed ? "#2F6B3A" : "#93670F" }}>
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatTime(timeTaken)}</span>
          <span className="flex items-center gap-1.5"><Brain className="w-4 h-4" /> {quiz.topic}</span>
          <span className="capitalize font-medium">{quiz.difficulty}</span>
        </div>

        {/* Eligibility banner */}
        <div className={`mt-5 px-5 py-3 flex items-center justify-center gap-3 text-sm font-medium border ${
          passed
            ? "bg-white/50 dark:bg-transparent text-[#2F6B3A] dark:text-[#7EBA88] border-[#2F6B3A] dark:border-[#2E4A32]"
            : "bg-white/50 dark:bg-transparent text-[#93670F] dark:text-[#D4A94A] border-[#93670F] dark:border-[#4A3A10]"
        }`}>
          {passed
            ? <><Award className="w-5 h-5" /> Certificate eligible — you scored {pct}%, above the 70% threshold</>
            : <><BookOpen className="w-5 h-5" /> Not eligible yet — you scored {pct}%, need 70% to earn a certificate</>
          }
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#3F3E38] dark:text-[#D6D4C9] font-medium py-3 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" /> Try again
        </button>
        <button
          onClick={() => router.push("/dashboard/generate")}
          className="flex-1 flex items-center justify-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium py-3 transition-colors text-sm"
        >
          <Zap className="w-4 h-4" /> New quiz
        </button>
      </div>

      {/* Certificate download button (only if passed) */}
      {passed && (
        <button
          onClick={() => setShowCert(true)}
          className="w-full flex items-center justify-center gap-2.5 bg-[#2F6B3A] hover:bg-[#255A2E] text-white font-medium py-3.5 transition-colors mb-5 text-sm"
        >
          <Trophy className="w-4 h-4" />
          View and download certificate
          <Download className="w-4 h-4" />
        </button>
      )}

      {/* View in My Quizzes */}
      <button
        onClick={() => router.push("/dashboard/quizzes")}
        className="w-full flex items-center justify-center gap-2 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#6B2737] dark:text-[#B5677A] font-medium py-3 hover:bg-[#F3E7E9] dark:hover:bg-[#2E1A20] transition-colors text-sm mb-8"
      >
        <BookOpen className="w-4 h-4" /> View in my quizzes
      </button>

      {/* Question review */}
      <div className="space-y-4">
        <h2 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA]">Question review</h2>
        {quiz.questions.map((q, i) => {
          const userAns = answers[i];
          const isCorrect = userAns === q.correctIndex;
          return (
            <div key={q.id} className={`bg-white dark:bg-[#1C1C16] border p-5 ${isCorrect ? "border-[#2F6B3A]" : "border-[#8C2E24]"}`}>
              <div className="flex items-start gap-3 mb-3">
                {isCorrect
                  ? <CheckCircle className="w-5 h-5 text-[#2F6B3A] dark:text-[#7EBA88] flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-[#8C2E24] dark:text-[#D08A7E] flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#8C8B82] mb-1">Q{i + 1}</div>
                  <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{q.question}</p>
                  {q.code && <CodeBlock code={q.code} />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {q.options.filter(o => o).map((opt, oi) => {
                  const isCorrectOpt = oi === q.correctIndex;
                  const isUserOpt = oi === userAns;
                  return (
                    <div key={oi} className={`text-xs px-3 py-2 border font-medium ${
                      isCorrectOpt ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]"
                      : isUserOpt && !isCorrectOpt ? "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]"
                      : "bg-[#FAFAF8] dark:bg-[#14140F] border-[#EAE8E1] dark:border-[#262620] text-[#5B5A52] dark:text-[#ABA99C]"
                    }`}>
                      {["A","B","C","D"][oi]}. {opt}
                      {isCorrectOpt && " ✓"}
                      {isUserOpt && !isCorrectOpt && " ✗"}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="flex gap-2 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] p-3">
                  <Brain className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main QuizTake Component ───────────────────────────────────────
export default function QuizTake({ quiz, onRetry }: { quiz: GeneratedQuiz; onRetry: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(quiz.questions.length).fill(null));
  const [showExplanation, setShowExplanation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeTaken, setTimeTaken] = useState(0);
  const [startTime] = useState(Date.now());
  const [userName, setUserName] = useState("Learner");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch user name from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "Learner";
        setUserName(name);
      }
    });
  }, []);

  // Timer
  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(() => {
      setTimeTaken(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, startTime]);

  const current: QuizQuestion = quiz.questions[currentIndex];
  const userAnswer = answers[currentIndex];
  const hasAnswered = userAnswer !== null;
  const isLast = currentIndex === quiz.questions.length - 1;
  const allAnswered = answers.every(a => a !== null);

  const handleOptionSelect = (optIndex: number) => {
    if (hasAnswered) return;
    const newAnswers = [...answers];
    newAnswers[currentIndex] = optIndex;
    setAnswers(newAnswers);
    setShowExplanation(true);
  };

  const handleNext = useCallback(() => {
    setShowExplanation(false);
    setCurrentIndex(i => i + 1);
  }, []);

  // Save quiz attempt via server-side API (reliable session via cookies)
  const saveAttempt = async (finalAnswers: (number | null)[], finalTime: number) => {
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const correctCount = finalAnswers.filter((a, i) => a === quiz.questions[i].correctIndex).length;
      const total = quiz.questions.length;
      const score = Math.round((correctCount / total) * 100);
      const passed = score >= 70;

      const res = await fetch(`${API_BASE_URL}/api/quiz/save-attempt`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          question_type: quiz.questionType,
          total_questions: total,
          correct_answers: correctCount,
          score_pct: score,
          time_taken_secs: finalTime,
          passed,
          certificate_earned: passed,
          // Full question + answer breakdown for admin tracking
          questions_data: quiz.questions.map((q, i) => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            userAnswerIndex: finalAnswers[i],
            isCorrect: finalAnswers[i] === q.correctIndex,
            explanation: q.explanation ?? null,
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        const msg = result.error || "Unknown error";
        const hint = result.hint ? ` — ${result.hint}` : "";
        console.error("Quiz save failed:", result);
        setSaveError(`Save failed: ${msg}${hint}`);
      } else {
        console.log("Quiz saved:", result);
      }
    } catch (err) {
      console.error("saveAttempt fetch error:", err);
      setSaveError(`Network error: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    setTimeTaken(finalTime);
    setSubmitted(true);
    saveAttempt(answers, finalTime);
  };

  if (submitted) {
    return (
      <QuizResults
        quiz={quiz}
        answers={answers}
        timeTaken={timeTaken}
        onRetry={onRetry}
        userName={userName}
        saving={saving}
        saveError={saveError}
      />
    );
  }

  const mins = Math.floor(timeTaken / 60);
  const secs = timeTaken % 60;
  const progress = ((currentIndex + (hasAnswered ? 1 : 0)) / quiz.questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {saving && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-4 py-2 text-sm text-[#5B5A52] dark:text-[#ABA99C] flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#6B2737]/30 border-t-[#6B2737] rounded-full animate-spin" />
          Saving result...
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{quiz.topic}</h1>
          <p className="text-xs text-[#8C8B82] capitalize">{quiz.difficulty} · {quiz.questions.length} questions</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-[#5B5A52] dark:text-[#ABA99C] bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-1.5">
          <Clock className="w-3.5 h-3.5" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-[#EDECE6] dark:bg-[#262620] h-1.5 mb-6 overflow-hidden">
        <div className="h-full bg-[#6B2737] dark:bg-[#B5677A] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Question navigation dots */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setShowExplanation(answers[i] !== null); }}
            className={`w-7 h-7 text-xs font-semibold transition-colors ${
              i === currentIndex ? "bg-[#6B2737] text-white"
              : answers[i] !== null
                ? answers[i] === quiz.questions[i].correctIndex ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] text-[#2F6B3A] dark:text-[#7EBA88]" : "bg-[#F5E7E4] dark:bg-[#2B1512] text-[#8C2E24] dark:text-[#D08A7E]"
              : "bg-[#EDECE6] dark:bg-[#262620] text-[#8C8B82] hover:bg-[#DEDCD3] dark:hover:bg-[#35352C]"
            }`}
          >{i + 1}</button>
        ))}
      </div>

      {/* Question card */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-[#6B2737] dark:text-[#B5677A] uppercase tracking-wider">
            Question {currentIndex + 1} of {quiz.questions.length}
          </span>
          {hasAnswered && (
            userAnswer === current.correctIndex
              ? <span className="flex items-center gap-1 text-xs font-medium text-[#2F6B3A] dark:text-[#7EBA88]"><CheckCircle className="w-3.5 h-3.5" /> Correct</span>
              : <span className="flex items-center gap-1 text-xs font-medium text-[#8C2E24] dark:text-[#D08A7E]"><XCircle className="w-3.5 h-3.5" /> Incorrect</span>
          )}
        </div>

        {/* Question + optional code block */}
        <QuestionText question={current.question} code={current.code} />

        <div className="grid grid-cols-1 gap-2.5">
          {current.options.filter(o => o).map((opt, i) => {
            const isSelected = userAnswer === i;
            const isCorrect = i === current.correctIndex;
            let cls = "w-full text-left px-4 py-3 border text-sm font-medium transition-colors ";
            if (!hasAnswered) {
              cls += "border-[#DEDCD3] dark:border-[#35352C] hover:border-[#6B2737] hover:bg-[#F3E7E9] dark:hover:bg-[#2E1A20] text-[#3F3E38] dark:text-[#D6D4C9] cursor-pointer";
            } else if (isCorrect) {
              cls += "border-[#2F6B3A] bg-[#E9F1E9] dark:bg-[#1A2A1D] text-[#1E4425] dark:text-[#7EBA88]";
            } else if (isSelected) {
              cls += "border-[#8C2E24] bg-[#F5E7E4] dark:bg-[#2B1512] text-[#5C1F18] dark:text-[#D08A7E]";
            } else {
              cls += "border-[#EAE8E1] dark:border-[#262620] text-[#8C8B82] cursor-default";
            }
            return (
              <button key={i} className={cls} onClick={() => handleOptionSelect(i)} disabled={hasAnswered}>
                <span className={`font-semibold mr-2.5 ${!hasAnswered ? "text-[#6B2737] dark:text-[#B5677A]" : isCorrect ? "text-[#2F6B3A] dark:text-[#7EBA88]" : isSelected ? "text-[#8C2E24] dark:text-[#D08A7E]" : "text-[#ABA99C]"}`}>
                  {["A", "B", "C", "D"][i]}.
                </span>
                {opt}
                {hasAnswered && isCorrect && <CheckCircle className="w-4 h-4 text-[#2F6B3A] dark:text-[#7EBA88] inline ml-2" />}
                {hasAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-[#8C2E24] dark:text-[#D08A7E] inline ml-2" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && current.explanation && (
        <div className="flex gap-2.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] p-4 mb-4">
          <Brain className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Explanation</p>
            <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] leading-relaxed">{current.explanation}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setCurrentIndex(i => i - 1); setShowExplanation(answers[currentIndex - 1] !== null); }}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[#5B5A52] dark:text-[#ABA99C] border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-medium bg-[#2F6B3A] hover:bg-[#255A2E] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Trophy className="w-4 h-4" /> Submit quiz
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!hasAnswered}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-[#6B2737] hover:bg-[#551F2C] text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}