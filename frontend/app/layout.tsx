import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/ThemeContext";

export const metadata: Metadata = {
  title: {
    default: "Questly — AI-Powered Learning Platform",
    template: "%s | Questly",
  },
  description:
    "Learn faster with AI-generated quizzes. Generate personalized quizzes on any topic, track your progress, and earn certificates.",
  keywords: ["AI quiz", "learning platform", "AI tutor", "study", "certificates"],
  openGraph: {
    title: "Questly — AI-Powered Learning Platform",
    description: "Learn faster with AI-generated quizzes and personalized study plans.",
    type: "website",
  },
};

/**
 * Inline script injected into <head> BEFORE React hydrates.
 * Reads localStorage + OS preference and applies data-theme / .dark
 * immediately — this prevents the flash of wrong theme on page load.
 */
const antiFlashScript = `
(function () {
  try {
    var saved = localStorage.getItem('questly-theme');
    var osDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved || (osDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: must run synchronously before paint */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: antiFlashScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
