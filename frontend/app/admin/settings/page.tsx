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

type SettingsMap = Record<string, string>;

// ── Admin profile card ────────────────────────────────────────────
function AdminProfile({ name, email }: { name: string; email: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "SA";
  return (
    <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5 flex items-center gap-4 mb-6">
      <div className="w-12 h-12 bg-[#6B2737] flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[#1B1B18] dark:text-[#F2F1EA] font-medium text-base truncate">{name}</p>
          <span className="text-[10px] font-semibold text-[#8C2E24] dark:text-[#D08A7E] bg-[#F5E7E4] dark:bg-[#2B1512] border border-[#E0B8AF] dark:border-[#4A2A24] px-2 py-0.5 whitespace-nowrap">
            SUPER ADMIN
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#8C8B82]">
          <Mail className="w-3 h-3" /> {email}
        </div>
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
    <div className="flex items-center justify-between py-3.5 border-b border-[#EAE8E1] dark:border-[#262620] last:border-b-0">
      <div className="flex-1 min-w-0 mr-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#1B1B18] dark:text-[#F2F1EA]">{item.label}</span>
          {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#6B2737] dark:bg-[#B5677A] flex-shrink-0" title="Unsaved change" />}
        </div>
        <div className="text-xs text-[#8C8B82] mt-0.5">{item.desc}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type={item.type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-28 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-1.5 text-sm text-[#1B1B18] dark:text-[#F2F1EA] outline-none font-medium"
        />
        {item.unit && <span className="text-xs text-[#8C8B82] w-8">{item.unit}</span>}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [values, setValues] = useState<SettingsMap>({});
  const [saved, setSaved] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      setAdmin({
        name: prof?.full_name || user.email?.split("@")[0] || "Admin User",
        email: prof?.email || user.email || "",
      });
    }

    const { data } = await supabase.from("admin_settings").select("key, value");
    const dbMap: SettingsMap = {};
    (data ?? []).forEach((row: { key: string; value: string }) => { dbMap[row.key] = row.value; });

    const merged: SettingsMap = {};
    SETTING_GROUPS.forEach(g => g.items.forEach(i => {
      merged[i.key] = dbMap[i.key] !== undefined ? dbMap[i.key] : String(i.defaultVal);
    }));

    setValues(merged);
    setSaved({ ...merged });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const rows = Object.entries(values).map(([key, value]) => ({
      key, value, updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "key" });
    if (error) {
      showToast("error", `Failed to save: ${error.message}`);
    } else {
      setSaved({ ...values });
      showToast("success", "All settings saved successfully!");
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm("Reset all settings to factory defaults?")) return;
    const defaults: SettingsMap = {};
    SETTING_GROUPS.forEach(g => g.items.forEach(i => { defaults[i.key] = String(i.defaultVal); }));
    setValues(defaults);

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
      showToast("success", "Settings reset to defaults.");
    }
    setSaving(false);
  };

  const dirtyKeys = new Set(
    Object.keys(values).filter(k => values[k] !== saved[k])
  );
  const hasDirty = dirtyKeys.size > 0;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">System Settings</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">
            Platform-wide configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading || saving}
            title="Reload from database"
            className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleReset}
            disabled={saving || loading}
            className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#8C2E24] dark:text-[#D08A7E] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors disabled:opacity-50"
            title="Reset to defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !hasDirty}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-[#6B2737] hover:bg-[#551F2C] px-4 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save All{hasDirty ? ` (${dirtyKeys.size})` : ""}</>
            }
          </button>
        </div>
      </div>

      {/* ── Admin profile ── */}
      {admin && <AdminProfile name={admin.name} email={admin.email} />}

      {/* ── Toast ── */}
      {toast && (
        <div className={`flex items-center gap-2 text-sm px-4 py-2.5 border ${toast.type === "success"
            ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]"
            : "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C8B82] text-[#8C2E24] dark:text-[#D08A7E]"
          }`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#8C8B82]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
        </div>
      ) : (
        <div className="space-y-5">
          {/* Setting groups */}
          {SETTING_GROUPS.map(group => (
            <div key={group.section} className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#DEDCD3] dark:border-[#35352C] flex items-center gap-2.5 bg-[#FAFAF8] dark:bg-[#14140F]">
                <div className="text-[#6B2737] dark:text-[#B5677A]">
                  {group.icon}
                </div>
                <h2 className="text-xs font-semibold text-[#1B1B18] dark:text-[#F2F1EA] uppercase tracking-widest">{group.section}</h2>
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
        </div>
      )}
    </div>
  );
}
