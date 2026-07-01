import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    // Safely add any columns that may be missing using IF NOT EXISTS
    const migrations = [
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS topic text`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS difficulty text`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS question_type text`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS total_questions int`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS correct_answers int`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS score_pct int`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS time_taken_secs int`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS passed boolean`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS certificate_earned boolean`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS user_id uuid`,
      `ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS created_at timestamptz default now()`,
    ];

    const errors: string[] = [];
    for (const sql of migrations) {
      const { error } = await supabase.rpc("exec_sql", { sql_query: sql }).single();
      if (error && !error.message.includes("already exists")) {
        errors.push(error.message);
      }
    }

    return NextResponse.json({ ok: true, errors });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
