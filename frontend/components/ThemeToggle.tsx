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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors text-xs font-semibold"
      >
        <span key={String(isDark)} className="animate-spin-once inline-flex">
          {isDark ? <Sun className="w-3.5 h-3.5 text-[#93670F]" /> : <Moon className="w-3.5 h-3.5 text-[#6B2737] dark:text-[#B5677A]" />}
        </span>
        <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors"
    >
      <span key={String(isDark)} className="animate-spin-once inline-flex">
        {isDark ? <Sun className="w-4 h-4 text-[#93670F]" /> : <Moon className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A]" />}
      </span>
    </button>
  );
}
