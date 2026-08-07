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
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Study Roadmap</h1>
        <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">AI generates a personalized week-by-week plan for your learning goal.</p>
      </div>

      {/* Generate new roadmap */}
      <form onSubmit={handleGenerate} className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
        <label className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-3 block flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" /> Generate New Roadmap
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g. Learn Python for Data Science, Master React.js, Prepare for IELTS..."
            className="flex-1 px-4 py-2.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder-[#8C8B82] outline-none"
          />
          <button
            type="submit"
            disabled={generating || !goal.trim()}
            className="bg-[#6B2737] hover:bg-[#551F2C] disabled:opacity-50 text-white font-medium px-5 py-2.5 flex items-center gap-2 text-xs transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </form>

      {/* Current Roadmap */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#DEDCD3] dark:border-[#35352C]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-semibold text-[#6B2737] dark:text-[#B5677A] uppercase tracking-wider mb-1">Current Goal</div>
              <h2 className="font-heading text-xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{roadmap.goal}</h2>
            </div>
            <div className="text-right">
              <div className="font-heading text-2xl font-medium text-[#6B2737] dark:text-[#B5677A]">{progress}%</div>
              <div className="text-xs text-[#8C8B82]">{doneCount}/{roadmap.weeks.length} weeks</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
            <div
              className="h-full bg-[#6B2737] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Weeks */}
        <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
          {roadmap.weeks.map((week) => {
            const isExpanded = expanded.includes(week.week);
            const toggle = () => setExpanded(prev =>
              prev.includes(week.week) ? prev.filter(w => w !== week.week) : [...prev, week.week]
            );

            return (
              <div key={week.week} className={week.current ? "bg-[#FAFAF8] dark:bg-[#14140F]" : ""}>
                <button
                  type="button"
                  onClick={toggle}
                  className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {week.done
                      ? <CheckCircle className="w-5 h-5 text-[#2F6B3A] dark:text-[#7EBA88]" />
                      : week.current
                      ? <div className="w-3 h-3 bg-[#6B2737] dark:bg-[#B5677A] animate-pulse" />
                      : <Lock className="w-4 h-4 text-[#8C8B82]" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#8C8B82]">Week {week.week}</span>
                      {week.current && (
                        <span className="bg-[#F3E7E9] dark:bg-[#2E1A20] border border-[#6B2737] text-[#6B2737] dark:text-[#B5677A] text-[10px] font-semibold px-2 py-0.5">
                          Current
                        </span>
                      )}
                      {week.done && (
                        <span className="bg-[#E9F1E9] dark:bg-[#1A2A1D] border border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88] text-[10px] font-semibold px-2 py-0.5">
                          Done
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-[#1B1B18] dark:text-[#F2F1EA] text-sm">{week.title}</div>
                    <div className="text-xs text-[#8C8B82] mt-0.5">{week.topics.join(" · ")}</div>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-[#8C8B82]" />
                    : <ChevronRight className="w-4 h-4 text-[#8C8B82]" />}
                </button>

                {isExpanded && (
                  <div className="px-6 pb-5 pt-1 border-t border-[#EAE8E1] dark:border-[#262620] bg-[#FAFAF8] dark:bg-[#14140F]">
                    <div className="ml-[48px] space-y-2">
                      {week.topics.map((topic, ti) => (
                        <div key={ti} className="flex items-center gap-3">
                          {week.done
                            ? <CheckCircle className="w-4 h-4 text-[#2F6B3A] dark:text-[#7EBA88] flex-shrink-0" />
                            : <Circle className="w-4 h-4 text-[#8C8B82] flex-shrink-0" />}
                          <span className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">{topic}</span>
                          {(week.done || week.current) && (
                            <a href="/dashboard/generate" className="ml-auto text-xs text-[#6B2737] dark:text-[#B5677A] hover:underline font-medium">
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
