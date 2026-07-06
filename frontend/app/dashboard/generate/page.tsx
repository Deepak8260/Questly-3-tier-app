"use client";
import { useState } from "react";
import { Zap, ChevronRight, Loader2, Brain, AlertCircle } from "lucide-react";
import type { GeneratedQuiz } from "@/lib/quiz";
import QuizTake from "@/app/dashboard/quiz/QuizTake";
import { API_BASE_URL } from "@/lib/api";

const MODES = [
  { id: "standard", label: "Standard", desc: "Classic quiz format" },
  { id: "adaptive", label: "Adaptive", desc: "Adjusts difficulty" },
  { id: "exam", label: "Exam mode", desc: "Timed & strict" },
];

const QUESTION_TYPES = [
  { id: "mcq", label: "Multiple choice" },
  { id: "truefalse", label: "True / false" },
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
      const res = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-7">
        <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Generate a quiz</h1>
        <p className="text-[#5B5A52] dark:text-[#ABA99C] text-sm">Enter any topic and get a personalized quiz in seconds.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] text-[#8C2E24] dark:text-[#D08A7E] text-sm px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-5">

        {/* AI Mode selector */}
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
          <label className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 block">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setForm({ ...form, aiMode: m.id })}
                className={`p-3 border text-left transition-colors ${
                  form.aiMode === m.id
                    ? "border-[#6B2737] bg-[#F3E7E9] dark:bg-[#2E1A20]"
                    : "border-[#DEDCD3] dark:border-[#35352C] hover:border-[#ABA99C]"
                }`}
              >
                <div className={`text-xs font-semibold ${form.aiMode === m.id ? "text-[#6B2737] dark:text-[#B5677A]" : "text-[#3F3E38] dark:text-[#D6D4C9]"}`}>{m.label}</div>
                <div className="text-xs text-[#8C8B82] mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
          <label className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 block">Topic</label>
          <input
            type="text"
            placeholder="e.g. Python for Data Science, World War II, Calculus..."
            value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })}
            required
            className="w-full px-4 py-3 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder-[#8C8B82] focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all"
          />
          {/* Suggestions */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, topic: s })}
                className="text-xs px-2.5 py-1 border border-[#DEDCD3] dark:border-[#35352C] hover:border-[#6B2737] hover:text-[#6B2737] dark:hover:text-[#B5677A] text-[#5B5A52] dark:text-[#ABA99C] transition-colors font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-2 gap-4">

          {/* Difficulty */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
            <label className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 block">Difficulty</label>
            <div className="flex flex-col gap-2">
              {["easy", "medium", "hard"].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm({ ...form, difficulty: d })}
                  className={`px-4 py-2 text-sm font-medium border transition-colors capitalize text-left ${
                    form.difficulty === d
                      ? d === "easy" ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]"
                        : d === "medium" ? "bg-[#F5EEDD] dark:bg-[#2B2110] border-[#93670F] text-[#93670F] dark:text-[#D4A94A]"
                        : "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]"
                      : "border-[#DEDCD3] dark:border-[#35352C] hover:border-[#ABA99C] text-[#5B5A52] dark:text-[#ABA99C]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Questions & Type */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
              <label className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 block">
                Questions <span className="text-[#6B2737] dark:text-[#B5677A]">{form.numQuestions}</span>
              </label>
              <input
                type="range"
                min={5}
                max={20}
                value={form.numQuestions}
                onChange={e => setForm({ ...form, numQuestions: parseInt(e.target.value) })}
                className="w-full accent-[#6B2737]"
              />
              <div className="flex justify-between text-xs text-[#8C8B82] mt-1">
                <span>5</span><span>20</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
              <label className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 block">Question type</label>
              <div className="space-y-1.5">
                {QUESTION_TYPES.map(qt => (
                  <button
                    key={qt.id}
                    type="button"
                    onClick={() => setForm({ ...form, questionType: qt.id })}
                    className={`w-full text-left px-3 py-2 text-sm font-medium border transition-colors ${
                      form.questionType === qt.id
                        ? "border-[#6B2737] bg-[#F3E7E9] dark:bg-[#2E1A20] text-[#6B2737] dark:text-[#B5677A]"
                        : "border-[#DEDCD3] dark:border-[#35352C] hover:border-[#ABA99C] text-[#5B5A52] dark:text-[#ABA99C]"
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
          className="w-full bg-[#6B2737] hover:bg-[#551F2C] disabled:opacity-50 disabled:pointer-events-none text-white font-medium py-4 flex items-center justify-center gap-2.5 transition-colors text-base"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating your quiz...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Generate quiz
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Tip */}
      <div className="mt-6 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] p-4 flex gap-3">
        <Brain className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Tip</p>
          <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] leading-relaxed">
            Be specific with your topic for better questions. Instead of &quot;Python,&quot; try &quot;Python list comprehensions and generators.&quot;
          </p>
        </div>
      </div>
    </div>
  );
}