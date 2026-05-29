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

interface DashboardMetrics {
  totalEvents: number;
  totalGuests: number;
  totalRegistered: number;
  totalMatches: number;
  overallConversion: number;
  activeEvents: number;
  repeatRegistrations: number;
  repeatEmails: string[];
}

export default function AdminPage() {
  const adminUser = useAdminUser();
  const isSuperAdmin = adminUser?.role === "super_admin";

  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
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
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadEvents(), loadMetrics()]);
    setLoading(false);
  }

  async function loadMetrics() {
    // Get all profiles to find repeat registrations
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("email, event_id");

    // Count emails that appear in more than one event
    const emailEventMap = new Map<string, Set<string>>();
    if (allProfiles) {
      for (const p of allProfiles) {
        const eventKey = p.event_id || "legacy";
        if (!emailEventMap.has(p.email)) {
          emailEventMap.set(p.email, new Set());
        }
        emailEventMap.get(p.email)!.add(eventKey);
      }
    }

    const repeatEmails: string[] = [];
    emailEventMap.forEach((events, email) => {
      if (events.size > 1) {
        repeatEmails.push(email);
      }
    });

    setMetrics({
      totalEvents: 0, // filled after events load
      totalGuests: 0,
      totalRegistered: allProfiles?.length || 0,
      totalMatches: 0,
      overallConversion: 0,
      activeEvents: 0,
      repeatRegistrations: repeatEmails.length,
      repeatEmails,
    });
  }

  async function loadEvents() {
    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (!eventsData) return;

    const eventsWithStats: EventWithStats[] = [];

    for (const event of eventsData) {
      const { count: guestCount } = await supabase
        .from("luma_list")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

      const { count: profileCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);

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

    // Event 1 stats (event_id = NULL)
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

    const agenticIdx = eventsWithStats.findIndex(
      (e) => e.slug === "agentic-infra-2026"
    );
    if (agenticIdx !== -1) {
      eventsWithStats[agenticIdx].guestCount = e1Guests || 0;
      eventsWithStats[agenticIdx].profileCount = e1Profiles || 0;
      eventsWithStats[agenticIdx].matchCount = e1Matches || 0;
    }

    // Compute aggregate metrics
    const totalGuests = eventsWithStats.reduce((s, e) => s + e.guestCount, 0);
    const totalRegistered = eventsWithStats.reduce(
      (s, e) => s + e.profileCount,
      0
    );
    const totalMatches = eventsWithStats.reduce(
      (s, e) => s + e.matchCount,
      0
    );
    const activeEvents = eventsWithStats.filter((e) => e.is_active).length;

    setMetrics((prev) => ({
      ...(prev || {
        repeatRegistrations: 0,
        repeatEmails: [],
      }),
      totalEvents: eventsWithStats.length,
      totalGuests,
      totalRegistered,
      totalMatches,
      overallConversion:
        totalGuests > 0 ? Math.round((totalRegistered / totalGuests) * 100) : 0,
      activeEvents,
    }));

    setEvents(eventsWithStats);
  }

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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

      if (csvText.trim() && event?.id) {
        const lines = csvText
          .trim()
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        const startIdx = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

        const entries: {
          email: string;
          linkedin_url: string | null;
          event_id: string;
        }[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i]
            .split(",")
            .map((p) => p.trim().replace(/"/g, ""));
          const email = parts[0]?.toLowerCase().trim();
          if (!email || !email.includes("@")) continue;

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
      setLoading(true);
      await loadAll();
    }
    setCreating(false);
  }

  function resetForm() {
    setShowCreate(false);
    setNewEvent({
      name: "",
      slug: "",
      event_date: "",
      location: "",
      description: "",
      image_url: "",
    });
    setLumaUrl("");
    setCsvText("");
    setFetchError("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-[#1d3d0f]/30 border-t-[#1d3d0f] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Dashboard metrics ── */}
      <section>
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight mb-6">
          Dashboard
        </h1>

        {/* Top-level stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total Events" value={metrics?.totalEvents ?? 0} />
          <MetricCard
            label="Active"
            value={metrics?.activeEvents ?? 0}
            accent
          />
          <MetricCard
            label="Total Guests"
            value={metrics?.totalGuests ?? 0}
          />
          <MetricCard
            label="Registered"
            value={metrics?.totalRegistered ?? 0}
            accent
          />
          <MetricCard label="Matches" value={metrics?.totalMatches ?? 0} />
          <MetricCard
            label="Avg Conversion"
            value={`${metrics?.overallConversion ?? 0}%`}
          />
        </div>

        {/* Second row — repeat registrations + per-event breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          {/* Repeat registrations card */}
          <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider">
                Repeat Attendees
              </h3>
              <span className="text-xl font-bold text-[#1d3d0f]">
                {metrics?.repeatRegistrations ?? 0}
              </span>
            </div>
            <p className="text-xs text-[#1d3d0f]/40 mb-3">
              People who registered for more than one event
            </p>
            {metrics && metrics.repeatEmails.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {metrics.repeatEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 text-xs text-[#1d3d0f]/70"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e8ff79] flex-shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#1d3d0f]/25 italic">
                No repeat attendees yet
              </p>
            )}
          </div>

          {/* Per-event conversion breakdown */}
          <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
            <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-3">
              Conversion by Event
            </h3>
            <div className="space-y-3">
              {events.map((event) => {
                const pct =
                  event.guestCount > 0
                    ? Math.round(
                        (event.profileCount / event.guestCount) * 100
                      )
                    : 0;
                return (
                  <div key={event.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#000000] truncate mr-3">
                        {event.name}
                      </span>
                      <span className="text-xs font-bold text-[#1d3d0f] flex-shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#1d3d0f]/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#e8ff79] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <p className="text-xs text-[#1d3d0f]/25 italic">
                  No events yet
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Events list ── */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <h2 className="text-lg font-bold text-[#000000] tracking-tight">
            Events
          </h2>
          {isSuperAdmin && !showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#1d3d0f] text-[#e8ff79] rounded-lg text-sm font-semibold hover:bg-[#000000] transition-colors"
            >
              + New Event
            </button>
          )}
        </div>

        {/* Create event form */}
        {showCreate && (
          <div className="bg-[#ffffff] rounded-xl border border-[#1d3d0f]/10 mb-5 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#1d3d0f] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#e8ff79]">
                Create New Event
              </h3>
              <button
                onClick={resetForm}
                className="text-xs text-[#ffffff]/40 hover:text-[#ffffff] transition-colors"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-5 space-y-5">
              {/* Luma import */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1d3d0f]/45 uppercase tracking-wider mb-2">
                  Import from Luma
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={lumaUrl}
                    onChange={(e) => setLumaUrl(e.target.value)}
                    placeholder="https://lu.ma/your-event"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/20 focus:outline-none focus:border-[#1d3d0f]/25 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleFetchLuma}
                    disabled={fetching || !lumaUrl.trim()}
                    className="px-4 py-2 bg-[#e8ff79] text-[#1d3d0f] rounded-lg text-sm font-semibold hover:bg-[#e8ff79]/80 transition-colors disabled:opacity-30"
                  >
                    {fetching ? "..." : "Fetch"}
                  </button>
                </div>
                {fetchError && (
                  <p className="text-xs text-red-600 mt-1.5">{fetchError}</p>
                )}
                {newEvent.name && !fetchError && lumaUrl && (
                  <div className="mt-2.5 flex items-center gap-3 p-2.5 rounded-lg bg-[#e8ff79]/15 border border-[#e8ff79]/30">
                    {newEvent.image_url && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[#1d3d0f]/8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={newEvent.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#000000] truncate">
                        {newEvent.name}
                      </p>
                      <p className="text-[11px] text-[#1d3d0f]/40">
                        Imported
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[#1d3d0f]/5" />

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#1d3d0f]/45 mb-1">
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
                    className="w-full px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/20 focus:outline-none focus:border-[#1d3d0f]/25 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#1d3d0f]/45 mb-1">
                    Slug <span className="text-red-400">*</span>
                    <span className="text-[#1d3d0f]/20 ml-1 font-normal">
                      /event/...
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
                    className="w-full px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm font-mono bg-[#ffffff] placeholder:text-[#1d3d0f]/20 placeholder:font-sans focus:outline-none focus:border-[#1d3d0f]/25 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#1d3d0f]/45 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newEvent.event_date}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] focus:outline-none focus:border-[#1d3d0f]/25 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#1d3d0f]/45 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, location: e.target.value })
                    }
                    placeholder="Bangalore"
                    className="w-full px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/20 focus:outline-none focus:border-[#1d3d0f]/25 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#1d3d0f]/45 mb-1">
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  placeholder="Brief event description..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/20 focus:outline-none focus:border-[#1d3d0f]/25 resize-none transition-colors"
                />
              </div>

              <div className="border-t border-[#1d3d0f]/5" />

              {/* CSV */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1d3d0f]/45 uppercase tracking-wider mb-1">
                  Guest List (CSV)
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`email,linkedin_url\njohn@example.com,https://linkedin.com/in/john`}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#1d3d0f]/10 text-sm font-mono bg-[#fdfff0] placeholder:text-[#1d3d0f]/15 focus:outline-none focus:border-[#1d3d0f]/25 resize-none transition-colors"
                />
                {csvText.trim() && (
                  <p className="text-[11px] text-[#1d3d0f]/35 mt-1">
                    {(() => {
                      const lines = csvText
                        .trim()
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean);
                      const hasHeader =
                        lines[0]?.toLowerCase().includes("email") || false;
                      const n = hasHeader ? lines.length - 1 : lines.length;
                      return `${n} guest${n !== 1 ? "s" : ""} detected`;
                    })()}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating || !newEvent.name || !newEvent.slug}
                  className="px-5 py-2.5 bg-[#1d3d0f] text-[#e8ff79] rounded-lg text-sm font-semibold hover:bg-[#000000] transition-colors disabled:opacity-40"
                >
                  {creating
                    ? "Creating..."
                    : csvText.trim()
                      ? "Create & Import Guests"
                      : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Event cards */}
        <div className="space-y-3">
          {events.map((event) => {
            const pct =
              event.guestCount > 0
                ? Math.round(
                    (event.profileCount / event.guestCount) * 100
                  )
                : 0;

            return (
              <Link
                key={event.id}
                href={`/admin/event/${event.slug}`}
                className="group block bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 hover:border-[#1d3d0f]/18 transition-all"
              >
                <div className="p-5 flex gap-5">
                  {/* Image thumbnail */}
                  {event.image_url && (
                    <div className="hidden sm:block w-24 h-24 rounded-lg overflow-hidden border border-[#1d3d0f]/8 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-[#000000] truncate">
                          {event.name}
                        </h3>
                        <p className="text-xs text-[#1d3d0f]/40 mt-0.5">
                          {event.event_date
                            ? new Date(
                                event.event_date
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "Date TBD"}
                          {event.location && (
                            <>
                              <span className="mx-1 text-[#1d3d0f]/15">
                                |
                              </span>
                              {event.location}
                            </>
                          )}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-semibold ${
                          event.is_active
                            ? "bg-[#e8ff79] text-[#1d3d0f]"
                            : "bg-[#000000]/5 text-[#000000]/30"
                        }`}
                      >
                        {event.is_active ? "Active" : "Closed"}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-3">
                      <MiniStat label="Guests" value={event.guestCount} />
                      <MiniStat
                        label="Registered"
                        value={event.profileCount}
                        accent
                      />
                      <MiniStat label="Matches" value={event.matchCount} />
                      <MiniStat label="Conv." value={`${pct}%`} />
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="hidden sm:flex items-center flex-shrink-0">
                    <svg
                      className="w-4 h-4 text-[#1d3d0f]/15 group-hover:text-[#1d3d0f]/40 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {events.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[#1d3d0f]/35">No events yet</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Components ─── */

function MetricCard({
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
      className={`rounded-xl border p-4 ${
        accent
          ? "bg-[#e8ff79]/30 border-[#e8ff79]/50"
          : "bg-[#fdfff0] border-[#1d3d0f]/8"
      }`}
    >
      <p className="text-2xl font-bold text-[#000000] leading-none">{value}</p>
      <p className="text-[11px] text-[#1d3d0f]/40 mt-1.5">{label}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-[#000000] leading-none">
        {accent ? (
          <span className="bg-[#e8ff79] px-1 rounded">{value}</span>
        ) : (
          value
        )}
      </p>
      <p className="text-[10px] text-[#1d3d0f]/30 mt-0.5">{label}</p>
    </div>
  );
}
