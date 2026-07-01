"use client";
import { useState } from "react";
import { Zap, ChevronRight, Loader2, Brain, AlertCircle } from "lucide-react";
import type { GeneratedQuiz } from "@/app/api/quiz/generate/route";
import QuizTake from "@/app/dashboard/quiz/QuizTake";

const MODES = [
  { id: "standard", label: "Standard", desc: "Classic quiz format", icon: "📝" },
  { id: "adaptive", label: "Adaptive", desc: "AI adjusts difficulty", icon: "🎯" },
  { id: "exam", label: "Exam Mode", desc: "Timed & strict", icon: "⏱️" },
];

const QUESTION_TYPES = [
  { id: "mcq", label: "Multiple Choice" },
  { id: "truefalse", label: "True / False" },
  { id: "mixed", label: "Mixed" },
];

const SUGGESTIONS = [
  "Python Basics", "Machine Learning", "SQL", "Linear Algebra", "World History", "React.js",
  "Data Structures", "Calculus", "Biology", "JavaScript ES6",
];

export default function GenerateQuizPage() {
  const [form, setForm] = useState({
    topic: "",
    difficulty: "medium",
    numQuestions: 10,
    questionType: "mcq",
    aiMode: "standard",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to generate quiz. Please try again.");
        setLoading(false);
        return;
      }

      setQuiz(data.quiz);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show quiz once generated
  if (quiz) {
    return (
      <QuizTake
        quiz={quiz}
        onRetry={() => setQuiz(null)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111827] mb-1">Generate a Quiz</h1>
        <p className="text-[#6B7280] text-sm">Enter any topic and let our AI create your personalized quiz in seconds.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm px-4 py-3 rounded-xl mb-5">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-5">

        {/* AI Mode selector */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
          <label className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-3 block">AI Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm({ ...form, aiMode: m.id })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  form.aiMode === m.id
                    ? "border-[#6366F1] bg-[#EEF2FF]"
                    : "border-[#E5E7EB] hover:border-[#D1D5DB]"
                }`}
              >
                <div className="text-xl mb-1">{m.icon}</div>
                <div className={`text-xs font-bold ${form.aiMode === m.id ? "text-[#6366F1]" : "text-[#374151]"}`}>{m.label}</div>
                <div className="text-xs text-[#9CA3AF] mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
          <label className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-3 block">Topic</label>
          <input
            type="text"
            placeholder="e.g. Python for Data Science, World War II, Calculus..."
            value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })}
            required
            className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
          />
          {/* Suggestions */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, topic: s })}
                className="text-xs px-2.5 py-1 bg-[#F3F4F6] hover:bg-[#EEF2FF] hover:text-[#6366F1] text-[#6B7280] rounded-full transition-colors font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* Difficulty */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
            <label className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-3 block">Difficulty</label>
            <div className="flex flex-col gap-2">
              {["easy", "medium", "hard"].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: d })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all capitalize ${
                    form.difficulty === d
                      ? d === "easy" ? "bg-[#D1FAE5] border-[#6EE7B7] text-[#065F46]"
                        : d === "medium" ? "bg-[#FEF3C7] border-[#FCD34D] text-[#92400E]"
                        : "bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]"
                      : "border-[#F3F4F6] hover:border-[#E5E7EB] text-[#6B7280]"
                  }`}
                >
                  {d === "easy" ? "🟢" : d === "medium" ? "🟡" : "🔴"} {d}
                </button>
              ))}
            </div>
          </div>

          {/* Questions & Type */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
              <label className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-3 block">
                Questions <span className="text-[#6366F1]">{form.numQuestions}</span>
              </label>
              <input
                type="range"
                min={5}
                max={20}
                value={form.numQuestions}
                onChange={e => setForm({ ...form, numQuestions: parseInt(e.target.value) })}
                className="w-full accent-[#6366F1]"
              />
              <div className="flex justify-between text-xs text-[#9CA3AF] mt-1">
                <span>5</span><span>20</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
              <label className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-3 block">Question Type</label>
              <div className="space-y-1.5">
                {QUESTION_TYPES.map(qt => (
                  <button
                    key={qt.id}
                    type="button"
                    onClick={() => setForm({ ...form, questionType: qt.id })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      form.questionType === qt.id
                        ? "border-[#6366F1] bg-[#EEF2FF] text-[#6366F1]"
                        : "border-[#F3F4F6] hover:border-[#E5E7EB] text-[#6B7280]"
                    }`}
                  >
                    {qt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <button
          type="submit"
          disabled={loading || !form.topic.trim()}
          className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 disabled:pointer-events-none text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(99,102,241,0.35)] text-base"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating your quiz with AI...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Generate Quiz
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* AI tip */}
      <div className="mt-6 bg-[#F5F3FF] rounded-2xl border border-[#DDD6FE] p-4 flex gap-3">
        <Brain className="w-4 h-4 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#6D28D9] mb-1">AI tip</p>
          <p className="text-xs text-[#7C3AED] leading-relaxed">
            Be specific with your topic for better questions. Instead of &quot;Python,&quot; try &quot;Python list comprehensions and generators.&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
