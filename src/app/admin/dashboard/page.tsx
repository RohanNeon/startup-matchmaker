"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface EventStat {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  is_active: boolean;
  guestCount: number;
  profileCount: number;
  matchCount: number;
}

interface ProfileRow {
  email: string;
  name: string;
  company: string;
  role: string;
  what_building: string | null;
  looking_for: string[];
  can_offer: string[];
  event_id: string | null;
}

// Auto-extract sectors from what_building text
const SECTOR_KEYWORDS: Record<string, string[]> = {
  "AI / ML": ["ai", "artificial intelligence", "machine learning", "deep learning", "llm", "genai", "gen ai", "gpt", "nlp", "computer vision", "agentic"],
  "SaaS": ["saas", "software as a service", "b2b saas", "b2c saas"],
  "Fintech": ["fintech", "financial", "banking", "payments", "lending", "insurance", "neobank", "defi"],
  "DevTools": ["devtools", "developer tools", "developer platform", "api", "sdk", "infrastructure", "infra", "devops", "cicd"],
  "Cybersecurity": ["cybersecurity", "cyber security", "security", "infosec", "soc", "siem", "threat"],
  "HealthTech": ["healthtech", "health tech", "healthcare", "biotech", "medtech", "telemedicine"],
  "EdTech": ["edtech", "education", "learning", "e-learning", "elearning"],
  "E-Commerce": ["ecommerce", "e-commerce", "commerce", "marketplace", "d2c", "retail"],
  "Web3 / Crypto": ["web3", "blockchain", "crypto", "defi", "nft", "dao", "decentralized"],
  "Hardware": ["hardware", "robotics", "iot", "embedded", "chip", "semiconductor"],
  "MarTech": ["martech", "marketing tech", "marketing automation", "adtech", "advertising"],
  "Data / Analytics": ["data analytics", "data science", "analytics", "big data", "data platform"],
  "Climate / Energy": ["climate", "cleantech", "sustainability", "energy", "ev", "carbon"],
};

function extractSectors(text: string | null): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(sector);
    }
  }
  return matched.length > 0 ? matched : ["Other"];
}

interface EventIdea {
  id: string;
  text: string;
  added_by: string;
  created_at: string;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<EventStat[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Sector overrides (profile email → sector)
  const [sectorOverrides, setSectorOverrides] = useState<Record<string, string>>({});
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [newSectorValue, setNewSectorValue] = useState("");

  // Event ideas
  const [ideas, setIdeas] = useState<EventIdea[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [addingIdea, setAddingIdea] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: eventsData }, { data: profilesData }, { data: ideasData }] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("profiles").select("email, name, company, role, what_building, looking_for, can_offer, event_id"),
      supabase.from("event_ideas").select("*").order("created_at", { ascending: false }),
    ]);

    const evts: EventStat[] = [];
    if (eventsData) {
      for (const ev of eventsData) {
        const isLegacy = ev.slug === "agentic-infra-2026";
        const [{ count: g }, { count: p }, { count: m }] = await Promise.all([
          isLegacy
            ? supabase.from("luma_list").select("*", { count: "exact", head: true }).is("event_id", null)
            : supabase.from("luma_list").select("*", { count: "exact", head: true }).eq("event_id", ev.id),
          isLegacy
            ? supabase.from("profiles").select("*", { count: "exact", head: true }).is("event_id", null)
            : supabase.from("profiles").select("*", { count: "exact", head: true }).eq("event_id", ev.id),
          isLegacy
            ? supabase.from("matches").select("*", { count: "exact", head: true }).is("event_id", null)
            : supabase.from("matches").select("*", { count: "exact", head: true }).eq("event_id", ev.id),
        ]);
        evts.push({ ...ev, guestCount: g || 0, profileCount: p || 0, matchCount: m || 0 });
      }
    }

    setEvents(evts);
    setProfiles((profilesData as ProfileRow[]) || []);
    setIdeas((ideasData as EventIdea[]) || []);
    setLoading(false);
  }

  async function handleAddIdea() {
    if (!newIdea.trim()) return;
    setAddingIdea(true);
    const { data } = await supabase.from("event_ideas").insert([{
      text: newIdea.trim(),
      added_by: "admin",
    }]).select().single();
    if (data) {
      setIdeas([data as EventIdea, ...ideas]);
      setNewIdea("");
    }
    setAddingIdea(false);
  }

  async function handleDeleteIdea(id: string) {
    await supabase.from("event_ideas").delete().eq("id", id);
    setIdeas(ideas.filter((i) => i.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="neon-loader" />
      </div>
    );
  }

  const totalGuests = events.reduce((s, e) => s + e.guestCount, 0);
  const totalRegistered = events.reduce((s, e) => s + e.profileCount, 0);
  const totalMatches = events.reduce((s, e) => s + e.matchCount, 0);
  const avgConversion = totalGuests > 0 ? Math.round((totalRegistered / totalGuests) * 100) : 0;

  // Unique attendees (deduplicated by email across events)
  const uniqueEmails = new Set(profiles.map((p) => p.email.toLowerCase()));

  // Looking for / can offer aggregates
  const lookingFor: Record<string, number> = {};
  const canOffer: Record<string, number> = {};
  for (const p of profiles) {
    for (const tag of p.looking_for || []) lookingFor[tag] = (lookingFor[tag] || 0) + 1;
    for (const tag of p.can_offer || []) canOffer[tag] = (canOffer[tag] || 0) + 1;
  }
  const allCategories = [...new Set([...Object.keys(lookingFor), ...Object.keys(canOffer)])];

  // Role breakdown
  const roleMap = new Map<string, number>();
  for (const p of profiles) {
    const role = p.role?.trim() || "Unknown";
    roleMap.set(role, (roleMap.get(role) || 0) + 1);
  }
  const roles = Array.from(roleMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const maxRole = Math.max(...roles.map(([, c]) => c), 1);

  // Sector breakdown (auto-extracted + overrides)
  const sectorMap = new Map<string, number>();
  for (const p of profiles) {
    const override = sectorOverrides[p.email];
    const sectors = override ? [override] : extractSectors(p.what_building);
    for (const s of sectors) {
      sectorMap.set(s, (sectorMap.get(s) || 0) + 1);
    }
  }
  const sectors = Array.from(sectorMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxSector = Math.max(...sectors.map(([, c]) => c), 1);

  // All known sector names (for the dropdown)
  const allSectorNames = [...new Set([...Object.keys(SECTOR_KEYWORDS), ...sectors.map(([s]) => s)])].sort();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Dashboard</h1>
      </div>

      {/* Top metrics with tooltips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
        <StatBox label="Events" value={events.length} hint="Total events created" />
        <StatBox label="Active" value={events.filter((e) => e.is_active).length} accent hint="Events currently accepting registrations" />
        <StatBox label="Guests" value={totalGuests} hint="Total invited across all events" />
        <StatBox label="Registered" value={totalRegistered} accent hint="Total form submissions across all events" />
        <StatBox label="Unique" value={uniqueEmails.size} hint="Unique people (deduplicated across events)" />
        <StatBox label="MatchUps" value={totalMatches} hint="Total match connections generated" />
        <StatBox label="Conversion" value={`${avgConversion}%`} hint="Average guest-to-registration rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Per-event breakdown */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">
            Event Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1d3d0f]/8">
                  <th className="text-left py-2 text-xs font-medium text-[#1d3d0f]/60">Event</th>
                  <th className="text-right py-2 text-xs font-medium text-[#1d3d0f]/60 px-2">Guests</th>
                  <th className="text-right py-2 text-xs font-medium text-[#1d3d0f]/60 px-2">Reg.</th>
                  <th className="text-right py-2 text-xs font-medium text-[#1d3d0f]/60 px-2">Matches</th>
                  <th className="text-right py-2 text-xs font-medium text-[#1d3d0f]/60 px-2">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const pct = ev.guestCount > 0 ? Math.round((ev.profileCount / ev.guestCount) * 100) : 0;
                  return (
                    <tr key={ev.id} className="border-b border-[#1d3d0f]/5">
                      <td className="py-2.5">
                        <Link href={`/admin/event/${ev.slug}`} className="text-sm font-medium text-[#1d3d0f] hover:underline">
                          {ev.name}
                        </Link>
                        <p className="text-[10px] text-[#1d3d0f]/45">
                          {ev.event_date ? new Date(ev.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBD"}
                          {ev.location && ` · ${ev.location}`}
                        </p>
                      </td>
                      <td className="text-right text-sm text-[#1d3d0f]/70 px-2">{ev.guestCount}</td>
                      <td className="text-right text-sm font-semibold text-[#1d3d0f] px-2">{ev.profileCount}</td>
                      <td className="text-right text-sm text-[#1d3d0f]/70 px-2">{ev.matchCount}</td>
                      <td className="text-right px-2">
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#e8ff79]/40 text-[#1d3d0f]">{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Event Ideas */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">
            Event Ideas
          </h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Add an event idea..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#1d3d0f]/10 bg-white outline-none focus:ring-1 focus:ring-[#1d3d0f]/20 placeholder:text-[#1d3d0f]/35"
              onKeyDown={(e) => e.key === "Enter" && handleAddIdea()}
            />
            <button
              onClick={handleAddIdea}
              disabled={addingIdea || !newIdea.trim()}
              className="px-3 py-2 bg-[#1d3d0f] text-white rounded-lg text-sm font-medium hover:bg-black transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {ideas.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ideas.map((idea) => (
                <div key={idea.id} className="flex items-start gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e8ff79] flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1d3d0f]/80">{idea.text}</p>
                    <p className="text-[9px] text-[#1d3d0f]/35 mt-0.5">
                      {new Date(idea.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteIdea(idea.id)}
                    className="p-0.5 text-[#1d3d0f]/0 group-hover:text-[#1d3d0f]/30 hover:!text-red-500 transition-colors flex-shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#1d3d0f]/40 italic">No ideas yet. Add one above.</p>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Demand vs Supply */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-1">Demand vs Supply</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1d3d0f]" /><span className="text-[10px] text-[#1d3d0f]/50">Looking for</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1d3d0f]/30" /><span className="text-[10px] text-[#1d3d0f]/50">Can offer</span></div>
          </div>
          <div className="space-y-3">
            {allCategories.map((cat) => {
              const d = lookingFor[cat] || 0;
              const s = canOffer[cat] || 0;
              const max = Math.max(d, s, 1);
              return (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-[#1d3d0f]">{cat}</span>
                    <span className="text-[10px] text-[#1d3d0f]/50">{d} / {s}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 bg-[#1d3d0f]/5 rounded overflow-hidden"><div className="h-full bg-[#1d3d0f] rounded" style={{ width: `${(d / max) * 100}%` }} /></div>
                    <div className="h-2.5 bg-[#1d3d0f]/5 rounded overflow-hidden"><div className="h-full bg-[#1d3d0f]/30 rounded" style={{ width: `${(s / max) * 100}%` }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Roles */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">Roles</h3>
          <div className="space-y-2.5">
            {roles.map(([role, count]) => (
              <div key={role} className="flex items-center gap-3">
                <span className="text-[11px] text-[#1d3d0f] w-24 truncate flex-shrink-0">{role}</span>
                <div className="flex-1 h-2.5 bg-[#1d3d0f]/5 rounded overflow-hidden">
                  <div className="h-full bg-[#1d3d0f] rounded" style={{ width: `${(count / maxRole) * 100}%` }} />
                </div>
                <span className="text-[10px] text-[#1d3d0f]/50 w-6 text-right flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sectors */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-1">Sectors</h3>
          <p className="text-[9px] text-[#1d3d0f]/35 mb-4">Auto-detected from &ldquo;What are you building?&rdquo; — click to edit</p>
          <div className="space-y-2">
            {sectors.map(([sector, count]) => (
              <div key={sector} className="group">
                {editingSector === sector ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={newSectorValue}
                      onChange={(e) => setNewSectorValue(e.target.value)}
                      className="flex-1 text-xs px-2 py-1 rounded border border-[#1d3d0f]/15 bg-white outline-none"
                    >
                      {allSectorNames.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newSectorValue}
                      onChange={(e) => setNewSectorValue(e.target.value)}
                      placeholder="Or type new..."
                      className="flex-1 text-xs px-2 py-1 rounded border border-[#1d3d0f]/15 bg-white outline-none"
                    />
                    <button
                      onClick={() => {
                        // Apply override to all profiles that had this sector
                        const newOverrides = { ...sectorOverrides };
                        for (const p of profiles) {
                          const current = sectorOverrides[p.email] || extractSectors(p.what_building)[0] || "Other";
                          if (current === sector) {
                            newOverrides[p.email] = newSectorValue || sector;
                          }
                        }
                        setSectorOverrides(newOverrides);
                        setEditingSector(null);
                      }}
                      className="text-[10px] px-2 py-1 bg-[#1d3d0f] text-white rounded"
                    >
                      Apply
                    </button>
                    <button onClick={() => setEditingSector(null)} className="text-[10px] text-[#1d3d0f]/40 px-1">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setEditingSector(sector); setNewSectorValue(sector); }}
                      className="text-[11px] text-[#1d3d0f] w-28 truncate flex-shrink-0 text-left hover:underline"
                      title="Click to edit sector"
                    >
                      {sector}
                    </button>
                    <div className="flex-1 h-2.5 bg-[#1d3d0f]/5 rounded overflow-hidden">
                      <div className="h-full bg-[#1d3d0f] rounded" style={{ width: `${(count / maxSector) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-[#1d3d0f]/50 w-6 text-right flex-shrink-0">{count}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, hint }: { label: string; value: number | string; accent?: boolean; hint?: string }) {
  return (
    <div className={`rounded-xl border p-4 relative group ${accent ? "bg-[#e8ff79]/30 border-[#e8ff79]/50" : "bg-[#fdfff0] border-[#1d3d0f]/8"}`}>
      <p className="text-2xl font-bold text-[#000000] leading-none">{value}</p>
      <p className="text-[10px] text-[#1d3d0f]/60 mt-1.5">{label}</p>
      {hint && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#1d3d0f] text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {hint}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1d3d0f]" />
        </div>
      )}
    </div>
  );
}
