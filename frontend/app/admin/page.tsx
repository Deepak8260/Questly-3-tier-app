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

function StatCard({ icon, label, value, sub, color, trend }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-5 hover:border-[#334155] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend === "up" ? "text-[#10B981]" : trend === "down" ? "text-[#EF4444]" : "text-[#64748B]"}`}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
          </div>
        )}
      </div>
      <div className="text-2xl font-black text-white mb-0.5">{value}</div>
      <div className="text-xs font-semibold text-[#64748B]">{label}</div>
      {sub && <div className="text-[10px] text-[#475569] mt-1">{sub}</div>}
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
  const [userCount, setUserCount] = useState(0);

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
    setUserCount(profilesRes.count ?? 0);
    setRecent(recentRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const CARDS = stats ? [
    { icon: <Users className="w-5 h-5" />,    label: "Total Users",         value: stats.totalUsers,       color: "#6366F1", trend: "up" as const,      sub: "Registered accounts" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Total Quizzes Taken", value: stats.totalAttempts,    color: "#8B5CF6", trend: "up" as const,      sub: "All time" },
    { icon: <Trophy className="w-5 h-5" />,   label: "Certificates Issued",  value: stats.totalCerts,       color: "#F59E0B", trend: "neutral" as const, sub: "Score ≥ 70%" },
    { icon: <Target className="w-5 h-5" />,   label: "Avg Score",            value: `${stats.avgScore}%`,   color: "#10B981", trend: stats.avgScore >= 70 ? "up" as const : "down" as const, sub: `${stats.passRate}% pass rate` },
    { icon: <Activity className="w-5 h-5" />, label: "Today's Attempts",     value: stats.todayAttempts,    color: "#EF4444", trend: "neutral" as const, sub: "Since midnight" },
    { icon: <Clock className="w-5 h-5" />,    label: "This Week",            value: stats.thisWeekAttempts, color: "#06B6D4", trend: "up" as const,      sub: "Last 7 days" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Unique Topics",         value: stats.topicsCount,      color: "#F97316", trend: "neutral" as const, sub: "Distinct subjects studied" },
    { icon: <TrendingUp className="w-5 h-5" />,label: "Pass Rate",            value: `${stats.passRate}%`,   color: "#A855F7", trend: stats.passRate >= 60 ? "up" as const : "down" as const, sub: "Platform-wide" },
  ] : [];

  const DIFF_COLOR: Record<string, string> = { easy:"#10B981", medium:"#6366F1", hard:"#EF4444" };

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">System Overview</h1>
          <p className="text-sm text-[#64748B]">Real-time platform metrics and activity</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-sm text-[#94a3b8] bg-[#1E293B] border border-[#334155] px-4 py-2 rounded-xl hover:border-[#6366F1] transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#64748B]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading platform data…
        </div>
      ) : (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {CARDS.map(c => <StatCard key={c.label} {...c} />)}
          </div>

          {/* Recent activity */}
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
              <h2 className="text-sm font-black text-[#64748B] uppercase tracking-widest">
                Recent Quiz Attempts
              </h2>
              <Link href="/admin/quizzes" className="text-xs text-[#6366F1] hover:text-[#4F46E5] font-semibold">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-[#1E293B]">
              {recent.map(a => (
                <div key={a.id} className="flex items-center px-6 py-3 gap-4 hover:bg-[#1E293B]/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.topic}</div>
                    <div className="text-xs text-[#475569] mt-0.5 font-mono">{a.user_id.slice(0, 8)}…</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
                    style={{ backgroundColor: (DIFF_COLOR[a.difficulty?.toLowerCase()] ?? "#6366F1") + "20",
                             color: DIFF_COLOR[a.difficulty?.toLowerCase()] ?? "#6366F1" }}>
                    {a.difficulty}
                  </span>
                  <div className={`w-14 text-right text-sm font-black ${a.passed ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                    {a.score_pct}%
                  </div>
                  {a.certificate_earned && <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />}
                  <div className="w-20 text-right text-xs text-[#475569]">{relTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
