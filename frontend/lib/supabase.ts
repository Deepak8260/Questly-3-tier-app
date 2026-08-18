import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "./env";

export function createClient() {
  return createBrowserClient(
    getPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
