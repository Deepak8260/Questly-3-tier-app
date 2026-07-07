import express, { Request, Response } from "express";
import { generateQuiz } from "../services/quiz-generator";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Generate quiz
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { topic, difficulty, numQuestions, questionType, aiMode } = req.body;
    if (!topic?.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const quiz = await generateQuiz({ topic, difficulty, numQuestions, questionType, aiMode });
    res.json({ quiz });
  } catch (err) {
    console.error("Quiz generation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save attempt
router.post("/save-attempt", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Auto-upsert profile
    // Note: In a real app, we'd use proper auth here, but let's approximate
    const { data: authData } = await supabase.auth.getUser(req.headers.authorization?.replace("Bearer ", ""));
    const userId = authData.user?.id || null;

    const fullName =
      (authData.user?.user_metadata?.full_name as string) ||
      (authData.user?.user_metadata?.name as string) ||
      authData.user?.email?.split("@")[0] ||
      "Unknown";

    if (userId) {
      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email: authData.user?.email || ""
      });
    }

    // Insert quiz attempt
    const { data, error } = await supabase
      .from("questly_quiz_attempts")
      .insert({
        user_id: userId,
        topic: body.topic || "Unknown",
        difficulty: body.difficulty || "medium",
        question_type: body.question_type || body.questionType || "mcq",
        total_questions: body.total_questions || body.totalQuestions || 0,
        correct_answers: body.correct_answers || body.correctAnswers || 0,
        score_pct: body.score_pct || body.scorePct || 0,
        time_taken_secs: body.time_taken_secs || body.timeTakenSecs || 0,
        passed: body.passed || false,
        certificate_earned: body.certificate_earned || body.certificateEarned || false,
        questions_data: body.questions_data || body.questionsData || null
      })
      .select()
      .single();

    if (error) {
      console.error("[save-attempt] Insert error:", error);
      return res.status(500).json({
        error: error.message,
        hint: error.hint,
        code: error.code
      });
    }

    console.log("[save-attempt] ✅ Saved:", data.id);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[save-attempt] Unexpected:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Init DB
router.post("/init-db", async (req: Request, res: Response) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const migrations = [
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS topic text",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS difficulty text",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS question_type text",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS total_questions int",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS correct_answers int",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS score_pct int",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS time_taken_secs int",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS passed boolean",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS certificate_earned boolean",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS user_id uuid",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS created_at timestamptz default now()",
      "ALTER TABLE questly_quiz_attempts ADD COLUMN IF NOT EXISTS questions_data jsonb"
    ];

    const errors: string[] = [];
    for (const sql of migrations) {
      const { error } = await supabase.rpc("exec_sql", { sql_query: sql }).single();
      if (error && !error.message.includes("already exists")) {
        errors.push(error.message);
      }
    }

    res.json({ ok: true, errors });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
