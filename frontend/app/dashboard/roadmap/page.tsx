"use client";
import { useState } from "react";
import { Map, Zap, ChevronDown, ChevronRight, CheckCircle, Circle, Lock, Loader2 } from "lucide-react";

const SAMPLE_ROADMAP = {
  goal: "Learn Python for Data Science",
  weeks: [
    { week: 1, title: "Python Basics", topics: ["Variables & Types", "Control Flow", "Functions"], done: true },
    { week: 2, title: "Data Structures", topics: ["Lists", "Dictionaries", "Sets & Tuples"], done: true },
    { week: 3, title: "NumPy", topics: ["Arrays", "Broadcasting", "Linear Algebra"], done: false, current: true },
    { week: 4, title: "Pandas", topics: ["DataFrames", "Data Cleaning", "Groupby"], done: false },
    { week: 5, title: "Visualization", topics: ["Matplotlib", "Seaborn", "Plotly"], done: false },
    { week: 6, title: "Machine Learning", topics: ["Scikit-learn", "Model Evaluation", "Cross-validation"], done: false },
  ],
};

export default function RoadmapPage() {
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [roadmap, setRoadmap] = useState(SAMPLE_ROADMAP);
  const [expanded, setExpanded] = useState<number[]>([3]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setGenerating(false);
  };

  const doneCount = roadmap.weeks.filter(w => w.done).length;
  const progress = Math.round((doneCount / roadmap.weeks.length) * 100);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111827] mb-1">Study Roadmap</h1>
        <p className="text-sm text-[#6B7280]">AI generates a personalized week-by-week plan for your learning goal.</p>
      </div>

      {/* Generate new roadmap */}
      <form onSubmit={handleGenerate} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 mb-6">
        <label className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest mb-3 block flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#6366F1]" /> Generate New Roadmap
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g. Learn Python for Data Science, Master React.js, Prepare for IELTS..."
            className="flex-1 px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
          />
          <button
            type="submit"
            disabled={generating || !goal.trim()}
            className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </form>

      {/* Current Roadmap */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#F3F4F6]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-[#6366F1] uppercase tracking-wider mb-1">Current Goal</div>
              <h2 className="text-lg font-black text-[#111827]">{roadmap.goal}</h2>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-[#6366F1]">{progress}%</div>
              <div className="text-xs text-[#6B7280]">{doneCount}/{roadmap.weeks.length} weeks</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Weeks */}
        <div className="divide-y divide-[#F9FAFB]">
          {roadmap.weeks.map((week) => {
            const isExpanded = expanded.includes(week.week);
            const toggle = () => setExpanded(prev =>
              prev.includes(week.week) ? prev.filter(w => w !== week.week) : [...prev, week.week]
            );

            return (
              <div key={week.week} className={week.current ? "bg-[#FAFBFF]" : ""}>
                <button
                  type="button"
                  onClick={toggle}
                  className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-[#FAFAFA] transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    week.done ? "bg-[#D1FAE5]" : week.current ? "bg-[#EEF2FF]" : "bg-[#F3F4F6]"
                  }`}>
                    {week.done
                      ? <CheckCircle className="w-5 h-5 text-[#10B981]" />
                      : week.current
                      ? <div className="w-2.5 h-2.5 bg-[#6366F1] rounded-full animate-pulse" />
                      : <Lock className="w-4 h-4 text-[#9CA3AF]" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#9CA3AF]">Week {week.week}</span>
                      {week.current && (
                        <span className="bg-[#EEF2FF] border border-[#C7D2FE] text-[#6366F1] text-xs font-bold px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                      {week.done && (
                        <span className="bg-[#D1FAE5] text-[#065F46] text-xs font-bold px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-[#111827] text-sm">{week.title}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">{week.topics.join(" · ")}</div>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                    : <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />}
                </button>

                {isExpanded && (
                  <div className="px-6 pb-5 pt-1">
                    <div className="ml-[52px] space-y-2">
                      {week.topics.map((topic, ti) => (
                        <div key={ti} className="flex items-center gap-3">
                          {week.done
                            ? <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                            : <Circle className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />}
                          <span className="text-sm text-[#374151]">{topic}</span>
                          {(week.done || week.current) && (
                            <a href="/dashboard/generate" className="ml-auto text-xs text-[#6366F1] hover:text-[#4F46E5] font-medium">
                              Quiz →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
