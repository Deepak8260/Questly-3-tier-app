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
function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5 flex items-start gap-4">
      <div className="w-10 h-10 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] flex items-center justify-center flex-shrink-0 text-[#6B2737] dark:text-[#B5677A]">
        {icon}
      </div>
      <div>
        <div className="text-xs text-[#8C8B82] font-medium mb-0.5">{label}</div>
        <div className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{value}</div>
        {sub && <div className="text-xs text-[#5B5A52] dark:text-[#ABA99C] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Mini bar chart (CSS-based, no library) ─────────────────────────
function ScoreBar({ score, max = 100, color }: { score: number; max?: number; color: string }) {
  return (
    <div className="h-2 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
      <div
        className="h-full transition-all duration-700"
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

  // Topic breakdown
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

  // Recent 10 attempts
  const recent = [...attempts].reverse().slice(0, 10).reverse();

  // Score trend
  const scoreArr = attempts.map(a => a.score_pct);
  const half = Math.floor(scoreArr.length / 2);
  const recentHalf = scoreArr.slice(half).reduce((a, b) => a + b, 0) / (scoreArr.length - half || 1);
  const prevHalf   = scoreArr.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
  const trending   = total >= 2 ? recentHalf - prevHalf : 0;

  return (
    <div className="space-y-6">

      {/* Header info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">
          Your learning performance across all quizzes
        </p>
        <button onClick={load} title="Refresh"
          className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#8C2E24] p-5 text-sm text-[#8C2E24]">
          <p className="font-semibold mb-1">Could not load analytics</p>
          <p className="font-mono text-xs">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && total === 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-16 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2">No data yet</h3>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] mb-6">
            Take your first quiz and your analytics will appear here.
          </p>
          <Link href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white text-xs font-medium px-5 py-2.5 transition-colors">
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
              sub={`${passed} passed`} />
            <StatCard icon={<Target className="w-5 h-5" />}
              label="Average Score" value={`${avgScore}%`}
              sub={trending > 0 ? `▲ ${trending.toFixed(0)}% trending up` : trending < 0 ? `▼ ${Math.abs(trending).toFixed(0)}% trending down` : "Stable"} />
            <StatCard icon={<Trophy className="w-5 h-5" />}
              label="Pass Rate" value={`${passRate}%`}
              sub={`${certs} certificate${certs !== 1 ? "s" : ""} earned`} />
            <StatCard icon={<Clock className="w-5 h-5" />}
              label="Avg Time" value={fmtTime(avgTime)}
              sub="per quiz" />
          </div>

          {/* ── Score timeline ── */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
            <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-5 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" /> Score Timeline (last {recent.length} quizzes)
            </h2>
            {/* Bar chart */}
            <div className="flex items-end gap-2 h-36">
              {recent.map((a) => {
                const h = `${Math.max(8, a.score_pct)}%`;
                const col = a.passed ? "#6B2737" : "#93670F";
                return (
                  <div key={a.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1B1B18] text-white text-[10px] px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {a.topic} — {a.score_pct}%
                    </div>
                    <div
                      className="w-full transition-all duration-500"
                      style={{ height: h, backgroundColor: col }}
                    />
                    <div className="text-[9px] text-[#8C8B82] text-center truncate w-full">
                      {fmtDate(a.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-[#8C8B82]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#6B2737] inline-block" /> Passed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#93670F] inline-block" /> Failed
              </span>
            </div>
          </div>

          {/* ── Topic breakdown + Difficulty side-by-side ── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* Topic breakdown */}
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
              <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-5 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" /> Performance by Topic
              </h2>
              <div className="space-y-4">
                {topicStats.slice(0, 8).map(t => (
                  <div key={t.topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate max-w-[60%]">
                        {t.topic}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#8C8B82]">{t.attempts} attempt{t.attempts !== 1 ? "s" : ""}</span>
                        <span className={`font-semibold ${t.best >= 70 ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                          Best: {t.best}%
                        </span>
                        {t.passed && (
                          <span title="Passed"><Award className="w-3.5 h-3.5 text-[#93670F] dark:text-[#D4A94A]" /></span>
                        )}
                      </div>
                    </div>
                    <ScoreBar
                      score={t.best}
                      color={t.best >= 70 ? "#2F6B3A" : "#93670F"}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">

              {/* Difficulty breakdown */}
              <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
                <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" /> By Difficulty
                </h2>
                <div className="space-y-4">
                  {diffStats.map(({ d, count, avg }) => (
                    <div key={d}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize text-[#1B1B18] dark:text-[#F2F1EA]">{d}</span>
                        <span className="text-xs text-[#8C8B82]">{count} quiz{count !== 1 ? "zes" : ""} · Avg {avg}%</span>
                      </div>
                      <ScoreBar score={avg} color="#6B2737" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlights */}
              <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
                <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" /> Highlights
                </h2>
                <div className="space-y-3">
                  {[
                    { label: "Best score ever",    value: `${bestScore}%`,  icon: "🏆" },
                    { label: "Lowest score",       value: `${worstScore}%`, icon: "📉" },
                    { label: "Certificates earned",value: certs,            icon: "🎓" },
                    { label: "Unique topics",      value: topicStats.length, icon: "📚" },
                  ].map(h => (
                    <div key={h.label} className="flex items-center justify-between py-2 border-b border-[#EAE8E1] dark:border-[#262620] last:border-b-0">
                      <span className="text-sm text-[#5B5A52] dark:text-[#ABA99C] flex items-center gap-2">
                        <span>{h.icon}</span> {h.label}
                      </span>
                      <span className="text-sm font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">{h.value}</span>
                    </div>
                  ))}

                  {/* Trend */}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-[#5B5A52] dark:text-[#ABA99C] flex items-center gap-2">
                      {trending >= 0
                        ? <TrendingUp className="w-4 h-4 text-[#2F6B3A] dark:text-[#7EBA88]" />
                        : <TrendingDown className="w-4 h-4 text-[#8C2E24] dark:text-[#D08A7E]" />}
                      Score trend
                    </span>
                    <span className={`text-sm font-semibold ${trending >= 0 ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#8C2E24] dark:text-[#D08A7E]"}`}>
                      {trending >= 0 ? "+" : ""}{trending.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Recent attempts table ── */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DEDCD3] dark:border-[#35352C]">
              <h2 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest">
                Recent Attempts
              </h2>
              <Link href="/dashboard/quizzes"
                className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:underline font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
              {[...attempts].reverse().slice(0, 6).map(a => (
                <div key={a.id} className="flex items-center px-5 py-3 gap-4 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{a.topic}</div>
                    <div className="text-xs text-[#8C8B82] mt-0.5">
                      {fmtDate(a.created_at)} · {a.correct_answers}/{a.total_questions} correct
                    </div>
                  </div>
                  <div className="hidden sm:block w-32">
                    <ScoreBar score={a.score_pct} color={a.passed ? "#2F6B3A" : "#93670F"} />
                  </div>
                  <div className={`w-14 text-right text-sm font-semibold ${a.passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                    {a.score_pct}%
                  </div>
                  <div className="w-16 text-right text-xs text-[#8C8B82]">{fmtTime(a.time_taken_secs)}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
