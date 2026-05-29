"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "./layout";

interface EventWithStats {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  guestCount: number;
  profileCount: number;
  matchCount: number;
}

export default function AdminPage() {
  const adminUser = useAdminUser();
  const isSuperAdmin = adminUser?.role === "super_admin";

  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Create event form
  const [showCreate, setShowCreate] = useState(false);
  const [lumaUrl, setLumaUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [newEvent, setNewEvent] = useState({
    name: "",
    slug: "",
    event_date: "",
    location: "",
    description: "",
  });
  const [csvText, setCsvText] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (!eventsData) {
      setLoading(false);
      return;
    }

    // Get stats for each event
    const eventsWithStats: EventWithStats[] = [];

    for (const event of eventsData) {
      // Count guests
      const { count: guestCount } = await supabase
        .from("luma_list")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      // Count profiles
      const { count: profileCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      // Count matches
      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      eventsWithStats.push({
        ...event,
        guestCount: guestCount || 0,
        profileCount: profileCount || 0,
        matchCount: matchCount || 0,
      });
    }

    // Also get event 1 stats (event_id = NULL)
    const { count: e1Guests } = await supabase
      .from("luma_list")
      .select("*", { count: "exact", head: true })
      .is("event_id", null);

    const { count: e1Profiles } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .is("event_id", null);

    const { count: e1Matches } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .is("event_id", null);

    // Find the agentic-infra event and update its stats with NULL data
    const agenticIdx = eventsWithStats.findIndex(
      (e) => e.slug === "agentic-infra-2026"
    );
    if (agenticIdx !== -1) {
      eventsWithStats[agenticIdx].guestCount = e1Guests || 0;
      eventsWithStats[agenticIdx].profileCount = e1Profiles || 0;
      eventsWithStats[agenticIdx].matchCount = e1Matches || 0;
    }

    setEvents(eventsWithStats);
    setLoading(false);
  }

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  }

  async function handleFetchLuma() {
    if (!lumaUrl.trim()) return;
    setFetching(true);
    setFetchError("");

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/fetch-luma-event", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: lumaUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.name) {
        setNewEvent({
          name: data.name || "",
          slug: data.slug || "",
          event_date: data.event_date || "",
          location: data.location || "",
          description: data.description || "",
        });
        setFetchError("");
      } else {
        setFetchError(data.error || "Could not fetch event details");
      }
    } catch {
      setFetchError("Network error fetching Luma page");
    }

    setFetching(false);
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const headers = await getAuthHeaders();

    // 1. Create the event
    const res = await fetch("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({
        slug: newEvent.slug,
        name: newEvent.name,
        event_date: newEvent.event_date || null,
        location: newEvent.location || null,
        description: newEvent.description || null,
      }),
    });

    if (res.ok) {
      const { event } = await res.json();

      // 2. If CSV is provided, upload guest list
      if (csvText.trim() && event?.id) {
        const lines = csvText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
        const startIdx = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

        const entries: { email: string; linkedin_url: string | null; event_id: string }[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim().replace(/"/g, ""));
          const email = parts[0]?.toLowerCase().trim();
          if (!email || !email.includes("@")) continue;

          // Try to find LinkedIn column
          let linkedin: string | null = null;
          for (let j = 1; j < parts.length; j++) {
            if (parts[j]?.includes("linkedin.com")) {
              linkedin = parts[j];
              break;
            }
          }

          entries.push({ email, linkedin_url: linkedin, event_id: event.id });
        }

        if (entries.length > 0) {
          await supabase.from("luma_list").insert(entries);
        }
      }

      setShowCreate(false);
      setNewEvent({ name: "", slug: "", event_date: "", location: "", description: "" });
      setLumaUrl("");
      setCsvText("");
      await loadEvents();
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-neon-dark">Events</h1>
        {isSuperAdmin && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors"
          >
            + New Event
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateEvent}
          className="bg-white rounded-2xl border border-neon-dark/10 p-5 mb-6 space-y-5"
        >
          {/* Step 1: Luma URL auto-fetch */}
          <div>
            <label className="block text-sm font-semibold text-neon-dark mb-1.5">
              Import from Luma
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={lumaUrl}
                onChange={(e) => setLumaUrl(e.target.value)}
                placeholder="https://lu.ma/your-event"
                className="flex-1 px-3 py-2 rounded-lg border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white"
              />
              <button
                type="button"
                onClick={handleFetchLuma}
                disabled={fetching || !lumaUrl.trim()}
                className="px-4 py-2 bg-neon-dark/10 text-neon-dark rounded-lg text-sm font-medium hover:bg-neon-dark/15 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {fetching ? "Fetching..." : "Fetch Details"}
              </button>
            </div>
            {fetchError && (
              <p className="text-xs text-red-600 mt-1.5">{fetchError}</p>
            )}
            {newEvent.name && !fetchError && lumaUrl && (
              <p className="text-xs text-green-700 mt-1.5">
                Event details fetched successfully
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-neon-dark/8" />

          {/* Step 2: Editable event fields (auto-populated or manual) */}
          <div>
            <p className="text-xs text-neon-dark/50 mb-3">
              Fields auto-fill from Luma, or fill manually.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                  Event name *
                </label>
                <input
                  type="text"
                  value={newEvent.name}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, name: e.target.value })
                  }
                  placeholder="Cybersecurity AI"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                  Slug *{" "}
                  <span className="text-neon-dark/40 font-normal">
                    (URL path)
                  </span>
                </label>
                <input
                  type="text"
                  value={newEvent.slug}
                  onChange={(e) =>
                    setNewEvent({
                      ...newEvent,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  placeholder="cybersecurity-ai"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newEvent.event_date}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, event_date: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, location: e.target.value })
                  }
                  placeholder="Bangalore"
                  className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-neon-dark/80 mb-1">
                Description
              </label>
              <textarea
                value={newEvent.description}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, description: e.target.value })
                }
                placeholder="Brief event description..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white resize-none"
              />
            </div>
          </div>

          {/* Step 3: CSV guest list */}
          <div>
            <label className="block text-sm font-semibold text-neon-dark mb-1.5">
              Guest List (CSV)
            </label>
            <p className="text-xs text-neon-dark/50 mb-2">
              Paste CSV with email column (required) and optional LinkedIn
              column. Header row is auto-detected.
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`email,linkedin_url\njohn@example.com,https://linkedin.com/in/john\njane@example.com,`}
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neon-dark bg-neon-bg resize-none"
            />
            {csvText.trim() && (
              <p className="text-xs text-neon-dark/50 mt-1">
                {(() => {
                  const lines = csvText
                    .trim()
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  const hasHeader =
                    lines[0]?.toLowerCase().includes("email") || false;
                  const dataLines = hasHeader
                    ? lines.length - 1
                    : lines.length;
                  return `${dataLines} guest${dataLines !== 1 ? "s" : ""} detected${hasHeader ? " (header row skipped)" : ""}`;
                })()}
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewEvent({
                  name: "",
                  slug: "",
                  event_date: "",
                  location: "",
                  description: "",
                });
                setLumaUrl("");
                setCsvText("");
                setFetchError("");
              }}
              className="px-4 py-2 text-neon-dark/60 text-sm font-medium hover:text-neon-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newEvent.name || !newEvent.slug}
              className="px-6 py-2 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50"
            >
              {creating
                ? "Creating..."
                : csvText.trim()
                  ? "Create Event & Import Guests"
                  : "Create Event"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/admin/event/${event.slug}`}
            className="block bg-white rounded-2xl border border-neon-dark/10 p-5 hover:border-neon-dark/25 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-neon-dark">
                  {event.name}
                </h2>
                <p className="text-sm text-neon-dark/50">
                  {event.event_date
                    ? new Date(event.event_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Date TBD"}
                  {event.location && ` · ${event.location}`}
                </p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  event.is_active
                    ? "bg-green-50 text-green-700"
                    : "bg-neon-dark/5 text-neon-dark/40"
                }`}
              >
                {event.is_active ? "Active" : "Closed"}
              </span>
            </div>
            <div className="flex gap-6">
              <Stat label="Guests" value={event.guestCount} />
              <Stat label="Registered" value={event.profileCount} />
              <Stat label="Matches" value={event.matchCount} />
              <Stat
                label="Conversion"
                value={
                  event.guestCount > 0
                    ? `${Math.round(
                        (event.profileCount / event.guestCount) * 100
                      )}%`
                    : "—"
                }
              />
            </div>
            <p className="text-xs text-neon-dark/30 mt-3">
              /event/{event.slug}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <p className="text-lg font-bold text-neon-dark">{value}</p>
      <p className="text-xs text-neon-dark/50">{label}</p>
    </div>
  );
}
