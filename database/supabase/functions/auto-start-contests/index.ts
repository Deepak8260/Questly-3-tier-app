/**
 * Supabase Edge Function: auto-start-contests
 *
 * This function is invoked every minute by a pg_cron job registered in the
 * migration SQL. Its job is simple: transition any 'published' contest whose
 * start_time has passed to 'live'.
 *
 * Deploy command:
 *   supabase functions deploy auto-start-contests --no-verify-jwt
 *
 * Then register the cron (if not using the SQL approach):
 *   supabase functions schedule auto-start-contests "* * * * *"
 *
 * Environment variables required (set in Supabase dashboard):
 *   SUPABASE_URL          — your project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface UpdateResult {
    count: number;
    ids: string[];
}

Deno.serve(async (_req: Request): Promise<Response> => {
    try {
        // Initialize Supabase with the service role key so RLS is bypassed.
        // This function only runs server-side and is not accessible to users.
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false } }
        );

        const now = new Date().toISOString();

        // Step 1: Find all published contests whose start_time has passed
        const { data: toStart, error: fetchErr } = await supabase
            .from("contests")
            .select("id, title, start_time")
            .eq("status", "published")
            .lte("start_time", now);

        if (fetchErr) {
            console.error("[auto-start-contests] Fetch error:", fetchErr.message);
            return new Response(
                JSON.stringify({ error: fetchErr.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!toStart || toStart.length === 0) {
            return new Response(
                JSON.stringify({ message: "No contests to start.", started: 0 }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // Step 2: Transition them all to 'live' in a single UPDATE
        const ids = toStart.map((c) => c.id);
        const { error: updateErr } = await supabase
            .from("contests")
            .update({ status: "live" })
            .in("id", ids);

        if (updateErr) {
            console.error("[auto-start-contests] Update error:", updateErr.message);
            return new Response(
                JSON.stringify({ error: updateErr.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const result: UpdateResult = { count: ids.length, ids };
        console.log(
            `[auto-start-contests] Started ${ids.length} contest(s):`,
            toStart.map((c) => `${c.title} (${c.id})`).join(", ")
        );

        return new Response(
            JSON.stringify({ message: `Started ${ids.length} contest(s).`, ...result }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[auto-start-contests] Unexpected error:", message);
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
