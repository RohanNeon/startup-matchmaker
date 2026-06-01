"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
  looking_for: string[];
  can_offer: string[];
  event_id: string | null;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<EventStat[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [{ data: eventsData }, { data: profilesData }] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("profiles").select("email, name, company, role, looking_for, can_offer, event_id"),
    ]);

    const evts: EventStat[] = [];
    if (eventsData) {
      for (const ev of eventsData) {
        const isLegacy = ev.slug === "agentic-infra-2026";
        const guestQ = isLegacy
          ? supabase.from("luma_list").select("*", { count: "exact", head: true }).is("event_id", null)
          : supabase.from("luma_list").select("*", { count: "exact", head: true }).eq("event_id", ev.id);
        const profQ = isLegacy
          ? supabase.from("profiles").select("*", { count: "exact", head: true }).is("event_id", null)
          : supabase.from("profiles").select("*", { count: "exact", head: true }).eq("event_id", ev.id);
        const matchQ = isLegacy
          ? supabase.from("matches").select("*", { count: "exact", head: true }).is("event_id", null)
          : supabase.from("matches").select("*", { count: "exact", head: true }).eq("event_id", ev.id);

        const [{ count: g }, { count: p }, { count: m }] = await Promise.all([guestQ, profQ, matchQ]);
        evts.push({ ...ev, guestCount: g || 0, profileCount: p || 0, matchCount: m || 0 });
      }
    }

    setEvents(evts);
    setProfiles((profilesData as ProfileRow[]) || []);
    setLoading(false);
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

  // Repeat attendees
  const emailEventMap = new Map<string, Set<string>>();
  for (const p of profiles) {
    const key = p.event_id || "legacy";
    if (!emailEventMap.has(p.email)) emailEventMap.set(p.email, new Set());
    emailEventMap.get(p.email)!.add(key);
  }
  const repeatEmails = Array.from(emailEventMap.entries()).filter(([, s]) => s.size > 1).map(([e]) => e);

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

  // Company breakdown
  const companyMap = new Map<string, number>();
  for (const p of profiles) {
    const company = p.company?.trim() || "Unknown";
    companyMap.set(company, (companyMap.get(company) || 0) + 1);
  }
  const companies = Array.from(companyMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Dashboard</h1>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatBox label="Total Events" value={events.length} />
        <StatBox label="Active" value={events.filter((e) => e.is_active).length} accent />
        <StatBox label="Total Guests" value={totalGuests} />
        <StatBox label="Registered" value={totalRegistered} accent />
        <StatBox label="MatchUps" value={totalMatches} />
        <StatBox label="Avg Conversion" value={`${avgConversion}%`} />
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

        {/* Repeat attendees */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider">Repeat Attendees</h3>
            <span className="text-lg font-bold text-[#1d3d0f]">{repeatEmails.length}</span>
          </div>
          <p className="text-xs text-[#1d3d0f]/60 mb-3">People who registered for more than one event</p>
          {repeatEmails.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {repeatEmails.map((email) => (
                <div key={email} className="flex items-center gap-2 text-xs text-[#1d3d0f]/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e8ff79] flex-shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#1d3d0f]/50 italic">No repeat attendees yet</p>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Demand vs Supply */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-1">Demand vs Supply (All Events)</h3>
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
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">Roles (All Events)</h3>
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

        {/* Top Companies */}
        <div className="bg-[#fdfff0] rounded-xl border border-[#1d3d0f]/8 p-5">
          <h3 className="text-xs font-semibold text-[#1d3d0f]/50 uppercase tracking-wider mb-4">Top Companies</h3>
          <div className="space-y-2">
            {companies.map(([company, count]) => (
              <div key={company} className="flex items-center justify-between py-1 border-b border-[#1d3d0f]/5 last:border-0">
                <span className="text-xs text-[#1d3d0f] truncate mr-2">{company}</span>
                <span className="text-[10px] font-semibold text-[#1d3d0f]/60 flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-[#e8ff79]/30 border-[#e8ff79]/50" : "bg-[#fdfff0] border-[#1d3d0f]/8"}`}>
      <p className="text-2xl font-bold text-[#000000] leading-none">{value}</p>
      <p className="text-[10px] text-[#1d3d0f]/60 mt-1.5">{label}</p>
    </div>
  );
}
