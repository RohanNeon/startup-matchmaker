"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "../../layout";

interface EventData {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  luma_url: string | null;
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
  checked_in: boolean;
}

interface MatchEntry {
  profile_email: string;
  match_email: string;
  match_rank: number;
  score: number;
  linkedin_url: string | null;
}

type Tab = "participants" | "guests" | "checkins" | "matches" | "emails";

export default function EventDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const adminUser = useAdminUser();
  const isSuperAdmin = adminUser?.role === "super_admin";
  const router = useRouter();

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

    const isLegacyEvent = eventData.slug === "agentic-infra-2026";

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

    let guestsQuery = supabase
      .from("luma_list")
      .select("email, linkedin_url, checked_in")
      .order("email", { ascending: true });

    if (isLegacyEvent) {
      guestsQuery = guestsQuery.is("event_id", null);
    } else {
      guestsQuery = guestsQuery.eq("event_id", eventData.id);
    }

    const { data: guestsData } = await guestsQuery;
    setGuests((guestsData as GuestEntry[]) || []);

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
          `MatchUp complete — ${data.totalMatches} matches for ${data.profileCount} profiles.`
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
        body: JSON.stringify({ eventId: event.id }),
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
      `⚠️ BATCH SEND\n\nThis will send MatchUp results to ALL ${participants.length} registered participants for "${event.name}".\n\nAre you absolutely sure?`
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

  async function handleFileUpload(entries: { email: string; linkedin_url: string | null; event_id: string }[]) {
    if (!event) return;
    setUploading(true);
    setUploadResult("");

    try {
      const { error: insertError, data: insertData } = await supabase
        .from("luma_list")
        .upsert(entries, { onConflict: "id" })
        .select();

      if (insertError) {
        setUploadResult(`Error: ${insertError.message}`);
      } else {
        setUploadResult(
          `Added ${insertData?.length || entries.length} guests successfully`
        );
        await loadEventData();
      }
    } catch (err) {
      setUploadResult(`Error: ${err}`);
    }

    setUploading(false);
  }

  async function handleAddSingleGuest(email: string, linkedin: string) {
    if (!event) return;
    const { error: insertError } = await supabase
      .from("luma_list")
      .upsert([{
        email: email.toLowerCase().trim(),
        linkedin_url: linkedin.trim() || null,
        event_id: event.id,
      }], { onConflict: "id" });

    if (insertError) {
      alert(`Failed to add: ${insertError.message}`);
    } else {
      await loadEventData();
    }
  }

  async function handleDeleteGuest(email: string) {
    if (!event) return;
    const confirmed = window.confirm(`Remove ${email} from the guest list?`);
    if (!confirmed) return;

    const isLegacyEvent = event.slug === "agentic-infra-2026";
    let query = supabase.from("luma_list").delete().eq("email", email);
    if (isLegacyEvent) {
      query = query.is("event_id", null);
    } else {
      query = query.eq("event_id", event.id);
    }

    const { error: deleteError } = await query;
    if (deleteError) {
      alert(`Failed to remove: ${deleteError.message}`);
    } else {
      await loadEventData();
    }
  }

  async function handleToggleActive() {
    if (!event) return;
    const newStatus = !event.is_active;
    const action = newStatus ? "activate" : "close";
    const confirmed = window.confirm(
      `${action === "activate" ? "Reactivate" : "Close"} "${event.name}"?${
        action === "close" ? "\n\nRegistration form will stop accepting new entries." : ""
      }`
    );
    if (!confirmed) return;

    const { error: updateError } = await supabase
      .from("events")
      .update({ is_active: newStatus })
      .eq("id", event.id);

    if (!updateError) {
      setEvent({ ...event, is_active: newStatus });
    }
  }

  async function handleDeleteEvent() {
    if (!event) return;
    const confirmed = window.confirm(
      `Delete "${event.name}"?\n\nThis will permanently delete the event and ALL related data (guest list, registrations, matches).\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      `Final confirmation: permanently delete "${event.name}" and all its data?`
    );
    if (!doubleConfirm) return;

    const headers = await getAuthHeaders();
    const res = await fetch("/api/events", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ eventId: event.id }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      alert(`Failed to delete: ${data.error}`);
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="neon-loader" />
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
  const checkedInCount = guests.filter((g) => g.checked_in).length;
  const registeredEmails = new Set(participants.map((p) => p.email.toLowerCase()));

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      key: "participants",
      label: "Registered",
      count: participants.length,
      icon: <IconPerson />,
    },
    {
      key: "guests",
      label: "Guest List",
      count: guests.length,
      icon: <IconList />,
    },
    {
      key: "checkins",
      label: "Check-ins",
      count: checkedInCount,
      icon: <IconCheckCircle />,
    },
    {
      key: "matches",
      label: "MatchUp",
      count: matches.length,
      icon: <IconLink />,
    },
    ...(isSuperAdmin
      ? [{
          key: "emails" as Tab,
          label: "Email Controls",
          count: 0,
          icon: <IconMail />,
        }]
      : []),
  ];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin"
        className="text-sm text-neon-dark/55 hover:text-neon-dark transition-colors mb-4 inline-flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All events
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-neon-dark/10 mb-6 overflow-hidden">
        {/* Top section with event info */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-neon-dark">{event.name}</h1>
                {/* Status indicator */}
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 ${
                  event.is_active
                    ? "bg-[#e8ff79]/40 text-neon-dark"
                    : "bg-neon-dark/5 text-neon-dark/55"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${event.is_active ? "bg-neon-dark" : "bg-neon-dark/20"}`} />
                  {event.is_active ? "Active" : "Closed"}
                </span>
              </div>
              <p className="text-sm text-neon-dark/65 mt-1">
                {event.event_date
                  ? new Date(event.event_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Date TBD"}
                {event.location && ` · ${event.location}`}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-neon-dark/40 font-mono">
                  /event/{event.slug}
                </span>
                {event.luma_url && (
                  <a
                    href={event.luma_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neon-dark/50 hover:text-neon-dark/80 transition-colors"
                  >
                    Luma
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Admin controls */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                <button
                  onClick={handleToggleActive}
                  className="text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors text-neon-dark/60 hover:text-neon-dark hover:bg-neon-dark/5 border border-neon-dark/10"
                >
                  {event.is_active ? "Close Event" : "Reactivate"}
                </button>
                <button
                  onClick={handleDeleteEvent}
                  className="p-1.5 rounded-lg text-neon-dark/30 hover:text-neon-dark/70 hover:bg-neon-dark/5 transition-colors"
                  title="Delete event"
                >
                  <IconTrash />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metrics strip — full width with dividers */}
        <div className="border-t border-neon-dark/6 grid grid-cols-2 sm:grid-cols-5 divide-x divide-neon-dark/6 bg-neon-bg/40">
          <MetricCell label="Invited" value={guests.length} />
          <MetricCell label="Registered" value={participants.length} highlight />
          <MetricCell
            label="Conversion"
            value={
              guests.length > 0
                ? `${Math.round((participants.length / guests.length) * 100)}%`
                : "—"
            }
          />
          <MetricCell label="MatchUps" value={matches.length} />
          <MetricCell label="Matched" value={uniqueMatchProfiles} />
        </div>
      </div>

      {/* Charts */}
      {participants.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <DemandSupplyChart participants={participants} />
          <RoleBreakdown participants={participants} />
        </div>
      )}

      {/* ─── Tab Navigation ─── */}
      <div className="bg-white rounded-2xl border border-neon-dark/10 overflow-hidden mb-6">
        <div className="flex border-b border-neon-dark/8">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-3.5 px-2 text-sm font-medium transition-all relative
                  ${isActive
                    ? "text-neon-dark"
                    : "text-neon-dark/55 hover:text-neon-dark/80 hover:bg-neon-dark/[0.02]"
                  }
                `}
              >
                <span className={`transition-colors ${isActive ? "text-neon-dark" : "text-neon-dark/45"}`}>
                  {tab.icon}
                </span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`
                      text-[11px] font-semibold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center
                      ${isActive
                        ? "bg-neon-dark text-white"
                        : "bg-neon-dark/8 text-neon-dark/60"
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                )}
                {/* Active bottom bar */}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-neon-dark rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content lives inside the card */}
        <div className="p-0">
          {activeTab === "participants" && (
            <ParticipantsTab participants={participants} />
          )}
          {activeTab === "guests" && (
            <GuestsTab
              guests={guests}
              event={event}
              registeredEmails={registeredEmails}
              uploading={uploading}
              uploadResult={uploadResult}
              handleFileUpload={handleFileUpload}
              handleAddSingleGuest={handleAddSingleGuest}
              handleDeleteGuest={handleDeleteGuest}
              isSuperAdmin={isSuperAdmin}
            />
          )}
          {activeTab === "checkins" && (
            <CheckInsTab guests={guests} participants={participants} />
          )}
          {activeTab === "matches" && (
            <MatchesTab matches={matches} participants={participants} />
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
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Icons (inline SVG, brand-color-only)
   ═══════════════════════════════════════════ */

function IconPerson() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconList() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}


/* ═══════════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════════ */

function MetricCell({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="px-4 py-3.5 text-center">
      <p className={`text-xl font-bold leading-tight ${highlight ? "text-neon-dark" : "text-neon-dark/80"}`}>{value}</p>
      <p className="text-[10px] text-neon-dark/55 mt-0.5 uppercase tracking-wider font-medium">{label}</p>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Search Bar (shared)
   ═══════════════════════════════════════════ */

function SearchBar({
  value,
  onChange,
  placeholder,
  count,
  total,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  count?: number;
  total?: number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-neon-dark/8">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-neon-dark/50"><IconSearch /></span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-neon-dark/40 text-neon-dark"
        />
        {value && (
          <button onClick={() => onChange("")} className="text-neon-dark/50 hover:text-neon-dark/80 text-xs">
            Clear
          </button>
        )}
      </div>
      {count !== undefined && total !== undefined && value && (
        <span className="text-xs text-neon-dark/55 flex-shrink-0">
          {count} of {total}
        </span>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   Registered Tab
   ═══════════════════════════════════════════ */

function ParticipantsTab({ participants }: { participants: Participant[] }) {
  const [search, setSearch] = useState("");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  const filtered = participants.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  if (participants.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-neon-dark/30 mb-3"><IconPerson /></div>
        <p className="text-sm text-neon-dark/60">No registrations yet</p>
        <p className="text-xs text-neon-dark/45 mt-1">People will appear here once they fill the event form</p>
      </div>
    );
  }

  return (
    <div>
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, company, or role..."
        count={filtered.length}
        total={participants.length}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neon-dark/8 bg-neon-bg/50">
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs w-10">#</th>
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs">Company</th>
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs hidden md:table-cell">Role</th>
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs hidden lg:table-cell">Looking For</th>
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs hidden lg:table-cell">Can Offer</th>
              <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const isExpanded = expandedEmail === p.email;
              return (
                <tr key={p.email} className="group">
                  <td colSpan={7} className="p-0">
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedEmail(isExpanded ? null : p.email)}
                      className="w-full flex items-center text-left hover:bg-neon-bg/40 transition-colors"
                    >
                      <span className="px-4 py-3 text-neon-dark/50 text-xs w-10 flex-shrink-0">{i + 1}</span>
                      <span className="px-4 py-3 flex-1 min-w-0">
                        <span className="font-medium text-neon-dark block truncate">{p.name}</span>
                        <span className="text-xs text-neon-dark/55 block truncate md:hidden">{p.role} at {p.company}</span>
                      </span>
                      <span className="px-4 py-3 text-neon-dark/60 hidden sm:block w-36 truncate flex-shrink-0">{p.company}</span>
                      <span className="px-4 py-3 text-neon-dark/60 hidden md:block w-32 truncate flex-shrink-0">{p.role}</span>
                      <span className="px-4 py-3 hidden lg:flex gap-1 w-40 flex-shrink-0 flex-wrap">
                        {p.looking_for.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-dark/8 text-neon-dark/60">{tag}</span>
                        ))}
                      </span>
                      <span className="px-4 py-3 hidden lg:flex gap-1 w-40 flex-shrink-0 flex-wrap">
                        {p.can_offer.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-dark/8 text-neon-dark/60">{tag}</span>
                        ))}
                      </span>
                      <span className="px-4 py-3 w-10 flex-shrink-0 text-neon-dark/45">
                        <IconChevron open={isExpanded} />
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="bg-neon-bg/40 border-t border-neon-dark/5 px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <label className="text-[10px] font-semibold text-neon-dark/55 uppercase tracking-wider">Email</label>
                            <p className="text-neon-dark/70 mt-0.5 text-xs break-all">{p.email}</p>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-neon-dark/55 uppercase tracking-wider">Role</label>
                            <p className="text-neon-dark/70 mt-0.5">{p.role} at {p.company}</p>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-neon-dark/55 uppercase tracking-wider">Looking For</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.looking_for.map((tag) => (
                                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-white text-neon-dark/70 border border-neon-dark/10">{tag}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-neon-dark/55 uppercase tracking-wider">Can Offer</label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.can_offer.map((tag) => (
                                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-white text-neon-dark/70 border border-neon-dark/10">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {p.what_building && (
                          <div className="mt-3 pt-3 border-t border-neon-dark/5">
                            <label className="text-[10px] font-semibold text-neon-dark/55 uppercase tracking-wider">What they&apos;re building</label>
                            <p className="text-sm text-neon-dark/70 mt-1 leading-relaxed">{p.what_building}</p>
                          </div>
                        )}
                        <p className="text-[10px] text-neon-dark/45 mt-3">
                          Registered {new Date(p.created_at).toLocaleString("en-IN", {
                            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}

                    {/* Row divider */}
                    {!isExpanded && <div className="border-b border-neon-dark/5" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && search && (
        <div className="p-8 text-center">
          <p className="text-sm text-neon-dark/60">No results for &ldquo;{search}&rdquo;</p>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   Guest List Tab
   ═══════════════════════════════════════════ */

function GuestsTab({
  guests,
  event,
  registeredEmails,
  uploading,
  uploadResult,
  handleFileUpload,
  handleAddSingleGuest,
  handleDeleteGuest,
  isSuperAdmin,
}: {
  guests: GuestEntry[];
  event: EventData;
  registeredEmails: Set<string>;
  uploading: boolean;
  uploadResult: string;
  handleFileUpload: (entries: { email: string; linkedin_url: string | null; event_id: string }[]) => void;
  handleAddSingleGuest: (email: string, linkedin: string) => Promise<void>;
  handleDeleteGuest: (email: string) => void;
  isSuperAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addLinkedin, setAddLinkedin] = useState("");
  const [adding, setAdding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const registeredCount = guests.filter((g) => registeredEmails.has(g.email.toLowerCase())).length;

  const filtered = guests.filter((g) => {
    if (!search) return true;
    return g.email.toLowerCase().includes(search.toLowerCase());
  });

  async function handleAdd() {
    if (!addEmail.trim()) return;
    setAdding(true);
    await handleAddSingleGuest(addEmail, addLinkedin);
    setAddEmail("");
    setAddLinkedin("");
    setShowAddForm(false);
    setAdding(false);
  }

  function parseFileContent(file: File) {
    const reader = new FileReader();
    const isExcel = file.name.match(/\.(xlsx|xls)$/i);

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

          const entries: { email: string; linkedin_url: string | null; event_id: string }[] = [];
          for (const row of rows) {
            const email = (row.email || row.Email || row.EMAIL || Object.values(row)[0] || "").toLowerCase().trim();
            if (!email || !email.includes("@")) continue;
            const linkedin = row.linkedin_url || row.LinkedIn || row.linkedin || Object.values(row)[1] || null;
            entries.push({ email, linkedin_url: linkedin || null, event_id: event.id });
          }

          if (entries.length > 0) {
            handleFileUpload(entries);
          }
        } catch {
          alert("Could not parse Excel file. Please check the format.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
        const startIdx = lines[0]?.toLowerCase().includes("email") ? 1 : 0;

        const entries: { email: string; linkedin_url: string | null; event_id: string }[] = [];
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i].split(",").map((p) => p.trim().replace(/"/g, ""));
          const email = parts[0]?.toLowerCase().trim();
          if (!email || !email.includes("@")) continue;
          const linkedin = parts[1] || null;
          entries.push({ email, linkedin_url: linkedin, event_id: event.id });
        }

        if (entries.length > 0) {
          handleFileUpload(entries);
        } else {
          alert("No valid emails found in CSV.");
        }
      };
      reader.readAsText(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFileContent(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFileContent(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      {/* Toolbar: search + actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neon-dark/8">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-neon-dark/50"><IconSearch /></span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-neon-dark/40 text-neon-dark"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-neon-dark/50 hover:text-neon-dark/80 text-xs">
              Clear
            </button>
          )}
        </div>

        {/* Status summary */}
        <span className="text-xs text-neon-dark/55 hidden sm:inline flex-shrink-0">
          {registeredCount} of {guests.length} registered
        </span>

        {/* Action buttons */}
        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { setShowUpload(!showUpload); setShowAddForm(false); }}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                showUpload
                  ? "bg-neon-dark text-white"
                  : "text-neon-dark/50 hover:text-neon-dark hover:bg-neon-dark/5 border border-neon-dark/10"
              }`}
            >
              <IconUpload />
              <span className="hidden sm:inline">Upload</span>
            </button>
            <button
              onClick={() => { setShowAddForm(!showAddForm); setShowUpload(false); }}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                showAddForm
                  ? "bg-neon-dark text-white"
                  : "text-neon-dark/50 hover:text-neon-dark hover:bg-neon-dark/5 border border-neon-dark/10"
              }`}
            >
              <IconPlus />
              <span className="hidden sm:inline">Add Guest</span>
            </button>
          </div>
        )}
      </div>

      {/* File upload area */}
      {showUpload && isSuperAdmin && (
        <div className="px-4 py-4 border-b border-neon-dark/8 bg-neon-bg/30">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-neon-dark/40 bg-neon/20"
                : "border-neon-dark/15 hover:border-neon-dark/30 hover:bg-white/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="text-neon-dark/45 flex justify-center mb-2"><IconUpload /></div>
            <p className="text-sm text-neon-dark/50 font-medium">
              {uploading ? "Uploading..." : "Drop a CSV or Excel file here"}
            </p>
            <p className="text-xs text-neon-dark/50 mt-1">
              or click to browse · columns: email, linkedin_url
            </p>
          </div>
          {uploadResult && (
            <p className="text-xs text-neon-dark/60 mt-2 text-center">{uploadResult}</p>
          )}
        </div>
      )}

      {/* Add single guest form */}
      {showAddForm && isSuperAdmin && (
        <div className="px-4 py-3 border-b border-neon-dark/8 bg-neon-bg/30">
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-neon-dark/15 bg-white outline-none focus:ring-2 focus:ring-neon-dark/20"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <input
              type="url"
              value={addLinkedin}
              onChange={(e) => setAddLinkedin(e.target.value)}
              placeholder="LinkedIn URL (optional)"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-neon-dark/15 bg-white outline-none focus:ring-2 focus:ring-neon-dark/20 hidden sm:block"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !addEmail.trim()}
              className="px-4 py-2 bg-neon-dark text-white rounded-lg text-sm font-medium hover:bg-neon-dark/90 transition-colors disabled:opacity-50"
            >
              {adding ? "..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Guest list table */}
      {guests.length === 0 ? (
        <div className="p-12 text-center">
          <div className="text-neon-dark/30 flex justify-center mb-3"><IconList /></div>
          <p className="text-sm text-neon-dark/60">No guests added yet</p>
          <p className="text-xs text-neon-dark/45 mt-1">Upload a CSV or Excel file, or add guests one by one</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neon-dark/8 bg-neon-bg/50">
                <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs w-10">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-neon-dark/60 text-xs hidden sm:table-cell">LinkedIn</th>
                <th className="text-center px-4 py-2.5 font-medium text-neon-dark/60 text-xs w-24">Status</th>
                {isSuperAdmin && (
                  <th className="text-center px-4 py-2.5 font-medium text-neon-dark/60 text-xs w-12"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => {
                const isRegistered = registeredEmails.has(g.email.toLowerCase());
                return (
                  <tr key={g.email} className="border-b border-neon-dark/5 hover:bg-neon-bg/30 transition-colors group">
                    <td className="px-4 py-2.5 text-neon-dark/50 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 text-neon-dark/70 font-mono text-xs">{g.email}</td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      {g.linkedin_url ? (
                        <a
                          href={g.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neon-dark/60 hover:text-neon-dark text-xs underline decoration-neon-dark/35"
                        >
                          View profile
                        </a>
                      ) : (
                        <span className="text-neon-dark/40 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isRegistered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-neon-dark/8 text-neon-dark/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-dark/40" />
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-neon-dark/[0.03] text-neon-dark/45">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-dark/15" />
                          Pending
                        </span>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleDeleteGuest(g.email)}
                          className="text-neon-dark/0 group-hover:text-neon-dark/40 hover:!text-red-500 transition-colors p-1"
                          title="Remove guest"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 && search && guests.length > 0 && (
        <div className="p-8 text-center">
          <p className="text-sm text-neon-dark/60">No guests match &ldquo;{search}&rdquo;</p>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   Check-ins Tab
   ═══════════════════════════════════════════ */

function CheckInsTab({
  guests,
  participants,
}: {
  guests: GuestEntry[];
  participants: Participant[];
}) {
  const registeredMap = new Map<string, Participant>();
  for (const p of participants) {
    registeredMap.set(p.email.toLowerCase(), p);
  }

  const checkedInAndRegistered = guests.filter(
    (g) => g.checked_in && registeredMap.has(g.email.toLowerCase())
  );
  const checkedInNotRegistered = guests.filter(
    (g) => g.checked_in && !registeredMap.has(g.email.toLowerCase())
  );
  const notCheckedIn = guests.filter((g) => !g.checked_in);

  const totalCheckedIn = checkedInAndRegistered.length + checkedInNotRegistered.length;

  if (totalCheckedIn === 0 && notCheckedIn.length === guests.length) {
    return (
      <div className="p-12 text-center">
        <div className="text-neon-dark/30 flex justify-center mb-3"><IconCheckCircle /></div>
        <p className="text-sm text-neon-dark/60">No check-ins recorded yet</p>
        <p className="text-xs text-neon-dark/45 mt-1">Check-in status will update as guests arrive at the venue</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-3.5 border-b border-neon-dark/8 bg-neon-bg/30">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neon-dark/60" />
          <span className="text-xs text-neon-dark/60">
            <span className="font-semibold">{checkedInAndRegistered.length}</span> checked in + registered
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neon-dark/25" />
          <span className="text-xs text-neon-dark/60">
            <span className="font-semibold">{checkedInNotRegistered.length}</span> checked in, not registered
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-neon-dark/10" />
          <span className="text-xs text-neon-dark/60">
            <span className="font-semibold">{notCheckedIn.length}</span> not checked in
          </span>
        </div>
        <span className="ml-auto text-xs text-neon-dark/50">
          {totalCheckedIn} / {guests.length} attended
        </span>
      </div>

      {/* Checked in + Registered */}
      {checkedInAndRegistered.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-neon-bg/40 border-b border-neon-dark/5">
            <h4 className="text-[11px] font-semibold text-neon-dark/60 uppercase tracking-wider">
              Checked In + Registered ({checkedInAndRegistered.length})
            </h4>
          </div>
          <div className="divide-y divide-neon-dark/5">
            {checkedInAndRegistered.map((g) => {
              const p = registeredMap.get(g.email.toLowerCase());
              return (
                <div key={g.email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neon-bg/30">
                  <span className="w-2 h-2 rounded-full bg-neon-dark/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-neon-dark truncate block">{p?.name || g.email}</span>
                    {p && <span className="text-xs text-neon-dark/55 truncate block">{p.role} at {p.company}</span>}
                  </div>
                  <span className="text-xs text-neon-dark/55 truncate hidden sm:block">{g.email}</span>
                  {g.linkedin_url && (
                    <a href={g.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-neon-dark/55 hover:text-neon-dark shrink-0 underline decoration-neon-dark/30">
                      LinkedIn
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checked in but NOT registered */}
      {checkedInNotRegistered.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-neon-bg/40 border-b border-neon-dark/5 border-t border-t-neon-dark/8">
            <h4 className="text-[11px] font-semibold text-neon-dark/60 uppercase tracking-wider">
              Checked In — Did Not Register ({checkedInNotRegistered.length})
            </h4>
          </div>
          <div className="divide-y divide-neon-dark/5">
            {checkedInNotRegistered.map((g) => (
              <div key={g.email} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neon-bg/30">
                <span className="w-2 h-2 rounded-full bg-neon-dark/25 shrink-0" />
                <span className="text-sm text-neon-dark/50 truncate flex-1">{g.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not checked in */}
      {notCheckedIn.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-neon-bg/40 border-b border-neon-dark/5 border-t border-t-neon-dark/8">
            <h4 className="text-[11px] font-semibold text-neon-dark/60 uppercase tracking-wider">
              Not Checked In ({notCheckedIn.length})
            </h4>
          </div>
          <div className="divide-y divide-neon-dark/5">
            {notCheckedIn.map((g) => (
              <div key={g.email} className="flex items-center gap-3 px-4 py-2.5 opacity-40">
                <span className="w-2 h-2 rounded-full bg-neon-dark/10 shrink-0" />
                <span className="text-sm text-neon-dark/50 truncate flex-1">{g.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   MatchUp Tab
   ═══════════════════════════════════════════ */

function MatchesTab({
  matches,
  participants,
}: {
  matches: MatchEntry[];
  participants: Participant[];
}) {
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (matches.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-neon-dark/30 flex justify-center mb-3"><IconLink /></div>
        <p className="text-sm text-neon-dark/60">No MatchUps computed yet</p>
        <p className="text-xs text-neon-dark/45 mt-1">Go to Email Controls tab to run the MatchUp algorithm</p>
      </div>
    );
  }

  const pMap = new Map<string, Participant>();
  for (const p of participants) {
    pMap.set(p.email, p);
  }

  const grouped = new Map<string, MatchEntry[]>();
  for (const m of matches) {
    const existing = grouped.get(m.profile_email) || [];
    existing.push(m);
    grouped.set(m.profile_email, existing);
  }

  let uniqueProfiles = Array.from(grouped.keys());

  if (search) {
    const q = search.toLowerCase();
    uniqueProfiles = uniqueProfiles.filter((email) => {
      const p = pMap.get(email);
      return (
        email.toLowerCase().includes(q) ||
        p?.name.toLowerCase().includes(q) ||
        p?.company.toLowerCase().includes(q)
      );
    });
  }

  return (
    <div>
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search matched people..."
        count={uniqueProfiles.length}
        total={grouped.size}
      />

      {/* Summary */}
      <div className="px-4 py-3 border-b border-neon-dark/8 bg-neon-bg/30 flex items-center justify-between">
        <span className="text-xs text-neon-dark/60">
          {grouped.size} people matched · {matches.length} total connections
        </span>
      </div>

      <div className="divide-y divide-neon-dark/5">
        {uniqueProfiles.map((profileEmail) => {
          const profileMatches = grouped.get(profileEmail) || [];
          const person = pMap.get(profileEmail);
          const isExpanded = expandedEmail === profileEmail;

          return (
            <div key={profileEmail}>
              <button
                onClick={() => setExpandedEmail(isExpanded ? null : profileEmail)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neon-bg/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-neon-dark/8 text-neon-dark/50 flex items-center justify-center text-xs font-bold shrink-0">
                  {person?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-neon-dark truncate">
                      {person?.name || profileEmail}
                    </span>
                    <span className="text-[11px] text-neon-dark/50 shrink-0">
                      {profileMatches.length} matches
                    </span>
                  </div>
                  {person && (
                    <p className="text-xs text-neon-dark/60 truncate">
                      {person.role} at {person.company}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {person?.looking_for?.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-dark/5 text-neon-dark/60 hidden sm:inline">{tag}</span>
                  ))}
                  <span className="text-neon-dark/40 ml-1"><IconChevron open={isExpanded} /></span>
                </div>
              </button>

              {isExpanded && (
                <div className="bg-neon-bg/30 px-4 pb-4">
                  <div className="grid gap-2">
                    {profileMatches.map((m) => {
                      const matchPerson = pMap.get(m.match_email);
                      return (
                        <div
                          key={`${m.profile_email}-${m.match_rank}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white border border-neon-dark/5"
                        >
                          <div className="w-6 h-6 rounded-full bg-neon-dark text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {m.match_rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-neon-dark truncate">
                                {matchPerson?.name || m.match_email}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-dark/5 text-neon-dark/60 font-mono shrink-0">
                                {m.score} pts
                              </span>
                            </div>
                            {matchPerson && (
                              <p className="text-xs text-neon-dark/60 truncate">
                                {matchPerson.role} at {matchPerson.company}
                              </p>
                            )}
                            {matchPerson?.can_offer && matchPerson.can_offer.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {matchPerson.can_offer.map((tag) => (
                                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-dark/5 text-neon-dark/50">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {m.linkedin_url && (
                            <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-neon-dark/55 hover:text-neon-dark shrink-0 underline decoration-neon-dark/30">
                              LinkedIn
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {uniqueProfiles.length === 0 && search && (
        <div className="p-8 text-center">
          <p className="text-sm text-neon-dark/60">No results for &ldquo;{search}&rdquo;</p>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════
   Email Controls Tab
   ═══════════════════════════════════════════ */

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
  const matchesExist = matches.length > 0;
  const uniqueRecipients = new Set(matches.map((m) => m.profile_email)).size;

  return (
    <div className="divide-y divide-neon-dark/8">
      {/* Step 1: Run MatchUp */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold shrink-0 mt-0.5 ${
            matchesExist ? "bg-neon-dark/10 text-neon-dark/60" : "bg-neon-dark text-white"
          }`}>
            {matchesExist ? "✓" : "1"}
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neon-dark">Run MatchUp</h3>
            {matchesExist ? (
              <p className="text-xs text-neon-dark/60 mt-0.5">
                {matches.length} MatchUps computed for {uniqueRecipients} participants
              </p>
            ) : (
              <>
                <p className="text-xs text-neon-dark/60 mt-0.5 mb-3">
                  Run the MatchUp algorithm on {participants.length} registered participants.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleComputeMatches}
                    disabled={computing || participants.length < 2}
                    className="px-4 py-2 bg-neon-dark text-white rounded-lg text-sm font-medium hover:bg-neon-dark/90 transition-colors disabled:opacity-50"
                  >
                    {computing ? "Computing..." : "Run MatchUp"}
                  </button>
                  {computeResult && (
                    <p className="text-xs text-neon-dark/50">{computeResult}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Step 2: Preview */}
      <div className={`p-5 ${!matchesExist ? "opacity-35 pointer-events-none" : ""}`}>
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 flex items-center justify-center bg-neon-dark text-white rounded-full text-xs font-bold shrink-0 mt-0.5">2</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neon-dark">Preview Recipients</h3>
            <p className="text-xs text-neon-dark/60 mt-0.5 mb-3">
              See who will receive emails and how many matches each person has. No emails are sent.
            </p>
            <button
              onClick={handleDryRun}
              disabled={sendingDryRun || !matchesExist}
              className="px-4 py-2 bg-neon-dark/5 text-neon-dark/70 border border-neon-dark/10 rounded-lg text-sm font-medium hover:bg-neon-dark/8 transition-colors disabled:opacity-50"
            >
              {sendingDryRun ? "Loading..." : "Preview List"}
            </button>
            {dryRunResult && (
              <pre className="mt-3 text-xs text-neon-dark/50 bg-neon-bg rounded-lg p-3 whitespace-pre-wrap font-mono border border-neon-dark/5">
                {dryRunResult}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Test Send */}
      <div className={`p-5 ${!matchesExist ? "opacity-35 pointer-events-none" : ""}`}>
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 flex items-center justify-center bg-neon-dark text-white rounded-full text-xs font-bold shrink-0 mt-0.5">3</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neon-dark">Send Test Email</h3>
            <p className="text-xs text-neon-dark/60 mt-0.5 mb-3">
              Send a real email to ONE person to verify it looks right on mobile and desktop.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="rohan@neon.fund"
                className="px-3 py-2 rounded-lg border border-neon-dark/15 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neon-dark/20 bg-white"
              />
              <button
                onClick={handleSendTestEmail}
                disabled={sendingTest || !testEmail || !matchesExist}
                className="px-4 py-2 bg-neon-dark/5 text-neon-dark/70 border border-neon-dark/10 rounded-lg text-sm font-medium hover:bg-neon-dark/8 transition-colors disabled:opacity-50"
              >
                {sendingTest ? "Sending..." : "Send Test"}
              </button>
            </div>
            {testResult && (
              <p className="mt-2 text-xs text-neon-dark/50">{testResult}</p>
            )}
          </div>
        </div>
      </div>

      {/* Step 4: Batch Send */}
      <div className="p-5 bg-neon-dark/[0.02]">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 flex items-center justify-center bg-neon-dark text-white rounded-full text-xs font-bold shrink-0 mt-0.5">4</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neon-dark">Send to All Participants</h3>
            <p className="text-xs text-neon-dark/60 mt-0.5 mb-3">
              This will send MatchUp results to ALL registered participants. Two confirmation dialogs will appear.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBatchSend}
                disabled={sendingEmails || matches.length === 0}
                className="px-4 py-2 bg-neon-dark text-[#e8ff79] rounded-lg text-sm font-semibold hover:bg-black transition-colors disabled:opacity-50"
              >
                {sendingEmails
                  ? "Sending..."
                  : `Send to All (${new Set(matches.map((m) => m.profile_email)).size} people)`}
              </button>
              {sendResult && (
                <p className="text-xs text-neon-dark/50">{sendResult}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   Charts
   ═══════════════════════════════════════════ */

function DemandSupplyChart({ participants }: { participants: Participant[] }) {
  const categories = ["Investor", "Co-founder", "Customers", "Talent", "Peers", "Capital", "Startups"];
  const lookingFor: Record<string, number> = {};
  const canOffer: Record<string, number> = {};

  for (const p of participants) {
    for (const item of p.looking_for || []) {
      lookingFor[item] = (lookingFor[item] || 0) + 1;
    }
    for (const item of p.can_offer || []) {
      canOffer[item] = (canOffer[item] || 0) + 1;
    }
  }

  const activeCategories = categories.filter(
    (c) => (lookingFor[c] || 0) > 0 || (canOffer[c] || 0) > 0
  );
  const maxVal = Math.max(
    ...activeCategories.map((c) => Math.max(lookingFor[c] || 0, canOffer[c] || 0)),
    1
  );

  return (
    <div className="bg-white rounded-xl border border-neon-dark/8 p-5">
      <h3 className="text-[11px] font-semibold text-neon-dark/65 uppercase tracking-wider mb-1">
        Demand vs Supply
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-neon-dark" />
          <span className="text-xs text-neon-dark/50">Looking for</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-neon-dark/30" />
          <span className="text-xs text-neon-dark/50">Can offer</span>
        </div>
      </div>
      <div className="space-y-4">
        {activeCategories.map((cat) => {
          const demand = lookingFor[cat] || 0;
          const supply = canOffer[cat] || 0;
          const gap = demand - supply;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-neon-dark">{cat}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neon-dark/50">{demand} / {supply}</span>
                  {gap !== 0 && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      gap > 0
                        ? "bg-neon-dark/10 text-neon-dark/70"
                        : "bg-[#e8ff79]/30 text-neon-dark/50"
                    }`}>
                      {gap > 0 ? `+${gap} gap` : `${Math.abs(gap)} surplus`}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="w-full h-3 bg-neon-dark/5 rounded overflow-hidden">
                  <div className="h-full bg-neon-dark rounded" style={{ width: `${(demand / maxVal) * 100}%` }} />
                </div>
                <div className="w-full h-3 bg-neon-dark/5 rounded overflow-hidden">
                  <div className="h-full bg-neon-dark/30 rounded" style={{ width: `${(supply / maxVal) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoleBreakdown({ participants }: { participants: Participant[] }) {
  const roleMap = new Map<string, number>();
  for (const p of participants) {
    const role = p.role?.trim() || "Unknown";
    roleMap.set(role, (roleMap.get(role) || 0) + 1);
  }

  const roles = Array.from(roleMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const total = participants.length;
  const maxCount = Math.max(...roles.map(([, c]) => c), 1);

  return (
    <div className="bg-white rounded-xl border border-neon-dark/8 p-5">
      <h3 className="text-[11px] font-semibold text-neon-dark/65 uppercase tracking-wider mb-4">
        Roles
      </h3>
      <div className="space-y-3">
        {roles.map(([role, count]) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={role} className="flex items-center gap-3">
              <span className="text-xs font-medium text-neon-dark w-28 truncate flex-shrink-0">{role}</span>
              <div className="flex-1 h-3 bg-neon-dark/5 rounded overflow-hidden">
                <div className="h-full bg-neon-dark rounded" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="text-xs text-neon-dark/60 flex-shrink-0 w-14 text-right">
                {count} <span className="text-neon-dark/45">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
