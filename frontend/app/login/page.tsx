"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", remember: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#14140F] flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 font-heading font-semibold text-[#1B1B18] dark:text-[#F2F1EA] text-xl mb-7">
            <div className="w-8 h-8 bg-[#6B2737] flex items-center justify-center text-white text-sm font-semibold">Q</div>
            Questly
          </Link>
          <h1 className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-2">Welcome back</h1>
          <p className="text-[#5B5A52] dark:text-[#ABA99C]">Sign in to continue your learning journey</p>
        </div>

        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-8">

          {error && (
            <div className="flex items-start gap-2.5 bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] text-[#8C2E24] dark:text-[#D08A7E] text-sm px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[#3F3E38] dark:text-[#D6D4C9]">Password</label>
                <Link href="/forgot-password" className="text-xs text-[#6B2737] dark:text-[#B5677A] hover:text-[#551F2C] dark:hover:text-[#C77E8F] font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Your password"
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={form.remember}
                onChange={e => setForm({ ...form, remember: e.target.checked })}
                className="w-4 h-4 border-[#DEDCD3] accent-[#6B2737]"
              />
              <label htmlFor="remember" className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Remember me for 30 days</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6B2737] hover:bg-[#551F2C] disabled:opacity-60 text-white font-medium py-3 flex items-center justify-center gap-2 transition-colors text-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#5B5A52] dark:text-[#ABA99C] mt-5">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#6B2737] dark:text-[#B5677A] font-medium hover:text-[#551F2C] dark:hover:text-[#C77E8F]">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}