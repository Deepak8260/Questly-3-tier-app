"use client";
import { useState, useEffect } from "react";
import {
    X, Loader2, Zap, Trophy, Calendar, Clock,
    Users, Lock, Globe, AlertCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Contest, ContestQuestion } from "../types";

interface Props {
    contest?: Contest | null;   // null = create mode, defined = edit mode
    onClose: () => void;
    onSaved: () => void;
}

interface FormState {
    title: string;
    description: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    questions_count: number;
    start_time: string;       // local datetime-local string
    duration_minutes: number;
    max_participants: string; // string to allow empty = unlimited
    visibility: "public" | "private";
}

const TOPICS = [
    "Python Basics", "JavaScript ES6", "Machine Learning", "SQL",
    "React.js", "Data Structures", "Linear Algebra", "World History",
    "Biology", "Calculus", "TypeScript", "Node.js",
];

function toLocalDateTimeString(iso: string): string {
    const d = new Date(iso);
    // Format: YYYY-MM-DDTHH:mm (required by <input type="datetime-local">)
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ContestFormModal({ contest, onClose, onSaved }: Props) {
    const isEdit = Boolean(contest);

    const [form, setForm] = useState<FormState>({
        title: contest?.title ?? "",
        description: contest?.description ?? "",
        topic: contest?.topic ?? "",
        difficulty: contest?.difficulty ?? "medium",
        questions_count: contest?.questions_count ?? 10,
        start_time: contest?.start_time ? toLocalDateTimeString(contest.start_time) : "",
        duration_minutes: contest?.duration_minutes ?? 30,
        max_participants: contest?.max_participants != null ? String(contest.max_participants) : "",
        visibility: contest?.visibility ?? "public",
    });

    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [questionPreview, setQuestionPreview] = useState<ContestQuestion[] | null>(
        contest?.question_set ?? null
    );

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const update = (field: keyof FormState, value: string | number) =>
        setForm(prev => ({ ...prev, [field]: value }));

    // ── Generate questions from the existing Quiz Generator API ──────
    const handleGenerateQuestions = async () => {
        if (!form.topic.trim()) { setError("Enter a topic first."); return; }
        setError("");
        setGenerating(true);
        try {
            const res = await fetch("/api/quiz/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: form.topic,
                    difficulty: form.difficulty,
                    numQuestions: form.questions_count,
                    questionType: "mcq",
                    aiMode: "standard",
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) { setError(data.error ?? "Generation failed"); return; }
            setQuestionPreview(data.quiz.questions as ContestQuestion[]);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setGenerating(false);
        }
    };

    // ── Save (create or update) ─────────────────────────────────────
    const handleSave = async (asDraft = false) => {
        setError("");

        // Validation
        if (!form.title.trim()) { setError("Title is required."); return; }
        if (!form.topic.trim()) { setError("Topic is required."); return; }
        if (!form.start_time) { setError("Start time is required."); return; }
        if (!questionPreview && !isEdit) { setError("Please generate questions first."); return; }

        setSaving(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Not authenticated."); setSaving(false); return; }

        const payload = {
            title: form.title.trim(),
            description: form.description.trim() || null,
            topic: form.topic.trim(),
            difficulty: form.difficulty,
            questions_count: questionPreview?.length ?? form.questions_count,
            start_time: new Date(form.start_time).toISOString(),
            duration_minutes: form.duration_minutes,
            max_participants: form.max_participants ? parseInt(form.max_participants) : null,
            visibility: form.visibility,
            status: asDraft ? "draft" : (isEdit ? contest!.status : "draft"),
            ...(questionPreview ? { question_set: questionPreview } : {}),
            ...(isEdit ? {} : { created_by: user.id }),
        };

        const query = isEdit
            ? supabase.from("contests").update(payload).eq("id", contest!.id)
            : supabase.from("contests").insert(payload);

        const { error: dbErr } = await query;
        if (dbErr) { setError(dbErr.message); setSaving(false); return; }

        setSaving(false);
        onSaved();
    };

    const canEdit = !isEdit || contest?.status === "draft" || contest?.status === "published";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
                    <div>
                        <h2 className="text-lg font-black text-white">
                            {isEdit ? "Edit Contest" : "Create New Contest"}
                        </h2>
                        <p className="text-xs text-[#64748B] mt-0.5">
                            {isEdit ? `Editing: ${contest?.title}` : "Fill in the details and generate questions"}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[#64748B] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1E293B]">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Error banner */}
                    {error && (
                        <div className="flex items-start gap-2.5 bg-[#2d0a0a] border border-[#7f1d1d] text-[#f87171] text-sm px-4 py-3 rounded-xl">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2">
                            Contest Title *
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => update("title", e.target.value)}
                            placeholder="e.g. Python Showdown #1"
                            disabled={!canEdit}
                            className="w-full bg-[#0B1120] border border-[#1E293B] text-white placeholder-[#475569] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all disabled:opacity-50"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2">
                            Description
                        </label>
                        <textarea
                            value={form.description}
                            onChange={e => update("description", e.target.value)}
                            placeholder="Brief description of the contest..."
                            rows={3}
                            disabled={!canEdit}
                            className="w-full bg-[#0B1120] border border-[#1E293B] text-white placeholder-[#475569] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all resize-none disabled:opacity-50"
                        />
                    </div>

                    {/* Topic + difficulty row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2">
                                Topic *
                            </label>
                            <input
                                type="text"
                                value={form.topic}
                                onChange={e => update("topic", e.target.value)}
                                placeholder="e.g. Python Basics"
                                list="topic-suggestions"
                                disabled={!canEdit}
                                className="w-full bg-[#0B1120] border border-[#1E293B] text-white placeholder-[#475569] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all disabled:opacity-50"
                            />
                            <datalist id="topic-suggestions">
                                {TOPICS.map(t => <option key={t} value={t} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2">
                                Difficulty
                            </label>
                            <div className="flex gap-2">
                                {(["easy", "medium", "hard"] as const).map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() => update("difficulty", d)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border capitalize transition-all disabled:opacity-50 ${form.difficulty === d
                                                ? d === "easy" ? "bg-[#052e16] border-[#166534] text-[#4ade80]"
                                                    : d === "medium" ? "bg-[#422006] border-[#92400e] text-[#fbbf24]"
                                                        : "bg-[#2d0a0a] border-[#7f1d1d] text-[#f87171]"
                                                : "bg-[#0B1120] border-[#1E293B] text-[#64748B] hover:border-[#334155]"
                                            }`}
                                    >
                                        {d === "easy" ? "🟢" : d === "medium" ? "🟡" : "🔴"} {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Questions count + Generate */}
                    <div>
                        <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2">
                            Number of Questions — <span className="text-[#6366F1]">{form.questions_count}</span>
                        </label>
                        <input
                            type="range" min={5} max={25} step={5}
                            value={form.questions_count}
                            onChange={e => update("questions_count", parseInt(e.target.value))}
                            disabled={!canEdit || generating}
                            className="w-full accent-[#6366F1] mb-3"
                        />
                        <div className="flex justify-between text-[10px] text-[#475569] mb-3">
                            {[5, 10, 15, 20, 25].map(n => <span key={n}>{n}</span>)}
                        </div>
                        <button
                            type="button"
                            onClick={handleGenerateQuestions}
                            disabled={!canEdit || generating || !form.topic.trim()}
                            className="w-full flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 disabled:pointer-events-none text-white font-bold py-3 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-[#6366F1]/20"
                        >
                            {generating
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating questions…</>
                                : <><Zap className="w-4 h-4" /> {questionPreview ? "Re-generate Questions" : "Generate Questions from Topic"}</>
                            }
                        </button>
                        {questionPreview && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-[#4ade80] bg-[#052e16] border border-[#166534] rounded-lg px-3 py-2">
                                <Trophy className="w-3.5 h-3.5" />
                                {questionPreview.length} questions generated ✓ — ready to save
                            </div>
                        )}
                    </div>

                    {/* Start time + Duration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> Start Time *
                            </label>
                            <input
                                type="datetime-local"
                                value={form.start_time}
                                onChange={e => update("start_time", e.target.value)}
                                disabled={!canEdit}
                                className="w-full bg-[#0B1120] border border-[#1E293B] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all disabled:opacity-50 [color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Duration (minutes)
                            </label>
                            <input
                                type="number"
                                min={5} max={180}
                                value={form.duration_minutes}
                                onChange={e => update("duration_minutes", parseInt(e.target.value) || 30)}
                                disabled={!canEdit}
                                className="w-full bg-[#0B1120] border border-[#1E293B] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all disabled:opacity-50"
                            />
                        </div>
                    </div>

                    {/* Max participants + visibility */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> Max Participants (blank = unlimited)
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={form.max_participants}
                                onChange={e => update("max_participants", e.target.value)}
                                placeholder="Unlimited"
                                disabled={!canEdit}
                                className="w-full bg-[#0B1120] border border-[#1E293B] text-white placeholder-[#475569] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-[#94a3b8] uppercase tracking-widest mb-2">
                                Visibility
                            </label>
                            <div className="flex gap-2">
                                {(["public", "private"] as const).map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() => update("visibility", v)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 ${form.visibility === v
                                                ? "bg-[#1e3a5f] border-[#2563EB] text-[#60a5fa]"
                                                : "bg-[#0B1120] border-[#1E293B] text-[#64748B] hover:border-[#334155]"
                                            }`}
                                    >
                                        {v === "public" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                        {v.charAt(0).toUpperCase() + v.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Q preview table (collapsed, first 3 questions) */}
                    {questionPreview && questionPreview.length > 0 && (
                        <div className="bg-[#0B1120] border border-[#1E293B] rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between">
                                <span className="text-xs font-black text-[#64748B] uppercase tracking-widest">
                                    Question Preview ({questionPreview.length} total)
                                </span>
                            </div>
                            <div className="divide-y divide-[#1E293B]">
                                {questionPreview.slice(0, 3).map((q, i) => (
                                    <div key={q.id} className="px-4 py-3">
                                        <div className="text-xs font-bold text-[#64748B] mb-1">Q{i + 1}</div>
                                        <div className="text-sm text-white">{q.question}</div>
                                    </div>
                                ))}
                                {questionPreview.length > 3 && (
                                    <div className="px-4 py-2.5 text-xs text-[#475569] text-center">
                                        + {questionPreview.length - 3} more questions
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-[#1E293B] flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-[#64748B] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] hover:text-white transition-all"
                    >
                        Cancel
                    </button>
                    <div className="flex-1" />
                    {!isEdit && (
                        <button
                            onClick={() => handleSave(true)}
                            disabled={saving || generating}
                            className="px-5 py-2.5 text-sm font-semibold text-[#94a3b8] border border-[#1E293B] rounded-xl hover:bg-[#1E293B] transition-all disabled:opacity-50"
                        >
                            Save as Draft
                        </button>
                    )}
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving || generating || !canEdit}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl transition-all hover:shadow-lg hover:shadow-[#6366F1]/20"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {isEdit ? "Save Changes" : "Create Contest"}
                    </button>
                </div>
            </div>
        </div>
    );
}
