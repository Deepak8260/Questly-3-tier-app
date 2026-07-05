"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";
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

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setSuccess("Account created. Check your email to confirm your account, then sign in.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#14140F] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-1/2 bg-[#1B1B18] dark:bg-[#0E0E0B] p-12 justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-white font-heading font-semibold text-xl">
          <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-sm font-semibold">Q</div>
          Questly
        </Link>

        <div className="max-w-md">
          <h2 className="font-heading text-4xl font-medium text-white mb-4 leading-tight">
            Your learning journey, built around exactly what you need to study.
          </h2>
          <p className="text-[#ABA99C] text-lg mb-8">
            Generate quizzes, track progress, and earn certificates — all in one place.
          </p>

          <div className="space-y-4">
            {[
              "Generate quizzes on any topic",
              "Get clear explanations for every answer",
              "Track your learning with analytics",
              "Earn shareable certificates",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white">
                <Check className="w-4 h-4 text-[#B5677A] flex-shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[#ABA99C] text-sm border-t border-[#35352C] pt-6">
          Join 10,000+ learners already on Questly
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="lg:hidden inline-flex items-center gap-2.5 font-heading font-semibold text-[#1B1B18] dark:text-[#F2F1EA] text-xl mb-6">
              <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-sm font-semibold">Q</div>
              Questly
            </Link>
            <h1 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2">Create your account</h1>
            <p className="text-[#5B5A52] dark:text-[#ABA99C]">Start learning for free. No credit card needed.</p>
          </div>

          <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-8">

            {error && (
              <div className="flex items-start gap-2.5 bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] text-[#8C2E24] dark:text-[#D08A7E] text-sm px-4 py-3 mb-5">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2.5 bg-[#E9F1E9] dark:bg-[#1A2A1D] border border-[#B8D8B8] dark:border-[#2E4A32] text-[#2F6B3A] dark:text-[#7EBA88] text-sm px-4 py-3 mb-5">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#3F3E38] dark:text-[#D6D4C9] block mb-1.5">Full name</label>
                <input
                  type="text"
                  placeholder="Deepak Kumar"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder-[#8C8B82] focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#3F3E38] dark:text-[#D6D4C9] block mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder-[#8C8B82] focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#3F3E38] dark:text-[#D6D4C9] block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 pr-11 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder-[#8C8B82] focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8B82] hover:text-[#5B5A52]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#3F3E38] dark:text-[#D6D4C9] block mb-1.5">Confirm password</label>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder-[#8C8B82] focus:outline-none focus:border-[#6B2737] focus:ring-2 focus:ring-[#6B2737]/15 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full bg-[#6B2737] hover:bg-[#551F2C] disabled:opacity-60 text-white font-medium py-3 flex items-center justify-center gap-2 transition-colors text-sm mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Create free account"
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-[#5B5A52] dark:text-[#ABA99C] mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-[#6B2737] dark:text-[#B5677A] font-medium hover:text-[#551F2C] dark:hover:text-[#C77E8F]">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}