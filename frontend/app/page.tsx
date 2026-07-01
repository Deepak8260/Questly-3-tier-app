"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Zap, BookOpen, Trophy, BarChart3, Brain, ArrowRight,
  CheckCircle, Star, Users, Sparkles, ChevronRight, LayoutDashboard
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase";

export default function LandingPage() {
  const [authUser, setAuthUser] = useState<{ name: string; initials: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          user.email?.split("@")[0] ||
          "User";
        const initials = name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        setAuthUser({ name, initials, email: user.email ?? "" });
      }
      setAuthChecked(true);
    });
  }, []);
  return (
    <div className="min-h-screen bg-[#F7F8FC]">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-[#111827] hover:no-underline">
            <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center text-white text-sm font-bold">
              Q
            </div>
            Questly
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-[#6B7280] font-medium">
            <Link href="#features" className="hover:text-[#111827] transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-[#111827] transition-colors">How it works</Link>
            <Link href="#pricing" className="hover:text-[#111827] transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="pill" />

            {/* Show skeleton while auth check is in flight */}
            {!authChecked && (
              <div className="w-24 h-8 bg-[#F3F4F6] rounded-lg animate-pulse" />
            )}

            {/* ── Signed IN — show avatar + name + dashboard link ── */}
            {authChecked && authUser && (
              <div className="flex items-center gap-2.5">
                {/* Avatar */}
                <div className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[#F3F4F6] dark:hover:bg-[#1e293b] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {authUser.initials}
                  </div>
                  <span className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc] hidden sm:block">
                    {authUser.name}
                  </span>
                </div>
                {/* Dashboard CTA */}
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white px-4 py-2 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-lg inline-flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
              </div>
            )}

            {/* ── Signed OUT — show Sign in + Get started ── */}
            {authChecked && !authUser && (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#6B7280] hover:text-[#111827] dark:text-[#94a3b8] dark:hover:text-[#f8fafc] transition-colors px-3 py-2"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white px-4 py-2 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-lg inline-flex items-center gap-1.5"
                >
                  Get started free
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        {/* Background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-br from-[#6366F1]/8 via-[#8B5CF6]/5 to-transparent rounded-full blur-3xl -z-0" />

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 bg-[#EEF2FF] border border-[#C7D2FE] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              Powered by Advanced AI
            </div>

            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#111827] leading-[1.1] mb-6">
              Learn Faster With{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]">
                AI-Generated Quizzes
              </span>
            </h1>

            <p className="text-xl text-[#6B7280] max-w-xl mx-auto mb-10 leading-relaxed">
              Generate quizzes on any topic in seconds. Track your progress,
              get AI explanations, and earn verified certificates.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(99,102,241,0.35)] text-base"
              >
                <Zap className="w-4 h-4" />
                Start Learning Free
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 bg-white border border-[#E5E7EB] hover:border-[#D1D5DB] text-[#374151] font-semibold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md text-base"
              >
                See how it works
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-[#6B7280]">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-2">
                  {["#6366F1", "#8B5CF6", "#10B981", "#F59E0B"].map((c, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span>10,000+ learners</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
                <span className="ml-1">4.9 / 5.0</span>
              </div>
            </div>
          </div>

          {/* Demo card */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-[#E5E7EB] p-6 relative">
              <div className="absolute -top-3 left-6 bg-[#6366F1] text-white text-xs font-bold px-3 py-1 rounded-full">
                Live Preview
              </div>

              {/* Mini quiz generator */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide block mb-1.5">
                  Quiz Topic
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827]">
                    Python Programming for Beginners
                  </div>
                  <button className="bg-[#6366F1] text-white text-sm font-semibold px-4 py-2.5 rounded-lg inline-flex items-center gap-1.5 hover:bg-[#4F46E5] transition-colors">
                    <Zap className="w-3.5 h-3.5" />
                    Generate
                  </button>
                </div>
              </div>

              {/* Sample question */}
              <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[#F3F4F6]">
                <div className="text-xs font-bold text-[#6366F1] uppercase tracking-wider mb-2">
                  Question 1 of 10
                </div>
                <p className="text-sm font-medium text-[#111827] mb-3">
                  Which keyword is used to define a function in Python?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {["function", "def", "fn", "define"].map((opt, i) => (
                    <div
                      key={i}
                      className={`text-xs px-3 py-2 rounded-lg border font-medium cursor-pointer transition-all ${
                        i === 1
                          ? "bg-[#EEF2FF] border-[#6366F1] text-[#6366F1]"
                          : "bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#D1D5DB]"
                      }`}
                    >
                      <span className="font-bold mr-1.5">{["A", "B", "C", "D"][i]}.</span> {opt}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-[#9CA3AF]">
                <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> AI Explanation available</span>
                <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> Certificate on completion</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 bg-[#EEF2FF] border border-[#C7D2FE] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              Features
            </div>
            <h2 className="text-4xl font-black text-[#111827] tracking-tight mb-4">
              Everything you need to learn faster
            </h2>
            <p className="text-[#6B7280] text-lg max-w-xl mx-auto">
              A complete AI learning ecosystem, not just a quiz generator.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl p-6 hover:border-[#E5E7EB] hover:shadow-md transition-all hover:-translate-y-1 group"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: f.color + "15" }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-[#111827] mb-2">{f.title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-[#F7F8FC]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 bg-[#EEF2FF] border border-[#C7D2FE] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            How it works
          </div>
          <h2 className="text-4xl font-black text-[#111827] tracking-tight mb-16">
            Start learning in 3 simple steps
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={i} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full border-t-2 border-dashed border-[#E5E7EB]" />
                )}
                <div className="relative">
                  <div className="w-16 h-16 bg-white border-2 border-[#E5E7EB] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">
                    {s.emoji}
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#6366F1] text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {i + 1}
                  </div>
                </div>
                <h3 className="font-bold text-[#111827] mb-2 text-lg">{s.title}</h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-[#6366F1]">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {STATS.map((s, i) => (
            <div key={i}>
              <div className="text-4xl font-black mb-1">{s.num}</div>
              <div className="text-indigo-200 text-sm font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#111827] tracking-tight mb-4">
              Loved by learners worldwide
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-[#F9FAFB] rounded-2xl p-6 border border-[#F3F4F6]">
                <div className="flex mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-sm text-[#374151] leading-relaxed mb-4">{`"${t.text}"`}</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#111827]">{t.name}</div>
                    <div className="text-xs text-[#6B7280]">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-[#F7F8FC]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 bg-[#EEF2FF] border border-[#C7D2FE] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            Pricing
          </div>
          <h2 className="text-4xl font-black text-[#111827] tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-[#6B7280] mb-12">Start free. Upgrade whenever you need more.</p>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl p-7 border border-[#E5E7EB] shadow-sm text-left">
              <div className="text-sm font-semibold text-[#6B7280] mb-1">Free Plan</div>
              <div className="text-4xl font-black text-[#111827] mb-1">$0</div>
              <div className="text-sm text-[#9CA3AF] mb-6">Forever free</div>
              <ul className="space-y-3 mb-7">
                {FREE_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#374151]">
                    <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center border border-[#E5E7EB] text-[#374151] hover:border-[#D1D5DB] font-semibold py-2.5 rounded-xl text-sm transition-all hover:shadow-sm">
                Get started free
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#6366F1] rounded-2xl p-7 border border-[#4F46E5] shadow-lg shadow-indigo-100 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                Popular
              </div>
              <div className="text-sm font-semibold text-indigo-200 mb-1">Pro Plan</div>
              <div className="text-4xl font-black text-white mb-1">$9</div>
              <div className="text-sm text-indigo-300 mb-6">per month</div>
              <ul className="space-y-3 mb-7">
                {PRO_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white">
                    <CheckCircle className="w-4 h-4 text-indigo-200 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center bg-white text-[#6366F1] font-semibold py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:-translate-y-0.5">
                Start Pro trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-5xl font-black text-[#111827] tracking-tight mb-4">
            Ready to learn smarter?
          </h2>
          <p className="text-[#6B7280] text-lg mb-10">
            Join 10,000+ learners already using Questly to master new skills faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-8 py-4 rounded-xl transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(99,102,241,0.35)] text-base"
            >
              <Zap className="w-4 h-4" />
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 border border-[#E5E7EB] hover:border-[#D1D5DB] text-[#374151] font-semibold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md text-base"
            >
              Sign in
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[#E5E7EB] bg-[#F9FAFB] py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#111827]">
            <div className="w-7 h-7 bg-[#6366F1] rounded-lg flex items-center justify-center text-white text-xs font-bold">
              Q
            </div>
            Questly
          </Link>
          <div className="flex gap-6 text-sm text-[#6B7280]">
            <Link href="#" className="hover:text-[#374151]">Privacy</Link>
            <Link href="#" className="hover:text-[#374151]">Terms</Link>
            <Link href="#" className="hover:text-[#374151]">Contact</Link>
          </div>
          <p className="text-sm text-[#9CA3AF]">© 2026 Questly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Zap, color: "#6366F1", title: "Instant AI Quiz Generation", desc: "Generate quizzes on any topic in seconds using advanced AI. MCQ, True/False, or mixed formats." },
  { icon: Brain, color: "#8B5CF6", title: "AI Learning Assistant", desc: "Get instant explanations for wrong answers. Your personal AI tutor explains concepts clearly." },
  { icon: BarChart3, color: "#10B981", title: "Learning Analytics", desc: "Track your progress over time. See your strong and weak topics with visual charts." },
  { icon: BookOpen, color: "#F59E0B", title: "Study Roadmap", desc: "AI generates personalized week-by-week study plans tailored to your learning goal." },
  { icon: Trophy, color: "#EF4444", title: "Certificates", desc: "Earn verified certificates after scoring 70%+. Download PDF and share on LinkedIn." },
  { icon: Users, color: "#6366F1", title: "Leaderboard", desc: "Compete with other learners. Climb the global rankings based on scores and streaks." },
];

const STEPS = [
  { emoji: "🎯", title: "Enter your topic", desc: "Type any topic — Python, History, Math, Machine Learning. AI handles the rest." },
  { emoji: "⚡", title: "AI generates your quiz", desc: "Our AI creates personalized questions in seconds based on your chosen difficulty." },
  { emoji: "🏆", title: "Take quiz & improve", desc: "Answer questions, get AI explanations, earn certificates, and track your progress." },
];

const STATS = [
  { num: "10K+", label: "Active learners" },
  { num: "500K+", label: "Quizzes generated" },
  { num: "95%", label: "Satisfaction rate" },
  { num: "50K+", label: "Certificates earned" },
];

const TESTIMONIALS = [
  { text: "Questly completely changed how I study. I went from struggling to passing my Python certification in just 3 weeks.", name: "Ananya R.", role: "Software Developer", color: "#6366F1" },
  { text: "The AI explanations are incredible. It doesn't just tell you the answer — it teaches you WHY. Game changer.", name: "Marcus T.", role: "Data Analyst", color: "#8B5CF6" },
  { text: "I use Questly every day during my commute. The streak system keeps me motivated. Already earned 5 certificates!", name: "Priya M.", role: "Student", color: "#10B981" },
];

const FREE_FEATURES = [
  "10 quizzes per month",
  "AI-generated questions",
  "Basic analytics",
  "2 certificates",
  "Community leaderboard",
];

const PRO_FEATURES = [
  "Unlimited quizzes",
  "AI explanations",
  "Full analytics dashboard",
  "Unlimited certificates",
  "Study roadmaps",
  "Priority AI Access",
  "Export results",
];
