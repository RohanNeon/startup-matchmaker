import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/admin-auth";

const LUMA_API = "https://api.lu.ma/discover/get-paginated-events";

// Regions to fetch
const REGIONS: Record<string, { label: string; latitude: string; longitude: string; place_id: string }> = {
  bangalore: {
    label: "Bangalore",
    latitude: "12.9716",
    longitude: "77.5946",
    place_id: "ChIJbU60yXAWrjsR4E9-UejD3_g",
  },
  bay_area: {
    label: "Bay Area",
    latitude: "37.7749",
    longitude: "-122.4194",
    place_id: "ChIJIQBpAG2ahYAR_6128GcTUEo",
  },
  singapore: {
    label: "Singapore",
    latitude: "1.3521",
    longitude: "103.8198",
    place_id: "ChIJdZOLiiMR2jERxPWrUs9peIg",
  },
};

// Keywords to filter relevant events (matched against event name with word boundaries)
const KEYWORDS = [
  "ai", "startup", "founder", "vc", "venture", "investor", "agentic",
  "saas", "tech", "devops", "infra", "cloud", "product", "growth",
  "seed", "series", "accelerator", "incubator", "pitch", "demo day",
  "hackathon", "builder", "engineering", "deeptech", "fintech",
  "cybersecurity", "open source", "llm", "genai", "machine learning",
  "data science", "agent", "mcp", "web3", "blockchain", "crypto",
];

const KEYWORD_PATTERN = new RegExp(
  `\\b(${KEYWORDS.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

interface LumaEntry {
  event: {
    name: string;
    url: string;
    start_at: string;
    end_at: string | null;
    cover_url: string | null;
    geo_address_info?: { city?: string; short_address?: string };
  };
  hosts?: Array<{ name?: string; avatar_url?: string }>;
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

// Cache duration: 20 hours (cron refreshes once daily at 8am IST)
const CACHE_HOURS = 20;

// GET /api/trending-events — return cached trending events for all regions
export async function GET() {
  const supabase = getSupabaseAdmin();

  // Fetch all cached regions at once
  const { data: cached } = await supabase
    .from("trending_events_cache")
    .select("id, events, updated_at")
    .in("id", Object.keys(REGIONS));

  const cachedMap = new Map<string, { events: TrendingEvent[]; updated_at: string }>();
  if (cached) {
    for (const row of cached) {
      cachedMap.set(row.id, { events: row.events as TrendingEvent[], updated_at: row.updated_at });
    }
  }

  const maxAge = CACHE_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const result: Record<string, { events: TrendingEvent[]; updated_at: string }> = {};
  const staleRegions: string[] = [];

  for (const regionId of Object.keys(REGIONS)) {
    const entry = cachedMap.get(regionId);
    if (entry && (now - new Date(entry.updated_at).getTime()) < maxAge) {
      result[regionId] = entry;
    } else {
      staleRegions.push(regionId);
    }
  }

  // Fetch stale regions in parallel
  if (staleRegions.length > 0) {
    const fetches = await Promise.all(
      staleRegions.map(async (regionId) => {
        const events = await fetchFromLuma(regionId);
        const updated_at = new Date().toISOString();

        if (events.length > 0) {
          await supabase.from("trending_events_cache").upsert(
            { id: regionId, events, updated_at },
            { onConflict: "id" }
          );
        }

        return { regionId, events, updated_at };
      })
    );

    for (const { regionId, events, updated_at } of fetches) {
      result[regionId] = { events, updated_at };
    }
  }

  // Filter out events older than 7 days from all results
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const regionId of Object.keys(result)) {
    result[regionId].events = result[regionId].events.filter(
      (ev) => ev.start_at > sevenDaysAgo
    );
  }

  return NextResponse.json({
    regions: Object.fromEntries(
      Object.entries(REGIONS).map(([id, geo]) => [
        id,
        {
          label: geo.label,
          events: result[id]?.events || [],
          updated_at: result[id]?.updated_at || null,
        },
      ])
    ),
  });
}

// POST /api/trending-events — force refresh all regions
export async function POST() {
  const supabase = getSupabaseAdmin();

  const results = await Promise.all(
    Object.keys(REGIONS).map(async (regionId) => {
      const events = await fetchFromLuma(regionId);
      const updated_at = new Date().toISOString();

      await supabase.from("trending_events_cache").upsert(
        { id: regionId, events, updated_at },
        { onConflict: "id" }
      );

      return { regionId, count: events.length };
    })
  );

  return NextResponse.json({
    refreshed: true,
    results,
    updated_at: new Date().toISOString(),
  });
}

async function fetchFromLuma(regionId: string): Promise<TrendingEvent[]> {
  const geo = REGIONS[regionId];
  if (!geo) return [];

  try {
    const params = new URLSearchParams({
      pagination_limit: "50",
      geo_latitude: geo.latitude,
      geo_longitude: geo.longitude,
      geo_place_id: geo.place_id,
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

    const filtered = entries.filter((entry) =>
      KEYWORD_PATTERN.test(entry.event.name)
    );

    const now = new Date().toISOString();
    const upcoming = filtered.filter(
      (entry) => entry.event.start_at > now
    );

    return upcoming.slice(0, 8).map((entry, i) => ({
      id: `luma-${regionId}-${i}-${entry.event.url}`,
      name: entry.event.name,
      url: `https://lu.ma/${entry.event.url}`,
      start_at: entry.event.start_at,
      city: entry.event.geo_address_info?.city || null,
      host_name: entry.hosts?.[0]?.name || null,
      host_avatar: entry.hosts?.[0]?.avatar_url || null,
      cover_url: entry.event.cover_url || null,
    }));
  } catch (err) {
    console.error(`Failed to fetch from Luma for ${regionId}:`, err);
    return [];
  }
}
