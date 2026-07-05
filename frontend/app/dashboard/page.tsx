"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap, Trophy, Flame, BarChart3, BookOpen,
  TrendingUp, TrendingDown, ArrowRight, Loader2, FileText
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
  topicWins: { name: string; pct: number }[];
  userName: string;
}

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

      const topicMap: Record<string, number[]> = {};
      all.forEach(a => {
        if (!topicMap[a.topic]) topicMap[a.topic] = [];
        topicMap[a.topic].push(a.score_pct);
      });
      const topicWins = Object.entries(topicMap)
        .map(([name, scores]) => ({
          name, pct: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length),
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
      <div className="flex items-center justify-center py-24 text-[#8C8B82]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your dashboard…
      </div>
    );
  }
  if (!stats) return null;

  const { quizTotal, avgScore, streak, certs, recentAttempts, topicWins, userName } = stats;

  const STATS_CARDS = [
    { icon: BookOpen, value: String(quizTotal), label: "Quizzes taken",   change: quizTotal > 0 ? "All time"  : "Take your first",  up: quizTotal > 0 },
    { icon: BarChart3, value: `${avgScore}%`,   label: "Avg score",        change: avgScore >= 70 ? "Above pass" : "Keep going",         up: avgScore >= 70 },
    { icon: Flame,     value: String(streak),   label: "Day streak",       change: streak > 0 ? `${streak} day${streak!==1?"s":""}` : "Start today", up: streak > 0 },
    { icon: Trophy,    value: String(certs),    label: "Certificates",     change: certs > 0 ? `${certs} earned` : "Score 70%+",       up: certs > 0 },
  ];

  const firstName = userName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ─────────────────────────────────────── */}
      <div className="bg-[#1B1B18] dark:bg-[#0E0E0B] p-7 text-white border border-[#1B1B18] dark:border-[#35352C]">
        <p className="text-[#ABA99C] text-sm font-medium mb-1">{greeting}, {firstName}</p>
        <h2 className="font-heading text-2xl font-medium mb-3">
          {quizTotal === 0
            ? "Start your quiz journey"
            : quizTotal < 5
            ? "You're just getting started — keep going"
            : "Ready to level up your knowledge?"}
        </h2>
        <p className="text-[#ABA99C] text-sm mb-5">
          {quizTotal === 0
            ? "Generate your first quiz and start learning."
            : `You've completed ${quizTotal} quiz${quizTotal!==1?"es":""} with a ${avgScore}% average. ${streak > 0 ? `${streak}-day streak.` : "Take a quiz to start a streak."}`}
        </p>
        <Link
          href="/dashboard/generate"
          className="inline-flex items-center gap-2 bg-white text-[#1B1B18] font-medium text-sm px-5 py-2.5 hover:bg-[#EDECE6] transition-colors"
        >
          <Zap className="w-4 h-4" />
          {quizTotal === 0 ? "Generate first quiz" : "Generate quiz"}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
        {STATS_CARDS.map((s, i) => (
          <div key={i} className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-5">
            <div className="flex items-start justify-between mb-3">
              <s.icon className="w-5 h-5 text-[#6B2737] dark:text-[#B5677A]" />
              <span className={`text-xs font-medium flex items-center gap-0.5 ${s.up ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#8C8B82]"}`}>
                {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {s.change}
              </span>
            </div>
            <div className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">{s.value}</div>
            <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Two-col grid ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent quizzes — REAL DATA */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEDCD3] dark:border-[#35352C]">
            <h3 className="font-heading font-medium text-[#1B1B18] dark:text-[#F2F1EA]">Recent quizzes</h3>
            <Link href="/dashboard/quizzes" className="text-xs text-[#6B2737] dark:text-[#B5677A] font-medium hover:text-[#551F2C] dark:hover:text-[#C77E8F] flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentAttempts.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#8C8B82] text-sm">
              No quizzes yet — <Link href="/dashboard/generate" className="text-[#6B2737] dark:text-[#B5677A] font-medium">take your first quiz</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
              {recentAttempts.map((q) => {
                const relTime = (() => {
                  const d = Math.floor((Date.now() - new Date(q.created_at).getTime()) / 1000);
                  if (d < 3600) return `${Math.floor(d/60)}m ago`;
                  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
                  return `${Math.floor(d/86400)}d ago`;
                })();
                return (
                  <div key={q.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                    <div className="w-10 h-10 bg-[#F3E7E9] dark:bg-[#2E1A20] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{q.topic}</div>
                      <div className="text-xs text-[#8C8B82] capitalize">{q.difficulty} · {relTime}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${q.score_pct >= 70 ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                        {q.score_pct}%
                      </div>
                      <div className="text-xs text-[#8C8B82]">
                        {q.certificate_earned ? "Certified" : q.passed ? "Passed" : "Retry"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Streak card */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-[#93670F] dark:text-[#D4A94A]" />
              <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">Current streak</span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="font-heading text-5xl font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{streak}</span>
              <span className="text-[#5B5A52] dark:text-[#ABA99C] text-sm mb-2">days</span>
            </div>
            <div className="flex gap-1 mb-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className={`flex-1 h-6 ${i < Math.min(streak, 7) ? "bg-[#93670F] dark:bg-[#D4A94A]" : "bg-[#EDECE6] dark:bg-[#262620]"}`} />
              ))}
            </div>
            <p className="text-xs text-[#8C8B82]">
              {streak > 0 ? `${streak} consecutive day${streak!==1?"s":""} of learning` : "Take a quiz today to start your streak"}
            </p>
          </div>

          {/* Top topics — REAL DATA */}
          {topicWins.length > 0 && (
            <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
              <h4 className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-3">Your top topics</h4>
              <div className="space-y-2.5">
                {topicWins.map((t) => (
                  <div key={t.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#3F3E38] dark:text-[#D6D4C9] truncate mr-2">{t.name}</span>
                      <span className="text-[#5B5A52] dark:text-[#ABA99C] font-medium shrink-0">{t.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#EDECE6] dark:bg-[#262620] overflow-hidden">
                      <div className="h-full bg-[#6B2737] dark:bg-[#B5677A]" style={{ width: `${t.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick generate */}
          <div className="bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A]" />
              <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">Quick generate</span>
            </div>
            <p className="text-xs text-[#5B5A52] dark:text-[#ABA99C] mb-4">Start a new quiz on any topic instantly.</p>
            <Link href="/dashboard/generate"
              className="flex items-center justify-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white text-sm font-medium px-4 py-2.5 transition-colors">
              <Zap className="w-3.5 h-3.5"/> New quiz
            </Link>
          </div>
        </div>
      </div>

      {/* Certs prompt if none yet */}
      {certs === 0 && quizTotal > 0 && (
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-6 flex items-center gap-5">
          <div className="w-11 h-11 bg-[#F5EEDD] dark:bg-[#2B2110] flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-[#93670F] dark:text-[#D4A94A]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-0.5">Earn your first certificate</h3>
            <p className="text-xs text-[#8C8B82]">Score 70% or above on any quiz to earn a certificate of achievement.</p>
          </div>
          <Link href="/dashboard/generate"
            className="text-sm font-medium text-[#6B2737] dark:text-[#B5677A] border border-[#DEDCD3] dark:border-[#35352C] px-4 py-2 hover:border-[#ABA99C] transition-colors whitespace-nowrap flex items-center gap-1.5">
            Take quiz <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

    </div>
  );
}