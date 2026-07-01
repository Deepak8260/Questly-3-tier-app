"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

/** Apply theme class to <html> — called both on mount and on toggle */
function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", t);
  if (t === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read persisted preference, fall back to OS preference
    const saved = localStorage.getItem("questly-theme") as Theme | null;
    const osDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: Theme = saved ?? (osDark ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("questly-theme", next);
  };

  // Render children always so SSR works; DOM just won't have .dark yet (handled by inline script)
  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : "light", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
