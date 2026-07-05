"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BookOpen, Trophy, BarChart3, Brain, ArrowRight,
  Check, Users, ChevronRight, LayoutDashboard
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
    <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#14140F]">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#F5F4F0]/95 dark:bg-[#14140F]/95 backdrop-blur-sm border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 font-heading font-semibold text-lg text-[#1B1B18] dark:text-[#F2F1EA] hover:no-underline">
            <div className="w-7 h-7 bg-[#6B2737] flex items-center justify-center text-white text-sm font-semibold">
              Q
            </div>
            Questly
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-[#5B5A52] dark:text-[#ABA99C] font-medium">
            <Link href="#features" className="hover:text-[#1B1B18] dark:hover:text-[#F2F1EA] transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-[#1B1B18] dark:hover:text-[#F2F1EA] transition-colors">How it works</Link>
            <Link href="#pricing" className="hover:text-[#1B1B18] dark:hover:text-[#F2F1EA] transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle variant="pill" />

            {!authChecked && (
              <div className="w-24 h-8 bg-[#EDECE6] dark:bg-[#262620] animate-pulse" />
            )}

            {authChecked && authUser && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-2 py-1">
                  <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {authUser.initials}
                  </div>
                  <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] hidden sm:block">
                    {authUser.name}
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium bg-[#6B2737] hover:bg-[#551F2C] text-white px-4 py-2 inline-flex items-center gap-1.5 transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
              </div>
            )}

            {authChecked && !authUser && (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#5B5A52] hover:text-[#1B1B18] dark:text-[#ABA99C] dark:hover:text-[#F2F1EA] transition-colors px-3 py-2"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium bg-[#6B2737] hover:bg-[#551F2C] text-white px-4 py-2 inline-flex items-center gap-1.5 transition-colors"
                >
                  Get started
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B2737] dark:text-[#B5677A] mb-5">
              AI-generated learning
            </p>
            <h1 className="font-heading text-4xl md:text-5xl font-medium tracking-tight text-[#1B1B18] dark:text-[#F2F1EA] leading-[1.15] mb-6">
              Learn faster with quizzes built for exactly what you're studying
            </h1>
            <p className="text-lg text-[#5B5A52] dark:text-[#ABA99C] mb-9 leading-relaxed max-w-lg">
              Generate a quiz on any topic in seconds. Track your progress,
              read AI explanations for what you missed, and earn a certificate
              once you know the material.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium px-6 py-3 transition-colors text-sm"
              >
                Start learning free
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 border border-[#DEDCD3] dark:border-[#35352C] hover:border-[#ABA99C] text-[#1B1B18] dark:text-[#F2F1EA] font-medium px-6 py-3 transition-colors text-sm"
              >
                See how it works
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="flex items-center gap-6 text-sm text-[#5B5A52] dark:text-[#ABA99C] border-t border-[#DEDCD3] dark:border-[#35352C] pt-6">
              <div>
                <span className="font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">10,000+</span> learners
              </div>
              <div className="w-px h-4 bg-[#DEDCD3] dark:bg-[#35352C]" />
              <div>
                <span className="font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">500,000+</span> quizzes generated
              </div>
            </div>
          </div>

          {/* Demo card */}
          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C]">
            <div className="border-b border-[#DEDCD3] dark:border-[#35352C] px-5 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#5B5A52] dark:text-[#ABA99C]">Quiz preview</span>
              <span className="text-xs text-[#8C8B82]">Question 1 of 10</span>
            </div>
            <div className="p-5">
              <label className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C] block mb-2">
                Topic
              </label>
              <div className="flex gap-2 mb-5">
                <div className="flex-1 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2 text-sm text-[#1B1B18] dark:text-[#F2F1EA]">
                  Python programming for beginners
                </div>
                <button className="bg-[#6B2737] text-white text-sm font-medium px-4 py-2 hover:bg-[#551F2C] transition-colors">
                  Generate
                </button>
              </div>

              <div className="border border-[#DEDCD3] dark:border-[#35352C] p-4">
                <p className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-3">
                  Which keyword is used to define a function in Python?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {["function", "def", "fn", "define"].map((opt, i) => (
                    <div
                      key={i}
                      className={`text-xs px-3 py-2 border font-medium ${
                        i === 1
                          ? "bg-[#F3E7E9] dark:bg-[#2E1A20] border-[#6B2737] text-[#6B2737] dark:text-[#B5677A]"
                          : "bg-white dark:bg-[#1C1C16] border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C]"
                      }`}
                    >
                      <span className="font-semibold mr-1.5">{["A", "B", "C", "D"][i]}.</span> {opt}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-[#8C8B82]">
                <span className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> AI explanation included</span>
                <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Certificate on completion</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-xl mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B2737] dark:text-[#B5677A] mb-3">
              Features
            </p>
            <h2 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] tracking-tight mb-4">
              Everything you need to learn faster
            </h2>
            <p className="text-[#5B5A52] dark:text-[#ABA99C]">
              A complete learning workflow, not just a quiz generator.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-6"
              >
                <f.icon className="w-5 h-5 text-[#6B2737] dark:text-[#B5677A] mb-4" />
                <h3 className="font-heading font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2 text-[15px]">{f.title}</h3>
                <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B2737] dark:text-[#B5677A] mb-3">
            How it works
          </p>
          <h2 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] tracking-tight mb-14">
            Start learning in three steps
          </h2>

          <div className="grid md:grid-cols-3 gap-x-8 gap-y-10">
            {STEPS.map((s, i) => (
              <div key={i}>
                <div className="text-sm font-semibold text-[#6B2737] dark:text-[#B5677A] mb-3 pb-3 border-b-2 border-[#6B2737] dark:border-[#B5677A] inline-block">
                  0{i + 1}
                </div>
                <h3 className="font-heading font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2 text-base">{s.title}</h3>
                <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#1B1B18] dark:bg-[#0E0E0B]">
        <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 divide-x divide-[#35352C]">
          {STATS.map((s, i) => (
            <div key={i} className="px-4 first:pl-0 text-center">
              <div className="font-heading text-3xl font-medium text-white mb-1">{s.num}</div>
              <div className="text-[#ABA99C] text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      <section className="border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] tracking-tight mb-14">
            What learners are saying
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="border border-[#DEDCD3] dark:border-[#35352C] p-6">
                <p className="text-sm text-[#3F3E38] dark:text-[#D6D4C9] leading-relaxed mb-5">{`"${t.text}"`}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-[#DEDCD3] dark:border-[#35352C]">
                  <div className="w-8 h-8 bg-[#EDECE6] dark:bg-[#262620] flex items-center justify-center text-[#1B1B18] dark:text-[#F2F1EA] text-sm font-semibold">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{t.name}</div>
                    <div className="text-xs text-[#8C8B82]">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B2737] dark:text-[#B5677A] mb-3">
            Pricing
          </p>
          <h2 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-[#5B5A52] dark:text-[#ABA99C] mb-12">Start free. Upgrade whenever you need more.</p>

          <div className="grid md:grid-cols-2 max-w-2xl mx-auto border border-[#DEDCD3] dark:border-[#35352C]">
            {/* Free Plan */}
            <div className="p-8 text-left border-b md:border-b-0 md:border-r border-[#DEDCD3] dark:border-[#35352C]">
              <div className="text-sm font-medium text-[#5B5A52] dark:text-[#ABA99C] mb-1">Free</div>
              <div className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">$0</div>
              <div className="text-sm text-[#8C8B82] mb-6">Forever free</div>
              <ul className="space-y-3 mb-7">
                {FREE_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3F3E38] dark:text-[#D6D4C9]">
                    <Check className="w-4 h-4 text-[#6B2737] dark:text-[#B5677A] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center border border-[#DEDCD3] dark:border-[#35352C] text-[#1B1B18] dark:text-[#F2F1EA] hover:border-[#ABA99C] font-medium py-2.5 text-sm transition-colors">
                Get started free
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="p-8 text-left bg-[#1B1B18] dark:bg-[#0E0E0B]">
              <div className="text-sm font-medium text-[#ABA99C] mb-1">Pro</div>
              <div className="font-heading text-3xl font-medium text-white mb-1">$9</div>
              <div className="text-sm text-[#8C8B82] mb-6">per month</div>
              <ul className="space-y-3 mb-7">
                {PRO_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#D6D4C9]">
                    <Check className="w-4 h-4 text-[#B5677A] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center bg-white text-[#1B1B18] font-medium py-2.5 text-sm hover:bg-[#EDECE6] transition-colors">
                Start Pro trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="border-b border-[#DEDCD3] dark:border-[#35352C]">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] tracking-tight mb-4">
            Ready to learn smarter?
          </h2>
          <p className="text-[#5B5A52] dark:text-[#ABA99C] text-lg mb-9">
            Join 10,000+ learners already using Questly to master new skills faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-[#6B2737] hover:bg-[#551F2C] text-white font-medium px-7 py-3 transition-colors text-sm"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 border border-[#DEDCD3] dark:border-[#35352C] hover:border-[#ABA99C] text-[#1B1B18] dark:text-[#F2F1EA] font-medium px-7 py-3 transition-colors text-sm"
            >
              Sign in
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-[#F5F4F0] dark:bg-[#14140F] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-heading font-semibold text-[#1B1B18] dark:text-[#F2F1EA]">
            <div className="w-6 h-6 bg-[#6B2737] flex items-center justify-center text-white text-xs font-semibold">
              Q
            </div>
            Questly
          </Link>
          <div className="flex gap-6 text-sm text-[#5B5A52] dark:text-[#ABA99C]">
            <Link href="#" className="hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]">Privacy</Link>
            <Link href="#" className="hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]">Terms</Link>
            <Link href="#" className="hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]">Contact</Link>
          </div>
          <p className="text-sm text-[#8C8B82]">© 2026 Questly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: BarChart3, title: "Instant quiz generation", desc: "Generate quizzes on any topic in seconds. MCQ, true/false, or mixed formats." },
  { icon: Brain, title: "AI learning assistant", desc: "Get instant explanations for wrong answers, explained clearly, not just marked wrong." },
  { icon: BarChart3, title: "Learning analytics", desc: "Track your progress over time and see your strong and weak topics." },
  { icon: BookOpen, title: "Study roadmap", desc: "A personalized week-by-week study plan tailored to your learning goal." },
  { icon: Trophy, title: "Certificates", desc: "Earn a verified certificate after scoring 70% or higher. Download as PDF." },
  { icon: Users, title: "Leaderboard", desc: "Compete with other learners and climb the rankings based on scores and streaks." },
];

const STEPS = [
  { title: "Enter your topic", desc: "Type any topic — Python, history, math, machine learning. The rest is handled for you." },
  { title: "Get your quiz", desc: "A personalized set of questions is generated in seconds based on your chosen difficulty." },
  { title: "Take it and improve", desc: "Answer questions, read explanations, earn certificates, and track your progress." },
];

const STATS = [
  { num: "10K+", label: "Active learners" },
  { num: "500K+", label: "Quizzes generated" },
  { num: "95%", label: "Satisfaction rate" },
  { num: "50K+", label: "Certificates earned" },
];

const TESTIMONIALS = [
  { text: "Questly completely changed how I study. I went from struggling to passing my Python certification in just 3 weeks.", name: "Ananya R.", role: "Software developer" },
  { text: "The explanations are excellent. It doesn't just tell you the answer, it teaches you why. That's the difference.", name: "Marcus T.", role: "Data analyst" },
  { text: "I use Questly every day during my commute. The streak system keeps me motivated, and I've already earned 5 certificates.", name: "Priya M.", role: "Student" },
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
  "Priority AI access",
  "Export results",
];