"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Activity, Trophy, BookOpen, Loader2, RefreshCw,
  Wifi, WifiOff, Users, Clock, MonitorSmartphone
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────
interface PresenceUser {
  user_id: string;
  name: string;
  email: string;
  joined_at: string;
}

interface ActiveUser {
  user_id: string;
  name: string;
  email: string;
  lastActivity: string;   // ISO
}

interface QuizEvent {
  id: string; topic: string; score_pct: number; passed: boolean;
  certificate_earned: boolean; difficulty: string;
  user_id: string; created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────
function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function isSameDay(iso: string, offsetDays: number) {
  const target = new Date();
  target.setDate(target.getDate() - offsetDays);
  return new Date(iso).toDateString() === target.toDateString();
}

const DIFF_COLOR: Record<string, string> = {
  easy: "#10B981", medium: "#6366F1", hard: "#EF4444",
};

// ── User card component ─────────────────────────────────────────────
function UserCard({
  userId, name, email, lastActivity, dotColor, statusLabel, isOnline,
  role,
}: {
  userId: string; name: string; email: string; lastActivity: string;
  dotColor: string; statusLabel: string; isOnline?: boolean; role?: string;
}) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <Link href={`/admin/users/${userId}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-[#0B1120] border border-[#1E293B] hover:border-[#334155] hover:bg-[#1E293B]/50 transition-all group">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-black">
          {initials}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B1120] ${dotColor} ${isOnline ? "animate-pulse" : ""}`} />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white truncate group-hover:text-[#6366F1] transition-colors">
          {name}
          {role === "super_admin" && (
            <span className="ml-1.5 text-[8px] font-black text-[#EF4444] bg-[#EF4444]/10 px-1 py-0.5 rounded-full">ADMIN</span>
          )}
        </div>
        <div className="text-[10px] text-[#475569] truncate">{email || "—"}</div>
      </div>
      {/* Status */}
      <div className="text-right shrink-0">
        <div className={`text-[9px] font-bold`} style={{ color: dotColor.replace("bg-[", "").replace("]", "") }}>
          {statusLabel}
        </div>
        <div className="text-[9px] text-[#475569] mt-0.5">{relTime(lastActivity)}</div>
      </div>
    </Link>
  );
}

// ── Section wrapper ────────────────────────────────────────────────
function Section({
  color, label, count, children, loading, emptyMsg, pulse = false, maxH = "max-h-72",
}: {
  color: string; label: string; count: number; children: React.ReactNode;
  loading: boolean; emptyMsg: string; pulse?: boolean; maxH?: string;
}) {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1E293B]">
        <div className={`w-2 h-2 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ backgroundColor: color }} />
        <h3 className="text-xs font-black text-white uppercase tracking-widest">{label}</h3>
        <span className="ml-auto text-xs font-bold" style={{ color }}>{count}</span>
      </div>
      <div className={`p-3 space-y-2 overflow-y-auto ${maxH}`}>
        {loading ? (
          <div className="flex justify-center py-6 text-[#475569]">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : count === 0 ? (
          <p className="text-xs text-[#475569] text-center py-5 leading-relaxed">{emptyMsg}</p>
        ) : children}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function AdminActivity() {
  // Realtime Presence — "Online Now"
  const [onlineUsers,  setOnlineUsers]  = useState<PresenceUser[]>([]);
  // Quiz-based activity tracking — Today / Yesterday
  const [todayUsers,   setTodayUsers]   = useState<ActiveUser[]>([]);
  const [yesterdayUsers, setYesterdayUsers] = useState<ActiveUser[]>([]);
  // Profiles for role lookup
  const [profileMap,   setProfileMap]   = useState<Record<string, { role: string }>>({});
  // Events feed
  const [events,   setEvents]   = useState<QuizEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [live,     setLive]     = useState(true);
  const [newCount, setNewCount] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef   = useRef<string | null>(null);
  const supabaseRef = useRef(createClient());

  // ── 1. Realtime Presence ─────────────────────────────────────────
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase.channel("questly-presence");

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, PresenceUser[]>;
      // Flatten all present users, deduplicate by user_id (take latest)
      const byId: Record<string, PresenceUser> = {};
      Object.values(state).flat().forEach(u => {
        if (!byId[u.user_id] || u.joined_at > byId[u.user_id].joined_at) {
          byId[u.user_id] = u;
        }
      });
      setOnlineUsers(Object.values(byId));
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── 2. Load activity data ─────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const supabase = supabaseRef.current;

    const [evtRes, profRes, attRes] = await Promise.all([
      // Recent quiz events
      supabase.from("questly_quiz_attempts")
        .select("id,topic,score_pct,passed,certificate_earned,difficulty,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(60),

      // Profiles for role + last_seen lookup
      supabase.from("profiles").select("id,full_name,email,role,last_seen_at"),

      // Quiz attempts from last 2 days for Today/Yesterday detection
      supabase.from("questly_quiz_attempts")
        .select("user_id,created_at")
        .gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString())
        .order("created_at", { ascending: false }),
    ]);

    const evts = (evtRes.data ?? []) as QuizEvent[];

    // Detect new events (polling)
    if (silent && evts.length && lastIdRef.current && evts[0].id !== lastIdRef.current) {
      const prev = new Set(events.map(e => e.id));
      const n = evts.filter(e => !prev.has(e.id)).length;
      if (n > 0) setNewCount(c => c + n);
    }
    if (evts.length) lastIdRef.current = evts[0].id;
    setEvents(evts);

    // Build profile map for role lookup
    const profs = profRes.data ?? [];
    const pmap: Record<string, { role: string }> = {};
    profs.forEach(p => { pmap[p.id] = { role: p.role ?? "user" }; });
    setProfileMap(pmap);

    // Build Today/Yesterday from two sources:
    // A) last_seen_at in profiles (if column exists)
    // B) latest quiz attempt timestamp (always available)
    const userActivity: Record<string, { name: string; email: string; lastActivity: string }> = {};

    // Source A: profiles.last_seen_at
    profs.forEach(p => {
      if (p.last_seen_at && p.email) {
        userActivity[p.id] = {
          name: p.full_name ?? p.email.split("@")[0],
          email: p.email,
          lastActivity: p.last_seen_at,
        };
      }
    });

    // Source B: quiz attempts (fills gaps where last_seen_at is missing)
    const attemptUserMap: Record<string, string> = {}; // user_id → latest created_at
    (attRes.data ?? []).forEach(a => {
      if (!attemptUserMap[a.user_id] || a.created_at > attemptUserMap[a.user_id]) {
        attemptUserMap[a.user_id] = a.created_at;
      }
    });
    Object.entries(attemptUserMap).forEach(([uid, iso]) => {
      if (!userActivity[uid]) {
        const prof = profs.find(p => p.id === uid);
        userActivity[uid] = {
          name:  prof?.full_name ?? prof?.email?.split("@")[0] ?? `User…${uid.slice(-4)}`,
          email: prof?.email ?? "",
          lastActivity: iso,
        };
      } else if (iso > userActivity[uid].lastActivity) {
        userActivity[uid].lastActivity = iso;
      }
    });

    const allActive = Object.entries(userActivity).map(([user_id, v]) => ({ user_id, ...v }));
    setTodayUsers(allActive.filter(u => isSameDay(u.lastActivity, 0) && !u.lastActivity.startsWith("2026-01")));
    setYesterdayUsers(allActive.filter(u => isSameDay(u.lastActivity, 1)));

    if (!silent) setLoading(false);
  }, [events]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (live) intervalRef.current = setInterval(() => load(true), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [live]);

  const todayEvents = events.filter(e => isSameDay(e.created_at, 0));
  const onlineIds   = new Set(onlineUsers.map(u => u.user_id));

  // Today = logged in today but NOT currently online (avoid double-counting)
  const todayOnly = todayUsers.filter(u => !onlineIds.has(u.user_id));

  return (
    <div className="animate-fade-in-up space-y-6">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Live Activity</h1>
          <p className="text-sm text-[#64748B]">Real-time platform monitoring · auto-refreshes every 10s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLive(v => !v)}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border transition-all font-semibold ${
              live ? "bg-[#0d2b20] border-[#10B981] text-[#10B981]" : "bg-[#1E293B] border-[#334155] text-[#64748B]"
            }`}>
            {live ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {live ? "Live" : "Paused"}
          </button>
          <button onClick={() => { setNewCount(0); load(); }}
            className="flex items-center gap-2 text-sm text-[#94a3b8] bg-[#1E293B] border border-[#334155] px-4 py-2 rounded-xl hover:border-[#6366F1] transition-all">
            <RefreshCw className="w-4 h-4" />
            {newCount > 0 && (
              <span className="bg-[#EF4444] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{newCount} new</span>
            )}
          </button>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Online Now",         value: onlineUsers.length,                    color: "#10B981", pulse: true  },
          { label: "Active Today",       value: onlineUsers.length + todayOnly.length, color: "#6366F1", pulse: false },
          { label: "Active Yesterday",   value: yesterdayUsers.length,                 color: "#F59E0B", pulse: false },
          { label: "Quizzes Today",      value: todayEvents.length,                    color: "#8B5CF6", pulse: false },
        ].map(s => (
          <div key={s.label} className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center relative"
              style={{ backgroundColor: s.color + "20" }}>
              <Users className="w-4 h-4" style={{ color: s.color }} />
              {s.pulse && s.value > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] rounded-full border border-[#0F172A] animate-pulse" />
              )}
            </div>
            <div>
              <div className="text-xl font-black text-white">{s.value}</div>
              <div className="text-xs text-[#64748B]">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* Left panels */}
        <div className="lg:col-span-2 space-y-4">

          {/* 🟢 Online Now (Realtime Presence) */}
          <Section color="#10B981" label="Online Now" count={onlineUsers.length}
            loading={false} pulse
            emptyMsg={"No users online right now.\nUsers appear here when they open the dashboard."}
            maxH="max-h-60">
            {onlineUsers.map(u => (
              <UserCard key={u.user_id} userId={u.user_id} name={u.name} email={u.email}
                lastActivity={u.joined_at} dotColor="bg-[#10B981]"
                statusLabel="Online" isOnline role={profileMap[u.user_id]?.role} />
            ))}
          </Section>

          {/* 🔵 Active Today */}
          <Section color="#6366F1" label="Active Today" count={todayOnly.length}
            loading={loading} emptyMsg="No other users active today" maxH="max-h-60">
            {todayOnly.map(u => (
              <UserCard key={u.user_id} userId={u.user_id} name={u.name} email={u.email}
                lastActivity={u.lastActivity} dotColor="bg-[#6366F1]"
                statusLabel="Today" role={profileMap[u.user_id]?.role} />
            ))}
          </Section>

          {/* 🟡 Active Yesterday */}
          <Section color="#F59E0B" label="Active Yesterday" count={yesterdayUsers.length}
            loading={loading} emptyMsg="No user activity from yesterday" maxH="max-h-52">
            {yesterdayUsers.map(u => (
              <UserCard key={u.user_id} userId={u.user_id} name={u.name} email={u.email}
                lastActivity={u.lastActivity} dotColor="bg-[#F59E0B]"
                statusLabel="Yesterday" role={profileMap[u.user_id]?.role} />
            ))}
          </Section>
        </div>

        {/* Right: event feed */}
        <div className="lg:col-span-3 bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E293B] flex-shrink-0">
            <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" /> Quiz Event Feed
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold"
              style={{ color: live ? "#10B981" : "#475569" }}>
              <div className={`w-1.5 h-1.5 rounded-full ${live ? "bg-[#10B981] animate-pulse" : "bg-[#475569]"}`} />
              {live ? "Live" : "Paused"}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#475569]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading events…
            </div>
          ) : (
            <div className="divide-y divide-[#1E293B] overflow-y-auto" style={{ maxHeight: 640 }}>
              {events.length === 0 ? (
                <div className="py-16 text-center text-[#475569] text-sm">No quiz attempts yet</div>
              ) : events.map(e => {
                const col = DIFF_COLOR[e.difficulty?.toLowerCase()] ?? "#6366F1";
                return (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#1E293B]/40 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: e.certificate_earned ? "#F59E0B20" : "#6366F120" }}>
                      {e.certificate_earned
                        ? <Trophy className="w-4 h-4 text-[#F59E0B]" />
                        : <BookOpen className="w-4 h-4 text-[#6366F1]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {e.certificate_earned ? "🏆 " : "📝 "}{e.topic}
                      </div>
                      <div className="text-[10px] text-[#475569] font-mono">{e.user_id.slice(0, 10)}…</div>
                    </div>
                    <span className={`text-sm font-black ${e.passed ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
                      {e.score_pct}%
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                      style={{ backgroundColor: col + "20", color: col }}>
                      {e.difficulty}
                    </span>
                    <div className="w-16 text-right text-[10px] text-[#475569] flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5" />{relTime(e.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
