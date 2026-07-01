"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled in Supabase, session is returned immediately
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      // Email confirmation required
      setSuccess("Account created! Please check your email to confirm your account, then sign in.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-1/2 bg-[#6366F1] p-12 justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-white font-bold text-xl">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-lg">Q</div>
          Questly
        </Link>

        <div className="max-w-md">
          <h2 className="text-4xl font-black text-white mb-4 leading-tight">
            Your AI-powered learning journey starts here.
          </h2>
          <p className="text-indigo-200 text-lg mb-8">
            Generate quizzes, track progress, and earn certificates — all powered by advanced AI.
          </p>

          <div className="space-y-4">
            {[
              "Generate quizzes on any topic",
              "Get AI explanations for every answer",
              "Track your learning with analytics",
              "Earn shareable certificates",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">✓</div>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-indigo-200 text-sm">
          <div className="flex -space-x-2">
            {["#818CF8", "#A78BFA", "#34D399", "#FCD34D"].map((c, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-[#6366F1]" style={{ backgroundColor: c }} />
            ))}
          </div>
          Join 10,000+ learners already on Questly
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2 font-bold text-[#111827] text-xl mb-6">
              <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center text-white font-black">Q</div>
              Questly
            </Link>
            <h1 className="text-3xl font-black text-[#111827] mb-2">Create your account</h1>
            <p className="text-[#6B7280]">Start learning for free. No credit card needed.</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">

            {/* Error / Success messages */}
            {error && (
              <div className="flex items-start gap-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm px-4 py-3 rounded-xl mb-5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2.5 bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] text-sm px-4 py-3 rounded-xl mb-5">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="Deepak Kumar"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 pr-11 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#374151] block mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-60 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg text-sm mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Create Free Account
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-[#6366F1] font-semibold hover:text-[#4F46E5]">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
