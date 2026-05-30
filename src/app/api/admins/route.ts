import { NextResponse } from "next/server";
import { getSupabaseAdmin, verifySuperAdmin } from "@/lib/admin-auth";

// GET /api/admins - list all admins (super admin only)
export async function GET(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("admins")
    .select("email, added_by, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    // Table might not exist yet
    return NextResponse.json({ admins: [], tableExists: false });
  }

  return NextResponse.json({ admins: data || [], tableExists: true });
}

// POST /api/admins - add an admin (super admin only)
export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { email } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (domain !== "neon.fund") {
    return NextResponse.json(
      { error: "Only @neon.fund emails can be added as admin" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("admins")
    .upsert([{ email: email.toLowerCase(), added_by: auth.email }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ admin: data });
}

// DELETE /api/admins - remove an admin (super admin only)
export async function DELETE(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  // Prevent removing yourself
  if (email.toLowerCase() === auth.email.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot remove yourself as admin" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("admins")
    .delete()
    .eq("email", email.toLowerCase());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
