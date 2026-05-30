import { NextResponse } from "next/server";
import { getSupabaseAdmin, verifySuperAdmin } from "@/lib/admin-auth";

// POST /api/admins/verify-otp — verify OTP and add as admin
export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { email, code } = body;

  if (!email || !code) {
    return NextResponse.json({ error: "email and code are required" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Look up OTP
  const { data: otpRecord, error: fetchErr } = await supabaseAdmin
    .from("admin_otps")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (fetchErr || !otpRecord) {
    return NextResponse.json({ error: "No verification code found. Send a new one." }, { status: 400 });
  }

  // Check expiry
  if (new Date(otpRecord.expires_at) < new Date()) {
    // Clean up expired OTP
    await supabaseAdmin.from("admin_otps").delete().eq("email", email.toLowerCase());
    return NextResponse.json({ error: "Code expired. Send a new one." }, { status: 400 });
  }

  // Check code
  if (otpRecord.code !== code.trim()) {
    return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 400 });
  }

  // OTP verified — add to admins table
  const { error: insertErr } = await supabaseAdmin
    .from("admins")
    .upsert([{ email: email.toLowerCase(), added_by: auth.email }]);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Clean up OTP
  await supabaseAdmin.from("admin_otps").delete().eq("email", email.toLowerCase());

  return NextResponse.json({ verified: true, email: email.toLowerCase() });
}
