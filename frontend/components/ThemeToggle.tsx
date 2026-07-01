"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";

interface ThemeToggleProps {
  /** "icon" = just the icon button (for dashboard topbar), "pill" = pill with label (for landing navbar) */
  variant?: "icon" | "pill";
}

export default function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "pill") {
    return (
      <button
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#1e293b] text-[#374151] dark:text-[#94a3b8] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] transition-all text-xs font-semibold shadow-sm"
      >
        <span key={String(isDark)} className="animate-spin-once inline-flex">
          {isDark ? <Sun className="w-3.5 h-3.5 text-[#F59E0B]" /> : <Moon className="w-3.5 h-3.5 text-[#6366F1]" />}
        </span>
        <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#1e293b] text-[#374151] dark:text-[#94a3b8] hover:bg-[#F3F4F6] dark:hover:bg-[#334155] transition-all shadow-sm"
    >
      <span key={String(isDark)} className="animate-spin-once inline-flex">
        {isDark ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4 text-[#6366F1]" />}
      </span>
    </button>
  );
}
