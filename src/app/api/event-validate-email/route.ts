import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/event-validate-email
// Body: { email, eventId }
// Checks email against luma_list for a specific event
export async function POST(request: Request) {
  const body = await request.json();
  const { email, eventId } = body;

  if (!email || !eventId) {
    return NextResponse.json(
      { error: "email and eventId are required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email is on the guest list for this specific event
  const { data: lumaEntry } = await supabaseAdmin
    .from("luma_list")
    .select("email")
    .eq("email", normalizedEmail)
    .eq("event_id", eventId)
    .single();

  if (!lumaEntry) {
    return NextResponse.json({
      valid: false,
      reason: "not_on_list",
      message:
        "This email is not on the guest list. Please use the email you registered with on Luma.",
    });
  }

  // Check if profile already exists for this event
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("email", normalizedEmail)
    .eq("event_id", eventId)
    .single();

  if (existingProfile) {
    return NextResponse.json({
      valid: false,
      reason: "already_registered",
      message:
        "This email has already been registered. You'll receive your matches soon!",
    });
  }

  return NextResponse.json({ valid: true });
}
