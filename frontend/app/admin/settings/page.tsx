"use client";
import { useEffect, useRef, useState } from "react";
import {
  Save, CheckCircle, AlertTriangle, Sliders, Zap,
  Trophy, RotateCcw, Loader2, Shield, User, Mail,
  RefreshCw, Database
} from "lucide-react";
import { createClient } from "@/lib/supabase";

// ── Setting definition ─────────────────────────────────────────────
interface SettingDef {
  key: string;
  label: string;
  desc: string;
  defaultVal: string | number;
  type: "number" | "text";
  unit?: string;
}

const SETTING_GROUPS: { section: string; icon: React.ReactNode; items: SettingDef[] }[] = [
  {
    section: "Quiz Limits",
    icon: <Sliders className="w-4 h-4" />,
    items: [
      { key: "max_quizzes_free", label: "Max Quizzes (Free)", desc: "Monthly quiz limit for free users", defaultVal: 10, type: "number", unit: "/mo" },
      { key: "max_quizzes_pro", label: "Max Quizzes (Pro)", desc: "Monthly quiz limit for pro users", defaultVal: 999, type: "number", unit: "/mo" },
      { key: "max_questions_per_quiz", label: "Max Questions / Quiz", desc: "Maximum questions in a single quiz", defaultVal: 20, type: "number" },
    ],
  },
  {
    section: "AI Generation",
    icon: <Zap className="w-4 h-4" />,
    items: [
      { key: "ai_daily_limit", label: "AI Daily Limit", desc: "Max AI requests per day globally", defaultVal: 500, type: "number", unit: "req/day" },
      { key: "ai_model", label: "AI Model", desc: "Model name used for quiz generation", defaultVal: "gemini-2.0-flash", type: "text" },
      { key: "ai_max_tokens", label: "Max Tokens / Request", desc: "Token budget per AI call", defaultVal: 2048, type: "number", unit: "tokens" },
    ],
  },
  {
    section: "Certificates & XP",
    icon: <Trophy className="w-4 h-4" />,
    items: [
      { key: "cert_pass_threshold", label: "Cert Threshold", desc: "Min score % to earn a certificate", defaultVal: 70, type: "number", unit: "%" },
      { key: "xp_per_correct", label: "XP per Correct", desc: "XP awarded per correct answer", defaultVal: 10, type: "number", unit: "XP" },
      { key: "xp_bonus_cert", label: "XP Cert Bonus", desc: "Bonus XP for earning a certificate", defaultVal: 100, type: "number", unit: "XP" },
    ],
  },
];

// All keys flattened
const ALL_KEYS = SETTING_GROUPS.flatMap(g => g.items.map(i => i.key));

type SettingsMap = Record<string, string>;

// ── Admin profile card ────────────────────────────────────────────
function AdminProfile({ name, email }: { name: string; email: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "SA";
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 flex items-center gap-4 mb-7">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EF4444] to-[#DC2626] flex items-center justify-center text-white text-xl font-black flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white font-bold text-base truncate">{name}</p>
          <span className="flex items-center gap-1 text-[9px] font-black bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] px-2 py-0.5 rounded-full whitespace-nowrap">
            <Shield className="w-2.5 h-2.5" /> SUPER ADMIN
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Mail className="w-3 h-3" /> {email}
        </div>
      </div>
      <div className="text-[10px] text-[#334155] text-right hidden sm:block">
        <div className="flex items-center gap-1 text-[#475569]"><Database className="w-3 h-3" /> Settings persisted in Supabase</div>
        <div className="mt-0.5 text-[#334155]">admin_settings table</div>
      </div>
    </div>
  );
}

// ── Inline editable row ───────────────────────────────────────────
function SettingRow({
  item, value, onChange, dirty,
}: {
  item: SettingDef;
  value: string;
  onChange: (v: string) => void;
  dirty: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3.5 border-b border-[#1E293B] last:border-b-0 transition-colors ${dirty ? "bg-[#6366F1]/5" : ""}`}>
      <div className="flex-1 min-w-0 mr-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{item.label}</span>
          {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] flex-shrink-0" title="Unsaved change" />}
        </div>
        <div className="text-xs text-[#475569] mt-0.5">{item.desc}</div>
        <div className="text-[9px] font-mono text-[#334155] mt-0.5">{item.key}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.unit && (
          <span className="text-[10px] text-[#475569] font-mono">{item.unit}</span>
        )}
        <input
          type={item.type === "number" ? "number" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-44 px-3 py-2 bg-[#1E293B] border border-[#334155] rounded-xl text-sm text-white text-right outline-none
                     focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 transition-colors font-mono"
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function AdminSettings() {
  const [values, setValues] = useState<SettingsMap>({});
  const [saved, setSaved] = useState<SettingsMap>({});   // last-saved snapshot
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Load from Supabase ──────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const supabase = createClient();

    // Load admin identity
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      const name =
        profile?.full_name ||
        (user.user_metadata?.full_name as string) ||
        user.email?.split("@")[0] ||
        "Admin";
      setAdmin({ name, email: user.email ?? profile?.email ?? "" });
    }

    // Load settings (key-value rows)
    const { data, error } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ALL_KEYS);

    if (error) {
      showToast("error", `Failed to load settings: ${error.message}`);
      // Fall back to defaults so the page is still usable
      const defaults: SettingsMap = {};
      SETTING_GROUPS.forEach(g => g.items.forEach(i => { defaults[i.key] = String(i.defaultVal); }));
      setValues(defaults);
      setSaved(defaults);
    } else {
      // Merge DB values with defaults for any missing keys
      const dbMap: SettingsMap = {};
      (data ?? []).forEach(row => { dbMap[row.key] = row.value; });
      const merged: SettingsMap = {};
      SETTING_GROUPS.forEach(g =>
        g.items.forEach(i => { merged[i.key] = dbMap[i.key] ?? String(i.defaultVal); })
      );
      setValues(merged);
      setSaved(merged);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Save to Supabase ────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();

    const rows = Object.entries(values).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("admin_settings")
      .upsert(rows, { onConflict: "key" });

    if (error) {
      showToast("error", `Save failed: ${error.message}`);
    } else {
      setSaved({ ...values });
      showToast("success", "All settings saved to database successfully!");
    }
    setSaving(false);
  };

  // ── Reset to defaults ───────────────────────────────────────────
  const handleReset = async () => {
    if (!confirm("Reset all settings to factory defaults and save to database?")) return;
    const defaults: SettingsMap = {};
    SETTING_GROUPS.forEach(g => g.items.forEach(i => { defaults[i.key] = String(i.defaultVal); }));
    setValues(defaults);

    // Also persist resets to DB immediately
    setSaving(true);
    const supabase = createClient();
    const rows = Object.entries(defaults).map(([key, value]) => ({
      key, value, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      showToast("error", `Reset failed: ${error.message}`);
    } else {
      setSaved({ ...defaults });
      showToast("success", "Settings reset to defaults and saved.");
    }
    setSaving(false);
  };

  // Compute dirty keys (changed but not yet saved)
  const dirtyKeys = new Set(
    Object.keys(values).filter(k => values[k] !== saved[k])
  );
  const hasDirty = dirtyKeys.size > 0;

  return (
    <div className="animate-fade-in-up max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">System Settings</h1>
          <p className="text-sm text-[#64748B]">
            Platform-wide configuration — changes are persisted in Supabase
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading || saving}
            className="flex items-center gap-1.5 text-sm text-[#64748B] border border-[#334155] bg-[#1E293B] px-3.5 py-2 rounded-xl hover:border-[#6366F1] hover:text-[#94a3b8] transition-all disabled:opacity-40"
            title="Reload from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleReset}
            disabled={saving || loading}
            className="flex items-center gap-1.5 text-sm text-[#64748B] border border-[#334155] bg-[#1E293B] px-4 py-2 rounded-xl hover:border-[#EF4444] hover:text-[#EF4444] transition-all disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !hasDirty}
            className="flex items-center gap-1.5 text-sm text-white bg-[#6366F1] hover:bg-[#4F46E5] px-5 py-2 rounded-xl transition-all font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save All{hasDirty ? ` (${dirtyKeys.size})` : ""}</>
            }
          </button>
        </div>
      </div>

      {/* ── Admin profile ── */}
      {admin && <AdminProfile name={admin.name} email={admin.email} />}

      {/* ── Toast ── */}
      {toast && (
        <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border mb-5 ${toast.type === "success"
            ? "bg-[#0d2b20] border-[#10B981] text-[#10B981]"
            : "bg-[#1c0809] border-[#EF4444] text-[#EF4444]"
          }`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#64748B]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings from database…
        </div>
      ) : (
        <div className="space-y-5">

          {/* Unsaved changes banner */}
          {hasDirty && (
            <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-[#6366F1]/40 bg-[#6366F1]/10 text-[#a5b4fc]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              You have {dirtyKeys.size} unsaved change{dirtyKeys.size > 1 ? "s" : ""}. Click <strong className="mx-1">Save All</strong> to persist to database.
            </div>
          )}

          {/* Setting groups */}
          {SETTING_GROUPS.map(group => (
            <div key={group.section} className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3 bg-[#0B1120]">
                <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 flex items-center justify-center text-[#6366F1]">
                  {group.icon}
                </div>
                <h2 className="text-sm font-black text-[#94a3b8] uppercase tracking-wider">{group.section}</h2>
              </div>
              <div className="px-5">
                {group.items.map(item => (
                  <SettingRow
                    key={item.key}
                    item={item}
                    value={values[item.key] ?? String(item.defaultVal)}
                    dirty={dirtyKeys.has(item.key)}
                    onChange={v => setValues(prev => ({ ...prev, [item.key]: v }))}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Info card */}
          <div className="flex items-start gap-3 bg-[#1E293B] border border-[#334155] rounded-2xl p-4">
            <Database className="w-4 h-4 text-[#6366F1] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#94a3b8] mb-1">Supabase-Persisted Settings</p>
              <p className="text-xs text-[#475569] leading-relaxed">
                Values are stored in the <code className="text-[#6366F1]">admin_settings</code> table
                using an upsert on the <code className="text-[#6366F1]">key</code> column.
                Run the SQL migration below if the table does not yet exist.
              </p>
              <pre className="mt-2 text-[10px] text-[#475569] bg-[#0F172A] px-3 py-2 rounded-lg overflow-x-auto font-mono leading-relaxed">{`create table if not exists admin_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);
alter table admin_settings enable row level security;
create policy "Super admins can manage settings"
  on admin_settings for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'super_admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'super_admin'));`}</pre>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
