// Shared TypeScript types for the Live Quiz Contest module.
// Used by both admin and user-facing pages.

export type ContestStatus = "draft" | "published" | "live" | "ended" | "cancelled";
export type ContestDifficulty = "easy" | "medium" | "hard";
export type ContestVisibility = "public" | "private";

// Matches the QuizQuestion shape from /api/quiz/generate/route.ts
export interface ContestQuestion {
    id: string;
    question: string;
    code?: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface Contest {
    id: string;
    title: string;
    description: string | null;
    topic: string;
    difficulty: ContestDifficulty;
    questions_count: number;
    start_time: string;        // ISO timestamp
    duration_minutes: number;
    max_participants: number | null;
    visibility: ContestVisibility;
    status: ContestStatus;
    question_set: ContestQuestion[] | null;
    announced_at: string | null;
    created_by: string;
    created_at: string;
    // Joined/computed fields (not persisted)
    participant_count?: number;
}

export interface ContestParticipant {
    id: string;
    contest_id: string;
    user_id: string;
    enrolled_at: string;
    // Joined from profiles
    profiles?: {
        full_name: string | null;
        email: string | null;
    };
}

export interface ContestResult {
    id: string;
    contest_id: string;
    user_id: string;
    score: number;
    total_questions: number;
    accuracy: number;
    time_taken_seconds: number;
    rank: number | null;
    submitted_at: string;
    // Joined from profiles
    profiles?: {
        full_name: string | null;
        email: string | null;
    };
}
