import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createSupabaseServerClient();

    // Verify session server-side
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[save-attempt] Auth error:", authError);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      topic, difficulty, question_type,
      total_questions, correct_answers,
      score_pct, time_taken_secs, passed, certificate_earned,
      questions_data,
    } = body;

    // ── Auto-upsert profile so admin can see this user ──────────────
    // This runs silently — failure won't block the quiz save
    const fullName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email?.split("@")[0] ||
      "Unknown";

    await supabase.from("profiles").upsert(
      {
        id:        user.id,
        full_name: fullName,
        email:     user.email ?? "",
        // Preserve existing role — never overwrite with 'user' if already admin
      },
      {
        onConflict: "id",
        ignoreDuplicates: false,
      }
    ).select("role").single().then(({ data: existingProfile }) => {
      // Only set role if profile is brand new (no existing role)
      // The upsert above doesn't touch role column — safe
    });

    // ── Insert quiz attempt ─────────────────────────────────────────
    const { data, error } = await supabase
      .from("questly_quiz_attempts")
      .insert({
        user_id:            user.id,
        topic:              topic             ?? "Unknown",
        difficulty:         difficulty        ?? "medium",
        question_type:      question_type     ?? "mcq",
        total_questions:    total_questions   ?? 0,
        correct_answers:    correct_answers   ?? 0,
        score_pct:          score_pct         ?? 0,
        time_taken_secs:    time_taken_secs   ?? 0,
        passed:             passed            ?? false,
        certificate_earned: certificate_earned ?? false,
        questions_data:     questions_data    ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[save-attempt] Insert error:", error);
      return NextResponse.json(
        { error: error.message, hint: error.hint, code: error.code },
        { status: 500 }
      );
    }

    console.log("[save-attempt] ✅ Saved:", data.id);
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[save-attempt] Unexpected:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
