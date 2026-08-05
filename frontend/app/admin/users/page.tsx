"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Filter, Trash2, Shield, RefreshCw,
  ChevronDown, Loader2, CheckCircle, XCircle,
  ChevronLeft, ChevronRight as ChevronRight2, Eye, Trophy
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string | null;
  quizCount: number;
  certCount: number;
  avgScore: number;
  lastActive: string | null;
}

const PAGE_SIZE = 15;

function relTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function AdminUsers() {
  const [users,    setUsers]    = useState<UserRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page,     setPage]     = useState(1);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();

    // Get ALL quiz attempts (gives us unique user IDs + stats)
    const { data: attempts } = await supabase
      .from("questly_quiz_attempts")
      .select("user_id, score_pct, certificate_earned, created_at");

    // Get profiles (might be empty for some users)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at");

    // Build profile lookup
    const profileMap: Record<string, { full_name: string | null; email: string | null; role: string; created_at: string | null }> = {};
    (profiles ?? []).forEach(p => {
      profileMap[p.id] = {
        full_name: p.full_name,
        email: p.email,
        role: p.role ?? "user",
        created_at: p.created_at,
      };
    });

    // Aggregate stats by user_id from attempts
    const statsMap: Record<string, { count: number; certs: number; totalScore: number; last: string }> = {};
    (attempts ?? []).forEach(a => {
      if (!statsMap[a.user_id]) {
        statsMap[a.user_id] = { count: 0, certs: 0, totalScore: 0, last: a.created_at };
      }
      statsMap[a.user_id].count++;
      if (a.certificate_earned) statsMap[a.user_id].certs++;
      statsMap[a.user_id].totalScore += a.score_pct;
      if (a.created_at > statsMap[a.user_id].last) statsMap[a.user_id].last = a.created_at;
    });

    // Also include users from profiles who may not have attempts yet
    const allUserIds = new Set([
      ...Object.keys(statsMap),
      ...Object.keys(profileMap),
    ]);

    const merged: UserRow[] = Array.from(allUserIds).map(uid => {
      const prof = profileMap[uid];
      const stat = statsMap[uid];
      return {
        id:         uid,
        full_name:  prof?.full_name  ?? "—",
        email:      prof?.email      ?? `User …${uid.slice(-8)}`,
        role:       prof?.role       ?? "user",
        created_at: prof?.created_at ?? null,
        quizCount:  stat?.count      ?? 0,
        certCount:  stat?.certs      ?? 0,
        avgScore:   stat ? Math.round(stat.totalScore / stat.count) : 0,
        lastActive: stat?.last       ?? null,
      };
    })
    // Sort by most quiz activity first
    .sort((a, b) => b.quizCount - a.quizCount);

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const toggleRole = async (u: UserRow) => {
    const newRole = u.role === "super_admin" ? "user" : "super_admin";
    const supabase = createClient();
    // Upsert profile with new role
    const { error } = await supabase.from("profiles").upsert({
      id: u.id, email: u.email !== `User …${u.id.slice(-8)}` ? u.email : undefined,
      full_name: u.full_name !== "—" ? u.full_name : undefined,
      role: newRole,
    }, { onConflict: "id" });
    if (error) { showMsg(error.message, false); return; }
    setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: newRole } : p));
    showMsg(`${u.full_name !== "—" ? u.full_name : u.email} is now ${newRole}`, true);
  };

  const deleteUserData = async (u: UserRow) => {
    if (!confirm(`Delete ALL data for ${u.full_name !== "—" ? u.full_name : u.email}? Cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from("questly_quiz_attempts").delete().eq("user_id", u.id);
    await supabase.from("profiles").delete().eq("id", u.id);
    setUsers(prev => prev.filter(p => p.id !== u.id));
    showMsg("User data deleted.", true);
  };

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) list = list.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
    if (roleFilter !== "all") list = list.filter(u => u.role === roleFilter);
    return list;
  }, [users, search, roleFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">User Management</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">{users.length} users tracked</p>
        </div>
        <button onClick={load} title="Refresh" className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-2.5 border ${msg.ok ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]" : "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]"}`}>
          {msg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#8C8B82]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="bg-transparent text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none w-full" />
        </div>
        <div className="relative flex items-center gap-1.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2 text-xs text-[#5B5A52] dark:text-[#ABA99C]">
          <Filter className="w-3 h-3 text-[#8C8B82]" />
          <span className="text-[#8C8B82] font-medium">Role:</span>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="bg-transparent outline-none font-medium text-[#1B1B18] dark:text-[#F2F1EA] pr-4 appearance-none cursor-pointer">
            <option value="all">All</option>
            <option value="user">User</option>
            <option value="super_admin">Admin</option>
          </select>
          <ChevronDown className="w-3 h-3 text-[#8C8B82] absolute right-2 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">
          <div>User</div><div>Role</div><div>Quizzes</div><div>Certs</div><div>Avg Score</div><div>Last Active</div><div>Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#8C8B82]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading users…
          </div>
        ) : paged.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#8C8B82]">
            {users.length === 0
              ? "No users found — run a quiz attempt to see users here."
              : "No results match your search."}
          </div>
        ) : (
          <div className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
            {paged.map(u => (
              <div key={u.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                {/* User */}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{u.full_name !== "—" ? u.full_name : <span className="text-[#8C8B82] italic">No name</span>}</div>
                  <div className="text-xs text-[#8C8B82] truncate">{u.email}</div>
                </div>
                {/* Role */}
                <div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 border ${u.role === "super_admin" ? "bg-[#F5E7E4] dark:bg-[#2B1512] text-[#8C2E24] dark:text-[#D08A7E] border-[#E0B8AF] dark:border-[#4A2A24]" : "bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border-[#DEDCD3] dark:border-[#35352C]"}`}>
                    {u.role === "super_admin" ? "Admin" : "User"}
                  </span>
                </div>
                {/* Stats */}
                <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{u.quizCount}</div>
                <div className="text-sm font-medium text-[#93670F] dark:text-[#D4A94A] flex items-center gap-1">
                  {u.certCount > 0 && <Trophy className="w-3.5 h-3.5" />}{u.certCount}
                </div>
                <div className={`text-sm font-medium ${u.avgScore >= 70 ? "text-[#2F6B3A] dark:text-[#7EBA88]" : u.avgScore > 0 ? "text-[#93670F] dark:text-[#D4A94A]" : "text-[#8C8B82]"}`}>
                  {u.avgScore > 0 ? `${u.avgScore}%` : "—"}
                </div>
                <div className="text-xs text-[#8C8B82]">{relTime(u.lastActive)}</div>
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link href={`/admin/users/${u.id}`} title="View full quiz history"
                    className="p-1.5 text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#6B2737] dark:hover:text-[#B5677A] transition-colors">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button title={u.role === "super_admin" ? "Demote to user" : "Promote to admin"}
                    onClick={() => toggleRole(u)}
                    className={`p-1.5 transition-colors ${u.role === "super_admin" ? "text-[#8C2E24] dark:text-[#D08A7E]" : "text-[#6B2737] dark:text-[#B5677A]"}`}>
                    <Shield className="w-4 h-4" />
                  </button>
                  <button title="Delete user data" onClick={() => deleteUserData(u)}
                    className="p-1.5 text-[#8C8B82] hover:text-[#8C2E24] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-xs text-[#5B5A52] dark:text-[#ABA99C]">
            <span>Page {page} of {pages} · {filtered.length} users</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                <ChevronRight2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
