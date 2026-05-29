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

    setEvents(eventsWithStats);
    setLoading(false);
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
      await loadEvents();
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
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#000000] tracking-tight">
            Events
          </h1>
          <p className="text-sm text-[#1d3d0f]/40 mt-0.5">
            {events.length} event{events.length !== 1 ? "s" : ""} total
          </p>
        </div>
        {isSuperAdmin && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-[#1d3d0f] text-[#e8ff79] rounded-lg text-sm font-semibold hover:bg-[#000000] transition-colors"
          >
            + New Event
          </button>
        )}
      </div>

      {/* Create event form */}
      {showCreate && (
        <div className="bg-[#ffffff] rounded-2xl border border-[#1d3d0f]/10 mb-8 overflow-hidden">
          <div className="px-6 py-4 bg-[#1d3d0f] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e8ff79]">
              Create New Event
            </h2>
            <button
              onClick={resetForm}
              className="text-xs text-[#ffffff]/40 hover:text-[#ffffff]/70 transition-colors"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleCreateEvent} className="p-6 space-y-6">
            {/* Luma import */}
            <div>
              <label className="block text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-2">
                Import from Luma
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={lumaUrl}
                  onChange={(e) => setLumaUrl(e.target.value)}
                  placeholder="https://lu.ma/your-event"
                  className="flex-1 px-3 py-2.5 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/25 focus:outline-none focus:border-[#1d3d0f]/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleFetchLuma}
                  disabled={fetching || !lumaUrl.trim()}
                  className="px-4 py-2.5 bg-[#e8ff79] text-[#1d3d0f] rounded-lg text-sm font-semibold hover:bg-[#e8ff79]/80 transition-colors disabled:opacity-30"
                >
                  {fetching ? "Fetching..." : "Fetch"}
                </button>
              </div>
              {fetchError && (
                <p className="text-xs text-red-600 mt-2">{fetchError}</p>
              )}
              {newEvent.name && !fetchError && lumaUrl && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-[#e8ff79]/20 border border-[#e8ff79]/40">
                  {newEvent.image_url && (
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-[#1d3d0f]/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={newEvent.image_url}
                        alt={newEvent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#000000] truncate">
                      {newEvent.name}
                    </p>
                    <p className="text-xs text-[#1d3d0f]/50 mt-0.5">
                      Details imported
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#1d3d0f]/6" />

            {/* Event fields */}
            <div>
              <p className="text-xs text-[#1d3d0f]/35 mb-4">
                Auto-filled from Luma, or enter manually.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Event name" required>
                  <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, name: e.target.value })
                    }
                    placeholder="Cybersecurity AI"
                    required
                  />
                </FormField>
                <FormField label="Slug" sublabel="/event/your-slug" required>
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
                    className="!font-mono !text-xs"
                  />
                </FormField>
                <FormField label="Date">
                  <input
                    type="date"
                    value={newEvent.event_date}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, event_date: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Location">
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, location: e.target.value })
                    }
                    placeholder="Bangalore"
                  />
                </FormField>
              </div>
              <div className="mt-4">
                <FormField label="Description">
                  <textarea
                    value={newEvent.description}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, description: e.target.value })
                    }
                    placeholder="Brief event description..."
                    rows={2}
                    className="resize-none"
                  />
                </FormField>
              </div>
            </div>

            {/* CSV */}
            <div>
              <label className="block text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-2">
                Guest List (CSV)
              </label>
              <p className="text-xs text-[#1d3d0f]/35 mb-2">
                Paste CSV with email column (required) and optional LinkedIn
                column.
              </p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`email,linkedin_url\njohn@example.com,https://linkedin.com/in/john`}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-[#1d3d0f]/10 text-sm font-mono bg-[#fdfff0] placeholder:text-[#1d3d0f]/20 focus:outline-none focus:border-[#1d3d0f]/30 resize-none transition-colors"
              />
              {csvText.trim() && (
                <p className="text-xs text-[#1d3d0f]/40 mt-1.5">
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
                    return `${dataLines} guest${dataLines !== 1 ? "s" : ""} detected`;
                  })()}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={creating || !newEvent.name || !newEvent.slug}
                className="px-6 py-2.5 bg-[#1d3d0f] text-[#e8ff79] rounded-lg text-sm font-semibold hover:bg-[#000000] transition-colors disabled:opacity-40"
              >
                {creating
                  ? "Creating..."
                  : csvText.trim()
                    ? "Create Event & Import Guests"
                    : "Create Event"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Event cards */}
      <div className="space-y-4">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/admin/event/${event.slug}`}
            className="group block bg-[#ffffff] rounded-2xl border border-[#1d3d0f]/8 hover:border-[#1d3d0f]/20 transition-all hover:shadow-md"
          >
            <div className="flex items-stretch">
              {/* Content */}
              <div className="flex-1 p-5 sm:p-6 min-w-0">
                {/* Title & status */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[17px] font-bold text-[#000000] group-hover:text-[#1d3d0f] transition-colors">
                      {event.name}
                    </h2>
                    <p className="text-[13px] text-[#1d3d0f]/45 mt-1">
                      {event.event_date
                        ? new Date(event.event_date).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "Date TBD"}
                      {event.location && (
                        <>
                          <span className="mx-1.5 text-[#1d3d0f]/20">
                            |
                          </span>
                          {event.location}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[11px] px-2.5 py-1 rounded-md font-semibold ${
                      event.is_active
                        ? "bg-[#e8ff79] text-[#1d3d0f]"
                        : "bg-[#000000]/5 text-[#000000]/35"
                    }`}
                  >
                    {event.is_active ? "Active" : "Closed"}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5">
                  <Stat label="Guests" value={event.guestCount} />
                  <Stat
                    label="Registered"
                    value={event.profileCount}
                    highlight
                  />
                  <Stat label="Matches" value={event.matchCount} />
                  <Stat
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

                <p className="text-[11px] text-[#1d3d0f]/20 mt-4 font-mono">
                  /event/{event.slug}
                </p>
              </div>

              {/* Image */}
              {event.image_url && (
                <div className="hidden sm:flex items-center pr-5 sm:pr-6">
                  <div className="w-[130px] h-[130px] rounded-xl overflow-hidden border border-[#1d3d0f]/8 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.image_url}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
          <p className="text-sm text-[#1d3d0f]/40">No events yet</p>
          <p className="text-xs text-[#1d3d0f]/25 mt-1">
            Create your first event to get started
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function FormField({
  label,
  sublabel,
  required,
  children,
}: {
  label: string;
  sublabel?: string;
  required?: boolean;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>>;
}) {
  // Clone the child input/textarea and inject shared styles
  const { className: childClass = "", ...childProps } = children.props;
  const baseClass = `w-full px-3 py-2.5 rounded-lg border border-[#1d3d0f]/10 text-sm bg-[#ffffff] placeholder:text-[#1d3d0f]/25 focus:outline-none focus:border-[#1d3d0f]/30 transition-colors ${childClass}`;

  return (
    <div>
      <label className="block text-xs font-medium text-[#1d3d0f]/55 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {sublabel && (
          <span className="text-[#1d3d0f]/25 font-normal ml-1">
            {sublabel}
          </span>
        )}
      </label>
      {children.type === "textarea" ? (
        <textarea {...(childProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} className={baseClass} />
      ) : (
        <input {...(childProps as React.InputHTMLAttributes<HTMLInputElement>)} className={baseClass} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-lg font-bold leading-none ${
          highlight ? "text-[#1d3d0f]" : "text-[#000000]"
        }`}
      >
        {highlight ? (
          <span className="bg-[#e8ff79] px-1.5 py-0.5 rounded">
            {value}
          </span>
        ) : (
          value
        )}
      </p>
      <p className="text-[11px] text-[#1d3d0f]/35 mt-1">{label}</p>
    </div>
  );
}
