import { NextRequest, NextResponse } from "next/server";
import { generateQuiz } from "@/lib/quiz-generator";

export async function POST(req: NextRequest) {
  try {
    const { topic, difficulty, numQuestions, questionType, aiMode } = await req.json();

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const quiz = await generateQuiz({ topic, difficulty, numQuestions, questionType, aiMode });
    return NextResponse.json({ quiz });
  } catch (err) {
    console.error("Quiz generation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
