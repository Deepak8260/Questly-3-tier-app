import type { QuizQuestion, GeneratedQuiz } from "./quiz";

export async function generateQuiz({
  topic,
  difficulty,
  numQuestions,
  questionType,
  aiMode,
}: {
  topic: string;
  difficulty: string;
  numQuestions: number;
  questionType: string;
  aiMode: string;
}): Promise<GeneratedQuiz> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI service not configured");
  }

  // Build prompt based on questionType
  const typeInstruction =
    questionType === "truefalse"
      ? 'Generate True/False questions. For each question, options MUST be exactly ["True", "False"] with 2 empty strings ["True","False","",""]. correctIndex must be 0 (True) or 1 (False).'
      : questionType === "mixed"
      ? 'Mix MCQ and True/False questions. For True/False questions use options ["True","False","",""], for MCQ use 4 distinct answer options.'
      : "Generate Multiple Choice Questions (MCQ) with exactly 4 distinct answer options each.";

  const difficultyGuide =
    difficulty === "easy"
      ? "beginner-friendly, straightforward concepts"
      : difficulty === "hard"
      ? "advanced, nuanced, expert-level concepts"
      : "intermediate, moderately challenging concepts";

  const isCodeTopic = /python|javascript|java|c\+\+|typescript|sql|coding|programming|algorithm|data structure|react|node|html|css|bash|rust|go|kotlin|swift/i.test(topic);

  const prompt = "You are a professional quiz generator. Generate exactly " + numQuestions + " quiz questions about: \"" + topic + "\".\n\nDifficulty: " + difficulty + " (" + difficultyGuide + ")\n" + typeInstruction + "\nAI Mode: " + aiMode + "\n\nCRITICAL: Respond ONLY with a valid JSON object. No markdown, no explanation.\n\nJSON format:\n{\n  \"questions\": [\n    {\n      \"question\": \"Clear, specific question text\",\n      \"code\": \"optional_code_snippet_here_or_empty_string\",\n      \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],\n      \"correctIndex\": 0,\n      \"explanation\": \"Brief explanation\"\n    }\n  ]\n}\n\nRules:\n- correctIndex is 0-based (0=first option, 1=second, etc.)\n- Each question must be unique\n- Explanations must be concise\n- Do NOT include the correct answer text in the question itself\n- Generate exactly " + numQuestions + " questions\n" + (isCodeTopic ? "- For programming/code questions: put the code snippet in the \"code\" field, leave empty string if no code needed\n- Write question text naturally referring to \"the code above\" or \"the following code\"" : '- Set "code" to empty string for all questions');

  // Try models in priority order
  const MODELS = ["gemini-2.5-flash"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let geminiData: any = null;
  let lastError = "";

  for (const model of MODELS) {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (geminiRes.ok) {
      geminiData = await geminiRes.json();
      break;
    } else {
      const errBody = await geminiRes.text();
      lastError = `Model ${model} → HTTP ${geminiRes.status}: ${errBody}`;
      console.error("Gemini attempt failed:", lastError);
    }
  }

  if (!geminiData) {
    console.error("All Gemini models failed. Last error:", lastError);
    throw new Error("AI generation failed. Please try again.");
  }

  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip any markdown code block wrappers if Gemini adds them
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: { questions: Omit<QuizQuestion, "id">[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Gemini response:", cleaned);
    throw new Error("Failed to parse AI response. Please try again.");
  }

  if (!Array.isArray(parsed?.questions) || parsed.questions.length === 0) {
    throw new Error("AI returned no questions. Please try again.");
  }

  // Normalize and validate each question
  const questions: QuizQuestion[] = parsed.questions.slice(0, numQuestions).map((q, i) => ({
    id: `q${i + 1}`,
    question: q.question ?? "Question unavailable",
    code: typeof q.code === "string" && q.code.trim() ? q.code.trim() : undefined,
    options: Array.isArray(q.options) && q.options.length >= 2
      ? q.options.slice(0, 4)
      : ["True", "False", "", ""],
    correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
    explanation: q.explanation ?? "",
  }));

  const quiz: GeneratedQuiz = {
    id: `quiz_${Date.now()}`,
    topic,
    difficulty,
    questionType,
    questions,
    createdAt: new Date().toISOString(),
  };

  return quiz;
}
