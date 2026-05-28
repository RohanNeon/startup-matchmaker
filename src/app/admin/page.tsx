"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

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
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Create event form
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    slug: "",
    event_date: "",
    location: "",
  });
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

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const adminPassword = sessionStorage.getItem("admin_password") || "";

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminKey: adminPassword,
        slug: newEvent.slug,
        name: newEvent.name,
        event_date: newEvent.event_date || null,
        location: newEvent.location || null,
      }),
    });

    if (res.ok) {
      setShowCreate(false);
      setNewEvent({ name: "", slug: "", event_date: "", location: "" });
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
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors"
        >
          {showCreate ? "Cancel" : "+ New Event"}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreateEvent}
          className="bg-white rounded-2xl border border-neon-dark/10 p-5 mb-6 space-y-4"
        >
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
                Slug * <span className="text-neon-dark/40 font-normal">(URL path)</span>
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
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Event"}
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
