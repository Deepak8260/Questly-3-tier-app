import { getPublicEnv } from "./env";

export const API_BASE_URL = getPublicEnv("NEXT_PUBLIC_API_BASE_URL");
