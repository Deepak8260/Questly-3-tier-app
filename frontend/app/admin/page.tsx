"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, BookOpen, Trophy, Activity, TrendingUp,
  TrendingDown, Loader2, RefreshCw, Clock, Target
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Stats {
  totalUsers: number;
  totalAttempts: number;
  totalCerts: number;
  avgScore: number;
  passRate: number;
  topicsCount: number;
  todayAttempts: number;
  thisWeekAttempts: number;
}

interface RecentAttempt {
  id: string;
  topic: string;
  score_pct: number;
  passed: boolean;
  certificate_earned: boolean;
  created_at: string;
  difficulty: string;
  user_id: string;
}

function StatCard({ icon, label, value, sub, trend }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[#6B2737] dark:text-[#B5677A]">
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend === "up" ? "text-[#2F6B3A] dark:text-[#7EBA88]" : trend === "down" ? "text-[#8C2E24] dark:text-[#D08A7E]" : "text-[#8C8B82]"}`}>
            {trend === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : trend === "down" ? <TrendingDown className="w-3.5 h-3.5" /> : null}
          </span>
        )}
      </div>
      <div className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">{value}</div>
      <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">{label}</div>
      {sub && <div className="text-xs text-[#8C8B82] mt-0.5">{sub}</div>}
    </div>
  );
}

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminOverview() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [recent,  setRecent]  = useState<RecentAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7 * 86400_000);

    const [attemptsRes, profilesRes, recentRes] = await Promise.all([
      supabase.from("questly_quiz_attempts").select("score_pct, passed, certificate_earned, created_at, topic"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("questly_quiz_attempts").select("*").order("created_at", { ascending: false }).limit(8),
    ]);

    const all = attemptsRes.data ?? [];
    const totalAttempts = all.length;
    const totalCerts = all.filter(a => a.certificate_earned).length;
    const passed = all.filter(a => a.passed).length;
    const avgScore = totalAttempts ? Math.round(all.reduce((s, a) => s + a.score_pct, 0) / totalAttempts) : 0;
    const topicsCount = new Set(all.map(a => a.topic)).size;
    const todayAttempts = all.filter(a => new Date(a.created_at) >= today).length;
    const weekAttempts = all.filter(a => new Date(a.created_at) >= weekAgo).length;

    setStats({
      totalUsers: profilesRes.count ?? 0,
      totalAttempts,
      totalCerts,
      avgScore,
      passRate: totalAttempts ? Math.round((passed / totalAttempts) * 100) : 0,
      topicsCount,
      todayAttempts,
      thisWeekAttempts: weekAttempts,
    });
    setRecent(recentRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const CARDS = stats ? [
    { icon: <Users className="w-5 h-5" />,    label: "Total Users",         value: stats.totalUsers,       trend: "up" as const,      sub: "Registered accounts" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Total Quizzes Taken", value: stats.totalAttempts,    trend: "up" as const,      sub: "All time" },
    { icon: <Trophy className="w-5 h-5" />,   label: "Certificates Issued",  value: stats.totalCerts,       trend: "neutral" as const, sub: "Score ≥ 70%" },
    { icon: <Target className="w-5 h-5" />,   label: "Avg Score",            value: `${stats.avgScore}%`,   trend: stats.avgScore >= 70 ? "up" as const : "down" as const, sub: `${stats.passRate}% pass rate` },
    { icon: <Activity className="w-5 h-5" />, label: "Today's Attempts",     value: stats.todayAttempts,    trend: "neutral" as const, sub: "Since midnight" },
    { icon: <Clock className="w-5 h-5" />,    label: "This Week",            value: stats.thisWeekAttempts, trend: "up" as const,      sub: "Last 7 days" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Unique Topics",         value: stats.topicsCount,      trend: "neutral" as const, sub: "Distinct subjects studied" },
    { icon: <TrendingUp className="w-5 h-5" />,label: "Pass Rate",            value: `${stats.passRate}%`,   trend: stats.passRate >= 60 ? "up" as const : "down" as const, sub: "Platform-wide" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">System Overview</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Real-time platform metrics and activity</p>
        </div>
        <button onClick={load} disabled={loading} title="Refresh"
          className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading platform data…
        </div>
      ) : (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
            {CARDS.map(c => <StatCard key={c.label} {...c} />)}
          </div>

          {/* Recent activity */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEDCD3] dark:border-[#35352C]">
              <h3 className="font-heading font-medium text-[#1B1B18] dark:text-[#F2F1EA]">
                Recent quiz attempts
              </h3>
              <Link href="/admin/quizzes" className="text-xs text-[#6B2737] dark:text-[#B5677A] font-medium hover:text-[#551F2C] flex items-center gap-0.5">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
              {recent.map(a => (
                <div key={a.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{a.topic}</div>
                    <div className="text-xs text-[#8C8B82] mt-0.5 font-mono">User: {a.user_id.slice(0, 8)}…</div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 border border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] capitalize">
                    {a.difficulty}
                  </span>
                  <div className={`w-14 text-right text-sm font-semibold ${a.passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                    {a.score_pct}%
                  </div>
                  {a.certificate_earned && <Trophy className="w-4 h-4 text-[#93670F] dark:text-[#D4A94A]" />}
                  <div className="w-20 text-right text-xs text-[#8C8B82]">{relTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
