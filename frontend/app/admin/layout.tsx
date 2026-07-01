"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Trophy,
  Activity, Database, Settings, LogOut, Shield, Zap,
  ChevronRight, AlertTriangle, Loader2, Swords
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const NAV = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "User Management" },
  { href: "/admin/quizzes", icon: BookOpen, label: "Quiz Database" },
  { href: "/admin/contests", icon: Swords, label: "Live Contests" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/admin/certificates", icon: Trophy, label: "Certificates" },
  { href: "/admin/activity", icon: Activity, label: "Live Activity" },
  { href: "/admin/explorer", icon: Database, label: "DB Explorer" },
  { href: "/admin/settings", icon: Settings, label: "System Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ name: string; email: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      // --- Primary check: profiles table ---
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, full_name, email")
        .eq("id", user.id)
        .single();

      const isAdmin =
        profile?.role === "super_admin" ||
        // Fallback: allow this email even before SQL is run
        user.email === "kd.codegeek@gmail.com";

      if (!isAdmin) {
        setDenied(true);
        setTimeout(() => router.replace("/dashboard"), 2500);
        return;
      }

      const name =
        profile?.full_name ||
        (user.user_metadata?.full_name as string) ||
        user.email?.split("@")[0] ||
        "Admin";
      setAdminUser({ name, email: user.email ?? "" });
      setChecking(false);
    };
    checkRole();
  }, [router]);


  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const pageLabel = NAV.find(n => path === n.href || (n.href !== "/admin" && path.startsWith(n.href)))?.label ?? "Admin";

  // ── Loading ──
  if (checking && !denied) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin mx-auto mb-3" />
          <p className="text-[#94a3b8] text-sm">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  // ── Access denied ──
  if (denied) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-[#EF4444] mx-auto mb-3" />
          <h2 className="text-white font-bold text-xl mb-2">Access Denied</h2>
          <p className="text-[#94a3b8] text-sm">You don't have admin privileges.<br />Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0B1120] overflow-x-hidden">

      {/* ── SIDEBAR ─── always dark */}
      <aside className="w-64 fixed left-0 top-0 h-full bg-[#0F172A] border-r border-[#1E293B] flex flex-col z-30">

        {/* Logo + ADMIN badge */}
        <div className="px-5 pt-5 pb-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0">
              Q
            </div>
            <span className="text-white font-bold text-base">Questly</span>
            <span className="ml-auto text-[9px] font-black bg-[#EF4444] text-white px-1.5 py-0.5 rounded-md tracking-wider">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs text-[#64748B]">
            <Shield className="w-3 h-3 text-[#6366F1]" />
            Super Admin Panel
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="text-[9px] font-black text-[#475569] tracking-widest uppercase px-3 mb-2">
            Control Center
          </div>
          {NAV.map((item) => {
            const active = path === item.href || (item.href !== "/admin" && path.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${active
                  ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20"
                  : "text-[#94a3b8] hover:bg-[#1E293B] hover:text-white"
                  }`}>
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-white" : "text-[#64748B] group-hover:text-[#94a3b8]"}`} />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-indigo-300" />}
              </Link>
            );
          })}

          <div className="text-[9px] font-black text-[#475569] tracking-widest uppercase px-3 mb-2 mt-5">
            Quick Links
          </div>
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#64748B] hover:bg-[#1E293B] hover:text-[#94a3b8] transition-all">
            <Zap className="w-[18px] h-[18px]" /> User Dashboard
          </Link>
        </nav>

        {/* Admin user at bottom */}
        <div className="p-3 border-t border-[#1E293B]">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#EF4444] to-[#DC2626] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {adminUser?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{adminUser?.name}</div>
              <div className="text-[10px] text-[#EF4444] font-bold">Super Admin</div>
            </div>
          </div>
          <button onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#64748B] hover:text-[#EF4444] hover:bg-[#1c0809] rounded-xl transition-all">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 ml-64 min-w-0 overflow-x-hidden">
        {/* Topbar */}
        <div className="sticky top-0 z-20 bg-[#0B1120]/90 backdrop-blur-md border-b border-[#1E293B] px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{pageLabel}</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#1E293B] border border-[#334155] text-xs font-bold px-3 py-1.5 rounded-full text-[#94a3b8]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Live
            </div>
            <div className="flex items-center gap-1.5 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs font-bold px-3 py-1.5 rounded-full">
              <Shield className="w-3 h-3" /> SUPER ADMIN
            </div>
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
