"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Attempt { score_pct: number; passed: boolean; certificate_earned: boolean; created_at: string; difficulty: string; topic: string; time_taken_secs: number; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DIFF_COLOR: Record<string,string> = { easy:"#10B981", medium:"#6366F1", hard:"#EF4444" };
const SCORE_BUCKETS = ["0-20","21-40","41-60","61-70","71-80","81-90","91-100"];

function Bar({ label, val, max, color }: { label:string; val:number; max:number; color:string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-right text-xs text-[#8C8B82] shrink-0 font-medium">{label}</div>
      <div className="flex-1 h-5 bg-[#FAFAF8] dark:bg-[#14140F] border border-[#DEDCD3] dark:border-[#35352C] overflow-hidden">
        <div className="h-full transition-all duration-700 flex items-center px-2"
          style={{ width: `${max ? (val/max)*100 : 0}%`, backgroundColor: color }}>
          {val > 0 && <span className="text-[9px] font-semibold text-white">{val}</span>}
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("questly_quiz_attempts").select("score_pct,passed,certificate_earned,created_at,difficulty,topic,time_taken_secs").order("created_at",{ascending:true});
    setAttempts(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-24 text-[#8C8B82]"><Loader2 className="w-5 h-5 animate-spin mr-2"/>Loading analytics…</div>;

  const total = attempts.length;
  const passed = attempts.filter(a=>a.passed).length;
  const certs  = attempts.filter(a=>a.certificate_earned).length;
  const avg    = total ? Math.round(attempts.reduce((s,a)=>s+a.score_pct,0)/total) : 0;

  // Score distribution
  const buckets = SCORE_BUCKETS.map((b,i) => {
    const [lo,hi] = b.split("-").map(Number);
    return { label: b, count: attempts.filter(a => a.score_pct >= lo && a.score_pct <= hi).length };
  });
  const maxBucket = Math.max(...buckets.map(b=>b.count), 1);

  // Difficulty breakdown
  const diffs = ["easy","medium","hard"].map(d => ({
    d, count: attempts.filter(a=>a.difficulty?.toLowerCase()===d).length,
    avg: attempts.filter(a=>a.difficulty?.toLowerCase()===d).length > 0
      ? Math.round(attempts.filter(a=>a.difficulty?.toLowerCase()===d).reduce((s,a)=>s+a.score_pct,0) / attempts.filter(a=>a.difficulty?.toLowerCase()===d).length)
      : 0
  }));

  // Top topics by attempts
  const topicMap: Record<string,{count:number;totalScore:number}> = {};
  attempts.forEach(a => {
    if (!topicMap[a.topic]) topicMap[a.topic]={count:0,totalScore:0};
    topicMap[a.topic].count++;
    topicMap[a.topic].totalScore += a.score_pct;
  });
  const topTopics = Object.entries(topicMap).sort((a,b)=>b[1].count-a[1].count).slice(0,8).map(([t,v])=>({ t, count: v.count, avg: Math.round(v.totalScore/v.count) }));
  const maxTopic = Math.max(...topTopics.map(t=>t.count),1);

  // Timeline: attempts per day (last 14 days)
  const days: Record<string,number> = {};
  for (let i=13;i>=0;i--) {
    const d = new Date(Date.now()-i*86400_000);
    days[fmtDate(d.toISOString())] = 0;
  }
  attempts.forEach(a => {
    const k = fmtDate(a.created_at);
    if (k in days) days[k]++;
  });
  const timeline = Object.entries(days);
  const maxDay = Math.max(...timeline.map(([,v])=>v),1);

  // Trend
  const half = Math.floor(attempts.length/2);
  const recent = attempts.slice(half).reduce((s,a)=>s+a.score_pct,0)/(attempts.length-half||1);
  const prev   = attempts.slice(0,half).reduce((s,a)=>s+a.score_pct,0)/(half||1);
  const trend  = recent - prev;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">Analytics</h1>
          <p className="text-sm text-[#5B5A52] dark:text-[#ABA99C]">Platform-wide performance data</p>
        </div>
        <button onClick={load} title="Refresh" className="p-2.5 border border-[#DEDCD3] dark:border-[#35352C] bg-white dark:bg-[#1C1C16] text-[#5B5A52] dark:text-[#ABA99C] hover:bg-[#FAFAF8] dark:hover:bg-[#262620] transition-colors">
          <RefreshCw className="w-4 h-4"/>
        </button>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-[#DEDCD3] dark:border-[#35352C]">
        {[
          { label:"Total Attempts", value: total },
          { label:"Pass Rate",      value: `${total?Math.round(passed/total*100):0}%` },
          { label:"Avg Score",      value: `${avg}%` },
          { label:"Certs Issued",   value: certs },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1C1C16] border-r border-b border-[#DEDCD3] dark:border-[#35352C] p-5 text-center">
            <div className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">{s.value}</div>
            <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Daily activity bar chart */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
        <h3 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-4">Daily Attempts (Last 14 Days)</h3>
        <div className="flex items-end gap-1.5" style={{height:80}}>
          {timeline.map(([d,v]) => (
            <div key={d} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1B1B18] text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {d}: {v}
              </div>
              <div className="w-full transition-all duration-700"
                style={{height:`${maxDay?(v/maxDay)*72:4}px`, minHeight:4, backgroundColor: v>0?"#6B2737":"#EAE8E1"}}/>
              <div className="text-[9px] text-[#8C8B82] font-medium">{d.split(" ")[0]}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-[#5B5A52] dark:text-[#ABA99C]">
          {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#2F6B3A] dark:text-[#7EBA88]"/> : <TrendingDown className="w-3.5 h-3.5 text-[#8C2E24] dark:text-[#D08A7E]"/>}
          Score trend: <span className={`font-semibold ${trend>=0?"text-[#2F6B3A] dark:text-[#7EBA88]":"text-[#8C2E24] dark:text-[#D08A7E]"}`}>{trend>=0?"+":""}{trend.toFixed(1)}%</span> vs previous period
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Score distribution */}
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
          <h3 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-4">Score Distribution</h3>
          <div className="space-y-2.5">
            {buckets.map(b => (
              <Bar key={b.label} label={b.label+"%"} val={b.count} max={maxBucket}
                color={parseInt(b.label)>=70?"#2F6B3A":parseInt(b.label)>=41?"#93670F":"#8C2E24"}/>
            ))}
          </div>
        </div>

        {/* Top topics */}
        <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
          <h3 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-4">Top Topics by Attempts</h3>
          <div className="space-y-3">
            {topTopics.map(t => (
              <div key={t.t}>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-medium text-[#1B1B18] dark:text-[#F2F1EA] truncate max-w-[60%]">{t.t}</span>
                  <span className="text-[#8C8B82]">{t.count} · {t.avg}% avg</span>
                </div>
                <div className="h-1.5 bg-[#EDECE6] dark:bg-[#262620] overflow-hidden">
                  <div className="h-full bg-[#6B2737] dark:bg-[#B5677A] transition-all duration-700"
                    style={{width:`${(t.count/maxTopic)*100}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Difficulty breakdown */}
      <div className="bg-white dark:bg-[#1C1C16] border border-[#DEDCD3] dark:border-[#35352C] p-5">
        <h3 className="text-xs font-semibold text-[#8C8B82] uppercase tracking-widest mb-4">Performance by Difficulty</h3>
        <div className="grid grid-cols-3 gap-6">
          {diffs.map(d => (
            <div key={d.d} className="text-center">
              <div className="font-heading text-3xl font-medium text-[#1B1B18] dark:text-[#F2F1EA] mb-1">{d.avg}%</div>
              <div className="text-xs font-medium text-[#5B5A52] dark:text-[#ABA99C] capitalize">{d.d}</div>
              <div className="text-xs text-[#8C8B82] mt-0.5">{d.count} attempts</div>
              <div className="mt-3 h-1.5 bg-[#EDECE6] dark:bg-[#262620] overflow-hidden">
                <div className="h-full bg-[#6B2737] dark:bg-[#B5677A]" style={{width:`${d.avg}%`}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
