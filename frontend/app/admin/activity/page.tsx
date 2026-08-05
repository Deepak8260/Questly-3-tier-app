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
      className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors group">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-xs font-semibold">
          {initials}
        </div>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate group-hover:text-[#6B2737] dark:group-hover:text-[#B5677A] transition-colors">
          {name}
          {role === "super_admin" && (
            <span className="ml-1.5 text-[8px] font-semibold text-[#8C2E24] dark:text-[#D08A7E] bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] px-1 py-0.5">ADMIN</span>
          )}
        </div>
        <div className="text-[10px] text-[#8C8B82] truncate">{email || "—"}</div>
      </div>
      {/* Status */}
      <div className="text-right shrink-0">
        <div className="text-[10px] font-semibold text-[#6B2737] dark:text-[#B5677A]">
          {statusLabel}
        </div>
        <div className="text-[10px] text-[#8C8B82] mt-0.5">{relTime(lastActivity)}</div>
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
    <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F]">
        <div className={`w-2 h-2 rounded-full ${pulse ? "animate-pulse" : ""}`} style={{ backgroundColor: color }} />
        <h3 className="text-xs font-semibold text-[#1B1B18] dark:text-[#F2F1EA] uppercase tracking-widest">{label}</h3>
        <span className="ml-auto text-xs font-semibold text-[#6B2737] dark:text-[#B5677A]">{count}</span>
      </div>
      <div className={`p-3 space-y-2 overflow-y-auto ${maxH}`}>
        {loading ? (
          <div className="flex justify-center py-6 text-[#8C8B82]">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : count === 0 ? (
          <p className="text-xs text-[#8C8B82] text-center py-5 leading-relaxed">{emptyMsg}</p>
        ) : children}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function AdminActivity() {
  const [onlineUsers,  setOnlineUsers]  = useState<PresenceUser[]>([]);
  const [todayUsers,   setTodayUsers]   = useState<ActiveUser[]>([]);
  const [yesterdayUsers, setYesterdayUsers] = useState<ActiveUser[]>([]);
  const [profileMap,   setProfileMap]   = useState<Record<string, { role: string }>>({});
  const [events,   setEvents]   = useState<QuizEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [live,     setLive]     = useState(true);
  const [newCount, setNewCount] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef   = useRef<string | null>(null);
  const supabaseRef = useRef(createClient());

  // Realtime Presence
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase.channel("questly-presence");

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, PresenceUser[]>;
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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const supabase = supabaseRef.current;

    const [evtRes, profRes] = await Promise.all([
      supabase.from("questly_quiz_attempts")
        .select("id,topic,score_pct,passed,certificate_earned,difficulty,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase.from("profiles").select("id,full_name,email,role,last_seen_at"),
    ]);

    const evts = (evtRes.data ?? []) as QuizEvent[];
    if (silent && evts.length && lastIdRef.current && evts[0].id !== lastIdRef.current) {
      const prev = new Set(events.map(e => e.id));
      const n = evts.filter(e => !prev.has(e.id)).length;
      if (n > 0) setNewCount(c => c + n);
    }
    if (evts.length) lastIdRef.current = evts[0].id;
    setEvents(evts);

    const profs = profRes.data ?? [];
    const pmap: Record<string, { role: string }> = {};
    profs.forEach(p => { pmap[p.id] = { role: p.role ?? "user" }; });
    setProfileMap(pmap);

    setLoading(false);
  }, [events]);

  useEffect(() => {
    load();
  }, [load]);

  const todayEvents = events.filter(e => isSameDay(e.created_at, 0));
  const onlineIds   = new Set(onlineUsers.map(u => u.user_id));
  const todayOnly = todayUsers.filter(u => !onlineIds.has(u.user_id));

  return (
    <div className="space-y-6">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Live Activity</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Real-time platform monitoring</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setLive(v => !v)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 border transition-colors ${
              live ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]" : "bg-white dark:bg-[#1C1C16] border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C]"
            }`}>
            {live ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {live ? "Live" : "Paused"}
          </button>
          <button onClick={() => { setNewCount(0); load(); }} title="Refresh"
            className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
        {[
          { label: "Online Now",         value: onlineUsers.length },
          { label: "Active Today",       value: onlineUsers.length + todayOnly.length },
          { label: "Active Yesterday",   value: yesterdayUsers.length },
          { label: "Quizzes Today",      value: todayEvents.length },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-5 text-center">
            <div className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">{s.value}</div>
            <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Left panels */}
        <div className="lg:col-span-2 space-y-4">
          <Section color="#2F6B3A" label="Online Now" count={onlineUsers.length}
            loading={false} pulse
            emptyMsg={"No users online right now."}
            maxH="max-h-60">
            {onlineUsers.map(u => (
              <UserCard key={u.user_id} userId={u.user_id} name={u.name} email={u.email}
                lastActivity={u.joined_at} dotColor="#2F6B3A"
                statusLabel="Online" isOnline role={profileMap[u.user_id]?.role} />
            ))}
          </Section>

          <Section color="#6B2737" label="Active Today" count={todayOnly.length}
            loading={loading} emptyMsg="No other users active today" maxH="max-h-60">
            {todayOnly.map(u => (
              <UserCard key={u.user_id} userId={u.user_id} name={u.name} email={u.email}
                lastActivity={u.lastActivity} dotColor="#6B2737"
                statusLabel="Today" role={profileMap[u.user_id]?.role} />
            ))}
          </Section>
        </div>

        {/* Right: event feed */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#DEDCD3] dark:border-[#35352C]">
            <h3 className="font-heading font-medium text-[#1B1B18] dark:text-[#F2F1EA] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A]" /> Quiz Event Feed
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#8C8B82]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading events…
            </div>
          ) : (
            <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620] overflow-y-auto" style={{ maxHeight: 500 }}>
              {events.length === 0 ? (
                <div className="py-16 text-center text-[#8C8B82] text-sm">No quiz attempts yet</div>
              ) : events.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">
                      {e.topic}
                    </div>
                    <div className="text-xs text-[#8C8B82] font-mono">User: {e.user_id.slice(0, 8)}…</div>
                  </div>
                  <span className={`text-sm font-semibold ${e.passed ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
                    {e.score_pct}%
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 border border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] capitalize">
                    {e.difficulty}
                  </span>
                  <div className="text-xs text-[#8C8B82]">{relTime(e.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
