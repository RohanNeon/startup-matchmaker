"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "./layout";
import * as XLSX from "xlsx";

interface ParsedGuest {
  email: string;
  linkedin_url: string | null;
}

function parseGuestFile(data: ArrayBuffer | string, fileName: string): { guests: ParsedGuest[]; columns: string[]; totalRows: number } {
  let rows: string[][] = [];

  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "xlsx" || ext === "xls") {
    // Excel file
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    rows = jsonData.map((r) => r.map(String));
  } else {
    // CSV / TSV / TXT — detect delimiter
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    // Detect delimiter: tab, comma, semicolon
    const firstLine = lines[0] || "";
    const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

    rows = lines.map((line) =>
      line.split(delimiter).map((cell) => cell.trim().replace(/^["']|["']$/g, ""))
    );
  }

  if (rows.length === 0) return { guests: [], columns: [], totalRows: 0 };

  // Auto-detect header row: check if first row has column-like names
  const firstRow = rows[0].map((c) => c.toLowerCase());
  const hasHeader = firstRow.some(
    (c) => c.includes("email") || c.includes("mail") || c.includes("linkedin") || c.includes("name")
  );

  const headerRow = hasHeader ? firstRow : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  // Find email column index
  let emailColIdx = -1;
  if (headerRow.length > 0) {
    emailColIdx = headerRow.findIndex(
      (h) => h === "email" || h === "e-mail" || h === "email address" || h === "emailaddress" || h.includes("email")
    );
  }
  // Fallback: scan data rows for email-like content
  if (emailColIdx === -1 && dataRows.length > 0) {
    for (let col = 0; col < (dataRows[0]?.length || 0); col++) {
      const sample = dataRows.slice(0, 5).filter((r) => r[col]?.includes("@"));
      if (sample.length >= 1) {
        emailColIdx = col;
        break;
      }
    }
  }

  // Find LinkedIn column index
  let linkedinColIdx = -1;
  if (headerRow.length > 0) {
    linkedinColIdx = headerRow.findIndex(
      (h) => h.includes("linkedin") || h.includes("profile") || h.includes("url")
    );
  }
  // Fallback: scan data for linkedin.com
  if (linkedinColIdx === -1 && dataRows.length > 0) {
    for (let col = 0; col < (dataRows[0]?.length || 0); col++) {
      if (col === emailColIdx) continue;
      const sample = dataRows.slice(0, 10).filter((r) => r[col]?.includes("linkedin.com"));
      if (sample.length >= 1) {
        linkedinColIdx = col;
        break;
      }
    }
  }

  const guests: ParsedGuest[] = [];
  for (const row of dataRows) {
    const email = emailColIdx >= 0 ? row[emailColIdx]?.toLowerCase().trim() : "";
    if (!email || !email.includes("@")) continue;

    let linkedin: string | null = null;
    if (linkedinColIdx >= 0 && row[linkedinColIdx]?.includes("linkedin.com")) {
      linkedin = row[linkedinColIdx].trim();
    }

    guests.push({ email, linkedin_url: linkedin });
  }

  // Deduplicate by email
  const seen = new Set<string>();
  const unique = guests.filter((g) => {
    if (seen.has(g.email)) return false;
    seen.add(g.email);
    return true;
  });

  return {
    guests: unique,
    columns: hasHeader ? rows[0] : [],
    totalRows: dataRows.length,
  };
}

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
  const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedColumns, setUploadedColumns] = useState<string[]>([]);
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

      if (parsedGuests.length > 0 && event?.id) {
        const entries = parsedGuests.map((g) => ({
          email: g.email,
          linkedin_url: g.linkedin_url,
          event_id: event.id,
        }));
        await supabase.from("luma_list").insert(entries);
      }

      resetForm();
      setLoading(true);
      await loadAll();
    }
    setCreating(false);
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (!result) return;
      const { guests, columns } = parseGuestFile(result as ArrayBuffer, file.name);
      setParsedGuests(guests);
      setUploadedFileName(file.name);
      setUploadedColumns(columns);
    };
    // Read as ArrayBuffer for xlsx, text for csv/txt
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
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
    setParsedGuests([]);
    setUploadedFileName("");
    setUploadedColumns([]);
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

      {/* ── Calendar ── */}
      <section>
        <h2 className="text-lg font-bold text-[#000000] tracking-tight mb-4">
          Calendar
        </h2>
        <EventCalendar events={events} />
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

              {/* File upload */}
              <div>
                <label className="block text-[11px] font-semibold text-[#1d3d0f]/45 uppercase tracking-wider mb-2">
                  Guest List
                </label>

                {parsedGuests.length === 0 ? (
                  /* Upload area */
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("border-[#1d3d0f]/30", "bg-[#e8ff79]/10");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("border-[#1d3d0f]/30", "bg-[#e8ff79]/10");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("border-[#1d3d0f]/30", "bg-[#e8ff79]/10");
                      const file = e.dataTransfer.files[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="border-2 border-dashed border-[#1d3d0f]/12 rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-[#1d3d0f]/20"
                    onClick={() =>
                      document.getElementById("guest-file-input")?.click()
                    }
                  >
                    <input
                      id="guest-file-input"
                      type="file"
                      accept=".csv,.xlsx,.xls,.tsv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-8 h-8 text-[#1d3d0f]/20"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <p className="text-sm font-medium text-[#1d3d0f]/40">
                        Drop file here or{" "}
                        <span className="text-[#1d3d0f] underline">
                          browse
                        </span>
                      </p>
                      <p className="text-[11px] text-[#1d3d0f]/25">
                        CSV, Excel, TSV — email column auto-detected
                      </p>
                    </div>
                  </div>
                ) : (
                  /* File loaded - show parsed results */
                  <div className="rounded-lg border border-[#1d3d0f]/10 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-[#fdfff0] border-b border-[#1d3d0f]/6 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-[#1d3d0f]/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs font-medium text-[#1d3d0f]/60 truncate">
                          {uploadedFileName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setParsedGuests([]);
                          setUploadedFileName("");
                          setUploadedColumns([]);
                          const input = document.getElementById("guest-file-input") as HTMLInputElement;
                          if (input) input.value = "";
                        }}
                        className="text-[11px] text-[#1d3d0f]/35 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#e8ff79]" />
                          <span className="text-xs text-[#1d3d0f]/70">
                            <span className="font-bold text-[#000000]">{parsedGuests.length}</span> unique emails
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#1d3d0f]/20" />
                          <span className="text-xs text-[#1d3d0f]/70">
                            <span className="font-bold text-[#000000]">{parsedGuests.filter((g) => g.linkedin_url).length}</span> with LinkedIn
                          </span>
                        </div>
                      </div>

                      {uploadedColumns.length > 0 && (
                        <p className="text-[11px] text-[#1d3d0f]/30">
                          Columns found: {uploadedColumns.join(", ")} — extracted email{parsedGuests.some((g) => g.linkedin_url) ? " & LinkedIn" : ""}
                        </p>
                      )}

                      {/* Preview first few emails */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {parsedGuests.slice(0, 5).map((g) => (
                          <span
                            key={g.email}
                            className="text-[11px] px-2 py-0.5 rounded bg-[#1d3d0f]/5 text-[#1d3d0f]/50 font-mono"
                          >
                            {g.email}
                          </span>
                        ))}
                        {parsedGuests.length > 5 && (
                          <span className="text-[11px] px-2 py-0.5 text-[#1d3d0f]/30">
                            +{parsedGuests.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
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
                    : parsedGuests.length > 0
                      ? `Create & Import ${parsedGuests.length} Guests`
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

function EventCalendar({ events }: { events: EventWithStats[] }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay(); // 0 = Sun
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d;

  // Build a map: "YYYY-MM-DD" → event[]
  const eventMap = new Map<string, EventWithStats[]>();
  for (const ev of events) {
    if (!ev.event_date) continue;
    const key = ev.event_date.slice(0, 10);
    if (!eventMap.has(key)) eventMap.set(key, []);
    eventMap.get(key)!.push(ev);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const getKey = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const monthLabel = firstDay.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Build calendar grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Check if any events fall in the visible range to show the legend
  const monthEvents = events.filter((ev) => {
    if (!ev.event_date) return false;
    const d = new Date(ev.event_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
      {/* Header: month nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#000000]">{monthLabel}</h3>
          {!(today.getFullYear() === year && today.getMonth() === month) && (
            <button
              onClick={goToday}
              className="text-[10px] px-2 py-0.5 rounded bg-[#1d3d0f]/5 text-[#1d3d0f]/50 hover:text-[#1d3d0f] transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1d3d0f]/5 transition-colors text-[#1d3d0f]/40 hover:text-[#1d3d0f]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#1d3d0f]/5 transition-colors text-[#1d3d0f]/40 hover:text-[#1d3d0f]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-[#1d3d0f]/30 uppercase tracking-wider py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const key = getKey(day);
          const dayEvents = eventMap.get(key) || [];
          const hasEvent = dayEvents.length > 0;
          const todayCell = isToday(day);

          return (
            <div
              key={key}
              className={`aspect-square flex flex-col items-center justify-center relative rounded-lg transition-colors ${
                hasEvent
                  ? "bg-[#1d3d0f] cursor-default"
                  : todayCell
                    ? "bg-[#1d3d0f]/8"
                    : "hover:bg-[#1d3d0f]/3"
              }`}
              title={
                hasEvent
                  ? dayEvents.map((e) => e.name).join(", ")
                  : undefined
              }
            >
              <span
                className={`text-xs font-medium leading-none ${
                  hasEvent
                    ? "text-[#e8ff79] font-bold"
                    : todayCell
                      ? "text-[#1d3d0f] font-bold"
                      : "text-[#000000]/60"
                }`}
              >
                {day}
              </span>
              {hasEvent && (
                <span className="w-1 h-1 rounded-full bg-[#e8ff79] mt-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Events this month */}
      {monthEvents.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1d3d0f]/6 space-y-2">
          {monthEvents.map((ev) => (
            <Link
              key={ev.id}
              href={`/admin/event/${ev.slug}`}
              className="flex items-center gap-3 group"
            >
              <span className="w-2 h-2 rounded-full bg-[#1d3d0f] flex-shrink-0" />
              <span className="text-xs font-medium text-[#000000] group-hover:underline truncate">
                {ev.name}
              </span>
              <span className="text-[10px] text-[#1d3d0f]/35 flex-shrink-0">
                {ev.event_date
                  ? new Date(ev.event_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                  : ""}
              </span>
              {ev.is_active && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#e8ff79] text-[#1d3d0f] font-semibold flex-shrink-0">
                  Active
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
