"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Zap, BookOpen, Map, Trophy, BarChart3,
  Users, Settings, LogOut, ChevronRight, Flame, Swords
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/generate", icon: Zap, label: "Generate Quiz" },
  { href: "/dashboard/quizzes", icon: BookOpen, label: "My Quizzes" },
  { href: "/dashboard/contests", icon: Swords, label: "Live Contests", badge: "LIVE" },
  { href: "/dashboard/battles", icon: Swords, label: "Battle Mode", badge: "HOT" },
  { href: "/dashboard/roadmap", icon: Map, label: "Study Roadmap" },
  { href: "/dashboard/certificates", icon: Trophy, label: "Certificates" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/leaderboard", icon: Users, label: "Leaderboard" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; initials: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] || "User";
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
      setUser({ name, email: user.email ?? "", initials });

      // ── 1. Realtime Presence — "Online Now" heartbeat ──────────────
      // Subscribes this user to the shared presence channel.
      // Admin can see everyone currently subscribed (= currently on dashboard).
      // Automatically removed when browser tab closes.
      presenceChannel = supabase.channel("questly-presence", {
        config: { presence: { key: user.id } },
      });
      presenceChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel!.track({
            user_id: user.id,
            name,
            email: user.email ?? "",
            joined_at: new Date().toISOString(),
          });
        }
      });

      // ── 2. Profile upsert — safe, no last_seen_at yet ─────────────
      supabase.from("profiles").upsert(
        { id: user.id, full_name: name, email: user.email ?? "" },
        { onConflict: "id" }
      ).then(() => {
        // Try updating last_seen_at separately (silently fails if column missing)
        supabase.from("profiles")
          .update({ last_seen_at: new Date().toISOString() } as Record<string, string>)
          .eq("id", user.id)
          .then(() => {/* silent */ });
      });
    });

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const pageTitle =
    path === "/dashboard" ? "Dashboard" :
      path.includes("generate") ? "Generate Quiz" :
        path.includes("quizzes") ? "My Quizzes" :
          path.includes("battles") ? "Battle Mode" :
            path.includes("contests") ? "Live Contests" :
              path.includes("roadmap") ? "Study Roadmap" :
                path.includes("certificates") ? "Certificates" :
                  path.includes("analytics") ? "Analytics" :
                    path.includes("leaderboard") ? "Leaderboard" :
                      path.includes("settings") ? "Settings" : "";

  return (
    <div className="flex min-h-screen bg-[#F7F8FC]">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-60 fixed left-0 top-0 h-full bg-white border-r border-[#E5E7EB] flex flex-col z-30">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-[#111827] text-base">
            <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center text-white font-black text-sm">Q</div>
            Questly
          </Link>
        </div>

        {/* Streak widget */}
        <div className="mx-3 mt-3 mb-1 px-3 py-2.5 bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] rounded-xl border border-[#FCD34D]/50">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-xs font-bold text-[#92400E]">7-day streak! 🔥</span>
          </div>
          <div className="text-xs text-[#B45309] mt-0.5">Keep it going — you&apos;re on fire!</div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <div className="text-[9px] font-black text-[#9CA3AF] tracking-widest uppercase px-3 mb-2 mt-1">Main</div>
          {NAV.map((item) => {
            const active = path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href));
            const navItem = item as typeof item & { badge?: string };
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${active
                  ? "bg-[#EEF2FF] text-[#6366F1]"
                  : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]"
                  }`}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-[#6366F1]" : "text-[#9CA3AF] group-hover:text-[#6B7280]"}`} />
                {item.label}
                {navItem.badge && !active && (
                  <span className="ml-1 text-[8px] font-black bg-[#EF4444] text-white px-1.5 py-0.5 rounded-full tracking-wider animate-pulse">
                    {navItem.badge}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-[#6366F1]" />}
              </Link>
            );
          })}

          <div className="text-[9px] font-black text-[#9CA3AF] tracking-widest uppercase px-3 mb-2 mt-4">Account</div>
          <Link href="/dashboard/settings" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151] transition-all group">
            <Settings className="w-[18px] h-[18px] text-[#9CA3AF] group-hover:text-[#6B7280]" />
            Settings
          </Link>
        </nav>

        {/* User profile at bottom */}
        <div className="p-3 border-t border-[#F3F4F6]">
          <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F9FAFB] transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-[#6366F1] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.initials ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#111827] truncate">{user?.name ?? "Loading..."}</div>
              <div className="text-xs text-[#9CA3AF] truncate">{user?.email ?? ""}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-xl transition-all mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 ml-60">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">{pageTitle}</h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="icon" />
            <Link
              href="/dashboard/generate"
              className="inline-flex items-center gap-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Zap className="w-3.5 h-3.5" />
              New Quiz
            </Link>
          </div>
        </div>

        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
