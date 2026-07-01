"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap, Trophy, Flame, BarChart3, BookOpen,
  TrendingUp, TrendingDown, ArrowRight, Star, Loader2, RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Attempt {
  id: string; topic: string; difficulty: string;
  score_pct: number; passed: boolean; certificate_earned: boolean;
  created_at: string; correct_answers: number; total_questions: number;
}

interface Stats {
  quizTotal: number; avgScore: number; streak: number;
  certs: number; recentAttempts: Attempt[];
  topicWins: { name: string; pct: number; color: string }[];
  userName: string;
}

const TOPIC_COLORS = ["#6366F1","#8B5CF6","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"];
const DIFF_EMOJI: Record<string,string> = { easy:"🟢", medium:"🟡", hard:"🔴" };

function calcStreak(attempts: Attempt[]): number {
  if (!attempts.length) return 0;
  const days = new Set(attempts.map(a => new Date(a.created_at).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] || "Learner";

      const { data: attempts } = await supabase
        .from("questly_quiz_attempts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const all = attempts ?? [];
      const avgScore = all.length
        ? Math.round(all.reduce((s, a) => s + a.score_pct, 0) / all.length) : 0;
      const certs  = all.filter(a => a.certificate_earned).length;
      const streak = calcStreak(all);

      // Top topics by highest avg score (min 1 attempt)
      const topicMap: Record<string, number[]> = {};
      all.forEach(a => {
        if (!topicMap[a.topic]) topicMap[a.topic] = [];
        topicMap[a.topic].push(a.score_pct);
      });
      const topicWins = Object.entries(topicMap)
        .map(([name, scores]) => ({
          name, pct: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length),
          color: TOPIC_COLORS[Object.keys(topicMap).indexOf(name) % TOPIC_COLORS.length],
        }))
        .sort((a,b) => b.pct - a.pct)
        .slice(0, 4);

      setStats({
        quizTotal: all.length, avgScore, streak, certs,
        recentAttempts: all.slice(0, 4),
        topicWins,
        userName: name,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#9CA3AF]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your dashboard…
      </div>
    );
  }
  if (!stats) return null;

  const { quizTotal, avgScore, streak, certs, recentAttempts, topicWins, userName } = stats;

  const STATS_CARDS = [
    { icon: BookOpen, color: "#6366F1", value: String(quizTotal), label: "Quizzes Taken",   change: quizTotal > 0 ? "+all time"  : "Take your first!",  up: quizTotal > 0 },
    { icon: BarChart3, color: "#10B981", value: `${avgScore}%`,   label: "Avg Score",        change: avgScore >= 70 ? "Above pass!" : "Keep going!",         up: avgScore >= 70 },
    { icon: Flame,     color: "#F59E0B", value: String(streak),   label: "Day Streak",       change: streak > 0 ? `${streak} day${streak!==1?"s":""} 🔥` : "Start today!", up: streak > 0 },
    { icon: Trophy,    color: "#8B5CF6", value: String(certs),    label: "Certificates",     change: certs > 0 ? `${certs} earned 🎓` : "Score ≥ 70%",       up: certs > 0 },
  ];

  const firstName = userName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-7 animate-fade-in-up">

      {/* ── Welcome Banner ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-2xl p-7 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <circle cx="160" cy="60" r="80" fill="white"/>
            <circle cx="40" cy="150" r="50" fill="white"/>
          </svg>
        </div>
        <div className="relative">
          <p className="text-indigo-200 text-sm font-medium mb-1">{greeting}, {firstName} 👋</p>
          <h2 className="text-2xl font-black mb-3">
            {quizTotal === 0
              ? "Start your AI quiz journey!"
              : quizTotal < 5
              ? "You're just getting started — keep going!"
              : "Ready to level up your knowledge?"}
          </h2>
          <p className="text-indigo-200 text-sm mb-5">
            {quizTotal === 0
              ? "Generate your first quiz and start learning."
              : `You've completed ${quizTotal} quiz${quizTotal!==1?"es":""} with a ${avgScore}% average. ${streak > 0 ? `${streak}-day streak! 🔥` : "Take a quiz to start a streak!"}`}
          </p>
          <Link
            href="/dashboard/generate"
            className="inline-flex items-center gap-2 bg-white text-[#6366F1] font-bold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            <Zap className="w-4 h-4" />
            {quizTotal === 0 ? "Generate First Quiz" : "Generate Quiz"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS_CARDS.map((s, i) => (
          <div key={i} className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + "15" }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <span className={`text-xs font-bold flex items-center gap-0.5 ${s.up ? "text-[#10B981]" : "text-[#6B7280]"}`}>
                {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {s.change}
              </span>
            </div>
            <div className="text-3xl font-black text-[#111827] dark:text-[#f8fafc] mb-1">{s.value}</div>
            <div className="text-xs font-medium text-[#6B7280] dark:text-[#94a3b8]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Two-col grid ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent quizzes — REAL DATA */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] dark:border-[#334155]">
            <h3 className="font-bold text-[#111827] dark:text-[#f8fafc]">Recent Quizzes</h3>
            <Link href="/dashboard/quizzes" className="text-xs text-[#6366F1] font-semibold hover:text-[#4F46E5] flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentAttempts.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#9CA3AF] text-sm">
              No quizzes yet — <Link href="/dashboard/generate" className="text-[#6366F1] font-semibold">take your first quiz!</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F9FAFB] dark:divide-[#334155]">
              {recentAttempts.map((q) => {
                const relTime = (() => {
                  const d = Math.floor((Date.now() - new Date(q.created_at).getTime()) / 1000);
                  if (d < 3600) return `${Math.floor(d/60)}m ago`;
                  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
                  return `${Math.floor(d/86400)}d ago`;
                })();
                return (
                  <div key={q.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#FAFAFA] dark:hover:bg-[#334155]/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#1e1b4b] flex items-center justify-center text-lg flex-shrink-0">
                      {DIFF_EMOJI[q.difficulty?.toLowerCase()] ?? "📝"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc] truncate">{q.topic}</div>
                      <div className="text-xs text-[#9CA3AF] capitalize">{q.difficulty} · {relTime}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${q.score_pct >= 70 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                        {q.score_pct}%
                      </div>
                      <div className="text-xs text-[#9CA3AF]">
                        {q.certificate_earned ? "🏆 Cert" : q.passed ? "✓ Passed" : "Retry →"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Streak card */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm font-bold text-[#111827] dark:text-[#f8fafc]">Current Streak</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-5xl font-black text-[#F59E0B]">{streak}</span>
              <span className="text-[#6B7280] dark:text-[#94a3b8] text-sm mb-2">days 🔥</span>
            </div>
            <div className="flex gap-1 mb-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className={`flex-1 h-6 rounded-md ${i < Math.min(streak, 7) ? "bg-[#F59E0B]" : "bg-[#F3F4F6] dark:bg-[#334155]"}`} />
              ))}
            </div>
            <p className="text-xs text-[#9CA3AF]">
              {streak > 0 ? `${streak} consecutive day${streak!==1?"s":""} of learning` : "Take a quiz today to start your streak!"}
            </p>
          </div>

          {/* Top topics — REAL DATA */}
          {topicWins.length > 0 && (
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] shadow-sm p-5">
              <h4 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc] mb-3">Your Top Topics</h4>
              <div className="space-y-2.5">
                {topicWins.map((t) => (
                  <div key={t.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#374151] dark:text-[#94a3b8] truncate mr-2">{t.name}</span>
                      <span className="text-[#6B7280] dark:text-[#94a3b8] font-semibold shrink-0">{t.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F3F4F6] dark:bg-[#334155] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${t.pct}%`, backgroundColor: t.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick generate */}
          <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F5F3FF] dark:from-[#1e1b4b] dark:to-[#0f0f23] rounded-2xl border border-[#E0E7FF] dark:border-[#3730a3] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#6366F1]" />
              <span className="text-sm font-bold text-[#4338CA] dark:text-[#818cf8]">Quick Generate</span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#94a3b8] mb-4">Start a new quiz on any topic instantly.</p>
            <Link href="/dashboard/generate"
              className="flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:shadow-md">
              <Zap className="w-3.5 h-3.5"/> New Quiz
            </Link>
          </div>
        </div>
      </div>

      {/* Certs prompt if none yet */}
      {certs === 0 && quizTotal > 0 && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] p-6 flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] flex items-center justify-center text-2xl flex-shrink-0">🏆</div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc] mb-0.5">Earn your first certificate!</h3>
            <p className="text-xs text-[#9CA3AF]">Score 70% or above on any quiz to earn a certificate of achievement.</p>
          </div>
          <Link href="/dashboard/generate"
            className="text-sm font-semibold text-[#6366F1] bg-[#EEF2FF] dark:bg-[#1e1b4b] px-4 py-2 rounded-xl hover:bg-[#E0E7FF] dark:hover:bg-[#312e81] transition-colors whitespace-nowrap">
            Take Quiz →
          </Link>
        </div>
      )}

    </div>
  );
}
