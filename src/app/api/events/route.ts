import { NextResponse } from "next/server";
import { getSupabaseAdmin, verifySuperAdmin } from "@/lib/admin-auth";

// GET /api/events - list all events (public)
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select("id, slug, name, event_date, location, is_active, image_url, created_at")
    .order("event_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events });
}

// POST /api/events - create a new event (super admin only)
export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { slug, name, event_date, location, description, image_url } = body;

  if (!slug || !name) {
    return NextResponse.json(
      { error: "slug and name are required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  const insertData: Record<string, unknown> = { slug, name, event_date, location };
  if (description) insertData.description = description;
  if (image_url) insertData.image_url = image_url;

  const { data, error } = await supabaseAdmin
    .from("events")
    .insert([insertData])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
