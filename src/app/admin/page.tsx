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
  image_url: string | null;
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
    image_url: "",
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
          image_url: data.image_url || "",
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
        image_url: newEvent.image_url || null,
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

      resetForm();
      await loadEvents();
    }
    setCreating(false);
  }

  function resetForm() {
    setShowCreate(false);
    setNewEvent({ name: "", slug: "", event_date: "", location: "", description: "", image_url: "" });
    setLumaUrl("");
    setCsvText("");
    setFetchError("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-neon-dark/30 border-t-neon-dark rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neon-dark tracking-tight">
            Events
          </h1>
          <p className="text-sm text-neon-dark/40 mt-1">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isSuperAdmin && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-all hover:shadow-lg hover:shadow-neon-dark/10 active:scale-[0.98]"
          >
            + New Event
          </button>
        )}
      </div>

      {/* Create event form */}
      {showCreate && (
        <form
          onSubmit={handleCreateEvent}
          className="bg-white rounded-2xl border border-neon-dark/10 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-neon-dark/5 bg-neon-bg/50">
            <h2 className="text-sm font-semibold text-neon-dark">Create New Event</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: Luma URL auto-fetch */}
            <div>
              <label className="block text-xs font-semibold text-neon-dark/60 uppercase tracking-wider mb-2">
                Import from Luma
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={lumaUrl}
                  onChange={(e) => setLumaUrl(e.target.value)}
                  placeholder="https://lu.ma/your-event"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-white placeholder:text-neon-dark/25 transition-all"
                />
                <button
                  type="button"
                  onClick={handleFetchLuma}
                  disabled={fetching || !lumaUrl.trim()}
                  className="px-5 py-2.5 bg-neon-dark/8 text-neon-dark rounded-xl text-sm font-medium hover:bg-neon-dark/12 transition-all disabled:opacity-30 whitespace-nowrap"
                >
                  {fetching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-neon-dark/30 border-t-neon-dark rounded-full animate-spin" />
                      Fetching
                    </span>
                  ) : (
                    "Fetch"
                  )}
                </button>
              </div>
              {fetchError && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 bg-red-500 rounded-full" />
                  {fetchError}
                </p>
              )}
              {newEvent.name && !fetchError && lumaUrl && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-xl bg-green-50/50 border border-green-200/40">
                  {newEvent.image_url && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-neon-dark/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={newEvent.image_url}
                        alt={newEvent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neon-dark truncate">{newEvent.name}</p>
                    <p className="text-xs text-green-700 mt-0.5">Details imported successfully</p>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-neon-dark/5" />

            {/* Step 2: Editable event fields */}
            <div>
              <p className="text-xs text-neon-dark/40 mb-4">
                Auto-filled from Luma, or enter manually.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neon-dark/60 mb-1.5">
                    Event name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, name: e.target.value })
                    }
                    placeholder="Cybersecurity AI"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-white placeholder:text-neon-dark/25 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neon-dark/60 mb-1.5">
                    Slug <span className="text-red-400">*</span>
                    <span className="text-neon-dark/30 font-normal ml-1">
                      /event/your-slug
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-white font-mono text-xs placeholder:font-sans placeholder:text-sm placeholder:text-neon-dark/25 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neon-dark/60 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newEvent.event_date}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_date: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neon-dark/60 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, location: e.target.value })
                    }
                    placeholder="Bangalore"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-white placeholder:text-neon-dark/25 transition-all"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-neon-dark/60 mb-1.5">
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  placeholder="Brief event description..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-white placeholder:text-neon-dark/25 resize-none transition-all"
                />
              </div>
            </div>

            {/* Step 3: CSV guest list */}
            <div>
              <label className="block text-xs font-semibold text-neon-dark/60 uppercase tracking-wider mb-2">
                Guest List (CSV)
              </label>
              <p className="text-xs text-neon-dark/40 mb-2">
                Paste CSV with email column (required) and optional LinkedIn column.
              </p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`email,linkedin_url\njohn@example.com,https://linkedin.com/in/john\njane@example.com,`}
                rows={4}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neon-dark/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neon-dark/20 focus:border-neon-dark/30 bg-neon-bg/50 placeholder:text-neon-dark/20 resize-none transition-all"
              />
              {csvText.trim() && (
                <p className="text-xs text-neon-dark/50 mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 bg-neon-dark/30 rounded-full" />
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
                    return `${dataLines} guest${dataLines !== 1 ? "s" : ""} detected${hasHeader ? " (header skipped)" : ""}`;
                  })()}
                </p>
              )}
            </div>
          </div>

          {/* Form footer */}
          <div className="px-6 py-4 border-t border-neon-dark/5 bg-neon-bg/30 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 text-neon-dark/50 text-sm font-medium hover:text-neon-dark transition-colors rounded-xl hover:bg-neon-dark/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newEvent.name || !newEvent.slug}
              className="px-6 py-2.5 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-all disabled:opacity-40 hover:shadow-lg hover:shadow-neon-dark/10 active:scale-[0.98]"
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

      {/* Event cards */}
      <div className="space-y-4">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/admin/event/${event.slug}`}
            className="group block bg-white rounded-2xl border border-neon-dark/8 hover:border-neon-dark/20 transition-all hover:shadow-lg hover:shadow-neon-dark/5 overflow-hidden"
          >
            <div className="flex">
              {/* Left: Content */}
              <div className="flex-1 p-6 min-w-0">
                {/* Header row */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-neon-dark group-hover:text-neon-dark/80 transition-colors truncate">
                      {event.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      {event.event_date && (
                        <span className="text-sm text-neon-dark/45">
                          {new Date(event.event_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {event.event_date && event.location && (
                        <span className="text-neon-dark/20">·</span>
                      )}
                      {event.location && (
                        <span className="text-sm text-neon-dark/45">
                          {event.location}
                        </span>
                      )}
                      {!event.event_date && !event.location && (
                        <span className="text-sm text-neon-dark/30">
                          No date set
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full font-medium tracking-wide ${
                      event.is_active
                        ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50"
                        : "bg-neon-dark/4 text-neon-dark/35 ring-1 ring-neon-dark/8"
                    }`}
                  >
                    {event.is_active ? "Active" : "Closed"}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-1">
                  <StatPill label="Guests" value={event.guestCount} />
                  <StatPill label="Registered" value={event.profileCount} accent />
                  <StatPill label="Matches" value={event.matchCount} />
                  <StatPill
                    label="Conversion"
                    value={
                      event.guestCount > 0
                        ? `${Math.round(
                            (event.profileCount / event.guestCount) * 100
                          )}%`
                        : "--"
                    }
                  />
                </div>

                {/* Slug */}
                <p className="text-[11px] text-neon-dark/25 mt-3 font-mono">
                  /event/{event.slug}
                </p>
              </div>

              {/* Right: Square image */}
              {event.image_url && (
                <div className="hidden sm:block w-44 flex-shrink-0">
                  <div className="h-full w-full relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.image_url}
                      alt={event.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {events.length === 0 && (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-2xl bg-neon-dark/5 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-neon-dark/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <p className="text-sm text-neon-dark/40">No events yet</p>
          <p className="text-xs text-neon-dark/25 mt-1">Create your first event to get started</p>
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      className={`px-3 py-1.5 rounded-lg text-center ${
        accent
          ? "bg-neon/40"
          : "bg-neon-dark/[0.03]"
      }`}
    >
      <p className="text-sm font-bold text-neon-dark leading-none">{value}</p>
      <p className="text-[10px] text-neon-dark/40 mt-0.5 leading-none">{label}</p>
    </div>
  );
}
