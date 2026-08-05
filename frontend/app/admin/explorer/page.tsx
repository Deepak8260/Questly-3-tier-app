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
    return <span className="text-[#8C8B82] italic text-xs">—</span>;

  if (typeof val === "boolean")
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 border ${
        val ? "bg-[#E9F1E9] dark:bg-[#1A2A1D] border-[#2F6B3A] text-[#2F6B3A] dark:text-[#7EBA88]" : "bg-[#F5E7E4] dark:bg-[#2B1512] border-[#8C2E24] text-[#8C2E24] dark:text-[#D08A7E]"
      }`}>
        {val ? "true" : "false"}
      </span>
    );

  const str = String(val);

  if (col === "created_at") {
    try {
      return (
        <span className="text-xs text-[#8C8B82]">
          {new Date(str).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </span>
      );
    } catch { /* fall through */ }
  }

  if (col === "score_pct") {
    const n = Number(val);
    return (
      <span className={`text-sm font-semibold ${n >= 70 ? "text-[#2F6B3A] dark:text-[#7EBA88]" : "text-[#93670F] dark:text-[#D4A94A]"}`}>
        {n}%
      </span>
    );
  }

  if (col === "role")
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 border ${
        str === "super_admin"
          ? "bg-[#F5E7E4] dark:bg-[#2B1512] text-[#8C2E24] dark:text-[#D08A7E] border-[#E0B8AF] dark:border-[#4A2A24]"
          : "bg-[#FAFAF8] dark:bg-[#14140F] text-[#5B5A52] dark:text-[#ABA99C] border-[#DEDCD3] dark:border-[#35352C]"
      }`}>
        {str === "super_admin" ? "Admin" : str}
      </span>
    );

  if (col === "difficulty") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 border border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] capitalize">
        {str}
      </span>
    );
  }

  if (col === "id" || col === "user_id")
    return <span className="font-mono text-xs text-[#8C8B82]">{str.slice(0, 12)}…</span>;

  return <span className="text-xs text-[#1B1B18] dark:text-[#F2F1EA] truncate block">{str}</span>;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Database Explorer</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">View and manage Supabase tables</p>
        </div>
        <button onClick={load} title="Refresh" className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table selector */}
      <div className="grid grid-cols-2 gap-4">
        {TABLES.map(t => (
          <button key={t.name}
            onClick={() => { setActiveTable(t.name); setPage(1); setSearch(""); }}
            className={`flex items-start gap-3 p-4 border transition-colors text-left ${
              activeTable === t.name
                ? "bg-[#F3E7E9] dark:bg-[#2E1A20] border-[#6B2737] dark:border-[#B5677A] text-[#6B2737] dark:text-[#B5677A]"
                : "bg-white dark:bg-[#1C1C16] border-[#DEDCD3] dark:border-[#35352C] text-[#5B5A52] dark:text-[#ABA99C] hover:text-[#1B1B18] dark:hover:text-[#F2F1EA]"
            }`}>
            <Database className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#6B2737] dark:text-[#B5677A]" />
            <div className="min-w-0">
              <div className="font-medium text-sm text-[#1B1B18] dark:text-[#F2F1EA]">{t.label}</div>
              <div className="text-xs text-[#8C8B82] mt-0.5">{t.desc}</div>
              <div className="text-[10px] mt-1 font-mono text-[#8C8B82] truncate">{t.name}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] px-5 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] px-3 py-2">
          <Search className="w-3.5 h-3.5 text-[#8C8B82] flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search in ${info.label}…`}
            className="bg-transparent text-sm text-[#1B1B18] dark:text-[#F2F1EA] placeholder:text-[#8C8B82] outline-none w-full" />
        </div>
        <span className="text-xs text-[#8C8B82] whitespace-nowrap">{count} total rows</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F]">
                {info.cols.map(col => (
                  <th key={col.key}
                    className={`${col.width} px-4 py-3 text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest whitespace-nowrap`}>
                    {col.label}
                  </th>
                ))}
                <th className="w-10 px-3 py-3 text-[10px] font-semibold text-[#8C8B82] uppercase tracking-widest">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE8E1] dark:divide-[#262620]">
              {loading ? (
                <tr>
                  <td colSpan={info.cols.length + 1} className="py-16 text-center text-[#8C8B82]">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={info.cols.length + 1} className="py-12 text-center text-[#8C8B82] text-sm">
                    No rows found
                  </td>
                </tr>
              ) : (
                filtered.map((row, ri) => (
                  <tr key={ri} className="hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
                    {info.cols.map(col => (
                      <td key={col.key}
                        className={`${col.width} px-4 py-3 max-w-0`}>
                        <div className="truncate">
                          <Cell col={col.key} val={row[col.key]} />
                        </div>
                      </td>
                    ))}
                    <td className="w-10 px-3 py-3">
                      <button
                        onClick={() => deleteRow(String(row.id))}
                        title="Delete row"
                        className="p-1 text-[#8C8B82] hover:text-[#8C2E24] transition-colors">
                        <Trash2 className="w-4 h-4" />
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#DEDCD3] dark:border-[#35352C] bg-[#FAFAF8] dark:bg-[#14140F] text-xs text-[#5B5A52] dark:text-[#ABA99C]">
            <span>Page {page} of {pages} · {count} total rows</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 border border-[#DEDCD3] dark:border-[#35352C] disabled:opacity-30 hover:bg-white dark:hover:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
