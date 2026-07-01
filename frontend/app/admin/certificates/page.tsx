"use client";
import { useEffect, useState } from "react";
import {
  Trophy, Loader2, RefreshCw, Trash2, Award, Eye, User,
  Download, Search
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import CertificateModal from "@/components/CertificateModal";

// ── Types ─────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string | null; email: string | null; }

interface Cert {
  id: string;
  user_id: string;
  topic: string;
  difficulty: string;
  score_pct: number;
  correct_answers: number;
  total_questions: number;
  created_at: string;
  userName: string;
  userEmail: string;
}

const DIFF_COLOR: Record<string,string> = {
  easy:   "#10B981",
  medium: "#6366F1",
  hard:   "#EF4444",
};

function makeCertId(id: string, t: string) {
  const d = new Date(t);
  return `QLST-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${id.replace(/-/g,"").slice(0,6).toUpperCase()}`;
}

// ── Main ──────────────────────────────────────────────────────────
export default function AdminCertificates() {
  const [certs,    setCerts]    = useState<Cert[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [active,   setActive]   = useState<Cert | null>(null);   // modal state

  // ── Load: certificates joined with profiles ──────────────────────
  const load = async () => {
    setLoading(true);
    const supabase = createClient();

    const [certsRes, profilesRes] = await Promise.all([
      supabase
        .from("questly_quiz_attempts")
        .select("id,user_id,topic,difficulty,score_pct,correct_answers,total_questions,created_at")
        .eq("certificate_earned", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, email"),
    ]);

    const profileMap: Record<string, Profile> = {};
    (profilesRes.data ?? []).forEach(p => { profileMap[p.id] = p; });

    const merged: Cert[] = (certsRes.data ?? []).map(c => {
      const p = profileMap[c.user_id];
      return {
        ...c,
        userName:  p?.full_name  ?? "Unknown User",
        userEmail: p?.email      ?? `…${c.user_id.slice(-8)}`,
      };
    });

    setCerts(merged);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Revoke ────────────────────────────────────────────────────────
  const revoke = async (id: string) => {
    if (!confirm("Revoke this certificate? The user will lose this earned certificate.")) return;
    const supabase = createClient();
    await supabase
      .from("questly_quiz_attempts")
      .update({ certificate_earned: false })
      .eq("id", id);
    setCerts(prev => prev.filter(c => c.id !== id));
  };

  // ── Derived data ──────────────────────────────────────────────────
  const filtered = search.trim()
    ? certs.filter(c =>
        c.topic.toLowerCase().includes(search.toLowerCase()) ||
        c.userName.toLowerCase().includes(search.toLowerCase()) ||
        c.userEmail.toLowerCase().includes(search.toLowerCase())
      )
    : certs;

  const uniqueUsers = new Set(certs.map(c => c.user_id)).size;
  const avgScore    = certs.length
    ? Math.round(certs.reduce((s, c) => s + c.score_pct, 0) / certs.length)
    : 0;

  const topicCounts = certs.reduce<Record<string, number>>((acc, c) => {
    acc[c.topic] = (acc[c.topic] || 0) + 1;
    return acc;
  }, {});
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="animate-fade-in-up">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Certificate Management</h1>
          <p className="text-sm text-[#64748B]">
            {certs.length} certificates issued across {uniqueUsers} user{uniqueUsers !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 text-sm text-[#94a3b8] bg-[#1E293B] border border-[#334155] px-4 py-2 rounded-xl hover:border-[#6366F1] transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Issued",    value: certs.length,                        color: "#F59E0B" },
          { label: "Unique Earners",  value: uniqueUsers,                         color: "#6366F1" },
          { label: "Avg Score",       value: `${avgScore}%`,                      color: "#10B981" },
          { label: "Topics Covered",  value: Object.keys(topicCounts).length,     color: "#8B5CF6" },
        ].map(s => (
          <div key={s.label}
            className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-4 text-center">
            <div className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[#64748B]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-4 gap-6">

        {/* Sidebar: top topics */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 h-fit">
          <h3 className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-4 flex items-center gap-2">
            <Award className="w-3.5 h-3.5" /> Top Certified Topics
          </h3>
          <div className="space-y-3">
            {topTopics.map(([topic, count], i) => (
              <div key={topic} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#1E293B] flex items-center justify-center text-[9px] font-black text-[#64748B]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{topic}</div>
                  <div className="text-[10px] text-[#475569]">{count} cert{count !== 1 ? "s" : ""}</div>
                </div>
                <Trophy className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0" />
              </div>
            ))}
            {topTopics.length === 0 && (
              <p className="text-xs text-[#475569] italic">No certificates yet</p>
            )}
          </div>
        </div>

        {/* Main table */}
        <div className="lg:col-span-3 bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">

          {/* Search bar */}
          <div className="px-5 py-3 border-b border-[#1E293B] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#475569] flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by user name, email, or topic…"
              className="w-full bg-transparent text-sm text-white placeholder:text-[#475569] outline-none"
            />
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 border-b border-[#1E293B] text-[9px] font-black text-[#475569] uppercase tracking-widest">
            <div>User</div>
            <div>Topic / Cert ID</div>
            <div>Level</div>
            <div>Score</div>
            <div>Issued</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#475569]">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading certificates…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[#475569] text-sm">
              {certs.length === 0 ? "No certificates have been issued yet." : "No results match your search."}
            </div>
          ) : (
            <div className="divide-y divide-[#1E293B] max-h-[620px] overflow-y-auto">
              {filtered.map(c => {
                const col = DIFF_COLOR[c.difficulty?.toLowerCase()] ?? "#6366F1";
                const certId = makeCertId(c.id, c.created_at);
                return (
                  <div key={c.id}
                    className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-[#1E293B]/40 transition-colors">

                    {/* User */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="w-3 h-3 text-[#64748B] flex-shrink-0" />
                        <span className="text-xs font-semibold text-white truncate">{c.userName}</span>
                      </div>
                      <div className="text-[10px] text-[#475569] truncate">{c.userEmail}</div>
                    </div>

                    {/* Topic + cert ID */}
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono text-[#6366F1] mb-0.5">{certId}</div>
                      <div className="text-xs font-semibold text-white truncate">{c.topic}</div>
                    </div>

                    {/* Difficulty */}
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded-full capitalize inline-block w-fit"
                      style={{ backgroundColor: col + "20", color: col }}
                    >
                      {c.difficulty}
                    </span>

                    {/* Score */}
                    <div className="text-sm font-black text-[#10B981]">
                      {c.score_pct}%
                      <div className="text-[10px] font-normal text-[#475569]">
                        {c.correct_answers}/{c.total_questions} correct
                      </div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-[#475569]">
                      {new Date(c.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* ── VIEW & DOWNLOAD ── */}
                      <button
                        onClick={() => setActive(c)}
                        title="View & Download Certificate"
                        className="p-1.5 rounded-lg text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* View user profile */}
                      <Link
                        href={`/admin/users/${c.user_id}`}
                        title="View user's quiz history"
                        className="p-1.5 rounded-lg text-[#475569] hover:text-[#6366F1] hover:bg-[#6366F1]/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>

                      {/* Revoke */}
                      <button
                        onClick={() => revoke(c.id)}
                        title="Revoke certificate"
                        className="p-1.5 rounded-lg text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Certificate Preview Modal ─────────────────────────────── */}
      {active && (
        <CertificateModal
          topic={active.topic}
          scorePct={active.score_pct}
          correctAnswers={active.correct_answers}
          totalQuestions={active.total_questions}
          difficulty={active.difficulty}
          userName={active.userName}
          earnedAt={active.created_at}
          certId={makeCertId(active.id, active.created_at)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
