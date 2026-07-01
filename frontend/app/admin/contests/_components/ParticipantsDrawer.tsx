"use client";
import { useEffect, useState } from "react";
import { X, Users, Loader2, Mail, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { ContestParticipant } from "../types";

interface Props {
    contestId: string;
    contestTitle: string;
    onClose: () => void;
}

function relTime(iso: string) {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export default function ParticipantsDrawer({ contestId, contestTitle, onClose }: Props) {
    const [participants, setParticipants] = useState<ContestParticipant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const supabase = createClient();

            // Step 1: Fetch participant rows (admin RLS policy allows this)
            const { data: parts } = await supabase
                .from("contest_participants")
                .select("id, contest_id, user_id, enrolled_at")
                .eq("contest_id", contestId)
                .order("enrolled_at", { ascending: false });

            if (!parts || parts.length === 0) {
                setParticipants([]);
                setLoading(false);
                return;
            }

            // Step 2: Fetch profiles separately for those user_ids
            // (avoids cross-table JOIN being blocked by profiles RLS)
            const userIds = parts.map(p => p.user_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .in("id", userIds);

            const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
            (profiles ?? []).forEach(pr => { profileMap[pr.id] = pr; });

            // Step 3: Merge participants with their profile data
            const merged = parts.map(p => ({
                ...p,
                profiles: profileMap[p.user_id] ?? { full_name: null, email: null },
            }));

            setParticipants(merged as ContestParticipant[]);
            setLoading(false);
        };
        load();
    }, [contestId]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full max-w-sm bg-[#0F172A] border-l border-[#1E293B] flex flex-col h-full shadow-2xl animate-slide-in-right">

                {/* Header */}
                <div className="px-6 py-5 border-b border-[#1E293B] flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-[#6366F1]" />
                            <span className="text-xs font-black text-[#64748B] uppercase tracking-widest">
                                Enrolled Participants
                            </span>
                        </div>
                        <h3 className="text-sm font-bold text-white line-clamp-2">{contestTitle}</h3>
                        {!loading && (
                            <p className="text-xs text-[#64748B] mt-1">{participants.length} enrolled</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#64748B] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1E293B] flex-shrink-0 ml-2"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-[#64748B]">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
                        </div>
                    ) : participants.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <Users className="w-10 h-10 text-[#1E293B] mb-3" />
                            <p className="text-[#64748B] text-sm">No participants enrolled yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#1E293B]">
                            {participants.map((p, idx) => {
                                const name = p.profiles?.full_name ?? "Unknown User";
                                const email = p.profiles?.email ?? "";
                                const initial = name[0]?.toUpperCase() ?? "?";
                                const colors = [
                                    "#6366F1", "#8B5CF6", "#10B981", "#F59E0B",
                                    "#EF4444", "#06B6D4", "#EC4899", "#F97316",
                                ];
                                const color = colors[idx % colors.length];
                                return (
                                    <div key={p.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#1E293B]/50 transition-colors">
                                        <div
                                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                            style={{ backgroundColor: color }}
                                        >
                                            {initial}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-white truncate">{name}</div>
                                            {email && (
                                                <div className="flex items-center gap-1 text-xs text-[#64748B] mt-0.5">
                                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{email}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-[#475569] flex-shrink-0">
                                            <Clock className="w-3 h-3" />
                                            {relTime(p.enrolled_at)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
