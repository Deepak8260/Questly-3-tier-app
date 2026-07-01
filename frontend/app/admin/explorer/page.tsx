"use client";
import { useState, useEffect } from "react";
import {
  Search, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Database, Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type TableName = "questly_quiz_attempts" | "profiles";

const TABLES: {
  name: TableName; label: string; desc: string;
  cols: { key: string; label: string; width: string }[];
}[] = [
  {
    name: "questly_quiz_attempts",
    label: "Quiz Attempts", desc: "All quiz attempt records",
    cols: [
      { key: "id",                 label: "ID",          width: "w-28"  },
      { key: "user_id",            label: "User ID",     width: "w-28"  },
      { key: "topic",              label: "Topic",       width: "w-36"  },
      { key: "difficulty",         label: "Level",       width: "w-20"  },
      { key: "score_pct",          label: "Score",       width: "w-16"  },
      { key: "passed",             label: "Passed",      width: "w-16"  },
      { key: "certificate_earned", label: "Cert",        width: "w-14"  },
      { key: "created_at",         label: "Date",        width: "w-36"  },
    ],
  },
  {
    name: "profiles",
    label: "User Profiles", desc: "Registered user profiles",
    cols: [
      { key: "id",         label: "ID",         width: "w-28" },
      { key: "full_name",  label: "Name",       width: "w-36" },
      { key: "email",      label: "Email",      width: "w-48" },
      { key: "role",       label: "Role",       width: "w-24" },
      { key: "created_at", label: "Joined",     width: "w-36" },
    ],
  },
];

const PAGE_SIZE = 15;

function Cell({ col, val }: { col: string; val: unknown }) {
  if (val === null || val === undefined)
    return <span className="text-[#334155] italic text-[10px]">—</span>;

  if (typeof val === "boolean")
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
        val ? "bg-[#10B981]/15 text-[#10B981]" : "bg-[#EF4444]/15 text-[#EF4444]"
      }`}>
        {val ? "true" : "false"}
      </span>
    );

  const str = String(val);

  // Format dates nicely
  if (col === "created_at") {
    try {
      return (
        <span className="text-[10px] text-[#64748B]">
          {new Date(str).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      );
    } catch { /* fall through */ }
  }

  // Score — colour coded
  if (col === "score_pct") {
    const n = Number(val);
    return (
      <span className={`text-xs font-bold ${n >= 70 ? "text-[#10B981]" : "text-[#F59E0B]"}`}>
        {n}%
      </span>
    );
  }

  // Role
  if (col === "role")
    return (
      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
        str === "super_admin"
          ? "bg-[#EF4444]/15 text-[#EF4444]"
          : "bg-[#1E293B] text-[#64748B]"
      }`}>
        {str === "super_admin" ? "Admin" : str}
      </span>
    );

  // Difficulty
  if (col === "difficulty") {
    const colors: Record<string,string> = {
      easy: "text-[#10B981]", medium: "text-[#6366F1]", hard: "text-[#EF4444]"
    };
    return (
      <span className={`text-xs font-semibold capitalize ${colors[str] ?? "text-[#94a3b8]"}`}>
        {str}
      </span>
    );
  }

  // IDs — truncate
  if (col === "id" || col === "user_id")
    return <span className="font-mono text-[10px] text-[#64748B]">{str.slice(0, 13)}…</span>;

  // Long strings
  if (str.length > 40)
    return <span className="text-xs text-[#94a3b8] truncate block">{str.slice(0, 38)}…</span>;

  return <span className="text-xs text-[#94a3b8]">{str}</span>;
}

export default function AdminExplorer() {
  const [activeTable, setActiveTable] = useState<TableName>("questly_quiz_attempts");
  const [rows,    setRows]    = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [count,   setCount]   = useState(0);

  const info = TABLES.find(t => t.name === activeTable)!;

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, count: c } = await supabase
      .from(activeTable)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    setRows(data ?? []);
    setCount(c ?? 0);
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeTable, page]);

  const deleteRow = async (id: string) => {
    if (!confirm("Delete this row permanently?")) return;
    const supabase = createClient();
    await supabase.from(activeTable).delete().eq("id", id);
    setRows(prev => prev.filter(r => r.id !== id));
    setCount(c => c - 1);
  };

  const filtered = search.trim()
    ? rows.filter(r =>
        Object.values(r).some(v =>
          String(v).toLowerCase().includes(search.toLowerCase())
        )
      )
    : rows;

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Database Explorer</h1>
          <p className="text-sm text-[#64748B]">View and manage Supabase tables</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 text-sm text-[#94a3b8] bg-[#1E293B] border border-[#334155] px-4 py-2 rounded-xl hover:border-[#6366F1] transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Table selector */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {TABLES.map(t => (
          <button key={t.name}
            onClick={() => { setActiveTable(t.name); setPage(1); setSearch(""); }}
            className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${
              activeTable === t.name
                ? "bg-[#6366F1]/10 border-[#6366F1] text-white"
                : "bg-[#0F172A] border-[#1E293B] text-[#64748B] hover:border-[#334155]"
            }`}>
            <Database className="w-5 h-5 mt-0.5 flex-shrink-0"
              style={{ color: activeTable === t.name ? "#6366F1" : undefined }} />
            <div className="min-w-0">
              <div className="font-bold text-sm">{t.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
              <div className="text-[9px] mt-1 font-mono opacity-50 truncate">{t.name}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-[#0F172A] border border-[#1E293B] rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#475569] flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search in ${info.label}…`}
            className="bg-transparent text-sm text-white placeholder:text-[#475569] outline-none w-full" />
        </div>
        <span className="text-xs text-[#475569] whitespace-nowrap">{count} total rows</span>
      </div>

      {/* Table — contained, horizontally scrolls only inside this box */}
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]">
                {info.cols.map(col => (
                  <th key={col.key}
                    className={`${col.width} px-4 py-3 text-[9px] font-black text-[#475569] uppercase tracking-widest whitespace-nowrap`}>
                    {col.label}
                  </th>
                ))}
                <th className="w-10 px-3 py-3 text-[9px] font-black text-[#475569] uppercase tracking-widest">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {loading ? (
                <tr>
                  <td colSpan={info.cols.length + 1} className="py-16 text-center text-[#475569]">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={info.cols.length + 1} className="py-12 text-center text-[#475569] text-sm">
                    No rows found
                  </td>
                </tr>
              ) : (
                filtered.map((row, ri) => (
                  <tr key={ri} className="hover:bg-[#1E293B]/40 transition-colors">
                    {info.cols.map(col => (
                      <td key={col.key}
                        className={`${col.width} px-4 py-2.5 max-w-0`}>
                        <div className="truncate">
                          <Cell col={col.key} val={row[col.key]} />
                        </div>
                      </td>
                    ))}
                    <td className="w-10 px-3 py-2.5">
                      <button
                        onClick={() => deleteRow(String(row.id))}
                        title="Delete row"
                        className="p-1 rounded text-[#475569] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#1E293B] text-xs text-[#475569]">
            <span>Page {page} of {pages} · {count} total rows</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-[#1E293B] text-[#94a3b8] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-[#1E293B] text-[#94a3b8] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
