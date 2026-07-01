import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class", // toggled via .dark class on <html>
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7F8FC",
        card: "#FFFFFF",
        primary: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
          light: "#EEF2FF",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#8B5CF6",
          light: "#F5F3FF",
        },
        border: "#E5E7EB",
        "text-primary": "#111827",
        "text-muted": "#6B7280",
        success: "#10B981",
        "success-bg": "#D1FAE5",
        warning: "#F59E0B",
        "warning-bg": "#FEF3C7",
        danger: "#EF4444",
        "danger-bg": "#FEE2E2",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        md: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        lg: "0 8px 24px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.04)",
        card: "0 0 0 1px #E5E7EB, 0 4px 12px rgba(0,0,0,0.06)",
        "primary-glow": "0 4px 16px rgba(99, 102, 241, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease both",
        "fade-in-up": "fadeInUp 0.4s ease both",
        "slide-in": "slideIn 0.3s ease both",
        "slide-in-right": "slideInRight 0.3s ease both",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "spin-once": "spinOnce 0.45s ease both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(100%)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        spinOnce: {
          "0%": { transform: "rotate(-90deg) scale(0.7)", opacity: "0" },
          "100%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
