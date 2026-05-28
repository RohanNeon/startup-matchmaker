"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "../../layout";

interface EventData {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

interface Participant {
  email: string;
  name: string;
  company: string;
  role: string;
  what_building: string | null;
  looking_for: string[];
  can_offer: string[];
  created_at: string;
}

interface GuestEntry {
  email: string;
  linkedin_url: string | null;
}

interface MatchEntry {
  profile_email: string;
  match_email: string;
  match_rank: number;
  score: number;
  linkedin_url: string | null;
}

type Tab = "participants" | "guests" | "matches" | "emails";

export default function EventDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const adminUser = useAdminUser();
  const isSuperAdmin = adminUser?.role === "super_admin";

  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("participants");

  // Action states
  const [computing, setComputing] = useState(false);
  const [computeResult, setComputeResult] = useState("");
  const [sendingDryRun, setSendingDryRun] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<string>("");
  const [sendingEmails, setSendingEmails] = useState(false);
  const [sendResult, setSendResult] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState("");

  // CSV upload
  const [csvText, setCsvText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState("");

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  }

  const loadEventData = useCallback(async () => {
    // Fetch event by slug
    const { data: eventData } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!eventData) {
      setError("Event not found.");
      setLoading(false);
      return;
    }

    setEvent(eventData);

    // For the first event (agentic-infra-2026), data has event_id = NULL
    const isLegacyEvent = eventData.slug === "agentic-infra-2026";

    // Fetch participants
    let participantsQuery = supabase
      .from("profiles")
      .select("email, name, company, role, what_building, looking_for, can_offer, created_at")
      .order("created_at", { ascending: true });

    if (isLegacyEvent) {
      participantsQuery = participantsQuery.is("event_id", null);
    } else {
      participantsQuery = participantsQuery.eq("event_id", eventData.id);
    }

    const { data: participantsData } = await participantsQuery;
    setParticipants((participantsData as Participant[]) || []);

    // Fetch guest list
    let guestsQuery = supabase
      .from("luma_list")
      .select("email, linkedin_url")
      .order("email", { ascending: true });

    if (isLegacyEvent) {
      guestsQuery = guestsQuery.is("event_id", null);
    } else {
      guestsQuery = guestsQuery.eq("event_id", eventData.id);
    }

    const { data: guestsData } = await guestsQuery;
    setGuests((guestsData as GuestEntry[]) || []);

    // Fetch matches
    let matchesQuery = supabase
      .from("matches")
      .select("profile_email, match_email, match_rank, score, linkedin_url")
      .order("profile_email", { ascending: true })
      .order("match_rank", { ascending: true });

    if (isLegacyEvent) {
      matchesQuery = matchesQuery.is("event_id", null);
    } else {
      matchesQuery = matchesQuery.eq("event_id", eventData.id);
    }

    const { data: matchesData } = await matchesQuery;
    setMatches((matchesData as MatchEntry[]) || []);

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  // ---- Actions ----

  async function handleComputeMatches() {
    if (!event) return;
    setComputing(true);
    setComputeResult("");

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/event-compute-matches", {
        method: "POST",
        headers,
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setComputeResult(
          `Computed ${data.totalMatches} matches for ${data.profileCount} profiles.`
        );
        await loadEventData();
      } else {
        setComputeResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setComputeResult(`Network error: ${err}`);
    }

    setComputing(false);
  }

  async function handleDryRun() {
    if (!event) return;
    setSendingDryRun(true);
    setDryRunResult("");

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/event-send-match-emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId: event.id,
          // No confirm = dry run
        }),
      });
      const data = await res.json();
      const dryRunList = data.results
        ?.map(
          (r: { email: string; matchCount: number }) =>
            `  ${r.email} → ${r.matchCount} matches`
        )
        .join("\n");

      setDryRunResult(
        `DRY RUN — ${data.dryRunCount || 0} recipients would receive emails:\n${dryRunList || "(none)"}`
      );
    } catch (err) {
      setDryRunResult(`Network error: ${err}`);
    }

    setSendingDryRun(false);
  }

  async function handleSendTestEmail() {
    if (!event || !testEmail) return;
    setSendingTest(true);
    setTestResult("");

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/event-send-match-emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId: event.id,
          targetEmail: testEmail.trim().toLowerCase(),
          confirm: true,
        }),
      });
      const data = await res.json();
      const status =
        data.results?.[0]?.status || data.error || "Unknown result";
      setTestResult(`Test email to ${testEmail}: ${status}`);
    } catch (err) {
      setTestResult(`Network error: ${err}`);
    }

    setSendingTest(false);
  }

  async function handleBatchSend() {
    if (!event) return;

    const confirmed = window.confirm(
      `⚠️ BATCH SEND\n\nThis will send match emails to ALL ${participants.length} registered participants for "${event.name}".\n\nAre you absolutely sure?`
    );
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      `FINAL CONFIRMATION\n\nSending to ${participants.length} people. This cannot be undone.\n\nProceed?`
    );
    if (!doubleConfirm) return;

    setSendingEmails(true);
    setSendResult("");

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/event-send-match-emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventId: event.id,
          confirm: "SEND_ALL",
        }),
      });
      const data = await res.json();
      setSendResult(
        `${data.mode}: ${data.sent || 0} emails sent out of ${data.total || 0} total.`
      );
    } catch (err) {
      setSendResult(`Network error: ${err}`);
    }

    setSendingEmails(false);
  }

  async function handleCsvUpload() {
    if (!event || !csvText.trim()) return;
    setUploading(true);
    setUploadResult("");

    try {
      // Parse CSV — expect email,linkedin_url per line
      const lines = csvText
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      // Skip header if present
      const startIdx =
        lines[0]?.toLowerCase().includes("email") ? 1 : 0;

      const entries: { email: string; linkedin_url: string | null; event_id: string }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/"/g, ""));
        const email = parts[0]?.toLowerCase().trim();
        if (!email || !email.includes("@")) continue;
        const linkedin = parts[1] || null;
        entries.push({ email, linkedin_url: linkedin, event_id: event.id });
      }

      if (entries.length === 0) {
        setUploadResult("No valid emails found in CSV.");
        setUploading(false);
        return;
      }

      // Insert using admin endpoint — since we're using anon key,
      // we need to use the service role key via an API route.
      // For now, use supabase directly (assuming RLS allows or is disabled for admin)
      const { error: insertError, data: insertData } = await supabase
        .from("luma_list")
        .upsert(entries, { onConflict: "id" })
        .select();

      if (insertError) {
        setUploadResult(`Error: ${insertError.message}`);
      } else {
        setUploadResult(
          `Uploaded ${insertData?.length || entries.length} guest entries.`
        );
        await loadEventData();
      }
    } catch (err) {
      setUploadResult(`Error: ${err}`);
    }

    setCsvText("");
    setUploading(false);
  }

  async function handleToggleActive() {
    if (!event) return;
    const { error: updateError } = await supabase
      .from("events")
      .update({ is_active: !event.is_active })
      .eq("id", event.id);

    if (!updateError) {
      setEvent({ ...event, is_active: !event.is_active });
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-neon-dark/60">{error || "Event not found"}</p>
        <Link
          href="/admin"
          className="text-sm text-neon-dark/50 hover:text-neon-dark mt-4 inline-block"
        >
          ← Back to events
        </Link>
      </div>
    );
  }

  const uniqueMatchProfiles = new Set(matches.map((m) => m.profile_email)).size;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "participants", label: "Registered", count: participants.length },
    { key: "guests", label: "Guest List", count: guests.length },
    { key: "matches", label: "Matches", count: matches.length },
    ...(isSuperAdmin
      ? [{ key: "emails" as Tab, label: "Email Controls", count: 0 }]
      : []),
  ];

  return (
    <div>
      {/* Back + Header */}
      <Link
        href="/admin"
        className="text-sm text-neon-dark/50 hover:text-neon-dark transition-colors mb-4 inline-block"
      >
        ← All events
      </Link>

      <div className="bg-white rounded-2xl border border-neon-dark/10 p-5 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-neon-dark">{event.name}</h1>
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
            <p className="text-xs text-neon-dark/30 mt-1">
              /event/{event.slug}
            </p>
          </div>
          {isSuperAdmin ? (
            <button
              onClick={handleToggleActive}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                event.is_active
                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                  : "bg-neon-dark/5 text-neon-dark/40 hover:bg-neon-dark/10"
              }`}
            >
              {event.is_active ? "Active" : "Closed"}
            </button>
          ) : (
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                event.is_active
                  ? "bg-green-50 text-green-700"
                  : "bg-neon-dark/5 text-neon-dark/40"
              }`}
            >
              {event.is_active ? "Active" : "Closed"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard label="Guest List" value={guests.length} />
          <StatCard label="Registered" value={participants.length} />
          <StatCard
            label="Conversion"
            value={
              guests.length > 0
                ? `${Math.round((participants.length / guests.length) * 100)}%`
                : "—"
            }
          />
          <StatCard label="Matches" value={matches.length} />
          <StatCard label="Matched Users" value={uniqueMatchProfiles} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-neon-dark/5 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-neon-dark shadow-sm"
                : "text-neon-dark/50 hover:text-neon-dark/70"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "participants" && (
        <ParticipantsTab participants={participants} />
      )}
      {activeTab === "guests" && (
        <GuestsTab
          guests={guests}
          csvText={csvText}
          setCsvText={setCsvText}
          uploading={uploading}
          handleCsvUpload={handleCsvUpload}
          uploadResult={uploadResult}
          isSuperAdmin={isSuperAdmin}
        />
      )}
      {activeTab === "matches" && (
        <MatchesTab matches={matches} />
      )}
      {activeTab === "emails" && (
        <EmailsTab
          event={event}
          participants={participants}
          matches={matches}
          computing={computing}
          computeResult={computeResult}
          handleComputeMatches={handleComputeMatches}
          sendingDryRun={sendingDryRun}
          dryRunResult={dryRunResult}
          handleDryRun={handleDryRun}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          sendingTest={sendingTest}
          testResult={testResult}
          handleSendTestEmail={handleSendTestEmail}
          sendingEmails={sendingEmails}
          sendResult={sendResult}
          handleBatchSend={handleBatchSend}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-neon-bg rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-neon-dark">{value}</p>
      <p className="text-xs text-neon-dark/50">{label}</p>
    </div>
  );
}

function ParticipantsTab({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-neon-dark/10 p-8 text-center">
        <p className="text-neon-dark/40">No registrations yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neon-dark/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neon-dark/10 bg-neon-bg">
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                #
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Email
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Company
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Role
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Looking For
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Can Offer
              </th>
              <th className="text-left px-4 py-3 font-medium text-neon-dark/60">
                Registered
              </th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <tr
                key={p.email}
                className="border-b border-neon-dark/5 hover:bg-neon-bg/50"
              >
                <td className="px-4 py-3 text-neon-dark/40">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-neon-dark">
                  {p.name}
                </td>
                <td className="px-4 py-3 text-neon-dark/70">{p.email}</td>
                <td className="px-4 py-3 text-neon-dark/70">{p.company}</td>
                <td className="px-4 py-3 text-neon-dark/70">{p.role}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.looking_for.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.can_offer.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-neon-dark/40">
                  {new Date(p.created_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GuestsTab({
  guests,
  csvText,
  setCsvText,
  uploading,
  handleCsvUpload,
  uploadResult,
  isSuperAdmin,
}: {
  guests: GuestEntry[];
  csvText: string;
  setCsvText: (v: string) => void;
  uploading: boolean;
  handleCsvUpload: () => void;
  uploadResult: string;
  isSuperAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* CSV Upload — only for super admin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-neon-dark/10 p-5">
          <h3 className="text-sm font-semibold text-neon-dark mb-2">
            Upload Guest List (CSV)
          </h3>
          <p className="text-xs text-neon-dark/40 mb-3">
            Paste CSV with columns: email, linkedin_url (one per line)
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"email,linkedin_url\njane@example.com,https://linkedin.com/in/jane\njohn@example.com,"}
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-neon-dark/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white resize-none"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleCsvUpload}
              disabled={uploading || !csvText.trim()}
              className="px-4 py-2 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
            {uploadResult && (
              <p className="text-sm text-neon-dark/60">{uploadResult}</p>
            )}
          </div>
        </div>
      )}

      {/* Guest list table */}
      <div className="bg-white rounded-2xl border border-neon-dark/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-neon-dark/10 bg-neon-bg">
          <h3 className="text-sm font-semibold text-neon-dark">
            Guest List ({guests.length})
          </h3>
        </div>
        {guests.length === 0 ? (
          <p className="p-8 text-center text-neon-dark/40">
            No guests added yet. Upload a CSV above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neon-dark/10">
                  <th className="text-left px-4 py-2 font-medium text-neon-dark/60">
                    #
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-neon-dark/60">
                    Email
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-neon-dark/60">
                    LinkedIn
                  </th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g, i) => (
                  <tr
                    key={g.email}
                    className="border-b border-neon-dark/5 hover:bg-neon-bg/50"
                  >
                    <td className="px-4 py-2 text-neon-dark/40">{i + 1}</td>
                    <td className="px-4 py-2 text-neon-dark/70">{g.email}</td>
                    <td className="px-4 py-2">
                      {g.linkedin_url ? (
                        <a
                          href={g.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Profile
                        </a>
                      ) : (
                        <span className="text-neon-dark/30 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchesTab({ matches }: { matches: MatchEntry[] }) {
  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-neon-dark/10 p-8 text-center">
        <p className="text-neon-dark/40">
          No matches computed yet. Go to Email Controls to compute matches.
        </p>
      </div>
    );
  }

  // Group by profile_email
  const grouped = new Map<string, MatchEntry[]>();
  for (const m of matches) {
    const existing = grouped.get(m.profile_email) || [];
    existing.push(m);
    grouped.set(m.profile_email, existing);
  }

  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([profileEmail, profileMatches]) => (
        <div
          key={profileEmail}
          className="bg-white rounded-2xl border border-neon-dark/10 p-4"
        >
          <h3 className="text-sm font-semibold text-neon-dark mb-2">
            {profileEmail}
          </h3>
          <div className="space-y-1">
            {profileMatches.map((m) => (
              <div
                key={`${m.profile_email}-${m.match_rank}`}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-neon-bg rounded-full text-xs font-bold text-neon-dark">
                  {m.match_rank}
                </span>
                <span className="text-neon-dark/70">{m.match_email}</span>
                <span className="text-xs text-neon-dark/40">
                  score: {m.score}
                </span>
                {m.linkedin_url && (
                  <a
                    href={m.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline ml-auto"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailsTab({
  event,
  participants,
  matches,
  computing,
  computeResult,
  handleComputeMatches,
  sendingDryRun,
  dryRunResult,
  handleDryRun,
  testEmail,
  setTestEmail,
  sendingTest,
  testResult,
  handleSendTestEmail,
  sendingEmails,
  sendResult,
  handleBatchSend,
}: {
  event: EventData;
  participants: Participant[];
  matches: MatchEntry[];
  computing: boolean;
  computeResult: string;
  handleComputeMatches: () => void;
  sendingDryRun: boolean;
  dryRunResult: string;
  handleDryRun: () => void;
  testEmail: string;
  setTestEmail: (v: string) => void;
  sendingTest: boolean;
  testResult: string;
  handleSendTestEmail: () => void;
  sendingEmails: boolean;
  sendResult: string;
  handleBatchSend: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Step 1: Compute Matches */}
      <div className="bg-white rounded-2xl border border-neon-dark/10 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 flex items-center justify-center bg-neon-dark text-neon rounded-full text-xs font-bold">
            1
          </span>
          <h3 className="text-sm font-semibold text-neon-dark">
            Compute Matches
          </h3>
        </div>
        <p className="text-xs text-neon-dark/40 mb-3 ml-8">
          Run the matching algorithm on {participants.length} registered
          participants.{" "}
          {matches.length > 0 &&
            `(${matches.length} matches already computed)`}
        </p>
        <div className="ml-8 flex items-center gap-3">
          <button
            onClick={handleComputeMatches}
            disabled={computing || participants.length < 2}
            className="px-4 py-2 bg-neon-dark text-neon rounded-xl text-sm font-semibold hover:bg-neon-dark/90 transition-colors disabled:opacity-50"
          >
            {computing
              ? "Computing..."
              : matches.length > 0
              ? "Recompute Matches"
              : "Compute Matches"}
          </button>
          {computeResult && (
            <p className="text-sm text-neon-dark/60">{computeResult}</p>
          )}
        </div>
      </div>

      {/* Step 2: Dry Run */}
      <div className="bg-white rounded-2xl border border-neon-dark/10 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 flex items-center justify-center bg-neon-dark text-neon rounded-full text-xs font-bold">
            2
          </span>
          <h3 className="text-sm font-semibold text-neon-dark">
            Dry Run (Preview)
          </h3>
        </div>
        <p className="text-xs text-neon-dark/40 mb-3 ml-8">
          See who would receive emails without actually sending anything.
        </p>
        <div className="ml-8">
          <button
            onClick={handleDryRun}
            disabled={sendingDryRun || matches.length === 0}
            className="px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            {sendingDryRun ? "Running..." : "Run Dry Run"}
          </button>
          {dryRunResult && (
            <pre className="mt-3 text-xs text-neon-dark/60 bg-neon-bg rounded-lg p-3 whitespace-pre-wrap font-mono">
              {dryRunResult}
            </pre>
          )}
        </div>
      </div>

      {/* Step 3: Test Send */}
      <div className="bg-white rounded-2xl border border-neon-dark/10 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 flex items-center justify-center bg-neon-dark text-neon rounded-full text-xs font-bold">
            3
          </span>
          <h3 className="text-sm font-semibold text-neon-dark">
            Send Test Email
          </h3>
        </div>
        <p className="text-xs text-neon-dark/40 mb-3 ml-8">
          Send a real match email to ONE person to verify it looks correct.
        </p>
        <div className="ml-8 flex items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className="px-3 py-2 rounded-lg border border-neon-dark/15 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neon-dark bg-white"
          />
          <button
            onClick={handleSendTestEmail}
            disabled={sendingTest || !testEmail || matches.length === 0}
            className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {sendingTest ? "Sending..." : "Send Test"}
          </button>
        </div>
        {testResult && (
          <p className="ml-8 mt-2 text-sm text-neon-dark/60">{testResult}</p>
        )}
      </div>

      {/* Step 4: Batch Send */}
      <div className="bg-white rounded-2xl border border-red-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-6 flex items-center justify-center bg-red-600 text-white rounded-full text-xs font-bold">
            4
          </span>
          <h3 className="text-sm font-semibold text-red-700">
            Send to All Participants
          </h3>
        </div>
        <p className="text-xs text-red-500/70 mb-3 ml-8">
          This will send match emails to ALL registered participants. Two
          confirmation dialogs will appear. This action cannot be undone.
        </p>
        <div className="ml-8 flex items-center gap-3">
          <button
            onClick={handleBatchSend}
            disabled={sendingEmails || matches.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {sendingEmails ? "Sending..." : `Send to All (${new Set(matches.map(m => m.profile_email)).size} people)`}
          </button>
          {sendResult && (
            <p className="text-sm text-neon-dark/60">{sendResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}
