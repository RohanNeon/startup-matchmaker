import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/admin-auth";

const LUMA_API = "https://api.lu.ma/discover/get-paginated-events";

// Bangalore coordinates
const GEO = {
  latitude: "12.9716",
  longitude: "77.5946",
  place_id: "ChIJbU60yXAWrjsR4E9-UejD3_g",
};

// Keywords to filter relevant events (matched against event name, lowercase)
const KEYWORDS = [
  "ai",
  "startup",
  "founder",
  "vc",
  "venture",
  "investor",
  "agentic",
  "saas",
  "tech",
  "devops",
  "infra",
  "cloud",
  "product",
  "growth",
  "seed",
  "series",
  "accelerator",
  "incubator",
  "pitch",
  "demo day",
  "hackathon",
  "builder",
  "engineering",
  "deeptech",
  "fintech",
  "cybersecurity",
  "open source",
  "llm",
  "genai",
  "machine learning",
  "data science",
  "agent",
  "mcp",
  "web3",
  "blockchain",
  "crypto",
];

interface LumaEvent {
  name: string;
  url: string;
  start_at: string;
  end_at: string | null;
  cover_url: string | null;
  geo_address_info?: {
    city?: string;
    short_address?: string;
  };
}

interface LumaEntry {
  event: LumaEvent;
  hosts?: Array<{
    name?: string;
    avatar_url?: string;
  }>;
}

interface TrendingEvent {
  id: string;
  name: string;
  url: string;
  start_at: string;
  city: string | null;
  host_name: string | null;
  host_avatar: string | null;
  cover_url: string | null;
}

// Cache duration: 20 hours (cron refreshes once daily at 8am IST, Hobby plan limit)
const CACHE_HOURS = 20;

// GET /api/trending-events — return cached trending events
export async function GET() {
  const supabase = getSupabaseAdmin();

  // Check cache freshness
  const { data: cached } = await supabase
    .from("trending_events_cache")
    .select("events, updated_at")
    .eq("id", "bangalore")
    .single();

  if (cached) {
    const age =
      Date.now() - new Date(cached.updated_at).getTime();
    const maxAge = CACHE_HOURS * 60 * 60 * 1000;

    if (age < maxAge) {
      return NextResponse.json({
        events: cached.events as TrendingEvent[],
        cached: true,
        updated_at: cached.updated_at,
      });
    }
  }

  // Cache is stale or missing — fetch fresh
  const events = await fetchFromLuma();

  if (events.length > 0) {
    await supabase.from("trending_events_cache").upsert(
      {
        id: "bangalore",
        events,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  }

  return NextResponse.json({
    events,
    cached: false,
    updated_at: new Date().toISOString(),
  });
}

// POST /api/trending-events — force refresh cache (called by cron)
export async function POST() {
  const events = await fetchFromLuma();
  const supabase = getSupabaseAdmin();

  await supabase.from("trending_events_cache").upsert(
    {
      id: "bangalore",
      events,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return NextResponse.json({
    refreshed: true,
    count: events.length,
    updated_at: new Date().toISOString(),
  });
}

async function fetchFromLuma(): Promise<TrendingEvent[]> {
  try {
    const params = new URLSearchParams({
      pagination_limit: "50",
      geo_latitude: GEO.latitude,
      geo_longitude: GEO.longitude,
      geo_place_id: GEO.place_id,
    });

    const res = await fetch(`${LUMA_API}?${params}`, {
      headers: {
        "x-luma-web-url": "https://lu.ma/discover",
        accept: "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const entries: LumaEntry[] = data.entries || [];

    // Filter by keywords in event name
    const filtered = entries.filter((entry) => {
      const name = entry.event.name.toLowerCase();
      return KEYWORDS.some((kw) => name.includes(kw));
    });

    // Only future events
    const now = new Date().toISOString();
    const upcoming = filtered.filter(
      (entry) => entry.event.start_at > now
    );

    // Map to our format, take top 8
    return upcoming.slice(0, 8).map((entry, i) => ({
      id: `luma-${i}-${entry.event.url}`,
      name: entry.event.name,
      url: `https://lu.ma/${entry.event.url}`,
      start_at: entry.event.start_at,
      city: entry.event.geo_address_info?.city || null,
      host_name: entry.hosts?.[0]?.name || null,
      host_avatar: entry.hosts?.[0]?.avatar_url || null,
      cover_url: entry.event.cover_url || null,
    }));
  } catch (err) {
    console.error("Failed to fetch from Luma:", err);
    return [];
  }
}
