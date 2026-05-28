import { NextResponse } from "next/server";
import { getSupabaseAdmin, verifySuperAdmin } from "@/lib/admin-auth";

interface Profile {
  email: string;
  name: string;
  company: string;
  role: string;
  what_building: string | null;
  looking_for: string[];
  can_offer: string[];
}

interface MatchResult {
  matchEmail: string;
  score: number;
  rank: number;
  linkedin: string | null;
}

function computeMatchesForProfile(
  me: Profile,
  others: Profile[],
  lumaMap: Map<string, string | null>
): MatchResult[] {
  const scored: { email: string; score: number; linkedin: string | null }[] = [];

  for (const other of others) {
    if (other.email === me.email) continue;
    // Same company filter
    if (other.company.toLowerCase().trim() === me.company.toLowerCase().trim()) continue;

    let score = 0;

    const theyOfferWhatINeed = me.looking_for.filter((l) =>
      other.can_offer.includes(l)
    );
    if (theyOfferWhatINeed.length > 0) {
      score += theyOfferWhatINeed.length * 3;
    }

    const iOfferWhatTheyNeed = other.looking_for.filter((l) =>
      me.can_offer.includes(l)
    );
    if (iOfferWhatTheyNeed.length > 0) {
      score += iOfferWhatTheyNeed.length * 2;
    }

    // Mutual benefit bonus
    if (theyOfferWhatINeed.length > 0 && iOfferWhatTheyNeed.length > 0) {
      score += 5;
    }

    // Category diversity bonus
    const uniqueCategories = new Set([
      ...theyOfferWhatINeed,
      ...iOfferWhatTheyNeed,
    ]);
    score += uniqueCategories.size;

    if (score === 0) continue;

    scored.push({
      email: other.email,
      score,
      linkedin: lumaMap.get(other.email) ?? null,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map((s, i) => ({
    matchEmail: s.email,
    score: s.score,
    rank: i + 1,
    linkedin: s.linkedin,
  }));
}

// POST /api/event-compute-matches
// Body: { adminKey, eventId }
// Computes matches ONLY for the specified event
export async function POST(request: Request) {
  const auth = await verifySuperAdmin(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { eventId } = body;

  if (!eventId) {
    return NextResponse.json(
      { error: "eventId is required" },
      { status: 400 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Verify event exists
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, slug, name")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Fetch profiles ONLY for this event
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("event_id", eventId);

  if (profilesError || !profiles || profiles.length < 2) {
    return NextResponse.json(
      {
        error: "Not enough profiles for matching",
        count: profiles?.length ?? 0,
        event: event.name,
      },
      { status: 200 }
    );
  }

  // Fetch luma_list for LinkedIn URLs (only this event)
  const { data: lumaList } = await supabaseAdmin
    .from("luma_list")
    .select("email, linkedin_url")
    .eq("event_id", eventId);

  const lumaMap = new Map<string, string | null>();
  if (lumaList) {
    for (const entry of lumaList as {
      email: string;
      linkedin_url: string | null;
    }[]) {
      lumaMap.set(entry.email, entry.linkedin_url);
    }
  }

  // Delete previous matches ONLY for this event
  await supabaseAdmin.from("matches").delete().eq("event_id", eventId);

  // Compute and store matches for every profile in this event
  let totalMatches = 0;

  for (const profile of profiles as Profile[]) {
    const matches = computeMatchesForProfile(
      profile,
      profiles as Profile[],
      lumaMap
    );

    if (matches.length === 0) continue;

    const rows = matches.map((m) => ({
      profile_email: profile.email,
      match_email: m.matchEmail,
      match_rank: m.rank,
      score: m.score,
      linkedin_url: m.linkedin,
      event_id: eventId,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("matches")
      .insert(rows);
    if (insertError) {
      console.error(
        `Error inserting matches for ${profile.email}:`,
        insertError.message
      );
    } else {
      totalMatches += matches.length;
    }
  }

  return NextResponse.json({
    status: "computed",
    event: event.name,
    eventId,
    profileCount: profiles.length,
    totalMatches,
  });
}
