"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, Zap, BookOpen, Map, Trophy, BarChart3,
  Users, Settings, LogOut, ChevronRight, Flame, Swords
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/generate", icon: Zap, label: "Generate quiz" },
  { href: "/dashboard/quizzes", icon: BookOpen, label: "My quizzes" },
  { href: "/dashboard/contests", icon: Swords, label: "Live contests", badge: "LIVE" },
  { href: "/dashboard/battles", icon: Swords, label: "Battle mode" },
  { href: "/dashboard/roadmap", icon: Map, label: "Study roadmap" },
  { href: "/dashboard/certificates", icon: Trophy, label: "Certificates" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/leaderboard", icon: Users, label: "Leaderboard" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; initials: string } | null>(null);
  const [pendingBattlesCount, setPendingBattlesCount] = useState(0);

  const loadPendingBattles = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from("quiz_battles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("player_two", user.id);

    setPendingBattlesCount(count ?? 0);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    let battleChannel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        user.email?.split("@")[0] || "User";
      const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
      setUser({ name, email: user.email ?? "", initials });

      // ── 1. Realtime Presence — "Online Now" heartbeat ──────────────
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

      // ── 2. Profile upsert ─────────────────────────────────────────
      supabase.from("profiles").upsert(
        { id: user.id, full_name: name, email: user.email ?? "" },
        { onConflict: "id" }
      ).then(() => {
        supabase.from("profiles")
          .update({ last_seen_at: new Date().toISOString() } as Record<string, string>)
          .eq("id", user.id)
          .then(() => {/* silent */ });
      });

      // ── 3. Load pending battles and subscribe to changes ──────────
      loadPendingBattles();
      
      battleChannel = supabase.channel("pending-battles")
        .on("postgres_changes", { event: "*", schema: "public", table: "quiz_battles" }, () => {
          loadPendingBattles();
        })
        .subscribe();
    });

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (battleChannel) supabase.removeChannel(battleChannel);
    };
  }, [loadPendingBattles]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const pageTitle =
    path === "/dashboard" ? "Dashboard" :
      path.includes("generate") ? "Generate quiz" :
        path.includes("quizzes") ? "My quizzes" :
          path.includes("battles") ? "Battle mode" :
            path.includes("contests") ? "Live contests" :
              path.includes("roadmap") ? "Study roadmap" :
                path.includes("certificates") ? "Certificates" :
                  path.includes("analytics") ? "Analytics" :
                    path.includes("leaderboard") ? "Leaderboard" :
                      path.includes("settings") ? "Settings" : "";

  return (
    <div className="flex min-h-screen bg-[#F5F4F0] dark:bg-[#14140F]">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-60 fixed left-0 top-0 h-full bg-white dark:bg-[#1C1C16] border-r border-[#DEDCD3] dark:border-[#35352C] flex flex-col z-30">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-[#EAE8E1] dark:border-[#262620]">
          <Link href="/" className="flex items-center gap-2.5 font-heading font-semibold text-[#1B1B18] dark:text-[#F2F1EA] text-base">
            <div className="w-7 h-7 bg-[#6B2737] flex items-center justify-center text-white font-semibold text-sm">Q</div>
            Questly
          </Link>
        </div>

        {/* Streak widget */}
        <div className="mx-3 mt-3 mb-1 px-3 py-2.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] border-l-2 border-l-[#93670F]">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-[#93670F]" />
            <span className="text-xs font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">7-day streak</span>
          </div>
          <div className="text-xs text-[#5B5A52] dark:text-[#ABA99C] mt-0.5">Keep it going.</div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] font-semibold text-[#8C8B82] tracking-widest uppercase px-3 mb-2 mt-1">Main</div>
          {NAV.map((item) => {
            const active = path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href));
            const navItem = item as typeof item & { badge?: string };
            const isBattleMode = item.href === "/dashboard/battles";
            const showPendingBadge = isBattleMode && pendingBattlesCount > 0;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors group ${active
                  ? "bg-[#F3E7E9] dark:bg-[#2E1A20] text-[#6B2737] dark:text-[#B5677A]"
                  : "text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]"
                  }`}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-[#6B2737] dark:text-[#B5677A]" : "text-[#8C8B82] group-hover:text-[#5B5A52]"}`} />
                {item.label}
                {showPendingBadge && (
                  <span className="ml-1 text-[9px] font-semibold bg-[#6B2737] text-white px-1.5 py-0.5 rounded-full">
                    {pendingBattlesCount}
                  </span>
                )}
                {navItem.badge && !active && !showPendingBadge && (
                  <span className="ml-1 text-[9px] font-semibold border border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] px-1.5 py-0.5 tracking-wider">
                    {navItem.badge}
                  </span>
                )}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-[#6B2737] dark:text-[#B5677A]" />}
              </Link>
            );
          })}

          <div className="text-[10px] font-semibold text-[#8C8B82] tracking-widest uppercase px-3 mb-2 mt-4">Account</div>
          <Link href="/dashboard/settings" className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA] transition-colors group">
            <Settings className="w-[18px] h-[18px] text-[#8C8B82] group-hover:text-[#5B5A52]" />
            Settings
          </Link>
        </nav>

        {/* User profile at bottom */}
        <div className="p-3 border-t border-[#EAE8E1] dark:border-[#262620]">
          <div className="flex items-center gap-3 p-2.5 hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {user?.initials ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate">{user?.name ?? "Loading..."}</div>
              <div className="text-xs text-[#8C8B82] truncate">{user?.email ?? ""}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#8C8B82] hover:text-[#8C2E24] hover:bg-[#F5E7E4] dark:hover:bg-[#2B1512] transition-colors mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 ml-60">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-[#F5F4F0]/95 dark:bg-[#14140F]/95 backdrop-blur-sm border-b border-[#DEDCD3] dark:border-[#35352C] px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{pageTitle}</h2>
            <p className="text-xs text-[#8C8B82] mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="icon" />
            <Link
              href="/dashboard/generate"
              className="inline-flex items-center gap-1.5 bg-[#6B2737] hover:bg-[#551F2C] text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              New quiz
            </Link>
          </div>
        </div>

        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}