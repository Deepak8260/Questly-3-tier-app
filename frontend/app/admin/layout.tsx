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
      <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#14140F] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#6B2737] dark:text-[#B5677A] animate-spin mx-auto mb-3" />
          <p className="text-[#5B5A52] dark:text-[#ABA99C] text-sm font-medium">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  // ── Access denied ──
  if (denied) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#14140F] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-[#8C2E24] dark:text-[#D08A7E] mx-auto mb-3" />
          <h2 className="font-heading text-[#1B1B18] dark:text-[#F2F1EA] font-semibold text-xl mb-2">Access Denied</h2>
          <p className="text-[#5B5A52] dark:text-[#ABA99C] text-sm">You don't have admin privileges.<br />Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F4F0] dark:bg-[#14140F]">

      {/* ── SIDEBAR ─── Matching Student Layout */}
      <aside className="w-60 fixed left-0 top-0 h-full bg-white dark:bg-[#1C1C16] border-r border-[#DEDCD3] dark:border-[#35352C] flex flex-col z-30">

        {/* Logo + ADMIN badge */}
        <div className="px-5 pt-5 pb-4 border-b border-[#EAE8E1] dark:border-[#262620]">
          <Link href="/" className="flex items-center gap-2.5 font-heading font-semibold text-[#1B1B18] dark:text-[#F2F1EA] text-base">
            <div className="w-7 h-7 bg-[#6B2737] flex items-center justify-center text-white font-semibold text-sm rounded-lg">
              Q
            </div>
            <span>Questly</span>
            <span className="ml-auto text-[9px] font-semibold bg-[#6B2737] text-white px-1.5 py-0.5 tracking-wider rounded-md">
              ADMIN
            </span>
          </Link>
          <div className="flex items-center gap-1.5 mt-2.5 text-xs text-[#8C8B82]">
            <Shield className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" />
            Super Admin Panel
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] font-semibold text-[#8C8B82] tracking-widest uppercase px-3 mb-2 mt-1">
            Control Center
          </div>
          {NAV.map((item) => {
            const active = path === item.href || (item.href !== "/admin" && path.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group ${active
                  ? "bg-[#F3E7E9] dark:bg-[#2E1A20] text-[#6B2737] dark:text-[#B5677A]"
                  : "text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]"
                  }`}>
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-[#6B2737] dark:text-[#B5677A]" : "text-[#8C8B82] group-hover:text-[#5B5A52]"}`} />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-[#6B2737] dark:text-[#B5677A]" />}
              </Link>
            );
          })}

          <div className="text-[10px] font-semibold text-[#8C8B82] tracking-widest uppercase px-3 mb-2 mt-4">
            Quick Links
          </div>
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA] rounded-lg transition-colors group">
            <Zap className="w-[18px] h-[18px] text-[#8C8B82] group-hover:text-[#5B5A52]" /> User Dashboard
          </Link>
        </nav>

        {/* Admin user at bottom */}
        <div className="p-3 border-t border-[#EAE8E1] dark:border-[#262620]">
          <div className="flex items-center gap-3 p-2.5 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] rounded-lg transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 rounded-lg">
              {adminUser?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{adminUser?.name}</div>
              <div className="text-xs text-[#8C2E24] dark:text-[#D08A7E] font-medium">Super Admin</div>
            </div>
          </div>
          <button onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8C8B82] hover:text-[#8C2E24] hover:bg-[#F5E7E4] dark:hover:bg-[#2B1512] rounded-lg transition-colors mt-1">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 ml-60">
        {/* Topbar */}
        <div className="sticky top-0 z-20 bg-[#F5F4F0]/95 dark:bg-[#14140F]/95 backdrop-blur-sm border-b border-[#DEDCD3] dark:border-[#35352C] px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{pageLabel}</h2>
            <p className="text-xs text-[#8C8B82] mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-xs font-medium px-3 py-1.5 text-[#5B5A52] dark:text-[#ABA99C] rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#2F6B3A] dark:bg-[#7EBA88] animate-pulse" />
              Live
            </div>
            <div className="flex items-center gap-1.5 bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] text-[#8C2E24] dark:text-[#D08A7E] text-xs font-medium px-3 py-1.5 rounded-full">
              <Shield className="w-3.5 h-3.5" /> SUPER ADMIN
            </div>
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
