"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Trophy, Target, Clock,
  Zap, BarChart2, BookOpen, Award, Loader2, RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Attempt {
  id: string;
  topic: string;
  difficulty: string;
  score_pct: number;
  correct_answers: number;
  total_questions: number;
  time_taken_secs: number;
  passed: boolean;
  certificate_earned: boolean;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────
function fmtTime(secs: number) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DIFF_COLOR: Record<string, string> = {
  easy:   "#10B981",
  medium: "#6366F1",
  hard:   "#EF4444",
};

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-xs text-[#9CA3AF] font-medium mb-0.5">{label}</div>
        <div className="text-2xl font-black text-[#111827] dark:text-[#f8fafc]">{value}</div>
        {sub && <div className="text-xs text-[#6B7280] dark:text-[#94a3b8] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Mini bar chart (CSS-based, no library) ─────────────────────────
function ScoreBar({ score, max = 100, color }: { score: number; max?: number; color: string }) {
  return (
    <div className="h-2 bg-[#F3F4F6] dark:bg-[#334155] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${(score / max) * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error: dbErr } = await supabase
      .from("questly_quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (dbErr) setError(dbErr.message);
    else setAttempts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Derived stats ────────────────────────────────────────────────
  const total   = attempts.length;
  const passed  = attempts.filter(a => a.passed).length;
  const certs   = attempts.filter(a => a.certificate_earned).length;
  const avgScore = total
    ? Math.round(attempts.reduce((s, a) => s + a.score_pct, 0) / total)
    : 0;
  const avgTime = total
    ? Math.round(attempts.reduce((s, a) => s + (a.time_taken_secs ?? 0), 0) / total)
    : 0;
  const passRate = total ? Math.round((passed / total) * 100) : 0;
  const bestScore  = total ? Math.max(...attempts.map(a => a.score_pct)) : 0;
  const worstScore = total ? Math.min(...attempts.map(a => a.score_pct)) : 0;

  // Topic breakdown (unique topics, best score per topic)
  const topicMap: Record<string, { scores: number[]; passed: boolean }> = {};
  attempts.forEach(a => {
    const t = a.topic;
    if (!topicMap[t]) topicMap[t] = { scores: [], passed: false };
    topicMap[t].scores.push(a.score_pct);
    if (a.passed) topicMap[t].passed = true;
  });
  const topicStats = Object.entries(topicMap)
    .map(([topic, { scores, passed }]) => ({
      topic,
      attempts: scores.length,
      best: Math.max(...scores),
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      passed,
    }))
    .sort((a, b) => b.best - a.best);

  // Difficulty breakdown
  const diffMap: Record<string, { count: number; totalScore: number }> = {};
  attempts.forEach(a => {
    const d = (a.difficulty ?? "unknown").toLowerCase();
    if (!diffMap[d]) diffMap[d] = { count: 0, totalScore: 0 };
    diffMap[d].count++;
    diffMap[d].totalScore += a.score_pct;
  });
  const diffStats = Object.entries(diffMap).map(([d, { count, totalScore }]) => ({
    d, count, avg: Math.round(totalScore / count),
  }));

  // Recent 10 attempts for score timeline
  const recent = [...attempts].reverse().slice(0, 10).reverse();

  // Score trend (compare last 5 vs previous 5)
  const scoreArr = attempts.map(a => a.score_pct);
  const half = Math.floor(scoreArr.length / 2);
  const recentHalf = scoreArr.slice(half).reduce((a, b) => a + b, 0) / (scoreArr.length - half || 1);
  const prevHalf   = scoreArr.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
  const trending   = total >= 2 ? recentHalf - prevHalf : 0;

  return (
    <div className="animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#111827] dark:text-[#f8fafc] mb-1">Analytics</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#94a3b8]">
            Your learning performance across all quizzes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh"
            className="p-2 rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#1e293b] text-[#6B7280] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/dashboard/generate"
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] px-4 py-2 rounded-xl transition-all hover:shadow-md">
            <Zap className="w-3.5 h-3.5" /> New Quiz
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-[#9CA3AF]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-[#FEF2F2] dark:bg-[#1c0809] rounded-2xl border border-[#FECACA] dark:border-[#7f1d1d] p-5 text-sm text-[#DC2626]">
          <p className="font-bold mb-1">Could not load analytics</p>
          <p className="font-mono text-xs">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && total === 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#f8fafc] mb-2">No data yet</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#94a3b8] mb-6">
            Take your first quiz and your analytics will appear here.
          </p>
          <Link href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-6 py-3 rounded-xl text-sm">
            <Zap className="w-4 h-4" /> Generate a Quiz
          </Link>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="space-y-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<BarChart2 className="w-5 h-5" />}
              label="Total Quizzes" value={total}
              sub={`${passed} passed`} color="#6366F1" />
            <StatCard icon={<Target className="w-5 h-5" />}
              label="Average Score" value={`${avgScore}%`}
              sub={trending > 0 ? `▲ ${trending.toFixed(0)}% trending up` : trending < 0 ? `▼ ${Math.abs(trending).toFixed(0)}% trending down` : "Stable"}
              color={trending >= 0 ? "#10B981" : "#EF4444"} />
            <StatCard icon={<Trophy className="w-5 h-5" />}
              label="Pass Rate" value={`${passRate}%`}
              sub={`${certs} certificate${certs !== 1 ? "s" : ""} earned`} color="#F59E0B" />
            <StatCard icon={<Clock className="w-5 h-5" />}
              label="Avg Time" value={fmtTime(avgTime)}
              sub="per quiz" color="#8B5CF6" />
          </div>

          {/* ── Score timeline ── */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5">
            <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-5 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Score Timeline (last {recent.length} quizzes)
            </h2>
            {/* Bar chart */}
            <div className="flex items-end gap-2 h-36">
              {recent.map((a, i) => {
                const h = `${Math.max(8, a.score_pct)}%`;
                const col = a.passed ? "#6366F1" : "#F59E0B";
                return (
                  <div key={a.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1F2937] text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {a.topic} — {a.score_pct}%
                    </div>
                    <div
                      className="w-full rounded-t-lg transition-all duration-500"
                      style={{ height: h, backgroundColor: col, opacity: 0.85 }}
                    />
                    <div className="text-[9px] text-[#9CA3AF] text-center truncate w-full">
                      {fmtDate(a.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-[#9CA3AF]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#6366F1] inline-block" /> Passed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#F59E0B] inline-block" /> Failed
              </span>
            </div>
          </div>

          {/* ── Topic breakdown + Difficulty side-by-side ── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Topic breakdown */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5">
              <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-5 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" /> Performance by Topic
              </h2>
              <div className="space-y-4">
                {topicStats.slice(0, 8).map(t => (
                  <div key={t.topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc] truncate max-w-[60%]">
                        {t.topic}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#9CA3AF]">{t.attempts} attempt{t.attempts !== 1 ? "s" : ""}</span>
                        <span className={`font-black ${t.best >= 70 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                          Best: {t.best}%
                        </span>
                        {t.passed && (
                          <span title="Passed"><Award className="w-3 h-3 text-[#F59E0B]" /></span>
                        )}
                      </div>
                    </div>
                    <ScoreBar
                      score={t.best}
                      color={t.best >= 70 ? "#10B981" : "#F59E0B"}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">

              {/* Difficulty breakdown */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5">
                <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> By Difficulty
                </h2>
                <div className="space-y-4">
                  {diffStats.map(({ d, count, avg }) => (
                    <div key={d}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold capitalize text-[#111827] dark:text-[#f8fafc]">{d}</span>
                        <span className="text-xs text-[#9CA3AF]">{count} quiz{count !== 1 ? "zes" : ""} · Avg {avg}%</span>
                      </div>
                      <ScoreBar score={avg} color={DIFF_COLOR[d] ?? "#6366F1"} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlights */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5">
                <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> Highlights
                </h2>
                <div className="space-y-3">
                  {[
                    { label: "Best score ever",    value: `${bestScore}%`,  icon: "🏆", color: "#10B981" },
                    { label: "Lowest score",       value: `${worstScore}%`, icon: "📉", color: "#F59E0B" },
                    { label: "Certificates earned",value: certs,            icon: "🎓", color: "#8B5CF6" },
                    { label: "Unique topics",      value: topicStats.length, icon: "📚", color: "#6366F1" },
                  ].map(h => (
                    <div key={h.label} className="flex items-center justify-between py-2 border-b border-[#F9FAFB] dark:border-[#334155] last:border-b-0">
                      <span className="text-sm text-[#6B7280] dark:text-[#94a3b8] flex items-center gap-2">
                        <span>{h.icon}</span> {h.label}
                      </span>
                      <span className="text-sm font-black" style={{ color: h.color }}>{h.value}</span>
                    </div>
                  ))}

                  {/* Trend */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-[#6B7280] dark:text-[#94a3b8] flex items-center gap-2">
                      {trending >= 0
                        ? <TrendingUp className="w-4 h-4 text-[#10B981]" />
                        : <TrendingDown className="w-4 h-4 text-[#EF4444]" />}
                      Score trend
                    </span>
                    <span className={`text-sm font-black ${trending >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                      {trending >= 0 ? "+" : ""}{trending.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Recent attempts table ── */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6] dark:border-[#334155]">
              <h2 className="text-sm font-black text-[#9CA3AF] uppercase tracking-widest">
                Recent Attempts
              </h2>
              <Link href="/dashboard/quizzes"
                className="text-xs text-[#6366F1] hover:text-[#4F46E5] font-semibold">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-[#F9FAFB] dark:divide-[#334155]">
              {[...attempts].reverse().slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center px-5 py-3 gap-4 hover:bg-[#FAFAFA] dark:hover:bg-[#263348] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc] truncate">{a.topic}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      {fmtDate(a.created_at)} · {a.correct_answers}/{a.total_questions} correct
                    </div>
                  </div>
                  <div className="hidden sm:block w-32">
                    <ScoreBar score={a.score_pct} color={a.passed ? "#6366F1" : "#F59E0B"} />
                  </div>
                  <div className={`w-14 text-right text-sm font-black ${a.passed ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                    {a.score_pct}%
                  </div>
                  <div className="w-16 text-right text-xs text-[#9CA3AF]">{fmtTime(a.time_taken_secs)}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
