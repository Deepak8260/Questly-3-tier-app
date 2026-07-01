"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, ChevronRight, ChevronLeft,
  Trophy, RotateCcw, Brain, Clock, Zap, Download, Award, BookOpen
} from "lucide-react";
import type { GeneratedQuiz, QuizQuestion } from "@/app/api/quiz/generate/route";
import { createClient } from "@/lib/supabase";

// ── Helpers ──────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-[#0F172A] text-[#E2E8F0] text-xs font-mono rounded-xl p-4 my-3 overflow-x-auto leading-relaxed whitespace-pre border border-[#1E293B]">
      <code>{code}</code>
    </pre>
  );
}

function QuestionText({ question, code }: { question: string; code?: string }) {
  return (
    <div className="mb-5">
      <p className="text-base font-semibold text-[#111827] leading-relaxed">{question}</p>
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
    // Use print-to-PDF approach for clean certificate download
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
            .cert { width: 900px; margin: 0 auto; padding: 60px; border: 12px solid #6366F1; min-height: 600px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: linear-gradient(135deg, #EEF2FF 0%, #fff 50%, #F5F3FF 100%); }
            .badge { font-size: 80px; margin-bottom: 16px; }
            .issuer { font-size: 14px; color: #6366F1; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 24px; }
            .title { font-size: 48px; font-weight: bold; color: #111827; margin-bottom: 8px; }
            .sub { font-size: 16px; color: #6B7280; margin-bottom: 40px; }
            .name { font-size: 36px; color: #6366F1; font-style: italic; margin: 16px 0; border-bottom: 2px solid #6366F1; padding-bottom: 8px; display: inline-block; }
            .body-text { font-size: 18px; color: #374151; margin-bottom: 8px; }
            .topic { font-size: 22px; font-weight: bold; color: #111827; margin: 8px 0 24px; }
            .score { font-size: 48px; font-weight: bold; color: #059669; margin: 16px 0 8px; }
            .score-label { font-size: 14px; color: #6B7280; margin-bottom: 32px; }
            .footer { display: flex; justify-content: space-between; width: 100%; margin-top: 48px; padding-top: 24px; border-top: 1px solid #E5E7EB; font-size: 13px; color: #6B7280; }
            .cert-id { font-family: monospace; font-size: 11px; color: #9CA3AF; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="cert">
            <div class="badge">🏆</div>
            <div class="issuer">Questly — AI-Powered Learning Platform</div>
            <div class="title">Certificate of Achievement</div>
            <div class="sub">This certifies that</div>
            <div class="name">${userName}</div>
            <div class="body-text">has successfully completed the quiz on</div>
            <div class="topic">${topic}</div>
            <div class="body-text">with a score of</div>
            <div class="score">${pct}%</div>
            <div class="score-label">${score} out of ${total} questions correct · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty</div>
            <div class="footer">
              <span>📅 Issued: ${date}</span>
              <span>✅ Passing criteria: ≥ 70%</span>
              <span>🎓 Verified by Questly</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Certificate preview */}
        <div
          ref={certRef}
          className="bg-gradient-to-br from-[#EEF2FF] via-white to-[#F5F3FF] p-10 border-8 border-[#6366F1] text-center"
        >
          <div className="text-5xl mb-3">🏆</div>
          <div className="text-xs font-black text-[#6366F1] tracking-[4px] uppercase mb-4">
            Questly · AI-Powered Learning Platform
          </div>
          <h2 className="text-3xl font-black text-[#111827] mb-1">Certificate of Achievement</h2>
          <p className="text-[#6B7280] mb-5">This certifies that</p>
          <div className="text-3xl font-bold text-[#6366F1] italic border-b-2 border-[#6366F1] inline-block pb-1 mb-5">
            {userName}
          </div>
          <p className="text-[#374151] mb-1">has successfully completed the quiz on</p>
          <p className="text-xl font-black text-[#111827] mb-4">{topic}</p>
          <div className="text-5xl font-black text-[#059669] mb-1">{pct}%</div>
          <div className="text-sm text-[#6B7280] mb-4">
            {score}/{total} correct · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty
          </div>
          <div className="flex items-center justify-between text-xs text-[#9CA3AF] border-t border-[#E5E7EB] pt-4 mt-2">
            <span>📅 {date}</span>
            <span>✅ Passing: ≥70%</span>
            <span>🎓 Verified by Questly</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 bg-[#F9FAFB]">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg text-sm"
          >
            <Download className="w-4 h-4" /> Download Certificate (PDF)
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 border border-[#E5E7EB] bg-white text-[#374151] font-semibold rounded-xl hover:bg-[#F9FAFB] text-sm"
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
    <div className="max-w-2xl mx-auto animate-fade-in-up">
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
        <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#94a3b8] bg-white dark:bg-[#1e293b] border border-[#E5E7EB] dark:border-[#334155] rounded-xl px-4 py-2.5 mb-4 shadow-sm">
          <div className="w-3 h-3 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin flex-shrink-0" />
          Saving quiz result...
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-start gap-3 bg-[#FEF2F2] dark:bg-[#1c0809] border border-[#FECACA] dark:border-[#7f1d1d] rounded-xl px-4 py-3 mb-4">
          <span className="text-[#EF4444] text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-bold text-[#DC2626] dark:text-[#f87171]">Quiz not saved</p>
            <p className="text-xs text-[#EF4444] dark:text-[#fca5a5] mt-0.5 font-mono">{saveError}</p>
            <p className="text-xs text-[#6B7280] mt-1">
              Go to <strong>Supabase → SQL Editor</strong> and run the migration SQL from My Quizzes page.
            </p>
          </div>
        </div>
      )}

      {/* Score card — text pinned with inline styles so global dark overrides don't make text invisible on light-green bg */}
      <div className={`rounded-3xl p-8 mb-6 text-center ${
        passed
          ? "bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border border-[#6EE7B7] dark:from-[#022c22] dark:to-[#064e3b] dark:border-[#065f46]"
          : "bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border border-[#FCD34D] dark:from-[#1c1208] dark:to-[#292110] dark:border-[#92400e]"
      }`}>
        <div className="text-6xl mb-3">{passed ? "🏆" : "💪"}</div>
        <div className={`text-7xl font-black mb-2 ${passed ? "text-[#059669] dark:text-[#34d399]" : "text-[#D97706] dark:text-[#fbbf24]"}`}>{pct}%</div>
        {/* Use style= to pin color, bypassing global dark-mode class overrides */}
        <div className="text-lg font-bold mb-1" style={{ color: passed ? "#065f46" : "#78350f" }}>
          {correct} / {total} correct
        </div>
        <div className="text-sm" style={{ color: passed ? "#047857" : "#92400e" }}>
          {passed ? "Great job! You've passed! 🎉" : "You need 70% to pass. Keep practicing!"}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm" style={{ color: passed ? "#047857" : "#92400e" }}>
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatTime(timeTaken)}</span>
          <span className="flex items-center gap-1.5"><Brain className="w-4 h-4" /> {quiz.topic}</span>
          <span className="capitalize font-medium">{quiz.difficulty}</span>
        </div>

        {/* Eligibility banner */}
        <div className={`mt-5 rounded-2xl px-5 py-3 flex items-center justify-center gap-3 text-sm font-semibold ${
          passed
            ? "bg-[#059669]/10 text-[#059669] dark:text-[#34d399] border border-[#6EE7B7] dark:border-[#065f46]"
            : "bg-[#D97706]/10 text-[#D97706] dark:text-[#fbbf24] border border-[#FCD34D] dark:border-[#92400e]"
        }`}>
          {passed
            ? <><Award className="w-5 h-5" /> Certificate eligible! You scored {pct}% ≥ 70%</>
            : <><BookOpen className="w-5 h-5" /> Not eligible yet — score {pct}%, need 70% to earn certificate</>
          }
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 border border-[#E5E7EB] bg-white text-[#374151] font-semibold py-3 rounded-xl hover:bg-[#F9FAFB] transition-all text-sm"
        >
          <RotateCcw className="w-4 h-4" /> Try Again
        </button>
        <button
          onClick={() => router.push("/dashboard/generate")}
          className="flex-1 flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg text-sm"
        >
          <Zap className="w-4 h-4" /> New Quiz
        </button>
      </div>

      {/* Certificate download button (only if passed) */}
      {passed && (
        <button
          onClick={() => setShowCert(true)}
          className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#047857] hover:to-[#059669] text-white font-bold py-3.5 rounded-xl transition-all hover:shadow-lg mb-5 text-sm"
        >
          <Trophy className="w-4 h-4" />
          View &amp; Download Certificate
          <Download className="w-4 h-4" />
        </button>
      )}

      {/* View in My Quizzes */}
      <button
        onClick={() => router.push("/dashboard/quizzes")}
        className="w-full flex items-center justify-center gap-2 border border-[#E5E7EB] bg-white text-[#6366F1] font-semibold py-3 rounded-xl hover:bg-[#EEF2FF] transition-all text-sm mb-8"
      >
        <BookOpen className="w-4 h-4" /> View in My Quizzes
      </button>

      {/* Question review */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-[#111827]">Question Review</h2>
        {quiz.questions.map((q, i) => {
          const userAns = answers[i];
          const isCorrect = userAns === q.correctIndex;
          return (
            <div key={q.id} className={`bg-white rounded-2xl border p-5 ${isCorrect ? "border-[#6EE7B7]" : "border-[#FECACA]"}`}>
              <div className="flex items-start gap-3 mb-3">
                {isCorrect
                  ? <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <div className="text-xs font-bold text-[#9CA3AF] mb-1">Q{i + 1}</div>
                  <p className="text-sm font-semibold text-[#111827]">{q.question}</p>
                  {q.code && <CodeBlock code={q.code} />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {q.options.filter(o => o).map((opt, oi) => {
                  const isCorrectOpt = oi === q.correctIndex;
                  const isUserOpt = oi === userAns;
                  return (
                    <div key={oi} className={`text-xs px-3 py-2 rounded-lg border font-medium ${
                      isCorrectOpt ? "bg-[#D1FAE5] border-[#6EE7B7] text-[#065F46]"
                      : isUserOpt && !isCorrectOpt ? "bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]"
                      : "bg-[#F9FAFB] border-[#F3F4F6] text-[#6B7280]"
                    }`}>
                      {["A","B","C","D"][oi]}. {opt}
                      {isCorrectOpt && " ✓"}
                      {isUserOpt && !isCorrectOpt && " ✗"}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <div className="flex gap-2 bg-[#F5F3FF] rounded-xl p-3">
                  <Brain className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#6D28D9] leading-relaxed">{q.explanation}</p>
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
      const correctCount = finalAnswers.filter((a, i) => a === quiz.questions[i].correctIndex).length;
      const total = quiz.questions.length;
      const score = Math.round((correctCount / total) * 100);
      const passed = score >= 70;

      const res = await fetch("/api/quiz/save-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        console.log("Quiz saved:", result.data);
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
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      {saving && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-[#E5E7EB] shadow-lg rounded-xl px-4 py-2 text-sm text-[#6B7280] flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin" />
          Saving result...
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-black text-[#111827]">{quiz.topic}</h1>
          <p className="text-xs text-[#9CA3AF] capitalize">{quiz.difficulty} · {quiz.questions.length} questions</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#6B7280] bg-white border border-[#E5E7EB] px-3 py-1.5 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-[#F3F4F6] rounded-full h-2 mb-6 overflow-hidden">
        <div className="h-full bg-[#6366F1] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Question navigation dots */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {quiz.questions.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setShowExplanation(answers[i] !== null); }}
            className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
              i === currentIndex ? "bg-[#6366F1] text-white scale-110"
              : answers[i] !== null
                ? answers[i] === quiz.questions[i].correctIndex ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEE2E2] text-[#991B1B]"
              : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]"
            }`}
          >{i + 1}</button>
        ))}
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black text-[#6366F1] uppercase tracking-wider">
            Question {currentIndex + 1} of {quiz.questions.length}
          </span>
          {hasAnswered && (
            userAnswer === current.correctIndex
              ? <span className="flex items-center gap-1 text-xs font-bold text-[#10B981]"><CheckCircle className="w-3.5 h-3.5" /> Correct!</span>
              : <span className="flex items-center gap-1 text-xs font-bold text-[#EF4444]"><XCircle className="w-3.5 h-3.5" /> Incorrect</span>
          )}
        </div>

        {/* Question + optional code block */}
        <QuestionText question={current.question} code={current.code} />

        <div className="grid grid-cols-1 gap-2.5">
          {current.options.filter(o => o).map((opt, i) => {
            const isSelected = userAnswer === i;
            const isCorrect = i === current.correctIndex;
            let cls = "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ";
            if (!hasAnswered) {
              cls += "border-[#E5E7EB] hover:border-[#6366F1] hover:bg-[#EEF2FF] text-[#374151] cursor-pointer";
            } else if (isCorrect) {
              cls += "border-[#6EE7B7] bg-[#ECFDF5] text-[#065F46]";
            } else if (isSelected) {
              cls += "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
            } else {
              cls += "border-[#F3F4F6] text-[#9CA3AF] cursor-default";
            }
            return (
              <button key={i} className={cls} onClick={() => handleOptionSelect(i)} disabled={hasAnswered}>
                <span className={`font-bold mr-2.5 ${!hasAnswered ? "text-[#6366F1]" : isCorrect ? "text-[#059669]" : isSelected ? "text-[#EF4444]" : "text-[#D1D5DB]"}`}>
                  {["A", "B", "C", "D"][i]}.
                </span>
                {opt}
                {hasAnswered && isCorrect && <CheckCircle className="w-4 h-4 text-[#10B981] inline ml-2" />}
                {hasAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-[#EF4444] inline ml-2" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {showExplanation && current.explanation && (
        <div className="flex gap-2.5 bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] p-4 mb-4">
          <Brain className="w-4 h-4 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[#6D28D9] mb-1">AI Explanation</p>
            <p className="text-sm text-[#7C3AED] leading-relaxed">{current.explanation}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setCurrentIndex(i => i - 1); setShowExplanation(answers[currentIndex - 1] !== null); }}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#6B7280] border border-[#E5E7EB] bg-white rounded-xl hover:bg-[#F9FAFB] disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white rounded-xl disabled:opacity-40 disabled:pointer-events-none transition-all hover:shadow-lg"
          >
            <Trophy className="w-4 h-4" /> Submit Quiz
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!hasAnswered}
            className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-xl disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
