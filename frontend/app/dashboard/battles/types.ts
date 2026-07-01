// Shared TypeScript types for the 1v1 Quiz Battle module.

import type { ContestQuestion } from "@/app/admin/contests/types";

export type BattleStatus = "pending" | "accepted" | "live" | "ended" | "declined" | "cancelled";
export type BattleMode = "friend" | "random";
export type BattleDifficulty = "easy" | "medium" | "hard";

export interface QuizBattle {
    id: string;
    player_one: string;
    player_two: string | null;
    topic: string;
    difficulty: BattleDifficulty;
    questions_count: number;
    question_set: ContestQuestion[] | null;
    mode: BattleMode;
    status: BattleStatus;
    winner: string | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
    // Joined from profiles
    player_one_profile?: { full_name: string | null; email: string | null } | null;
    player_two_profile?: { full_name: string | null; email: string | null } | null;
}

export interface BattleResult {
    id: string;
    battle_id: string;
    user_id: string;
    score: number;
    total_questions: number;
    accuracy: number;
    time_taken_seconds: number;
    submitted_at: string;
    // Joined from profiles
    profiles?: { full_name: string | null; email: string | null } | null;
}

export interface BattleAnswer {
    id: string;
    battle_id: string;
    user_id: string;
    question_id: string;
    selected_answer: string;
    is_correct: boolean;
    answered_at: string;
}

// Global battle leaderboard entry (aggregated)
export interface BattleLeaderboardEntry {
    user_id: string;
    full_name: string | null;
    email: string | null;
    total_battles: number;
    battles_won: number;
    win_rate: number;         // 0-100
    avg_accuracy: number;     // 0-100
    avg_time_seconds: number;
    rank: number;
}
