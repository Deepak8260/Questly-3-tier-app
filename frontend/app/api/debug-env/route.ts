import { NextResponse } from "next/server";

// Kept as a harmless health-style check. This intentionally does NOT
// return env var names/values anymore — the previous version leaked
// the full list of process.env keys and whether secrets were set,
// which is not something to expose over an unauthenticated route.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
