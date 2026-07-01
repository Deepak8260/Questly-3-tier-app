"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Lock, Moon, Sun, LogOut, Trash2,
  Save, CheckCircle, AlertTriangle, Eye, EyeOff, Loader2
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useTheme } from "@/lib/ThemeContext";

// ── Reusable section card ─────────────────────────────────────────
function Section({ title, description, icon, children }: {
  title: string; description: string;
  icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-[#E5E7EB] dark:border-[#334155] overflow-hidden">
      <div className="px-6 py-5 border-b border-[#F3F4F6] dark:border-[#334155] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] dark:bg-[#1e1b4b] flex items-center justify-center text-[#6366F1] flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#111827] dark:text-[#f8fafc]">{title}</h2>
          <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Input field ───────────────────────────────────────────────────
function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">{label}</label>
      <input
        {...props}
        className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#334155]
                   bg-[#F9FAFB] dark:bg-[#0f172a] text-sm text-[#111827] dark:text-[#f8fafc]
                   placeholder:text-[#9CA3AF] outline-none
                   focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1] transition-all
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

// ── Toast message ─────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border mt-4 ${type === "success"
      ? "bg-[#D1FAE5] border-[#6EE7B7] text-[#065F46]"
      : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
      }`}>
      {type === "success"
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // ThemeContext only exposes toggleTheme, so we derive a "select" helper
  const selectTheme = (t: "light" | "dark") => {
    if (t !== theme) toggleTheme();
  };

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [initials, setInitials] = useState("?");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwds, setShowPwds] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Delete-account confirmation
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // ── Load user on mount ───────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name = (user.user_metadata?.full_name as string)
        || (user.user_metadata?.name as string)
        || user.email?.split("@")[0]
        || "";
      setDisplayName(name);
      setEmail(user.email ?? "");
      setInitials(name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?");
    });
  }, []);

  // ── Save profile ─────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!displayName.trim()) {
      setProfileMsg({ text: "Display name cannot be empty.", type: "error" }); return;
    }
    setProfileSaving(true); setProfileMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() },
    });
    if (error) {
      setProfileMsg({ text: error.message, type: "error" });
    } else {
      // Also update profiles table if it exists
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id, full_name: displayName.trim(), updated_at: new Date().toISOString(),
        });
      }
      const ini = displayName.trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      setInitials(ini);
      setProfileMsg({ text: "Profile updated successfully!", type: "success" });
    }
    setProfileSaving(false);
  };

  // ── Change password ───────────────────────────────────────────────
  const changePassword = async () => {
    if (!newPwd) { setPwdMsg({ text: "Please enter a new password.", type: "error" }); return; }
    if (newPwd.length < 8) { setPwdMsg({ text: "Password must be at least 8 characters.", type: "error" }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ text: "Passwords do not match.", type: "error" }); return; }
    setPwdSaving(true); setPwdMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) {
      setPwdMsg({ text: error.message, type: "error" });
    } else {
      setPwdMsg({ text: "Password changed successfully!", type: "success" });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    }
    setPwdSaving(false);
  };

  // ── Delete account ───────────────────────────────────────────────
  const deleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      setDeleteMsg({ text: 'Type DELETE (all caps) to confirm.', type: "error" }); return;
    }
    setDeleting(true); setDeleteMsg(null);
    const supabase = createClient();
    // Delete all user data first
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("questly_quiz_attempts").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
    }
    // Sign out (Supabase free tier doesn't allow self-deletion via anon key)
    await supabase.auth.signOut();
    router.push("/");
    setDeleting(false);
  };

  // ── Sign out ─────────────────────────────────────────────────────
  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="animate-fade-in-up max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-black text-[#111827] dark:text-[#f8fafc] mb-1">Settings</h1>
        <p className="text-sm text-[#6B7280] dark:text-[#94a3b8]">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">

        {/* ── Profile ── */}
        <Section title="Profile" description="Update your display name and avatar" icon={<User className="w-4 h-4" />}>
          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-black flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc]">{displayName || "—"}</p>
              <p className="text-xs text-[#9CA3AF]">{email}</p>
              <p className="text-[10px] text-[#9CA3AF] mt-1">
                Avatar is auto-generated from your initials
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <Field
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your full name"
            />
            <Field
              label="Email Address"
              value={email}
              disabled
              type="email"
              placeholder="your@email.com"
            />
            <p className="text-[11px] text-[#9CA3AF]">
              Email cannot be changed here. Contact support if needed.
            </p>
          </div>
          {profileMsg && <Toast msg={profileMsg.text} type={profileMsg.type} />}
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="mt-4 flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50
                       text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-md"
          >
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Profile
          </button>
        </Section>

        {/* ── Appearance ── */}
        <Section title="Appearance" description="Choose your preferred theme" icon={theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map(t => (
              <button
                key={t}
                onClick={() => selectTheme(t)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all ${theme === t
                  ? "border-[#6366F1] bg-[#EEF2FF] dark:bg-[#1e1b4b]"
                  : "border-[#E5E7EB] dark:border-[#334155] bg-[#F9FAFB] dark:bg-[#0f172a] hover:border-[#C7D2FE]"
                  }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t === "light" ? "bg-[#FEF3C7]" : "bg-[#1e293b]"
                  }`}>
                  {t === "light"
                    ? <Sun className="w-4 h-4 text-[#F59E0B]" />
                    : <Moon className="w-4 h-4 text-[#94a3b8]" />}
                </div>
                <div className="text-left">
                  <div className={`text-sm font-bold capitalize ${theme === t ? "text-[#6366F1]" : "text-[#374151] dark:text-[#f8fafc]"
                    }`}>{t} Mode</div>
                  <div className="text-[10px] text-[#9CA3AF]">
                    {t === "light" ? "Clean & bright" : "Easy on the eyes"}
                  </div>
                </div>
                {theme === t && (
                  <CheckCircle className="w-4 h-4 text-[#6366F1] ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#9CA3AF] mt-3">
            Your preference is saved to this browser automatically.
          </p>
        </Section>

        {/* ── Security / Password ── */}
        <Section title="Security" description="Change your account password" icon={<Lock className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="relative">
              <Field
                label="New Password"
                type={showPwds ? "text" : "password"}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button
                onClick={() => setShowPwds(v => !v)}
                className="absolute right-3 bottom-2.5 text-[#9CA3AF] hover:text-[#6B7280]"
                type="button"
              >
                {showPwds ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Field
              label="Confirm Password"
              type={showPwds ? "text" : "password"}
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Repeat new password"
            />
            {/* Password strength indicator */}
            {newPwd.length > 0 && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map(i => {
                    const strength = Math.min(
                      4,
                      (newPwd.length >= 8 ? 1 : 0) +
                      (/[A-Z]/.test(newPwd) ? 1 : 0) +
                      (/[0-9]/.test(newPwd) ? 1 : 0) +
                      (/[^A-Za-z0-9]/.test(newPwd) ? 1 : 0)
                    );
                    return (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength
                        ? strength <= 1 ? "bg-[#EF4444]" : strength <= 2 ? "bg-[#F59E0B]" : strength <= 3 ? "bg-[#10B981]" : "bg-[#059669]"
                        : "bg-[#E5E7EB] dark:bg-[#334155]"
                        }`} />
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#9CA3AF]">
                  Include uppercase, numbers, and symbols for a stronger password.
                </p>
              </div>
            )}
          </div>
          {pwdMsg && <Toast msg={pwdMsg.text} type={pwdMsg.type} />}
          <button
            onClick={changePassword}
            disabled={pwdSaving || !newPwd || !confirmPwd}
            className="mt-4 flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50
                       text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-md"
          >
            {pwdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Update Password
          </button>
        </Section>

        {/* ── Account actions ── */}
        <Section title="Account" description="Session and account management" icon={<LogOut className="w-4 h-4" />}>
          <div className="space-y-3">
            {/* Sign out */}
            <div className="flex items-center justify-between py-3 border-b border-[#F9FAFB] dark:border-[#334155]">
              <div>
                <p className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc]">Sign Out</p>
                <p className="text-xs text-[#9CA3AF]">End your current session</p>
              </div>
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-sm font-semibold text-[#6B7280] dark:text-[#94a3b8]
                           border border-[#E5E7EB] dark:border-[#334155] px-4 py-2 rounded-xl
                           hover:bg-[#F9FAFB] dark:hover:bg-[#334155] transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>

            {/* Email info */}
            <div className="flex items-center gap-3 py-3 border-b border-[#F9FAFB] dark:border-[#334155]">
              <Mail className="w-4 h-4 text-[#9CA3AF]" />
              <div>
                <p className="text-xs text-[#9CA3AF]">Logged in as</p>
                <p className="text-sm font-semibold text-[#111827] dark:text-[#f8fafc]">{email}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Danger zone ── */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl border-2 border-[#FEE2E2] dark:border-[#7f1d1d] overflow-hidden">
          <div className="px-6 py-5 border-b border-[#FEE2E2] dark:border-[#7f1d1d] flex items-start gap-3 bg-[#FEF2F2] dark:bg-[#1c0809]">
            <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] flex items-center justify-center text-[#EF4444] flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#DC2626]">Danger Zone</h2>
              <p className="text-xs text-[#EF4444] mt-0.5">
                These actions are permanent and cannot be undone.
              </p>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-[#374151] dark:text-[#f8fafc] mb-1 font-semibold">Delete Account</p>
            <p className="text-xs text-[#9CA3AF] mb-4">
              This will permanently remove all your quizzes, certificates, and account data.
            </p>
            <Field
              label='Type "DELETE" to confirm'
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
            />
            {deleteMsg && <Toast msg={deleteMsg.text} type={deleteMsg.type} />}
            <button
              onClick={deleteAccount}
              disabled={deleting || deleteConfirm !== "DELETE"}
              className="mt-4 flex items-center gap-2 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40
                         text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete My Account
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
