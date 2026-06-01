"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "../layout";

interface EventRow {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  location: string | null;
  image_url: string | null;
  luma_url: string | null;
  is_active: boolean;
  created_at: string;
  guestCount: number;
  profileCount: number;
  matchCount: number;
}

export default function EventsPage() {
  const adminUser = useAdminUser();
  const isSuperAdmin = adminUser?.role === "super_admin";
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
    if (!data) { setLoading(false); return; }

    const evts: EventRow[] = [];
    for (const ev of data) {
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
    setEvents(evts);
    setLoading(false);
  }

  const filtered = events.filter((ev) => {
    if (filter === "active" && !ev.is_active) return false;
    if (filter === "closed" && ev.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      return ev.name.toLowerCase().includes(q) || ev.slug.toLowerCase().includes(q) || (ev.location?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="neon-loader" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Events</h1>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Link href="/admin" className="px-4 py-2 bg-[#1d3d0f] text-[#e8ff79] rounded-lg text-sm font-semibold hover:bg-[#000000] transition-colors">
              + New Event
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-[#fdfff0] rounded-lg border border-[#1d3d0f]/8 px-3 py-2">
          <svg className="w-4 h-4 text-[#1d3d0f]/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#1d3d0f]/40 text-[#1d3d0f]"
          />
        </div>
        <div className="flex rounded-lg border border-[#1d3d0f]/8 overflow-hidden">
          {(["all", "active", "closed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filter === f ? "bg-[#1d3d0f] text-white" : "bg-[#fdfff0] text-[#1d3d0f]/60 hover:text-[#1d3d0f]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Events table */}
      <div className="bg-white rounded-xl border border-[#1d3d0f]/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1d3d0f]/8 bg-[#fdfff0]/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-[#1d3d0f]/60">Event</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-[#1d3d0f]/60 hidden md:table-cell">Date</th>
              <th className="text-left px-3 py-3 text-xs font-medium text-[#1d3d0f]/60 hidden lg:table-cell">Location</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-[#1d3d0f]/60">Guests</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-[#1d3d0f]/60">Reg.</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-[#1d3d0f]/60 hidden sm:table-cell">Matches</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-[#1d3d0f]/60">Conv.</th>
              <th className="text-center px-3 py-3 text-xs font-medium text-[#1d3d0f]/60">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => {
              const pct = ev.guestCount > 0 ? Math.round((ev.profileCount / ev.guestCount) * 100) : 0;
              return (
                <tr key={ev.id} className="border-b border-[#1d3d0f]/5 hover:bg-[#fdfff0]/50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/event/${ev.slug}`} className="flex items-center gap-3">
                      {ev.image_url && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#1d3d0f]/8 flex-shrink-0 hidden sm:block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ev.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-[#1d3d0f] group-hover:text-[#000000] transition-colors block truncate">{ev.name}</span>
                        {ev.luma_url && (
                          <span className="text-[10px] text-[#1d3d0f]/40 flex items-center gap-1 mt-0.5">
                            <Image src="/luma-logo.png" alt="" width={9} height={9} />
                            Luma
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-[#1d3d0f]/60 hidden md:table-cell">
                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "TBD"}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-[#1d3d0f]/60 hidden lg:table-cell">{ev.location || "—"}</td>
                  <td className="px-3 py-3.5 text-center text-sm text-[#1d3d0f]/70">{ev.guestCount}</td>
                  <td className="px-3 py-3.5 text-center text-sm font-semibold text-[#1d3d0f]">{ev.profileCount}</td>
                  <td className="px-3 py-3.5 text-center text-sm text-[#1d3d0f]/70 hidden sm:table-cell">{ev.matchCount}</td>
                  <td className="px-3 py-3.5 text-center">
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[#e8ff79]/40 text-[#1d3d0f]">{pct}%</span>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      ev.is_active ? "bg-[#e8ff79]/40 text-[#1d3d0f]" : "bg-[#1d3d0f]/5 text-[#1d3d0f]/50"
                    }`}>
                      {ev.is_active ? "Active" : "Closed"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-[#1d3d0f]/50">{search ? `No events match "${search}"` : "No events"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
