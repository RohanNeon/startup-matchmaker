import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    if (theyOfferWhatINeed.length > 0 && iOfferWhatTheyNeed.length > 0) {
      score += 2;
    }

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

export async function POST(request: Request) {
  const body = await request.json();
  const { adminKey } = body;

  if (adminKey !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Fetch all profiles (only people who filled the form)
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("*");

  if (profilesError || !profiles || profiles.length < 2) {
    return NextResponse.json(
      { error: "Not enough profiles for matching", count: profiles?.length ?? 0 },
      { status: 200 }
    );
  }

  // Fetch luma_list for LinkedIn URLs
  const { data: lumaList } = await supabaseAdmin
    .from("luma_list")
    .select("email, linkedin_url");

  const lumaMap = new Map<string, string | null>();
  if (lumaList) {
    for (const entry of lumaList as { email: string; linkedin_url: string | null }[]) {
      lumaMap.set(entry.email, entry.linkedin_url);
    }
  }

  // Clear previous matches
  await supabaseAdmin.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Compute and store matches for every profile
  let totalMatches = 0;

  for (const profile of profiles as Profile[]) {
    const matches = computeMatchesForProfile(profile, profiles as Profile[], lumaMap);

    if (matches.length === 0) continue;

    const rows = matches.map((m) => ({
      profile_email: profile.email,
      match_email: m.matchEmail,
      match_rank: m.rank,
      score: m.score,
      linkedin_url: m.linkedin,
    }));

    const { error: insertError } = await supabaseAdmin.from("matches").insert(rows);
    if (insertError) {
      console.error(`Error inserting matches for ${profile.email}:`, insertError.message);
    } else {
      totalMatches += matches.length;
    }
  }

  return NextResponse.json({
    status: "computed",
    profileCount: profiles.length,
    totalMatches,
  });
}
