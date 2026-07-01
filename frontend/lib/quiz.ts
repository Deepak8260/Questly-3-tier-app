export interface QuizQuestion {
  id: string;
  question: string;
  code?: string;              // optional code snippet shown below the question
  options: string[];          // always 4 options (even for T/F: ["True","False","",""])
  correctIndex: number;       // 0-3
  explanation: string;
}

export interface GeneratedQuiz {
  id: string;
  topic: string;
  difficulty: string;
  questionType: string;
  questions: QuizQuestion[];
  createdAt: string;
}
