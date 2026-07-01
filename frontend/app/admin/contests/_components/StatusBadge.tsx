import { ContestStatus } from "../types";

const CONFIG: Record<ContestStatus, { label: string; bg: string; text: string; dot: string }> = {
    draft: { label: "Draft", bg: "#1E293B", text: "#94a3b8", dot: "#64748B" },
    published: { label: "Published", bg: "#1e3a5f", text: "#60a5fa", dot: "#3B82F6" },
    live: { label: "Live", bg: "#052e16", text: "#4ade80", dot: "#22C55E" },
    ended: { label: "Ended", bg: "#1E293B", text: "#64748B", dot: "#475569" },
    cancelled: { label: "Cancelled", bg: "#2d0a0a", text: "#f87171", dot: "#EF4444" },
};

export default function StatusBadge({ status }: { status: ContestStatus }) {
    const cfg = CONFIG[status] ?? CONFIG.draft;
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: cfg.bg, color: cfg.text }}
        >
            <span
                className={`w-1.5 h-1.5 rounded-full ${status === "live" ? "animate-pulse" : ""}`}
                style={{ backgroundColor: cfg.dot }}
            />
            {cfg.label}
        </span>
    );
}
